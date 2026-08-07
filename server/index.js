import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

const EN_TO_HY_PROMPT = `You are an expert English-to-Armenian (Eastern Armenian) translator and grammar checker.

Translate the user's English text into natural, grammatically correct Eastern Armenian, using the Armenian script (not transliteration).

Rules:
- Produce natural, everyday Armenian a native speaker would actually use, not a stiff literal translation.
- Apply correct Armenian case, verb conjugation, and word order — do not just substitute words one-for-one from English.
- If the English input is ambiguous (e.g. missing context needed to pick a verb form or pronoun), choose the most common/neutral interpretation.
- Respond with ONLY a JSON object, no markdown fences, no extra commentary, matching this exact shape:
{"translated": "<translated text in Armenian script>", "transliteration": "<latin-script phonetic transliteration of the Armenian>", "notes": "<optional short note on any grammar choice worth flagging, or empty string>"}`;

const HY_TO_EN_PROMPT = `You are an expert Armenian (Eastern Armenian)-to-English translator.

Translate the user's Armenian text (given in Armenian script) into natural, fluent English.

Rules:
- Produce natural English a native speaker would actually use, not a stiff literal translation.
- If the Armenian input is ambiguous, choose the most common/neutral interpretation.
- Respond with ONLY a JSON object, no markdown fences, no extra commentary, matching this exact shape:
{"translated": "<translated text in English>", "transliteration": "<latin-script phonetic transliteration of the ORIGINAL Armenian input>", "notes": "<optional short note worth flagging, or empty string>"}`;

app.post('/api/translate', async (req, res) => {
  const { text, direction } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }

  const systemPrompt = direction === 'hy-en' ? HY_TO_EN_PROMPT : EN_TO_HY_PROMPT;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    });

    const raw = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { translated: raw, transliteration: '', notes: '' };
    }

    res.json(parsed);
  } catch (err) {
    console.error('translate error', err);
    res.status(502).json({ error: 'Translation request failed' });
  }
});

app.post('/api/speak', async (req, res) => {
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
