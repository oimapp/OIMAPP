// The church's social media as round icons. The links are set in the admin (Settings > Church social media).

import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useApp } from "@/lib/app";
import { useColors } from "@/lib/prefs";

type Link = { kind: string; url: string };

const LOOK: Record<string, { label: string; bg: string; fa?: string; mci?: string }> = {
  linktree: { label: "All links", bg: "#2F9E44", mci: "link-variant" },
  facebook: { label: "Facebook", bg: "#1877F2", fa: "facebook-f" },
  youtube: { label: "YouTube", bg: "#FF0000", fa: "youtube" },
  telegram: { label: "Telegram", bg: "#229ED9", fa: "telegram" },
  tiktok: { label: "TikTok", bg: "#111111", fa: "tiktok" },
  instagram: { label: "Instagram", bg: "#C13584", fa: "instagram" },
  whatsapp: { label: "WhatsApp", bg: "#25D366", fa: "whatsapp" },
  website: { label: "Website", bg: "#14228C", mci: "web" },
};

export function SocialLinks({ title, card }: { title?: string; card?: boolean }) {
  const { settings } = useApp();
  const C = useColors();
  const links = ((settings.social_links ?? []) as Link[]).filter((l) => LOOK[l.kind] && /^https?:\/\//.test(l.url));
  if (!links.length) return null;
  return (
    <View style={card ? { gap: 10, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line } : { gap: 10 }}>
      {title ? <Text style={{ fontSize: 17, fontWeight: "700", color: C.ink }}>{title}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {links.map((l) => {
          const look = LOOK[l.kind];
          return (
            <Pressable
              key={l.kind}
              onPress={() => void Linking.openURL(l.url)}
              accessibilityRole="link"
              accessibilityLabel={look.label}
              style={({ pressed }) => ({ alignItems: "center", gap: 5, width: 62, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: look.bg, alignItems: "center", justifyContent: "center" }}>
                {look.fa ? (
                  <FontAwesome6 name={look.fa} brand size={24} color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name={look.mci as never} size={26} color="#FFFFFF" />
                )}
              </View>
              <Text style={{ fontSize: 11, color: C.muted, textAlign: "center" }} numberOfLines={1}>{look.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
