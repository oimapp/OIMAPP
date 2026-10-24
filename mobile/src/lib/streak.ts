// Reading streak: how many days in a row the member opened something to read
// (a lesson, a daily reading or a Bible chapter). Kept on the phone.

import { getCached, setCached } from "./cache";
import { todayISO } from "./dates";

const listeners = new Set<() => void>();

export async function readDays() {
  return new Set((await getCached<string[]>("read_days")) ?? []);
}

export async function recordReadToday() {
  const days = await readDays();
  const today = todayISO();
  if (days.has(today)) return false;
  days.add(today);
  // Keep the last 400 days only.
  await setCached("read_days", [...days].sort().slice(-400));
  listeners.forEach((l) => l());
  return true;
}

export function onReadDay(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Days in a row up to today (or up to yesterday, if today is not read yet). */
export async function currentStreak() {
  const days = await readDays();
  const d = new Date();
  if (!days.has(todayISO(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(todayISO(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return { n, today: days.has(todayISO()) };
}
