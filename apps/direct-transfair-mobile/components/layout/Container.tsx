// apps/direct-transfair-mobile/components/layout/Container.tsx
import React from "react";
import { View, StyleSheet } from "react-native";

export function Container(props: { children: React.ReactNode }) {
  return <View style={styles.container}>{props.children}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 1100, // clé pour éviter l’affichage “étiré” sur web desktop
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});
