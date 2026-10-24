// A book's cover: the picture uploaded in the admin, or a designed cover until there is one.

import React from "react";
import { Image, Text, View, ViewStyle } from "react-native";
import type { BookRow } from "@/lib/app";
import { bookTitle } from "@/lib/books";
import type { Lang } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { serif } from "@/lib/theme";
import { Icon } from "./ui";

export function coverUrl(path: string | null | undefined) {
  return path ? supabase.storage.from("public").getPublicUrl(path).data.publicUrl : null;
}

export function Cover({ book, lang, width, style }: { book: BookRow; lang: Lang; width: number; style?: ViewStyle }) {
  const height = Math.round(width * 1.38);
  const uri = coverUrl(book.cover_path);
  const radius = Math.max(8, width * 0.06);
  if (uri) {
    return <Image source={{ uri }} style={[{ width, height, borderRadius: radius, backgroundColor: "#E8EAF8" }, style as object]} resizeMode="cover" />;
  }
  const bg = book.kind === "children" ? "#B3142B" : book.kind === "daily" ? "#14228C" : "#0B145E";
  const [title, year] = [bookTitle(book, lang).replace(/ \d{4}$/, ""), String(book.year)];
  const small = width < 120;
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: bg, padding: small ? 10 : 16, justifyContent: "space-between", overflow: "hidden" }, style]}>
      <View style={{ position: "absolute", right: -width * 0.25, top: -width * 0.25, width: width * 0.8, height: width * 0.8, borderRadius: width, backgroundColor: "rgba(255,255,255,0.08)" }} />
      <Icon name={book.kind === "daily" ? "white-balance-sunny" : "book-cross"} size={small ? 22 : 34} color="#FFFFFF" />
      <View style={{ gap: 4 }}>
        <View style={{ height: 3, width: small ? 22 : 36, backgroundColor: "#E0263F", borderRadius: 2 }} />
        <Text style={{ fontFamily: serif, color: "#FFFFFF", fontWeight: "700", fontSize: small ? 13 : 19, lineHeight: small ? 17 : 24 }}>{title}</Text>
        <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: small ? 11 : 14 }}>{year}</Text>
      </View>
    </View>
  );
}
