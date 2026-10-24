import { router, useLocalSearchParams } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PartView } from "@/components/Blocks";
import { ReadAloud } from "@/components/ReadAloud";
import { TeacherGuide } from "@/components/TeacherGuide";
import { recordReadToday } from "@/lib/streak";
import type { Block } from "@/lib/vault";
import { Button, Icon, IconName, Loading, Segments, Sheet } from "@/components/ui";
import { Watermark } from "@/components/Watermark";
import { useApp } from "@/lib/app";
import { bookTitle, markRead, useBookIndex } from "@/lib/books";
import { setCached } from "@/lib/cache";
import { longDate } from "@/lib/dates";
import { Lang, translate } from "@/lib/i18n";
import { findMark, setMark, useMarks } from "@/lib/notes";
import { TEXT_SIZES, usePrefs } from "@/lib/prefs";
import { serif } from "@/lib/theme";
import { getItem, Item } from "@/lib/vault";

export default function Reader() {
  const { book: bookId, key } = useLocalSearchParams<{ book: string; key: string }>();
  const { t, lang, userId, profile, settings, catalogue } = useApp();
  const { prefs, setPref, C } = usePrefs();
  const book = catalogue.books.find((b) => b.id === bookId);
  const { index } = useBookIndex(bookId);
  const marks = useMarks(userId);
  const [item, setItem] = useState<Item | null>(null);
  const [missing, setMissing] = useState(false);
  const [readLang, setReadLang] = useState<Lang>(lang);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"lesson" | "guide">("lesson");

  const bookmark = bookId && key ? findMark(marks, bookId, key, "bookmark") : undefined;
  const note = bookId && key ? findMark(marks, bookId, key, "note") : undefined;
  const isBookmarked = !!bookmark && !bookmark.deleted;
  const noteText = note && !note.deleted ? note.body : "";

  // Block screenshots and screen recording while a book page is open (Android).
  useEffect(() => {
    if (settings.block_screenshots === false) return;
    ScreenCapture.preventScreenCaptureAsync("reader").catch(() => undefined);
    return () => { ScreenCapture.allowScreenCaptureAsync("reader").catch(() => undefined); };
  }, [settings.block_screenshots]);

  useEffect(() => {
    if (!userId || !bookId || !key) return;
    setItem(null);
    setMissing(false);
    void getItem(bookId, userId, key).then((it) => {
      if (!it) return setMissing(true);
      setItem(it);
      void markRead(userId, bookId, key);
      void recordReadToday();
      void setCached("last_read", { book: bookId, key, date: it.date, n: it.n, topic: { en: it.en?.topic ?? "", yo: it.yo?.topic ?? "" } });
    });
  }, [bookId, key, userId]);

  const pos = index?.findIndex((e) => e.key === key) ?? -1;
  const prev = pos > 0 ? index![pos - 1] : null;
  const next = index && pos >= 0 && pos < index.length - 1 ? index[pos + 1] : null;
  const go = (k: string) => router.replace(`/read/${bookId}/${k}`);

  const toggleBookmark = () => {
    if (userId && bookId && key) void setMark(userId, { book_id: bookId, item_key: key, kind: "bookmark", body: "", deleted: isBookmarked });
  };
  const openNote = () => { setDraft(noteText); setEditing(true); };
  const saveNote = (text: string) => {
    if (userId && bookId && key) void setMark(userId, { book_id: bookId, item_key: key, kind: "note", body: text.trim(), deleted: !text.trim() });
    setEditing(false);
  };

  if (missing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper, padding: 18 }}>
        <Text style={{ color: C.ink, fontSize: 16 }}>{t("notDownloaded")}</Text>
      </SafeAreaView>
    );
  }
  if (!item) return <Loading />;

  const part = item[readLang]?.topic ? item[readLang] : item.en;
  const showGuide = !!profile?.is_teacher && !!item.n && (book?.kind === "manual" || book?.kind === "children");
  const kicker = [
    item.n ? translate(readLang, "lesson", { n: item.n }) : "",
    item.review ? translate(readLang, "review") : "",
  ].filter(Boolean).join(" · ");

  const TopIcon = ({ name, onPress, color }: { name: IconName; onPress: () => void; color?: string }) => (
    <Pressable onPress={onPress} hitSlop={8} style={{ padding: 7 }}>
      <Icon name={name} size={24} color={color ?? C.deep} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <TopIcon name="arrow-left" onPress={() => router.back()} />
        <Text style={{ flex: 1, fontWeight: "700", color: C.deep }} numberOfLines={1}>
          {book ? bookTitle(book, lang) : ""}
        </Text>
        <TopIcon name="format-font-size-decrease" onPress={() => setPref("textSize", Math.max(0, prefs.textSize - 1))} />
        <TopIcon name="format-font-size-increase" onPress={() => setPref("textSize", Math.min(TEXT_SIZES.length - 1, prefs.textSize + 1))} />
        <TopIcon name={isBookmarked ? "bookmark" : "bookmark-outline"} color={isBookmarked ? C.red : C.deep} onPress={toggleBookmark} />
        <TopIcon name="pencil-outline" onPress={openNote} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView key={key} contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 16 }}>
          <Segments<Lang> value={readLang} onChange={setReadLang} options={[["yo", "Yorùbá"], ["en", "English"]]} />
          <Text style={{ color: C.muted, fontSize: 14 }}>
            {longDate(item.date, readLang)}{kicker ? `  ·  ${kicker}` : ""}
          </Text>
          {item.theme ? <Text style={{ color: C.red, fontWeight: "700" }}>{item.theme[readLang] || item.theme.en}</Text> : null}
          {showGuide && (
            <Segments<"lesson" | "guide"> value={tab} onChange={setTab} options={[["lesson", t("lessonTab")], ["guide", t("teacherGuide")]]} />
          )}
          {tab === "guide" && showGuide ? (
            <TeacherGuide bookId={bookId!} n={item.n!} />
          ) : (
            <>
              <ReadAloud parts={spoken(part)} lang={readLang} recorded={{ bookId: bookId!, key: key! }} />
              <PartView
                part={{ ...part, name: "" }}
                size={TEXT_SIZES[prefs.textSize]}
                lang={readLang}
                labels={{ memory: translate(readLang, "memoryVerse"), text: translate(readLang, "text"), open: translate(readLang, "openInBible") }}
              />
            </>
          )}

          {noteText ? (
            <Pressable onPress={openNote} style={{ borderWidth: 2, borderStyle: "dashed", borderColor: C.line, borderRadius: 14, padding: 16, gap: 6 }}>
              <Text style={{ color: C.muted, fontWeight: "700", fontSize: 13 }}>{t("yourNote")}</Text>
              <Text style={{ fontFamily: serif, color: C.ink, fontSize: 16, lineHeight: 24 }}>{noteText}</Text>
            </Pressable>
          ) : (
            <Button kind="outline" icon="pencil-outline" title={t("addNote")} onPress={openNote} />
          )}
        </ScrollView>
        {settings.watermark !== false && <Watermark text={profile?.phone ?? ""} />}
      </View>

      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line }}>
        <NavButton label={t("previous")} icon="chevron-left" disabled={!prev} onPress={() => prev && go(prev.key)} />
        <View style={{ width: 1, backgroundColor: C.line }} />
        <NavButton label={t("next")} icon="chevron-right" right disabled={!next} onPress={() => next && go(next.key)} />
      </View>

      <Sheet visible={editing} onClose={() => setEditing(false)}>
        <Text style={{ fontSize: 19, fontWeight: "700", color: C.ink }}>{noteText ? t("editNote") : t("addNote")}</Text>
        <Text style={{ color: C.muted }}>{part.topic}</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          autoFocus
          textAlignVertical="top"
          style={{ minHeight: 150, maxHeight: 280, borderWidth: 1.5, borderColor: C.line, borderRadius: 12, padding: 14, fontSize: 16, lineHeight: 23, color: C.ink, backgroundColor: C.paper, fontFamily: serif }}
        />
        <Text style={{ color: C.muted, fontSize: 13 }}>{t("notePrivate")}</Text>
        <Button title={t("save")} onPress={() => saveNote(draft)} />
        {noteText ? <Button kind="link" title={t("deleteNote")} onPress={() => saveNote("")} /> : null}
      </Sheet>
    </SafeAreaView>
  );

  function NavButton({ label, icon, right, disabled, onPress }: {
    label: string; icon: IconName; right?: boolean; disabled?: boolean; onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={{ flex: 1, flexDirection: right ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 14, opacity: disabled ? 0.35 : 1 }}
      >
        <Icon name={icon} size={22} />
        <Text style={{ color: C.brand, fontWeight: "700", fontSize: 15 }}>{label}</Text>
      </Pressable>
    );
  }
}

/** The lesson as plain sentences for the reading voice. */
function spoken(part: { topic: string; text: string; body: Block[] }) {
  const out = [part.topic, part.text];
  for (const b of part.body) {
    if (b.t === "lab") out.push(`${b.k}. ${b.x}`);
    else if (b.t === "mv") out.push(`${b.x} ${b.ref}`);
    else out.push(b.x);
  }
  return out;
}
