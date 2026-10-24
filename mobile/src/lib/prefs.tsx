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

const DEFAULTS: Prefs = { appearance: "system", textSize: 1, welcomeOnOpen: true, reminderOn: true, reminderTime: "06:00" };

// Bump this when a default must be applied again to phones that saved older choices.
const PREFS_VERSION = 2;

type Ctx = { prefs: Prefs; setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void; C: Colors; ready: boolean };
const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getCached<Partial<Prefs> & { v?: number }>("prefs").then((p) => {
      if (p) {
        // The daily reminder is on for everyone from version 2 (conference request).
        const upgraded = (p.v ?? 1) < PREFS_VERSION ? { ...p, reminderOn: true } : p;
        setPrefs({ ...DEFAULTS, ...upgraded });
      }
      setReady(true);
    });
  }, []);

  const setPref = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setPrefs((old) => {
      const next = { ...old, [k]: v };
      void setCached("prefs", { ...next, v: PREFS_VERSION });
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
