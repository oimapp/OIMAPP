// Small building blocks used on every screen, so the whole app looks the same.

import React from "react";
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, serif } from "@/lib/theme";

export function Screen({ children, scroll = true, pad = true }: { children: React.ReactNode; scroll?: boolean; pad?: boolean }) {
  const inner = <View style={[pad && { padding: 18 }, { gap: 14 }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Logo({ size = 96 }: { size?: number }) {
  return <Image source={require("@/assets/images/logo.png")} style={{ width: size, height: size, alignSelf: "center" }} />;
}

export function Title({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <Text style={[styles.title, center && { textAlign: "center" }]}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Body({ children, muted, center, style }: { children: React.ReactNode; muted?: boolean; center?: boolean; style?: object }) {
  return <Text style={[styles.body, muted && { color: C.muted }, center && { textAlign: "center" }, style]}>{children}</Text>;
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title, onPress, kind = "primary", busy, disabled,
}: { title: string; onPress: () => void; kind?: "primary" | "outline" | "danger" | "link"; busy?: boolean; disabled?: boolean }) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        kind === "primary" && { backgroundColor: C.brand },
        kind === "outline" && { borderWidth: 1.5, borderColor: C.brand, backgroundColor: C.white },
        kind === "danger" && { backgroundColor: C.red },
        kind === "link" && { backgroundColor: "transparent", minHeight: 36 },
        (pressed || off) && { opacity: 0.7 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={kind === "outline" || kind === "link" ? C.brand : C.white} />
      ) : (
        <Text style={[styles.btnText, (kind === "outline" || kind === "link") && { color: C.brand }, kind === "link" && { textDecorationLine: "underline" }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#9AA0B8" style={styles.input} {...props} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Notice({ text, tone = "info" }: { text: string; tone?: "info" | "error" | "ok" }) {
  const bg = tone === "error" ? C.redSoft : tone === "ok" ? C.greenSoft : C.soft;
  const fg = tone === "error" ? C.red : tone === "ok" ? C.green : C.deep;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 15, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

export function Pill({ text, tone = "brand" }: { text: string; tone?: "brand" | "green" | "muted" }) {
  const bg = tone === "green" ? C.greenSoft : tone === "muted" ? C.paper : C.soft;
  const fg = tone === "green" ? C.green : tone === "muted" ? C.muted : C.brand;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

export function Loading({ text }: { text?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: C.paper }}>
      <ActivityIndicator size="large" color={C.brand} />
      {text ? <Body muted center>{text}</Body> : null}
    </View>
  );
}

/** Two or three choices side by side, like English | Yorùbá. */
export function Segments<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segments}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[styles.segment, value === v && styles.segmentOn]}>
          <Text style={[styles.segmentText, value === v && { color: C.white }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  title: { fontFamily: serif, fontSize: 26, fontWeight: "700", color: C.deep },
  h2: { fontSize: 18, fontWeight: "700", color: C.ink },
  body: { fontSize: 16, lineHeight: 23, color: C.ink },
  card: { backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line, gap: 8 },
  btn: { minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnText: { color: C.white, fontSize: 16, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700", color: C.ink },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.ink },
  hint: { fontSize: 13, color: C.muted },
  notice: { borderRadius: 12, padding: 14 },
  segments: { flexDirection: "row", backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 9 },
  segmentOn: { backgroundColor: C.brand },
  segmentText: { fontSize: 14, fontWeight: "700", color: C.muted },
});
