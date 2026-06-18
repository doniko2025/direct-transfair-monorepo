// apps/direct-transfair-mobile/app/scan.tsx
// =========================================================
// QR SCANNER SCREEN v1.0 — Direct Transf'air
// ✅ Scanne le QR généré par qr.tsx (directtransfair://pay/{userId})
// ✅ Résout l'identité via api.getPublicUser(id) — route backend
//    GET /users/public/:id (accessible à tout utilisateur authentifié,
//    scopée au même tenant — voir users.controller.ts v4.2)
// ✅ Gère : permission refusée, QR étranger non reconnu, auto-scan
//    de son propre QR, utilisateur introuvable / autre société
// ✅ Sur succès → navigue vers /(tabs)/send avec mode=WALLET et le
//    téléphone du destinataire pré-rempli (réutilise la détection
//    par téléphone déjà existante dans send.tsx, aucune logique
//    métier dupliquée)
//
// ⚠️ Dépendance requise : `npx expo install expo-camera`
//    (pas encore installée au moment de l'écriture de ce fichier)
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Platform, StatusBar, ActivityIndicator, Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";

const { width: SW } = Dimensions.get("window");
const DEEP_LINK_SCHEME = "directtransfair";

const T = {
  black:   "#000000",
  white:   "#FFFFFF",
  ink:     "#0D1F14",
  inkSub:  "#6B9E85",
  green:   "#059669",
  greenLt: "#ECFDF5",
  red:     "#DC2626",
  redLt:   "#FEF2F2",
  amber:   "#D97706",
  amberLt: "#FFFBEB",
  border:  "#E5E5EA",
  r: { sm: 12, md: 16, lg: 22, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
  },
};

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

