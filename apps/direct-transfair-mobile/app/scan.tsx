// apps/direct-transfair-mobile/app/scan.tsx
// =========================================================
// QR SCANNER SCREEN v2.0 — Direct Transf'air
// ✅ v2.0 : REFONTE THÈME CLAIR — écran de permission crème (icône beige, bouton pilule),
//    viseur à quatre coins de la couleur de la société sur l'image caméra, résultat dans
//    une feuille basse claire (avatar beige, bouton pilule « Envoyer de l'argent »).
//    Plus aucune couleur verte/rouge écrite en dur : accent = marque du tenant, états
//    via la palette du design system. LOGIQUE INCHANGÉE (extraction de l'ID depuis
//    directtransfair://pay/{id}, résolution api.getPublicUser, gestion permission
//    refusée / QR étranger / auto-scan / introuvable / autre société, redirection vers
//    /(tabs)/send avec mode=WALLET et le téléphone pré-rempli).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v1.1 : WHITE-LABEL — couleurs suivent la marque ; nom = branding.name du tenant.
// ✅ v1.0 : Scanne le QR généré par qr.tsx, résout l'identité via GET /users/public/:id
//    (même tenant), gère permission refusée, QR étranger, auto-scan, utilisateur introuvable.
// ⚠️ Dépendance requise : expo-camera.
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, Dimensions, ActivityIndicator, Platform, StatusBar } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../providers/AuthProvider";
import { useTenant } from "../providers/TenantProvider";
import { api } from "../services/api";
import { Avatar, Button, IconButton, Screen, NavBar, UText, useUI } from "../components/ui";

const { width: SW } = Dimensions.get("window");
const DEEP_LINK_SCHEME = "directtransfair";
const FRAME_SIZE = Math.min(SW * 0.7, 260);

type ResolvedUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  primaryCurrency?: string;
};

type ScanState =
  | { kind: "scanning" }
  | { kind: "resolving" }
  | { kind: "found"; data: ResolvedUser }
  | { kind: "self" }
  | { kind: "not-found" }
  | { kind: "forbidden" }
  | { kind: "invalid" };

