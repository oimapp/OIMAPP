// The app's shared state: language, sign-in, profile, the phone check and settings.
// It decides which screen the member sees first (the "stage").

import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { clearCached, getCached, setCached } from "./cache";
import { CHANNEL, missingEnv } from "./env";
import { Lang, StringKey, translate } from "./i18n";
import { errorCode, rpc, supabase } from "./supabase";
import { forgetMarks } from "./notes";
import { wipeAll } from "./vault";
import * as Notifications from "expo-notifications";

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  parish: string;
  language: Lang;
  is_teacher: boolean;
  status: "active" | "frozen";
};

export type BookRow = {
  id: string;
  kind: "manual" | "daily" | "children" | "document";
  year: number;
  title_en: string;
  title_yo: string;
  status: string;
  version: number;
  owned: boolean;
  cover_path?: string | null;
};

export type Product = { id: string; name_en: string; name_yo: string; price_kobo: number; book_ids: string[]; play_product_id: string | null };
export type Catalogue = { books: BookRow[]; products: Product[] };

export type DeviceInfo = {
  state: "other_phone";
  other_model: string;
  moves_left: number;
  can_move: boolean;
  wait_until: string;
};

export type Stage =
  | "loading" | "env" | "language" | "signin" | "profile"
  | "device" | "frozen" | "offline_block" | "test_ended" | "ready";

type Ctx = {
  stage: Stage;
  lang: Lang;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  setLang: (l: Lang) => Promise<void>;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  settings: Record<string, any>;
  catalogue: Catalogue;
  deviceInfo: DeviceInfo | null;
  online: boolean;
  installId: string;
  model: string;
  boot: () => Promise<void>;
  afterProfileSaved: (p: Profile) => Promise<void>;
  moveHere: () => Promise<void>;
  refreshCatalogue: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

const DAY = 24 * 60 * 60 * 1000;

/** A steady id for this phone. Android keeps it the same even if the app is reinstalled. */
async function makeInstallId() {
  let raw = "";
  if (Platform.OS === "android") raw = Application.getAndroidId();
  else raw = (await Application.getIosIdForVendorAsync()) ?? "";
  if (!raw) raw = Crypto.randomUUID();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `oim:${raw}`);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [lang, setLangState] = useState<Lang>("yo");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [catalogue, setCatalogue] = useState<Catalogue>({ books: [], products: [] });
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [online, setOnline] = useState(true);
  const [installId, setInstallId] = useState("");
  const booting = useRef(false);

  const model = useMemo(
    () => [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || "Unknown phone",
    [],
  );

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase.from("settings").select("key, value");
    if (error) throw new Error(errorCode(error));
    const s = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    setSettings(s);
    await setCached("settings", s);
    return s;
  }, []);

  const refreshCatalogue = useCallback(async () => {
    try {
      const c = await rpc<Catalogue>("app_catalogue");
      setCatalogue(c);
      await setCached("catalogue", c);
    } catch {
      // keep what we have
    }
  }, []);

  /** Ask the server whether this phone may use the account. */
  const checkDevice = useCallback(async (id: string, move = false) => {
    const r = await rpc<{ state: string } & Partial<Omit<DeviceInfo, "state">>>("app_device", {
      p_install_id: id, p_model: model, p_platform: Platform.OS === "ios" ? "ios" : "android", p_move: move,
      p_version: Application.nativeApplicationVersion ?? "", p_channel: CHANNEL,
    });
    if (r.state === "ok") {
      await setCached("device_ok_at", Date.now());
      setDeviceInfo(null);
      await refreshCatalogue();
      setStage("ready");
    } else if (r.state === "no_profile") {
      setStage("profile");
    } else if (r.state === "frozen") {
      setStage("frozen");
    } else if (r.state === "test_ended") {
      setStage("test_ended");
    } else {
      setDeviceInfo(r as unknown as DeviceInfo);
      setStage("device");
    }
  }, [model, refreshCatalogue]);

  const boot = useCallback(async () => {
    if (booting.current) return;
    booting.current = true;
    try {
      if (missingEnv.length) return setStage("env");

      const savedLang = await getCached<Lang>("lang");
      if (!savedLang) return setStage("language");
      setLangState(savedLang);

      const id = installId || (await makeInstallId());
      setInstallId(id);

      // Public settings (help line number and so on) are needed even before sign in.
      const cs = await getCached<Record<string, any>>("settings");
      if (cs) setSettings(cs);
      await loadSettings().catch(() => undefined);

      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return setStage("signin");
      setUserId(session.user.id);
      setEmail(session.user.email ?? null);

      // Show saved things first, so the app opens fast and works offline.
      const [cp, cc] = await Promise.all([
        getCached<Profile>(`profile:${session.user.id}`),
        getCached<Catalogue>("catalogue"),
      ]);
      if (cp) setProfile(cp);
      if (cc) setCatalogue(cc);

      try {
        const { data: p, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        if (error) throw new Error(errorCode(error));
        setOnline(true);
        if (!p) return setStage("profile");
        setProfile(p as Profile);
        await setCached(`profile:${session.user.id}`, p);
        await checkDevice(id);
      } catch (e) {
        // No internet. Allow reading if the phone was checked recently enough.
        if (errorCode(e) !== "offline") throw e;
        setOnline(false);
        const okAt = (await getCached<number>("device_ok_at")) ?? 0;
        const days = Number(cs?.offline_days ?? 90);
        if (cp && okAt && Date.now() - okAt < days * DAY) setStage("ready");
        else setStage("offline_block");
      }
    } catch {
      setStage("offline_block");
    } finally {
      booting.current = false;
    }
  }, [installId, loadSettings, checkDevice]);

  useEffect(() => {
    void boot();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        setProfile(null);
        setStage((s) => (s === "language" || s === "env" ? s : "signin"));
      }
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await setCached("lang", l);
    if (profile) {
      await supabase.from("profiles").update({ language: l }).eq("id", profile.id);
      const p = { ...profile, language: l };
      setProfile(p);
      await setCached(`profile:${p.id}`, p);
    }
  }, [profile]);

  const afterProfileSaved = useCallback(async (p: Profile) => {
    setProfile(p);
    await setCached(`profile:${p.id}`, p);
    await checkDevice(installId);
  }, [checkDevice, installId]);

  const moveHere = useCallback(async () => {
    await checkDevice(installId, true);
  }, [checkDevice, installId]);

  const signOut = useCallback(async () => {
    wipeAll();
    forgetMarks();
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
    await clearCached();
    await supabase.auth.signOut().catch(() => undefined);
    setUserId(null);
    setProfile(null);
    setCatalogue({ books: [], products: [] });
    setStage("signin");
  }, []);

  const value: Ctx = {
    stage, lang, t, setLang, userId, email, profile, settings, catalogue, deviceInfo, online,
    installId, model, boot, afterProfileSaved, moveHere, refreshCatalogue, signOut,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
