// Every word the app shows, in English and Yoruba.
// To change a word, change it here. Keep the same key in both languages.

export type Lang = "en" | "yo";

const en = {
  appName: "Ona Iwa Mimo",
  churchName: "Cherubim and Seraphim Church of Nigeria and Overseas",

  // Language choice
  chooseLanguage: "Choose your language",
  chooseLanguageHint: "You can change this later in Me.",
  continue: "Continue",

  // Sign in
  signIn: "Sign in",
  signUp: "Create account",
  signInTitle: "Welcome",
  signInHint: "Sign in to read your books on this phone.",
  signUpHint: "Create your account. It takes one minute.",
  email: "Email address",
  password: "Password",
  passwordHint: "At least 8 characters.",
  haveAccount: "I already have an account",
  noAccount: "I am new here",
  wrongLogin: "The email or password is not correct.",
  emailTaken: "An account with this email already exists. Sign in instead.",
  weakPassword: "The password must be at least 8 characters.",
  badEmail: "Type a correct email address.",
  checkEmail: "Check your email and tap the link we sent, then come back and sign in.",
  forgotPassword: "Forgot your password? Message us on WhatsApp and we will help you.",

  // Profile
  aboutYou: "About you",
  aboutYouHint: "Your phone number shows faintly on every page you read, so please use your own number.",
  fullName: "Full name",
  phone: "Phone number",
  phoneHint: "For example 0803 123 4567",
  parish: "Parish (church)",
  optional: "optional",
  save: "Save",
  saved: "Saved.",
  nameNeeded: "Type your full name.",
  phoneInvalid: "Type a correct phone number, for example 0803 123 4567.",
  phoneTaken: "This phone number is already on another account. If it is yours, message us on WhatsApp.",
  phoneLocked: "Your phone number can only be changed by the church office. Message us on WhatsApp.",

  // One phone per account
  otherPhoneTitle: "Your account is on another phone",
  otherPhoneBody: "Your books can only be read on one phone at a time. Right now they are on: {model}.",
  moveHere: "Move my account to this phone",
  moveWarn: "The other phone will stop showing your books. You can do this {n} more time(s) this year.",
  moveWait: "You moved phones recently. You can move again on {date}.",
  noMovesLeft: "You have used all your phone changes for this year.",
  askHelp: "Ask for help on WhatsApp",
  frozenTitle: "Your account is on hold",
  frozenBody: "Please message the church office on WhatsApp so they can help you.",
  offlineTooLong: "Please connect to the internet once so the app can check your account. Then you can read offline again.",
  tryAgain: "Try again",
  signOut: "Sign out",

  // Tabs
  tabHome: "Home",
  tabBooks: "Books",
  tabChurch: "Church",
  tabMe: "Me",

  // Home
  greeting: "Welcome, {name}",
  todayReading: "Today's reading",
  thisSunday: "This Sunday's lesson",
  childrenSunday: "Children's lesson this Sunday",
  notOwnedYet: "You don't have this book yet.",
  notDownloaded: "Download this book to read it.",
  openBook: "Open",
  messages: "Messages",
  noMessages: "No messages yet.",
  offlineNote: "You are offline. Downloaded books still work.",

  // Books
  myBooks: "My books",
  owned: "Yours",
  notOwned: "Not bought",
  download: "Download book",
  downloading: "Downloading...",
  savingSafely: "Saving it safely on this phone...",
  downloaded: "On this phone",
  updateAvailable: "A corrected version is ready.",
  updateBook: "Update",
  lessons: "Lessons",
  days: "Days",
  lesson: "Lesson {n}",
  review: "Review",
  buyTitle: "How to get this book",
  buySoon: "Buying inside the app is coming soon. During testing, the church office can unlock this book for you.",
  noBooks: "No books yet. They will appear here when the conference releases them.",
  search: "Search",
  downloadFailed: "The download did not finish. Check your internet and try again.",
  wrongPhone: "This phone is not the phone on your account. Close the app and open it again.",

  // Reader
  memoryVerse: "Memory verse",
  text: "Bible text",
  previous: "Previous",
  next: "Next",
  textSize: "Text size",

  // Church
  calendar: "Calendar",
  districts: "Districts",
  babaAladura: "Baba Aladura",
  noEvents: "No events yet.",
  noDistricts: "No districts yet.",
  noBabas: "Nothing here yet.",
  prophet: "Prophet in charge",
  call: "Call",
  churches: "{n} churches",

  // Me
  account: "Account",
  thisPhone: "This phone",
  appLanguage: "App language",
  help: "Help on WhatsApp",
  helpHint: "Questions about your account or books",
  version: "Version {v}",
  signOutConfirm: "Sign out? The books downloaded on this phone will be removed. You can download them again when you sign in.",
  cancel: "Cancel",
  english: "English",
  yoruba: "Yorùbá",

  // General
  loading: "Loading...",
  offline: "No internet connection.",
  somethingWrong: "Something went wrong. Please try again.",
  maintenance: "Notice",
  updateApp: "A new version of the app is available. Please update it.",
};

