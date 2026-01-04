// apps/direct-transfair-mobile/components/layout/Card.tsx
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";

export function Card(props: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f6f7f9",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 12,
    padding: 16,
  },
});
