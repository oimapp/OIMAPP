// The 66 books of the Bible: code, English name, Yoruba name, and other spellings
// used in the manuals, so a reference like "PSALMS 100:1-5" or "Orin Dafidi 100:1-5" can be opened.

export type BookInfo = { code: string; en: string; yo: string; chapters: number; alias: string[] };

const B = (code: string, en: string, yo: string, chapters: number, alias: string[] = []): BookInfo => ({ code, en, yo, chapters, alias });

export const BIBLE_BOOKS: BookInfo[] = [
  B("GEN", "Genesis", "Jẹ́nẹ́sísì", 50, ["gen", "jenesisi", "genesisi"]),
  B("EXO", "Exodus", "Ẹ́kísódù", 40, ["eksodus", "exo", "ex", "eksodu", "ekisodu"]),
  B("LEV", "Leviticus", "Léfítíkù", 27, ["lev", "lefitiku"]),
  B("NUM", "Numbers", "Nọ́ńbà", 36, ["num", "numeri", "nonba"]),
  B("DEU", "Deuteronomy", "Diutarónómì", 34, ["deut", "deu", "deuteronomi", "diutaronomi"]),
  B("JOS", "Joshua", "Jóṣúà", 24, ["josh", "jos", "josua"]),
  B("JDG", "Judges", "Àwọn Onídàájọ́", 21, ["judg", "jdg", "onidajo", "awononidajo"]),
  B("RUT", "Ruth", "Rúùtù", 4, ["rutu"]),
  B("1SA", "1 Samuel", "1 Sámúẹ́lì", 31, ["1sam", "1samueli", "isamueli"]),
  B("2SA", "2 Samuel", "2 Sámúẹ́lì", 24, ["2sam", "2samueli", "iisamueli"]),
  B("1KI", "1 Kings", "1 Àwọn Ọba", 22, ["awonobakiini", "awonobakinni", "1kgs", "1king", "1awonoba", "1oba", "iawonoba"]),
  B("2KI", "2 Kings", "2 Àwọn Ọba", 25, ["awonobakeji", "2kgs", "2king", "2awonoba", "2oba", "iiawonoba"]),
  B("1CH", "1 Chronicles", "1 Kíróníkà", 29, ["1chronicle", "1chr", "1chron", "1kronika", "1kironika"]),
  B("2CH", "2 Chronicles", "2 Kíróníkà", 36, ["2chronicle", "2chr", "2chron", "2kronika", "2kironika"]),
  B("EZR", "Ezra", "Ẹ́sírà", 10, ["ezr", "esra", "esira"]),
  B("NEH", "Nehemiah", "Nehemáyà", 13, ["neh", "nehemaya"]),
  B("EST", "Esther", "Ẹ́sítà", 10, ["esiteri", "esth", "est", "esteri", "esita"]),
  B("JOB", "Job", "Jóòbù", 42, ["jobu", "joobu"]),
  B("PSA", "Psalms", "Orin Dáfídì", 150, ["orindaifidi", "psalm", "psalm", "psalms", "ps", "psa", "orindafidi", "sáàmù", "saamu"]),
  B("PRO", "Proverbs", "Òwe", 31, ["prov", "pro", "owe"]),
  B("ECC", "Ecclesiastes", "Oníwàásù", 12, ["ecclesiates", "eccl", "ecc", "oniwasu", "oniwaasu"]),
  B("SNG", "Song of Solomon", "Orin Sólómọ́nì", 8, ["song", "songofsongs", "sos", "orinsolomoni"]),
  B("ISA", "Isaiah", "Àìsáyà", 66, ["isa", "isaiah", "aisaya", "isaya"]),
  B("JER", "Jeremiah", "Jeremáyà", 52, ["jer", "jeremaya"]),
  B("LAM", "Lamentations", "Ẹkún Jeremáyà", 5, ["lam", "ekunjeremaya", "ekunjeremiah"]),
  B("EZK", "Ezekiel", "Ìsíkíẹ́lì", 48, ["esikieli", "ezek", "eze", "esekieli", "isikieli"]),
  B("DAN", "Daniel", "Dáníẹ́lì", 12, ["dan", "danieli"]),
  B("HOS", "Hosea", "Hóséà", 14, ["hos", "hosea"]),
  B("JOL", "Joel", "Jóẹ́lì", 3, ["joel", "joeli"]),
  B("AMO", "Amos", "Ámósì", 9, ["amos", "amosi"]),
  B("OBA", "Obadiah", "Ọbadáyà", 1, ["obad", "obadaya"]),
  B("JON", "Jonah", "Jónà", 4, ["jonah", "jona"]),
  B("MIC", "Micah", "Míkà", 7, ["mic", "mika"]),
  B("NAM", "Nahum", "Náhúmù", 3, ["nah", "nahumu"]),
  B("HAB", "Habakkuk", "Hábákúkù", 3, ["hab", "habakuku"]),
  B("ZEP", "Zephaniah", "Sefanáyà", 3, ["zeph", "zep", "sefanaya", "sefaniah"]),
  B("HAG", "Haggai", "Hágáì", 2, ["hag", "hagai"]),
  B("ZEC", "Zechariah", "Sekaráyà", 14, ["zakariah", "sakariah", "zech", "zec", "sekaraya", "sekariah"]),
  B("MAL", "Malachi", "Málákì", 4, ["mal", "malaki"]),
  B("MAT", "Matthew", "Mátíù", 28, ["matteu", "mathew", "matthew", "matt", "mat", "mt", "matiu"]),
  B("MRK", "Mark", "Máàkù", 16, ["mark", "mk", "marku", "maaku"]),
  B("LUK", "Luke", "Lúùkù", 24, ["luke", "lk", "luku", "luuku"]),
  B("JHN", "John", "Jòhánù", 21, ["johannu", "john", "jn", "johanu"]),
  B("ACT", "Acts", "Ìṣe Àwọn Àpọ́sítélì", 28, ["actsofapostle", "actsofapostles", "actsoftheapostles", "acts", "act", "iseawonaposteli", "iseawonapositeli", "ise"]),
  B("ROM", "Romans", "Róòmù", 16, ["rom", "romu", "roomu"]),
  B("1CO", "1 Corinthians", "1 Kọ́ríńtì", 16, ["1cor", "1korinti"]),
  B("2CO", "2 Corinthians", "2 Kọ́ríńtì", 13, ["2cor", "2korinti"]),
  B("GAL", "Galatians", "Gálátíà", 6, ["gal", "galatia"]),
  B("EPH", "Ephesians", "Éfésù", 6, ["eph", "efesu"]),
  B("PHP", "Philippians", "Fílípì", 4, ["phillippians", "philipians", "phil", "php", "filipi", "filippi"]),
  B("COL", "Colossians", "Kólósè", 4, ["col", "kolose", "kolosse"]),
  B("1TH", "1 Thessalonians", "1 Tẹsalóníkà", 5, ["1thess", "1thes", "1th", "1tesalonika", "1tessalonika"]),
  B("2TH", "2 Thessalonians", "2 Tẹsalóníkà", 3, ["2thess", "2thes", "2th", "2tesalonika", "2tessalonika"]),
  B("1TI", "1 Timothy", "1 Tímótíù", 6, ["1timoti", "1tim", "1timoteu", "1timotiu"]),
  B("2TI", "2 Timothy", "2 Tímótíù", 4, ["2timoti", "2tim", "2timoteu", "2timotiu"]),
  B("TIT", "Titus", "Títù", 3, ["tit", "titu"]),
  B("PHM", "Philemon", "Fílémónì", 1, ["philem", "phlm", "filemoni"]),
  B("HEB", "Hebrews", "Hébérù", 13, ["heb", "heberu"]),
  B("JAS", "James", "Jákọ́bù", 5, ["jas", "jam", "jakobu"]),
  B("1PE", "1 Peter", "1 Pétérù", 5, ["1pet", "1pe", "1peteru"]),
  B("2PE", "2 Peter", "2 Pétérù", 3, ["2pet", "2pe", "2peteru"]),
  B("1JN", "1 John", "1 Jòhánù", 5, ["1jn", "1johanu"]),
  B("2JN", "2 John", "2 Jòhánù", 1, ["2jn", "2johanu"]),
  B("3JN", "3 John", "3 Jòhánù", 1, ["3jn", "3johanu"]),
  B("JUD", "Jude", "Júdà", 1, ["jude", "juda"]),
  B("REV", "Revelation", "Ìfihàn", 22, ["rev", "revelations", "ifihan"]),
];