// ✅ Extrait l'ID depuis directtransfair://pay/{id} (ou directtransfair://pay/{id}?...)
function extractUserId(raw: string): string | null {
  try {
    const match = raw.match(new RegExp(`^${DEEP_LINK_SCHEME}://pay/([^/?]+)`));
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export default function ScanScreen() {
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

  // ── Permission pas encore accordée ──────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={T.green} size="large" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.permissionWrap}>
          <View style={s.permissionIcon}>
            <Ionicons name="camera-outline" size={36} color={T.green} />
          </View>
          <Text style={[s.permissionTitle, { fontFamily: T.font.serif }]}>
            Accès à la caméra requis
          </Text>
          <Text style={[s.permissionTxt, { fontFamily: T.font.sans }]}>
            Direct Transf'air a besoin de la caméra pour scanner les QR codes de paiement.
          </Text>
          <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}>
            <Text style={[s.permissionBtnTxt, { fontFamily: T.font.sans }]}>Autoriser la caméra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.backLink} onPress={() => router.back()}>
            <Text style={[s.backLinkTxt, { fontFamily: T.font.sans }]}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={state.kind === "scanning" ? handleBarcodeScanned : undefined}
      />

      {/* Overlay sombre + cadre de visée */}
      <View style={s.overlay} pointerEvents="box-none">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={s.topBar}>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color={T.white} />
            </TouchableOpacity>
            <Text style={[s.topTitle, { fontFamily: T.font.serif }]}>Scanner un QR</Text>
            <View style={{ width: 38 }} />
          </View>

          {state.kind === "scanning" && (
            <View style={s.frameWrap}>
              <View style={s.frame} />
              <Text style={[s.hint, { fontFamily: T.font.sans }]}>
                Placez le QR code de paiement dans le cadre
              </Text>
            </View>
          )}
        </SafeAreaView>
      </View>

      {/* ── Bottom sheet résultat ── */}
      {state.kind !== "scanning" && (
        <View style={s.sheet}>
          {state.kind === "resolving" && (
            <View style={s.sheetCenter}>
              <ActivityIndicator color={T.green} size="large" />
              <Text style={[s.sheetMsg, { fontFamily: T.font.sans }]}>Recherche du destinataire…</Text>
            </View>
          )}

          {state.kind === "found" && (
            <View>
              <View style={s.foundRow}>
                <View style={s.avatarBox}>
                  <Text style={[s.avatarTxt, { fontFamily: T.font.serif }]}>
                    {(state.data.firstName?.[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.foundName, { fontFamily: T.font.serif }]}>
                    {`${state.data.firstName ?? ""} ${state.data.lastName ?? ""}`.trim() || "Utilisateur"}
                  </Text>
                  {!!state.data.phone && (
                    <Text style={[s.foundSub, { fontFamily: T.font.sans }]}>{state.data.phone}</Text>
                  )}
                </View>
                <View style={s.checkBadge}>
                  <Ionicons name="checkmark" size={16} color={T.white} />
                </View>
              </View>
              <TouchableOpacity style={s.primaryBtn} onPress={handleSendMoney} activeOpacity={0.88}>
                <Ionicons name="paper-plane-outline" size={18} color={T.white} />
                <Text style={[s.primaryBtnTxt, { fontFamily: T.font.sans }]}>Envoyer de l'argent</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryBtn} onPress={reset}>
                <Text style={[s.secondaryBtnTxt, { fontFamily: T.font.sans }]}>Scanner un autre QR</Text>
              </TouchableOpacity>
            </View>
          )}

          {state.kind === "self" && (
            <View style={s.sheetCenter}>
              <View style={[s.statusIcon, { backgroundColor: T.amberLt }]}>
                <Ionicons name="information-circle-outline" size={28} color={T.amber} />
              </View>
              <Text style={[s.sheetTitle, { fontFamily: T.font.serif }]}>C'est votre propre QR</Text>
              <Text style={[s.sheetMsg, { fontFamily: T.font.sans }]}>
                Présentez ce code à quelqu'un d'autre pour recevoir un paiement.
              </Text>
              <TouchableOpacity style={s.secondaryBtn} onPress={reset}>
                <Text style={[s.secondaryBtnTxt, { fontFamily: T.font.sans }]}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {(state.kind === "not-found" || state.kind === "invalid") && (
            <View style={s.sheetCenter}>
              <View style={[s.statusIcon, { backgroundColor: T.redLt }]}>
                <Ionicons name="close-circle-outline" size={28} color={T.red} />
              </View>
              <Text style={[s.sheetTitle, { fontFamily: T.font.serif }]}>QR non reconnu</Text>
              <Text style={[s.sheetMsg, { fontFamily: T.font.sans }]}>
                {state.kind === "not-found"
                  ? "Ce destinataire n'existe pas ou son compte est inactif."
                  : "Ce QR code ne provient pas de Direct Transf'air."}
              </Text>
              <TouchableOpacity style={s.secondaryBtn} onPress={reset}>
                <Text style={[s.secondaryBtnTxt, { fontFamily: T.font.sans }]}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {state.kind === "forbidden" && (
            <View style={s.sheetCenter}>
              <View style={[s.statusIcon, { backgroundColor: T.redLt }]}>
                <Ionicons name="lock-closed-outline" size={28} color={T.red} />
              </View>
              <Text style={[s.sheetTitle, { fontFamily: T.font.serif }]}>Société différente</Text>
              <Text style={[s.sheetMsg, { fontFamily: T.font.sans }]}>
                Ce destinataire n'appartient pas à votre société et ne peut pas recevoir de paiement ici.
              </Text>
              <TouchableOpacity style={s.secondaryBtn} onPress={reset}>
                <Text style={[s.secondaryBtnTxt, { fontFamily: T.font.sans }]}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const FRAME_SIZE = Math.min(SW * 0.7, 260);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.white },
  root: { flex: 1, backgroundColor: T.black },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 8 : 0,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: T.r.sm,
    backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center", alignItems: "center",
  },
  topTitle: { color: T.white, fontSize: 17, fontWeight: "700" },

  frameWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 18 },
  frame: {
    width: FRAME_SIZE, height: FRAME_SIZE, borderRadius: 20,
    borderWidth: 3, borderColor: T.white,
  },
  hint: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 40 },

  sheet: {
    backgroundColor: T.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 22, paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  sheetCenter: { alignItems: "center", gap: 10 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: T.ink },
  sheetMsg:   { fontSize: 13, color: T.inkSub, fontWeight: "600", textAlign: "center", lineHeight: 19, marginBottom: 6 },
  statusIcon: { width: 60, height: 60, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 4 },

  foundRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  avatarBox: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: T.greenLt,
    justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#A7F3D0",
  },
  avatarTxt: { fontSize: 20, fontWeight: "900", color: T.green },
  foundName: { fontSize: 17, fontWeight: "700", color: T.ink, marginBottom: 2 },
  foundSub:  { fontSize: 12, color: T.inkSub, fontWeight: "600" },
  checkBadge: {
    width: 28, height: 28, borderRadius: T.r.pill, backgroundColor: T.green,
    justifyContent: "center", alignItems: "center",
  },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: T.green, borderRadius: T.r.md, paddingVertical: 16, marginBottom: 10,
  },
  primaryBtnTxt: { color: T.white, fontSize: 14, fontWeight: "900", letterSpacing: 0.3 },
  secondaryBtn: { alignItems: "center", paddingVertical: 12 },
  secondaryBtnTxt: { color: T.inkSub, fontSize: 13, fontWeight: "700" },

  permissionWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, gap: 8 },
  permissionIcon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: T.greenLt,
    justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 1.5, borderColor: "#A7F3D0",
  },
  permissionTitle: { fontSize: 19, fontWeight: "700", color: T.ink, textAlign: "center" },
  permissionTxt: { fontSize: 13, color: T.inkSub, fontWeight: "600", textAlign: "center", lineHeight: 19, marginBottom: 12 },
  permissionBtn: { backgroundColor: T.green, borderRadius: T.r.md, paddingVertical: 15, paddingHorizontal: 32 },
  permissionBtnTxt: { color: T.white, fontSize: 14, fontWeight: "800" },
  backLink: { paddingVertical: 14 },
  backLinkTxt: { color: T.inkSub, fontSize: 13, fontWeight: "700" },
});