// apps/direct-transfair-mobile/app/pay/scan.tsx
// =========================================================
// PAYER AVEC QR CODE (caméra) v1.0 — Lot 11
// La caméra s'active, le client scanne le QR affiché par le marchand ; le contenu est vérifié (QR de paiement marchand
// uniquement) puis l'écran de confirmation s'ouvre avec le montant. Les QR d'autres origines sont refusés.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Platform, StatusBar, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "../../components/ui/Icon";
import { useTenant } from "../../providers/TenantProvider";
import { Button, IconButton, NavBar, Screen, UText, useUI } from "../../components/ui";
import { parseMerchantQr } from "../../components/merchant/merchantUi";

const { width: SW } = Dimensions.get("window");
const FRAME = Math.min(SW * 0.7, 270);

export default function PayScanScreen() {
  const { C, R } = useUI();
  const { branding } = useTenant();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [invalid, setInvalid] = useState(false);
  const lock = useRef(false);

  useFocusEffect(useCallback(() => {
    lock.current = false;
    setInvalid(false);
    return () => {};
  }, []));

  const onScanned = useCallback(({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    const payload = parseMerchantQr(data);
    if (!payload) { setInvalid(true); return; }
    router.replace({ pathname: "/pay/confirm", params: { payload } } as any);
  }, [router]);

  const retry = () => { lock.current = false; setInvalid(false); };

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.ink} size="large" /></View>;
  }

  if (!permission.granted) {
    return (
      <Screen header={<NavBar onBack={() => router.back()} />} footer={<Button label="Autoriser la caméra" icon="camera-outline" onPress={requestPermission} />}>
        <View style={{ alignItems: "center", paddingTop: 36, gap: 10 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.beige, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Ionicons name="camera-outline" size={38} color={C.ink} />
          </View>
          <UText v="title" align="center">Accès à la caméra requis</UText>
          <UText v="body" tone="muted" align="center" style={{ maxWidth: 320 }}>
            {branding.name} utilise la caméra uniquement pour lire le QR code de paiement du marchand.
          </UText>
        </View>
      </Screen>
    );
  }

  const corner = (pos: object) => <View style={[{ position: "absolute", width: 42, height: 42, borderColor: "#FFFFFF" }, pos]} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={invalid ? undefined : onScanned}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.28)" }]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 8 : 56 }}>
          <IconButton icon="chevron-back" label="Retour" onPress={() => router.back()} />
          <View style={{ paddingHorizontal: 16, height: 40, borderRadius: R.pill, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
            <UText v="bodyStrong">Payer avec QR code</UText>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {!invalid && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 24 }} pointerEvents="none">
            <View style={{ width: FRAME, height: FRAME }}>
              {corner({ top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 24 })}
              {corner({ top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 24 })}
              {corner({ bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 24 })}
              {corner({ bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 24 })}
            </View>
            <View style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.surface, maxWidth: "88%" }}>
              <UText v="caption" align="center">Placez le QR code du marchand dans le cadre</UText>
            </View>
          </View>
        )}
      </View>

      {invalid && (
        <View style={[{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 28, width: "100%", maxWidth: 640, alignSelf: "center" }]}>
          <View style={{ alignItems: "center", gap: 8 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.dangerBg, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
              <Ionicons name="close-circle-outline" size={30} color={C.danger} />
            </View>
            <UText v="heading" align="center">QR code non reconnu</UText>
            <UText v="body" tone="muted" align="center" style={{ marginBottom: 12 }}>Ce n'est pas un QR de paiement marchand de {branding.name}.</UText>
            <Button label="Réessayer" kind="dark" icon="refresh" onPress={retry} />
          </View>
        </View>
      )}
    </View>
  );
}
