import AsyncStorage from "@react-native-async-storage/async-storage";

/** Small saved values (settings, profile, lists) so the app still opens without internet. */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem(`c:${key}`);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export async function setCached(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(`c:${key}`, JSON.stringify(value));
  } catch {
    // Not important if it fails; the app fetches again next time.
  }
}

export async function clearCached() {
  const keep = ["c:lang", "c:prefs"];
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("c:") && !keep.includes(k));
  await AsyncStorage.multiRemove(keys);
}
