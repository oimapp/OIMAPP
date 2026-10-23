import type { Lang } from "./i18n";

// Yoruba follows the books: day names with the date in numbers, and "Oṣù Kínní" for months.
const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  yo: ["Oṣù Kínní", "Oṣù Kejì", "Oṣù Kẹta", "Oṣù Kẹrin", "Oṣù Karùn-ún", "Oṣù Kẹfà", "Oṣù Keje", "Oṣù Kẹjọ", "Oṣù Kẹsàn-án", "Oṣù Kẹwàá", "Oṣù Kọkànlá", "Oṣù Kejìlá"],
};
const DAYS = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  yo: ["Ọjọ́ Àìkú", "Ọjọ́ Ajé", "Ọjọ́ Ìṣẹ́gun", "Ọjọ́rú", "Ọjọ́bọ̀", "Ọjọ́ Ẹtì", "Ọjọ́ Àbámẹ́ta"],
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Today as YYYY-MM-DD in the phone's own time zone. */
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parse(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Sunday 3 January 2027" / "Ọjọ́ Àìkú, 03/01/2027" */
export function longDate(iso: string, lang: Lang, withDay = true) {
  const d = parse(iso);
  if (lang === "yo") {
    const num = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return withDay ? `${DAYS.yo[d.getDay()]}, ${num}` : num;
  }
  const day = withDay ? `${DAYS.en[d.getDay()]} ` : "";
  return `${day}${d.getDate()} ${MONTHS.en[d.getMonth()]} ${d.getFullYear()}`;
}

/** "3 Jan" / "03/01" */
export function shortDate(iso: string, lang: Lang) {
  const d = parse(iso);
  return lang === "yo" ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : `${d.getDate()} ${MONTHS.en[d.getMonth()].slice(0, 3)}`;
}

/** "January 2027" / "Oṣù Kínní 2027" */
export function monthName(iso: string, lang: Lang) {
  const d = parse(iso);
  return `${MONTHS[lang][d.getMonth()]} ${d.getFullYear()}`;
}

/** The Sunday on or after a date. */
export function nextSunday(iso: string) {
  const d = parse(iso);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return todayISO(d);
}
