// How to buy a book the member does not own yet.
// Test APKs ("pilot" builds) show the WhatsApp agent and the payment page.
// Google Play builds must not point to outside payments (Google Play rules), so they only offer Google Play.

import React, { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useApp } from "@/lib/app";
import { buy, playPrices, restore } from "@/lib/billing";
import { CHANNEL } from "@/lib/env";
import { StringKey } from "@/lib/i18n";
import { useColors } from "@/lib/prefs";
import { Body, Button, Card, Icon, IconName, Notice } from "./ui";

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

  if (CHANNEL === "play") return <PlayBuy bookId={bookId} />;

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
      {agent ? (
        <Option icon="whatsapp" color={C.green} title={t("payWhatsApp")} hint={t("payWhatsAppHint")}
          onPress={() => void Linking.openURL(`https://wa.me/${agent}?text=${encodeURIComponent("Hi")}`)} />
      ) : null}
      {page ? (
        <Option icon="credit-card-outline" title={t("payOnline")} hint={t("payOnlineHint")}
          onPress={() => void Linking.openURL(`${page}?book=${encodeURIComponent(offers[0]?.id ?? "")}&phone=${encodeURIComponent(profile?.phone ?? "")}`)} />
      ) : null}
      <Body muted>{t("afterPay")}</Body>
    </View>
  );
}

/** Google Play: one button per product that contains this book, with Google's own price. */
function PlayBuy({ bookId }: { bookId: string }) {
  const { t, lang, catalogue, userId, refreshCatalogue } = useApp();
  const C = useColors();
  const offers = catalogue.products.filter((p) => p.book_ids.includes(bookId) && p.play_product_id);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: StringKey; tone: "ok" | "error" } | null>(null);
  const skus = offers.map((p) => p.play_product_id!).join(",");

  useEffect(() => {
    void playPrices(skus ? skus.split(",") : []).then(setPrices);
    // Finish any purchase that was paid but interrupted before the book unlocked.
    void restore().then((n) => { if (n) void refreshCatalogue(); });
  }, [skus, refreshCatalogue]);

  const go = async (sku: string) => {
    if (!userId || busy) return;
    setMsg(null);
    setBusy(sku);
    const r = await buy(sku, userId);
    setBusy(null);
    if (r === "paid") {
      setMsg({ key: "paidUnlocked", tone: "ok" });
      await refreshCatalogue();
    } else if (r === "pending") setMsg({ key: "payPending", tone: "ok" });
    else if (r === "cancelled") setMsg({ key: "payCancelled", tone: "error" });
    else if (r === "unavailable") setMsg({ key: "playUnavailable", tone: "error" });
    else setMsg({ key: "payFailed", tone: "error" });
  };

  const doRestore = async () => {
    setBusy("restore");
    await restore();
    await refreshCatalogue();
    setBusy(null);
  };

  return (
    <View style={{ gap: 12 }}>
      {msg ? <Notice tone={msg.tone} text={t(msg.key)} /> : null}
      <Card>
        <Text style={{ fontWeight: "700", fontSize: 17, color: C.ink }}>{t("buyHere")}</Text>
        {offers.length === 0 ? <Body muted>{t("noBooks")}</Body> : null}
        {offers.map((p) => (
          <View key={p.id} style={{ gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ color: C.ink, flex: 1, fontWeight: "600" }}>{lang === "yo" ? p.name_yo : p.name_en}</Text>
              <Text style={{ color: C.brand, fontWeight: "800" }}>{prices[p.play_product_id!] ?? naira(p.price_kobo)}</Text>
            </View>
            <Button title={busy === p.play_product_id ? t("checkingPayment") : t("buyWithPlay")} icon="google-play"
              busy={busy === p.play_product_id} disabled={!!busy} onPress={() => void go(p.play_product_id!)} />
          </View>
        ))}
      </Card>
      <Button kind="link" title={t("restorePurchases")} busy={busy === "restore"} onPress={() => void doRestore()} />
    </View>
  );
}
