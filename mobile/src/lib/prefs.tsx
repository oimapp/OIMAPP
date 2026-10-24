// The member's own choices on this phone: light or dark look, text size,
// welcome page, and the daily reminder.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { getCached, setCached } from "./cache";
import { Colors, DARK, LIGHT } from "./theme";

export type Appearance = "system" | "light" | "dark";

export type Prefs = {
  appearance: Appearance;
  textSize: number;          // 0..4, see TEXT_SIZES
  welcomeOnOpen: boolean;
  reminderOn: boolean;
  reminderTime: string;      // "06:00"
};

export const TEXT_SIZES = [0.85, 1, 1.15, 1.3, 1.5];

const DEFAULTS: Prefs = { appearance: "system", textSize: 1, welcomeOnOpen: true, reminderOn: false, reminderTime: "06:00" };

type Ctx = { prefs: Prefs; setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void; C: Colors; ready: boolean };
const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getCached<Partial<Prefs>>("prefs").then((p) => {
      if (p) setPrefs({ ...DEFAULTS, ...p });
      setReady(true);
    });
  }, []);

  const setPref = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setPrefs((old) => {
      const next = { ...old, [k]: v };
      void setCached("prefs", next);
      return next;
    });
  }, []);

  const dark = prefs.appearance === "dark" || (prefs.appearance === "system" && system === "dark");
  const value = useMemo(() => ({ prefs, setPref, C: dark ? DARK : LIGHT, ready }), [prefs, setPref, dark, ready]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const c = useContext(PrefsContext);
  if (!c) throw new Error("usePrefs must be used inside PrefsProvider");
  return c;
}

export function useColors() {
  return usePrefs().C;
}
