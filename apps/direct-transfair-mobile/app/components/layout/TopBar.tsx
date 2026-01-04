//apps/direct-transfair-mobile/app/components/layout/TopBar.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function TopBar(props: { title?: string; rightText?: string }) {
  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Text style={styles.brand}>{props.title ?? "Direct Transf’air"}</Text>
        <View style={styles.right}>
          <Text style={styles.chip}>{props.rightText ?? "Bonjour"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
  },
  inner: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontSize: 16,
    fontWeight: "700",
  },
  right: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f6f7f9",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    fontSize: 12,
  },
});