export const OLD_TESTAMENT = BIBLE_BOOKS.slice(0, 39);
export const NEW_TESTAMENT = BIBLE_BOOKS.slice(39);

/** "Orin Dáfídì" -> "orindafidi", "1 Thess." -> "1thess", "I. Samueli" -> "1samueli" */
export function bookKey(s: string) {
  let t = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  t = t.replace(/^(iii|ii|i)[.\s]+/, (m) => String(m.replace(/[.\s]/g, "").length));
  return t.replace(/[.\s']/g, "");
}

const LOOKUP = new Map<string, BookInfo>();
for (const b of BIBLE_BOOKS) {
  for (const n of [b.code, b.en, b.yo, ...b.alias]) LOOKUP.set(bookKey(n), b);
}

export function findBook(name: string) {
  return LOOKUP.get(bookKey(name)) ?? null;
}

export type BibleRef = { book: BookInfo; chapter: number; from?: number; to?: number; label: string };

/**
 * Read references such as "PSALMS 100: 1-5", "Genesis1:1-2", "1 Thess. 5:18",
 * "ORIN DÁFIDI 150:1-6; PSALMS 103:1-5". Anything it cannot read is skipped.
 */
export function parseRefs(text: string): BibleRef[] {
  const out: BibleRef[] = [];
  for (const raw of text.split(/[;,]\s*(?=[1-3]?\s*[A-Za-zÀ-ỹ])/)) {
    const m = raw.trim().match(/^((?:[1-3]|I{1,3}\.?)?\s*[A-Za-zÀ-ỹ̀-ͯ.\s']+?)\s*(\d+)\s*(?::\s*(\d+)(?:\s*[-–]\s*(\d+))?)?/);
    if (!m) continue;
    const book = findBook(m[1]);
    if (!book) continue;
    const chapter = Number(m[2]);
    if (!chapter || chapter > book.chapters) continue;
    out.push({ book, chapter, from: m[3] ? Number(m[3]) : undefined, to: m[4] ? Number(m[4]) : m[3] ? Number(m[3]) : undefined, label: raw.trim() });
  }
  return out;
}
