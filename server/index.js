import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import Stripe from 'stripe';

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173';

const FREE_DAILY_LIMITS = { translate: 15, speak: 30 };
const DAY_MS = 24 * 60 * 60 * 1000;
const SUBSCRIPTION_CACHE_MS = 5 * 60 * 1000;

// In-memory only — resets on server restart. Acceptable tradeoff for a
// hobby-scale app; see README/task notes for the reasoning.
const usageByKey = new Map();
const subscriptionCache = new Map();

function checkFreeLimit(ip, action) {
  const key = `${ip}:${action}`;
  const now = Date.now();
  const entry = usageByKey.get(key);
  if (!entry || now > entry.resetAt) {
    usageByKey.set(key, { count: 1, resetAt: now + DAY_MS });
    return true;
  }
  if (entry.count >= FREE_DAILY_LIMITS[action]) return false;
  entry.count += 1;
  return true;
}

async function isActiveSubscription(accessCode) {
  if (!accessCode || !stripe) return false;
  const cached = subscriptionCache.get(accessCode);
  if (cached && Date.now() - cached.checkedAt < SUBSCRIPTION_CACHE_MS) {
    return cached.active;
  }
  try {
    const subscription = await stripe.subscriptions.retrieve(accessCode);
    const active = subscription.status === 'active' || subscription.status === 'trialing';
    subscriptionCache.set(accessCode, { active, checkedAt: Date.now() });
    return active;
  } catch {
    subscriptionCache.set(accessCode, { active: false, checkedAt: Date.now() });
    return false;
  }
}

function enforceUsageLimit(action) {
  return async (req, res, next) => {
    const accessCode = req.get('x-access-code');
    if (await isActiveSubscription(accessCode)) {
      req.isPro = true;
      return next();
    }
    req.isPro = false;
    if (checkFreeLimit(req.ip, action)) {
      return next();
    }
    res.status(429).json({
      error: 'Free daily limit reached. Upgrade to Pro for unlimited translations.',
      limitReached: true,
    });
  };
}

const EN_TO_HY_PROMPT = `You are an expert English-to-Armenian (Eastern Armenian) translator and grammar checker.

Translate the user's English text into natural, grammatically correct Eastern Armenian, using the Armenian script (not transliteration).

Rules:
- Produce natural, everyday Armenian a native speaker would actually use, not a stiff literal translation.
- Apply correct Armenian case, verb conjugation, and word order — do not just substitute words one-for-one from English.
- If the English input is ambiguous (e.g. missing context needed to pick a verb form or pronoun), choose the most common/neutral interpretation.
- Respond in EXACTLY this format, with no extra commentary before, after, or between sections:
[ARMENIAN]
<translated text in Armenian script>
[TRANSLITERATION]
<latin-script phonetic transliteration of the Armenian>
[NOTES]
<optional short note on any grammar choice worth flagging, or leave this section blank>`;

const HY_TO_EN_PROMPT = `You are an expert Armenian (Eastern Armenian)-to-English translator.

Translate the user's Armenian text (given in Armenian script) into natural, fluent English.

Rules:
- Produce natural English a native speaker would actually use, not a stiff literal translation.
- If the Armenian input is ambiguous, choose the most common/neutral interpretation.
- Respond in EXACTLY this format, with no extra commentary before, after, or between sections:
[ARMENIAN]
<translated text in English>
[TRANSLITERATION]
<latin-script phonetic transliteration of the ORIGINAL Armenian input>
[NOTES]
<optional short note worth flagging, or leave this section blank>`;

app.post('/api/translate', enforceUsageLimit('translate'), async (req, res) => {
  const { text, direction } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }

  const systemPrompt = direction === 'hy-en' ? HY_TO_EN_PROMPT : EN_TO_HY_PROMPT;

  // Server-Sent Events — Cloudflare (and proxies generally) recognize this
  // content type and pass it through unbuffered/uncompressed, unlike a plain
  // chunked text/plain response, which gets held until complete.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(': connected\n\n');

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    });

    stream.on('text', (delta) => {
      res.write(`data: ${JSON.stringify(delta)}\n\n`);
    });

    await stream.finalMessage();
    res.write('event: done\ndata: {}\n\n');
    res.end();
  } catch (err) {
    console.error('translate error', err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Translation request failed' });
    } else {
      res.write('event: error\ndata: {}\n\n');
      res.end();
    }
  }
});

app.post('/api/speak', enforceUsageLimit('speak'), async (req, res) => {
  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    return res.status(500).json({ error: 'Server is missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION' });
  }

  const ssml = `<speak version="1.0" xml:lang="hy-AM"><voice name="hy-AM-AnahitNeural">${escapeXml(text)}</voice></speak>`;

  try {
    const ttsRes = await fetch(
      `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        },
        body: ssml,
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error('Azure TTS error', ttsRes.status, errText);
      return res.status(502).json({ error: 'TTS request failed' });
    }

    const buffer = Buffer.from(await ttsRes.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (err) {
    console.error('speak error', err);
    res.status(502).json({ error: 'TTS request failed' });
  }
});

app.get('/api/check-access', async (req, res) => {
  const accessCode = req.get('x-access-code');
  const active = await isActiveSubscription(accessCode);
  res.json({ active });
});

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe || !process.env.STRIPE_PRICE_ID) {
    return res.status(500).json({ error: 'Server is missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID' });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${PUBLIC_APP_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_APP_URL}/?checkout=cancel`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('checkout session error', err);
    res.status(502).json({ error: err.message || 'Could not start checkout' });
  }
});

app.get('/api/verify-session', async (req, res) => {
  const sessionId = req.query.session_id;
  if (!stripe || !sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ active: false });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    const subscription = session.subscription;
    const active = subscription && (subscription.status === 'active' || subscription.status === 'trialing');
    if (!active) return res.json({ active: false });
    subscriptionCache.set(subscription.id, { active: true, checkedAt: Date.now() });
    res.json({ active: true, accessCode: subscription.id });
  } catch (err) {
    console.error('verify session error', err);
    res.status(502).json({ active: false });
  }
});

app.post('/api/restore-access', async (req, res) => {
  const { email } = req.body ?? {};
  if (!stripe || !email || typeof email !== 'string') {
    return res.status(400).json({ active: false });
  }
  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) return res.json({ active: false });

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });
    const subscription = subscriptions.data[0];
    if (!subscription) return res.json({ active: false });

    subscriptionCache.set(subscription.id, { active: true, checkedAt: Date.now() });
    res.json({ active: true, accessCode: subscription.id });
  } catch (err) {
    console.error('restore access error', err);
    res.status(502).json({ active: false });
  }
});

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Armenian Speaker server listening on http://localhost:${PORT}`);
});