type Strings = typeof en;

const yo: Strings = {
  appName: "Ona Iwa Mimo",
  churchName: "Ìjọ Kérúbù àti Séráfù ti Nàìjíríà àti Òkè Òkun",

  chooseLanguage: "Yan èdè rẹ",
  chooseLanguageHint: "O lè yí i padà lẹ́yìn náà ní apá Èmi.",
  continue: "Tẹ̀síwájú",

  signIn: "Wọlé",
  signUp: "Ṣí àkáǹtì",
  signInTitle: "Ẹ káàbọ̀",
  signInHint: "Wọlé láti ka àwọn ìwé rẹ lórí fóònù yìí.",
  signUpHint: "Ṣí àkáǹtì rẹ. Kò ju ìṣẹ́jú kan lọ.",
  email: "Àdírẹ́sì ímeèlì",
  password: "Ọ̀rọ̀ aṣínà",
  passwordHint: "Ó kéré tán, lẹ́tà mẹ́jọ.",
  haveAccount: "Mo ti ní àkáǹtì",
  noAccount: "Mo jẹ́ ẹni tuntun",
  wrongLogin: "Ímeèlì tàbí ọ̀rọ̀ aṣínà kò tọ̀nà.",
  emailTaken: "Àkáǹtì ti wà fún ímeèlì yìí. Wọlé dípò rẹ̀.",
  weakPassword: "Ọ̀rọ̀ aṣínà gbọ́dọ̀ ní lẹ́tà mẹ́jọ ó kéré tán.",
  badEmail: "Kọ àdírẹ́sì ímeèlì tó tọ̀nà.",
  checkEmail: "Wo ímeèlì rẹ kí o sì tẹ ọ̀nà tí a fi ránṣẹ́, lẹ́yìn náà padà wá wọlé.",
  forgotPassword: "Ṣé o gbàgbé ọ̀rọ̀ aṣínà rẹ? Kọ̀wé sí wa lórí WhatsApp, a ó ràn ọ́ lọ́wọ́.",

  aboutYou: "Nípa rẹ",
  aboutYouHint: "Nọ́ńbà fóònù rẹ yóò hàn díẹ̀ lórí gbogbo ojú ìwé tí o bá kà, nítorí náà lo nọ́ńbà tìrẹ.",
  fullName: "Orúkọ rẹ ní kíkún",
  phone: "Nọ́ńbà fóònù",
  phoneHint: "Bí àpẹẹrẹ 0803 123 4567",
  parish: "Ìjọ rẹ",
  optional: "kò pọndandan",
  save: "Fi pamọ́",
  saved: "A ti fi pamọ́.",
  nameNeeded: "Kọ orúkọ rẹ ní kíkún.",
  phoneInvalid: "Kọ nọ́ńbà fóònù tó tọ̀nà, bí àpẹẹrẹ 0803 123 4567.",
  phoneTaken: "Nọ́ńbà fóònù yìí ti wà lórí àkáǹtì mìíràn. Tó bá jẹ́ tìrẹ, kọ̀wé sí wa lórí WhatsApp.",
  phoneLocked: "Ọ́fíìsì ìjọ nìkan ló lè yí nọ́ńbà fóònù rẹ padà. Kọ̀wé sí wa lórí WhatsApp.",

  otherPhoneTitle: "Àkáǹtì rẹ wà lórí fóònù mìíràn",
  otherPhoneBody: "Fóònù kan ṣoṣo ni o lè fi ka àwọn ìwé rẹ ní àkókò kan. Wọ́n wà lórí: {model} báyìí.",
  moveHere: "Gbé àkáǹtì mi wá sí fóònù yìí",
  moveWarn: "Fóònù kejì kò ní fi àwọn ìwé rẹ hàn mọ́. O lè ṣe èyí ní ìgbà {n} sí i lọ́dún yìí.",
  moveWait: "O ṣẹ̀ṣẹ̀ yí fóònù padà. O lè tún yí i padà ní {date}.",
  noMovesLeft: "O ti lo gbogbo àǹfààní láti yí fóònù padà fún ọdún yìí.",
  askHelp: "Béèrè ìrànlọ́wọ́ lórí WhatsApp",
  frozenTitle: "A ti dá àkáǹtì rẹ dúró fún ìgbà díẹ̀",
  frozenBody: "Jọ̀wọ́ kọ̀wé sí ọ́fíìsì ìjọ lórí WhatsApp kí wọ́n lè ràn ọ́ lọ́wọ́.",
  offlineTooLong: "Jọ̀wọ́ so fóònù rẹ mọ́ íntánẹ́ẹ̀tì lẹ́ẹ̀kan kí áàpù lè ṣàyẹ̀wò àkáǹtì rẹ. Lẹ́yìn náà o lè kà láìsí íntánẹ́ẹ̀tì.",
  tryAgain: "Gbìyànjú lẹ́ẹ̀kan sí i",
  signOut: "Jáde",

  tabHome: "Ilé",
  tabBooks: "Ìwé",
  tabChurch: "Ìjọ",
  tabMe: "Èmi",

  greeting: "Ẹ káàbọ̀, {name}",
  todayReading: "Ẹ̀kọ́ òní",
  thisSunday: "Ẹ̀kọ́ Ọjọ́ Ìsinmi yìí",
  childrenSunday: "Ẹ̀kọ́ àwọn ọmọdé Ọjọ́ Ìsinmi yìí",
  notOwnedYet: "O kò tíì ní ìwé yìí.",
  notDownloaded: "Ṣe ìgbàsílẹ̀ ìwé yìí kí o tó lè kà á.",
  openBook: "Ṣí i",
  messages: "Ìkéde",
  noMessages: "Kò sí ìkéde kankan síbẹ̀.",
  offlineNote: "O kò sí lórí íntánẹ́ẹ̀tì. Àwọn ìwé tí o ti gbà sílẹ̀ ṣì ń ṣiṣẹ́.",

  myBooks: "Àwọn ìwé mi",
  owned: "Tìrẹ",
  notOwned: "O kò tíì rà á",
  download: "Gba ìwé sílẹ̀",
  downloading: "Ó ń gbà á sílẹ̀...",
  savingSafely: "Ó ń fi pamọ́ dáadáa sórí fóònù yìí...",
  downloaded: "Ó wà lórí fóònù yìí",
  updateAvailable: "Ẹ̀dà tí a ti ṣàtúnṣe sí ti wà.",
  updateBook: "Ṣe àtúnṣe",
  lessons: "Àwọn ẹ̀kọ́",
  days: "Àwọn ọjọ́",
  lesson: "Ẹ̀kọ́ {n}",
  review: "Àtúnyẹ̀wò",
  buyTitle: "Bí o ṣe lè rí ìwé yìí gbà",
  buySoon: "Ríra nínú áàpù ń bọ̀ láìpẹ́. Ní àsìkò ìdánwò yìí, ọ́fíìsì ìjọ lè ṣí ìwé yìí sílẹ̀ fún ọ.",
  noBooks: "Kò sí ìwé kankan síbẹ̀. Wọn yóò farahàn níbí nígbà tí àpéjọ bá tú wọn jáde.",
  search: "Wá",
  downloadFailed: "Ìgbàsílẹ̀ náà kò parí. Ṣàyẹ̀wò íntánẹ́ẹ̀tì rẹ kí o sì gbìyànjú lẹ́ẹ̀kan sí i.",
  wrongPhone: "Fóònù yìí kọ́ ni fóònù tí ó wà lórí àkáǹtì rẹ. Pa áàpù náà dé kí o sì tún ṣí i.",

  memoryVerse: "Ẹsẹ ìrántí",
  text: "Ẹsẹ Bíbélì",
  previous: "Èyí tó ṣáájú",
  next: "Èyí tó kàn",
  textSize: "Ìtóbi lẹ́tà",

  calendar: "Kàlẹ́ńdà",
  districts: "Àwọn agbègbè",
  babaAladura: "Baba Aládùúrà",
  noEvents: "Kò sí ètò kankan síbẹ̀.",
  noDistricts: "Kò sí agbègbè kankan síbẹ̀.",
  noBabas: "Kò sí nǹkan kan níbí síbẹ̀.",
  prophet: "Wòlíì tó ń bójú tó o",
  call: "Pè",
  churches: "Ìjọ {n}",

  account: "Àkáǹtì",
  thisPhone: "Fóònù yìí",
  appLanguage: "Èdè áàpù",
  help: "Ìrànlọ́wọ́ lórí WhatsApp",
  helpHint: "Ìbéèrè nípa àkáǹtì tàbí àwọn ìwé rẹ",
  version: "Ẹ̀dà {v}",
  signOutConfirm: "Ṣé o fẹ́ jáde? A ó yọ àwọn ìwé tí o ti gbà sílẹ̀ kúrò lórí fóònù yìí. O lè tún gbà wọ́n sílẹ̀ nígbà tí o bá wọlé.",
  cancel: "Fagilé",
  english: "English",
  yoruba: "Yorùbá",

  loading: "Ó ń ṣí i...",
  offline: "Kò sí íntánẹ́ẹ̀tì.",
  somethingWrong: "Nǹkan kan ṣẹlẹ̀. Jọ̀wọ́ gbìyànjú lẹ́ẹ̀kan sí i.",
  maintenance: "Ìkéde",
  updateApp: "Ẹ̀dà tuntun áàpù yìí ti jáde. Jọ̀wọ́ ṣe àtúnṣe rẹ̀.",
};

export const STRINGS: Record<Lang, Strings> = { en, yo };
export type StringKey = keyof Strings;

/** Get a word in the chosen language, filling in {name}-style blanks. */
export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
