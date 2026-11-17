export const naira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 Jan 2027" from an ISO date or timestamp, without time-zone shifts for plain dates. */
export function day(iso: string | null | undefined, withYear = true) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MON[m - 1]}${withYear ? " " + y : ""}`;
}

/** "3 Jan 2027, 14:05" in Nigeria time. */
export function when(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export const BOOK_NAME: Record<string, string> = {
  manual: "Sunday School Manual",
  daily: "Daily Divine Bread",
  children: "Children's Sunday School Manual",
  constitution: "Church Constitution",
};
export const bookName = (bookId: string) => `${BOOK_NAME[bookId.split("-")[0]] ?? bookId} ${bookId.split("-")[1] ?? ""}`.trim();
