// The member's phone number printed faintly across the page.
// If someone photographs a page with another phone, the number shows whose book it was.

import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function Watermark({ text }: { text: string }) {
  if (!text) return null;
  const rows = Array.from({ length: 14 });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.rotate}>
        {rows.map((_, i) => (
          <Text key={i} numberOfLines={1} style={[styles.text, { marginLeft: (i % 2) * 70 }]}>
            {`${text}      ${text}      ${text}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rotate: { position: "absolute", top: -120, left: -160, right: -160, bottom: -120, justifyContent: "space-around", transform: [{ rotate: "-28deg" }] },
  text: { fontSize: 15, fontWeight: "700", color: "rgba(20, 34, 140, 0.07)", letterSpacing: 1 },
});