// Extrait l'ID depuis directtransfair://pay/{id} (ou directtransfair://pay/{id}?...)
function extractUserId(raw: string): string | null {
  try {
    const match = raw.match(new RegExp(`^${DEEP_LINK_SCHEME}://pay/([^/?]+)`));
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export default function ScanScreen() {
  const { C, R, S } = useUI();
  const { branding } = useTenant();
  const router = useRouter();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: "scanning" });
  const lockRef = useRef(false);

  // Reset propre chaque fois qu'on revient sur cet écran
  useFocusEffect(
    useCallback(() => {
      lockRef.current = false;
      setState({ kind: "scanning" });
      return () => {};
    }, []),
  );

  const handleBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (lockRef.current) return;
    lockRef.current = true;

    const scannedId = extractUserId(data);
    if (!scannedId) {
      setState({ kind: "invalid" });
      return;
    }

    if (scannedId === user?.id) {
      setState({ kind: "self" });
      return;
    }

    setState({ kind: "resolving" });
    try {
      const resolved = await api.getPublicUser(scannedId);
      setState({ kind: "found", data: resolved });
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) setState({ kind: "not-found" });
      else if (status === 403) setState({ kind: "forbidden" });
      else setState({ kind: "invalid" });
    }
  }, [user?.id]);

  const reset = () => {
    lockRef.current = false;
    setState({ kind: "scanning" });
  };

  const handleSendMoney = () => {
    if (state.kind !== "found") return;
    const phone = state.data.phone;
    if (!phone) {
      setState({ kind: "invalid" });
      return;
    }
    router.replace({
      pathname: "/(tabs)/send",
      params: { mode: "WALLET", phone },
    } as any);
  };

  // ── Permission pas encore connue ────────────────────────
  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.ink} size="large" />
      </View>
    );
  }

  // ── Permission refusée / non accordée ───────────────────
  if (!permission.granted) {
    return (
      <Screen
        header={<NavBar onBack={() => router.back()} />}
        footer={<Button label="Autoriser la caméra" icon="camera-outline" onPress={requestPermission} />}
      >
        <View style={{ alignItems: "center", paddingTop: 36, gap: 10 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.beige, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Ionicons name="camera-outline" size={38} color={C.ink} />
          </View>
          <UText v="title" align="center">Accès à la caméra requis</UText>
          <UText v="body" tone="muted" align="center" style={{ maxWidth: 320 }}>
            {branding.name} a besoin de la caméra pour scanner les QR codes de paiement.
          </UText>
        </View>
      </Screen>
    );
  }

  const corner = (pos: object) => (
    <View style={[{ position: "absolute", width: 40, height: 40, borderColor: C.accent }, pos]} />
  );

  const status = (icon: string, tone: "warn" | "danger", title: string, message: string) => (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tone === "warn" ? C.warnBg : C.dangerBg, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
        <Ionicons name={icon as any} size={30} color={tone === "warn" ? C.warn : C.danger} />
      </View>
      <UText v="heading" align="center">{title}</UText>
      <UText v="body" tone="muted" align="center" style={{ marginBottom: 12 }}>{message}</UText>
      <Button label="Réessayer" kind="dark" icon="refresh" onPress={reset} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={state.kind === "scanning" ? handleBarcodeScanned : undefined}
      />

      {/* Barre du haut + viseur */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.18)" }]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 8 : 56 }}>
          <IconButton icon="chevron-back" label="Retour" onPress={() => router.back()} />
          <View style={{ paddingHorizontal: 16, height: 40, borderRadius: R.pill, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
            <UText v="bodyStrong">Scanner un QR</UText>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {state.kind === "scanning" && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 22 }} pointerEvents="none">
            <View style={{ width: FRAME_SIZE, height: FRAME_SIZE }}>
              {corner({ top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 22 })}
              {corner({ top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 22 })}
              {corner({ bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 22 })}
              {corner({ bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 22 })}
            </View>
            <View style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.surface }}>
              <UText v="caption" align="center">Place le QR code de paiement dans le cadre</UText>
            </View>
          </View>
        )}
      </View>

      {/* Feuille résultat */}
      {state.kind !== "scanning" && (
        <View
          style={[
            { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 28, width: "100%", maxWidth: 640, alignSelf: "center" },
            S.lg,
          ]}
        >
          {state.kind === "resolving" && (
            <View style={{ alignItems: "center", gap: 14, paddingVertical: 12 }}>
              <ActivityIndicator color={C.ink} size="large" />
              <UText v="body" tone="muted">Recherche du destinataire…</UText>
            </View>
          )}

          {state.kind === "found" && (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 6 }}>
                <Avatar name={`${state.data.firstName ?? ""} ${state.data.lastName ?? ""}`.trim() || "?"} size={56} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <UText v="heading" numberOfLines={1}>
                    {`${state.data.firstName ?? ""} ${state.data.lastName ?? ""}`.trim() || "Utilisateur"}
                  </UText>
                  {!!state.data.phone && <UText v="caption" tone="muted">{state.data.phone}</UText>}
                </View>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.pos, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </View>
              </View>
              <Button label="Envoyer de l'argent" icon="paper-plane-outline" onPress={handleSendMoney} />
              <Button label="Scanner un autre QR" kind="ghost" onPress={reset} />
            </View>
          )}

          {state.kind === "self" &&
            status("information-circle-outline", "warn", "C'est ton propre QR", "Présente ce code à quelqu'un d'autre pour recevoir un paiement.")}

          {(state.kind === "not-found" || state.kind === "invalid") &&
            status(
              "close-circle-outline", "danger", "QR non reconnu",
              state.kind === "not-found"
                ? "Ce destinataire n'existe pas ou son compte est inactif."
                : `Ce QR code ne provient pas de ${branding.name}.`,
            )}

          {state.kind === "forbidden" &&
            status("lock-closed-outline", "danger", "Société différente", "Ce destinataire n'appartient pas à ta société et ne peut pas recevoir de paiement ici.")}
        </View>
      )}
    </View>
  );
}
