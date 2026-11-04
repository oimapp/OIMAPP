// How to buy a book the member does not own yet.
// Test APKs ("pilot" builds) show the WhatsApp agent and the payment page.
// Google Play builds must not point to outside payments, so they only offer Google Play.

import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useApp } from "@/lib/app";
import { CHANNEL } from "@/lib/env";
import { useColors } from "@/lib/prefs";
import { Body, Card, Icon, IconName } from "./ui";

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

export function BuyOptions({ bookId }: { bookId: string }) {
  const { t, lang, catalogue, settings, profile } = useApp();
  const C = useColors();
  const offers = catalogue.products.filter((p) => p.book_ids.includes(bookId));
  const agent = String(settings.agent_whatsapp ?? "").replace(/[^\d]/g, "");
  const page = String(settings.pay_page_url ?? "");

  const Option = ({ icon, title, hint, onPress, color }: { icon: IconName; title: string; hint: string; onPress: () => void; color?: string }) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", gap: 12, alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, opacity: pressed ? 0.8 : 1 })}>
      <Icon name={icon} size={28} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.ink, fontWeight: "700", fontSize: 16 }}>{title}</Text>
        <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{hint}</Text>
      </View>
      <Icon name="chevron-right" color={C.muted} />
    </Pressable>
  );

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text style={{ fontWeight: "700", fontSize: 17, color: C.ink }}>{t("buyHere")}</Text>
        {offers.length === 0 ? <Body muted>{t("noBooks")}</Body> : offers.map((p) => (
          <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
            <Text style={{ color: C.ink, flex: 1 }}>{lang === "yo" ? p.name_yo : p.name_en}</Text>
            <Text style={{ color: C.brand, fontWeight: "800" }}>{naira(p.price_kobo)}</Text>
          </View>
        ))}
      </Card>
      {CHANNEL === "pilot" ? (
        <>
          {agent ? (
            <Option icon="whatsapp" color={C.green} title={t("payWhatsApp")} hint={t("payWhatsAppHint")}
              onPress={() => void Linking.openURL(`https://wa.me/${agent}?text=${encodeURIComponent("Hi")}`)} />
          ) : null}
          {page ? (
            <Option icon="credit-card-outline" title={t("payOnline")} hint={t("payOnlineHint")}
              onPress={() => void Linking.openURL(`${page}?book=${encodeURIComponent(offers[0]?.id ?? "")}&phone=${encodeURIComponent(profile?.phone ?? "")}`)} />
          ) : null}
          <Body muted>{t("afterPay")}</Body>
        </>
      ) : (
        <Card><Body muted>{t("playSoon")}</Body></Card>
      )}
    </View>
  );
}
