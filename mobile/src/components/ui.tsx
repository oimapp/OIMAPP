// Small building blocks used on every screen, so the whole app looks the same
// in both light and dark mode.

import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch,
  Text, TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/lib/prefs";
import { serif } from "@/lib/theme";

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const C = useColors();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? C.brand} />;
}

export function Screen({ children, scroll = true, pad = true }: { children: React.ReactNode; scroll?: boolean; pad?: boolean }) {
  const C = useColors();
  const inner = <View style={[pad && { padding: 18 }, { gap: 14 }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={["top", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

/** A screen with a back arrow and a title at the top. */
export function SubScreen({ title, right, children, scroll = true, onBack }: { title: string; right?: React.ReactNode; children: React.ReactNode; scroll?: boolean; onBack?: () => void }) {
  const C = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={["top", "left", "right"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
        <Pressable onPress={onBack ?? (() => router.back())} hitSlop={12} style={{ padding: 6 }}>
          <Icon name="arrow-left" size={26} color={C.deep} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: serif, fontSize: 20, fontWeight: "700", color: C.deep }} numberOfLines={1}>{title}</Text>
        {right}
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 18, gap: 12 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Logo({ size = 96 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#FFFFFF", alignSelf: "center", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <Image source={require("@/assets/images/logo.png")} style={{ width: size, height: size }} />
    </View>
  );
}

export function Title({ children, center }: { children: React.ReactNode; center?: boolean }) {
  const C = useColors();
  return <Text style={{ fontFamily: serif, fontSize: 26, fontWeight: "700", color: C.deep, textAlign: center ? "center" : "left" }}>{children}</Text>;
}

export function H2({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const C = useColors();
  return <Text style={[{ fontSize: 18, fontWeight: "700", color: C.ink }, style]}>{children}</Text>;
}

export function Kicker({ children, color }: { children: React.ReactNode; color?: string }) {
  const C = useColors();
  return <Text style={{ color: color ?? C.red, fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</Text>;
}

export function Body({ children, muted, center, style }: { children: React.ReactNode; muted?: boolean; center?: boolean; style?: TextStyle }) {
  const C = useColors();
  return <Text style={[{ fontSize: 16, lineHeight: 23, color: muted ? C.muted : C.ink, textAlign: center ? "center" : "left" }, style]}>{children}</Text>;
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const C = useColors();
  const base: ViewStyle = { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line, gap: 8 };
  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Button({
  title, onPress, kind = "primary", busy, disabled, icon,
}: { title: string; onPress: () => void; kind?: "primary" | "outline" | "danger" | "link"; busy?: boolean; disabled?: boolean; icon?: IconName }) {
  const C = useColors();
  const off = disabled || busy;
  const fg = kind === "outline" || kind === "link" ? C.brand : kind === "danger" ? "#FFFFFF" : C.onBrand;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        { minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, flexDirection: "row", gap: 8 },
        kind === "primary" && { backgroundColor: C.brand },
        kind === "outline" && { borderWidth: 1.5, borderColor: C.brand, backgroundColor: C.card },
        kind === "danger" && { backgroundColor: C.red },
        kind === "link" && { backgroundColor: "transparent", minHeight: 36 },
        (pressed || off) && { opacity: 0.7 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: 16, fontWeight: "700", textDecorationLine: kind === "link" ? "underline" : "none" }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, style, ...props }: TextInputProps & { label: string; hint?: string }) {
  const C = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink }}>{label}</Text>
      <TextInput
        placeholderTextColor={C.muted}
        style={[{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.ink }, style]}
        {...props}
      />
      {hint ? <Text style={{ fontSize: 13, color: C.muted }}>{hint}</Text> : null}
    </View>
  );
}

export function Notice({ text, tone = "info" }: { text: string; tone?: "info" | "error" | "ok" }) {
  const C = useColors();
  const bg = tone === "error" ? C.redSoft : tone === "ok" ? C.greenSoft : C.soft;
  const fg = tone === "error" ? C.red : tone === "ok" ? C.green : C.deep;
  return (
    <View style={{ borderRadius: 12, padding: 14, backgroundColor: bg }}>
      <Text style={{ color: fg, fontSize: 15, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

export function Pill({ text, tone = "brand" }: { text: string; tone?: "brand" | "green" | "muted" | "red" }) {
  const C = useColors();
  const bg = tone === "green" ? C.greenSoft : tone === "muted" ? C.paper : tone === "red" ? C.redSoft : C.soft;
  const fg = tone === "green" ? C.green : tone === "muted" ? C.muted : tone === "red" ? C.red : C.brand;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

export function Loading({ text }: { text?: string }) {
  const C = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: C.paper }}>
      <ActivityIndicator size="large" color={C.brand} />
      {text ? <Body muted center>{text}</Body> : null}
    </View>
  );
}

/** Two or three choices side by side, like English | Yorùbá. */
export function Segments<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const C = useColors();
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 4, gap: 4 }}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={{ flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 9, backgroundColor: value === v ? C.brand : "transparent" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: value === v ? C.onBrand : C.muted }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A row in a settings list: icon, text, and something on the right. */
export function Row({ icon, title, hint, right, onPress, iconBg, iconColor }: {
  icon: IconName; title: string; hint?: string; right?: React.ReactNode; onPress?: () => void; iconBg?: string; iconColor?: string;
}) {
  const C = useColors();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: iconBg ?? C.paper, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: C.ink, fontWeight: "600" }}>{title}</Text>
        {hint ? <Text style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" color={C.muted} /> : null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const C = useColors();
  return <Switch value={value} onValueChange={onChange} trackColor={{ true: C.brand, false: C.line }} thumbColor="#FFFFFF" />;
}

/** A group of rows with lines between them. */
export function Group({ children }: { children: React.ReactNode }) {
  const C = useColors();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14 }}>
      {items.map((child, i) => (
        <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: C.line } : undefined}>{child}</View>
      ))}
    </View>
  );
}

/** A panel that slides up from the bottom. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const C = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(5,8,30,0.5)" }} onPress={onClose} />
        <View style={{ backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34, gap: 12 }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: "center", marginBottom: 4 }} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
