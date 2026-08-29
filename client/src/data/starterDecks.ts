/**
 * Pre-built Eastern Armenian starter content. Each entry becomes a real SRS
 * card on first load, so built-in decks behave identically to user-made ones.
 */

export type StarterCard = {
  armenian: string
  english: string
  transliteration: string
  notes?: string
}

export type StarterDeck = {
  id: string
  name: string
  description: string
  cards: StarterCard[]
}

export const STARTER_DECKS: StarterDeck[] = [
  {
    id: 'starter-greetings',
    name: 'Greetings & Politeness',
    description: 'The first phrases to learn in any language.',
    cards: [
      { armenian: 'Բարև', english: 'Hello', transliteration: 'Barev', notes: 'Informal, to one person you know.' },
      { armenian: 'Բարև Ձեզ', english: 'Hello (formal)', transliteration: 'Barev Dzez', notes: 'Polite/plural form.' },
      { armenian: 'Բարի լույս', english: 'Good morning', transliteration: 'Bari luys', notes: 'Literally "good light."' },
      { armenian: 'Բարի երեկո', english: 'Good evening', transliteration: 'Bari yereko' },
      { armenian: 'Բարի գիշեր', english: 'Good night', transliteration: 'Bari gisher' },
      { armenian: 'Ցտեսություն', english: 'Goodbye', transliteration: 'Tstesutyun' },
      { armenian: 'Շնորհակալություն', english: 'Thank you', transliteration: 'Shnorhakalutyun' },
      { armenian: 'Խնդրեմ', english: "Please / You're welcome", transliteration: 'Khndrem' },
      { armenian: 'Այո', english: 'Yes', transliteration: 'Ayo' },
      { armenian: 'Ոչ', english: 'No', transliteration: 'Voch' },
      { armenian: 'Ներեցեք', english: 'Excuse me / Sorry', transliteration: 'Neretsek' },
      { armenian: 'Ինչպե՞ս եք', english: 'How are you? (formal)', transliteration: 'Inchpes ek' },
      { armenian: 'Լավ եմ', english: "I'm well", transliteration: 'Lav em' },
      { armenian: 'Ես չեմ հասկանում', english: "I don't understand", transliteration: 'Yes chem haskanum' },
    ],
  },
  {
    id: 'starter-numbers',
    name: 'Numbers 1-20',
    description: 'Counting, prices, times and quantities.',
    cards: [
      { armenian: 'մեկ', english: 'one', transliteration: 'mek' },
      { armenian: 'երկու', english: 'two', transliteration: 'yerku' },
      { armenian: 'երեք', english: 'three', transliteration: 'yerek' },
      { armenian: 'չորս', english: 'four', transliteration: 'chors' },
      { armenian: 'հինգ', english: 'five', transliteration: 'hing' },
      { armenian: 'վեց', english: 'six', transliteration: 'vets' },
      { armenian: 'յոթ', english: 'seven', transliteration: 'yot' },
      { armenian: 'ութ', english: 'eight', transliteration: 'ut' },
      { armenian: 'ինը', english: 'nine', transliteration: 'iny' },
      { armenian: 'տասը', english: 'ten', transliteration: 'tasy' },
      { armenian: 'տասնմեկ', english: 'eleven', transliteration: 'tasnmek' },
      { armenian: 'տասներկու', english: 'twelve', transliteration: 'tasnerku' },
      { armenian: 'տասներեք', english: 'thirteen', transliteration: 'tasnerek' },
      { armenian: 'տասնչորս', english: 'fourteen', transliteration: 'tasnchors' },
      { armenian: 'տասնհինգ', english: 'fifteen', transliteration: 'tasnhing' },
      { armenian: 'քսան', english: 'twenty', transliteration: 'ksan' },
    ],
  },
  {
    id: 'starter-food',
    name: 'Food & Dining',
    description: 'Ordering, eating out and grocery basics.',
    cards: [
      { armenian: 'ջուր', english: 'water', transliteration: 'jur' },
      { armenian: 'հաց', english: 'bread', transliteration: 'hats' },
      { armenian: 'պանիր', english: 'cheese', transliteration: 'panir' },
      { armenian: 'միս', english: 'meat', transliteration: 'mis' },
      { armenian: 'ձուկ', english: 'fish', transliteration: 'dzuk' },
      { armenian: 'միրգ', english: 'fruit', transliteration: 'mirg' },
      { armenian: 'սուրճ', english: 'coffee', transliteration: 'surch' },
      { armenian: 'թեյ', english: 'tea', transliteration: 'tey' },
      { armenian: 'կաթ', english: 'milk', transliteration: 'kat' },
      { armenian: 'ձու', english: 'egg', transliteration: 'dzu' },
      { armenian: 'աղ', english: 'salt', transliteration: 'agh' },
      { armenian: 'շաքար', english: 'sugar', transliteration: 'shakar' },
      { armenian: 'Ես քաղցած եմ', english: "I'm hungry", transliteration: 'Yes kaghtsats em' },
      { armenian: 'Համեղ է', english: "It's delicious", transliteration: 'Hamegh e' },
      { armenian: 'Հաշիվը, խնդրեմ', english: 'The bill, please', transliteration: 'Hashivy, khndrem' },
    ],
  },
  {
    id: 'starter-travel',
    name: 'Travel & Directions',
    description: 'Getting around and asking for help.',
    cards: [
      { armenian: 'Որտե՞ղ է', english: 'Where is…?', transliteration: 'Vorteh e' },
      { armenian: 'աջ', english: 'right', transliteration: 'aj' },
      { armenian: 'ձախ', english: 'left', transliteration: 'dzakh' },
      { armenian: 'ուղիղ', english: 'straight ahead', transliteration: 'ughigh' },
      { armenian: 'օդանավակայան', english: 'airport', transliteration: 'odanavakayan' },
      { armenian: 'կայարան', english: 'station', transliteration: 'kayaran' },
      { armenian: 'հյուրանոց', english: 'hotel', transliteration: 'hyuranots' },
      { armenian: 'տոմս', english: 'ticket', transliteration: 'toms' },
      { armenian: 'քարտեզ', english: 'map', transliteration: 'kartez' },
      { armenian: 'Ինչքա՞ն արժե', english: 'How much does it cost?', transliteration: 'Inchkan arzhe' },
      { armenian: 'Ես կորել եմ', english: "I'm lost", transliteration: 'Yes korel em' },
      { armenian: 'Օգնեցե՛ք', english: 'Help!', transliteration: 'Ognetsek' },
    ],
  },
  {
    id: 'starter-family',
    name: 'Family & People',
    description: 'Talking about the people in your life.',
    cards: [
      { armenian: 'մայր', english: 'mother', transliteration: 'mayr' },
      { armenian: 'հայր', english: 'father', transliteration: 'hayr' },
      { armenian: 'քույր', english: 'sister', transliteration: 'kuyr' },
      { armenian: 'եղբայր', english: 'brother', transliteration: 'yeghbayr' },
      { armenian: 'տատիկ', english: 'grandmother', transliteration: 'tatik' },
      { armenian: 'պապիկ', english: 'grandfather', transliteration: 'papik' },
      { armenian: 'որդի', english: 'son', transliteration: 'vordi' },
      { armenian: 'դուստր', english: 'daughter', transliteration: 'dustr' },
      { armenian: 'ընտանիք', english: 'family', transliteration: 'yntanik' },
      { armenian: 'ընկեր', english: 'friend', transliteration: 'nker' },
      { armenian: 'երեխա', english: 'child', transliteration: 'yerekha' },
    ],
  },
  {
    id: 'starter-verbs',
    name: 'Essential Verbs',
    description: 'The dozen verbs that unlock the most sentences.',
    cards: [
      { armenian: 'լինել', english: 'to be', transliteration: 'linel' },
      { armenian: 'ունենալ', english: 'to have', transliteration: 'unenal' },
      { armenian: 'գնալ', english: 'to go', transliteration: 'gnal' },
      { armenian: 'գալ', english: 'to come', transliteration: 'gal' },
      { armenian: 'ուտել', english: 'to eat', transliteration: 'utel' },
      { armenian: 'խմել', english: 'to drink', transliteration: 'khmel' },
      { armenian: 'տեսնել', english: 'to see', transliteration: 'tesnel' },
      { armenian: 'խոսել', english: 'to speak', transliteration: 'khosel' },
      { armenian: 'իմանալ', english: 'to know', transliteration: 'imanal' },
      { armenian: 'ուզել', english: 'to want', transliteration: 'uzel' },
      { armenian: 'անել', english: 'to do / make', transliteration: 'anel' },
      { armenian: 'սիրել', english: 'to love', transliteration: 'sirel' },
    ],
  },
  {
    id: 'starter-time',
    name: 'Days & Time',
    description: 'Scheduling, calendars and talking about when.',
    cards: [
      { armenian: 'այսօր', english: 'today', transliteration: 'aysor' },
      { armenian: 'վաղը', english: 'tomorrow', transliteration: 'vaghy' },
      { armenian: 'երեկ', english: 'yesterday', transliteration: 'yerek' },
      { armenian: 'հիմա', english: 'now', transliteration: 'hima' },
      { armenian: 'օր', english: 'day', transliteration: 'or' },
      { armenian: 'շաբաթ', english: 'week', transliteration: 'shabat' },
      { armenian: 'ամիս', english: 'month', transliteration: 'amis' },
      { armenian: 'տարի', english: 'year', transliteration: 'tari' },
      { armenian: 'Երկուշաբթի', english: 'Monday', transliteration: 'Yerkushabti' },
      { armenian: 'Երեքշաբթի', english: 'Tuesday', transliteration: 'Yerekshabti' },
      { armenian: 'Չորեքշաբթի', english: 'Wednesday', transliteration: 'Chorekshabti' },
      { armenian: 'Հինգշաբթի', english: 'Thursday', transliteration: 'Hingshabti' },
      { armenian: 'Ուրբաթ', english: 'Friday', transliteration: 'Urbat' },
      { armenian: 'Կիրակի', english: 'Sunday', transliteration: 'Kiraki' },
    ],
  },
]
