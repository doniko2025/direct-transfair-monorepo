// apps/direct-transfair-mobile/app/pay/verify.tsx
// =========================================================
// VÉRIFIER UN REÇU v1.0 — Lot 14
// Scanner le QR d'un reçu PDF (ou coller son code) : le serveur répond avec les VRAIES données du paiement. On compare
// avec le document : un PDF retouché ne correspond plus. Utilisable par un client, un commerçant ou un caissier.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Platform, StatusBar, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { ReceiptCheck } from "../../services/merchantTypes";
import { Ionicons } from "../../components/ui/Icon";
import { Button, Card, Divider, Field, IconButton, NavBar, Notice, Screen, UText, useUI } from "../../components/ui";
import { Rise, StatusHero, apiProblem, money, shortDateTime } from "../../components/merchant/merchantUi";

const { width: SW } = Dimensions.get("window");
const FRAME = Math.min(SW * 0.7, 270);
const CODE_RE = /(MP-[A-Z0-9]{4,14}-[A-F0-9]{6}\.[A-Za-z0-9_-]{22})/;
const METHOD = { PHONE: "Téléphone", QR: "QR code", STATIC_QR: "QR de caisse" } as const;

/** Extrait le code d'un QR scanné (adresse de contrôle complète) ou d'un texte collé. */
export function extractReceiptCode(raw: string | null | undefined): string | null {
  let text = (raw ?? "").trim();
  try { text = decodeURIComponent(text); } catch { /* texte collé tel quel */ }
  const m = CODE_RE.exec(text);
  return m ? m[1]! : null;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 9 }}>
      <UText v="body" tone="muted">{label}</UText>
      <UText v={strong ? "bodyStrong" : "body"} style={{ flexShrink: 1, textAlign: "right" }}>{value}</UText>
    </View>
  );
}

function Result({ r, onAgain }: { r: ReceiptCheck; onAgain: () => void }) {
  if (!r.valid) {
    return (
      <View>
        <StatusHero tone="danger" icon="close-circle" title="Reçu non reconnu" message="Ce code ne correspond à aucun paiement. Le document est falsifié, incomplet ou le QR code est abîmé. Ne l'acceptez pas." />
        <Button label="Vérifier un autre reçu" kind="outline" onPress={onAgain} />
      </View>
    );
  }
  const refunded = r.status === "REFUNDED";
  return (
    <Rise>
      <StatusHero tone={refunded ? "warn" : "pos"} icon={refunded ? "return-down-back-outline" : "checkmark-circle"} title={refunded ? "Reçu authentique — REMBOURSÉ" : "Reçu authentique"} />
      <Card pad={18}>
        <UText v="hero" align="center" style={{ marginBottom: 6 }}>{money(r.amount, r.currency)}</UText>
        <Divider />
        <Line label="Commerce" value={r.businessName} strong />
        {!!r.city && <Line label="Ville" value={r.city} />}
        <Line label="Référence" value={r.reference} />
        <Line label="Payé le" value={shortDateTime(r.paidAt)} />
        <Line label="Moyen" value={METHOD[r.method]} />
        {r.refundedAt && <Line label="Remboursé le" value={shortDateTime(r.refundedAt)} />}
      </Card>
      <Notice tone="info" icon="information-circle-outline" style={{ marginTop: 14 }}>
        Comparez le montant, le commerce et la référence ci-dessus avec ceux écrits sur le reçu. S'ils diffèrent, le document a été modifié : ne l'acceptez pas.
      </Notice>
      <View style={{ height: 14 }} />
      <Button label="Vérifier un autre reçu" kind="outline" onPress={onAgain} />
    </Rise>
  );
}

export default function VerifyReceiptScreen() {
  const { C, R } = useUI();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReceiptCheck | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const lock = useRef(false);

  useFocusEffect(useCallback(() => { lock.current = false; return () => {}; }, []));

  const check = useCallback(async (raw: string) => {
    const code = extractReceiptCode(raw);
    if (!code) { setResult({ valid: false }); return; }
    setBusy(true);
    setProblem(null);
    try {
      setResult(await api.verifyReceipt(code));
    } catch (e) {
      setProblem(apiProblem(e).message);
      lock.current = false;
    } finally {
      setBusy(false);
    }
  }, []);

  const onScanned = useCallback(({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    void check(data);
  }, [check]);

  const again = () => { lock.current = false; setResult(null); setProblem(null); setText(""); };

  // ── Résultat ──
  if (result) {
    return (
      <Screen header={<NavBar onBack={() => router.back()} title="Vérifier un reçu" />}>
        <Result r={result} onAgain={again} />
      </Screen>
    );
  }

  // ── Saisie manuelle (ou caméra refusée) ──
  if (manual || (permission && !permission.granted && !permission.canAskAgain)) {
    return (
      <Screen
        header={<NavBar onBack={() => router.back()} title="Vérifier un reçu" />}
        footer={<Button label="Vérifier" icon="shield-checkmark-outline" loading={busy} disabled={text.trim().length < 10} onPress={() => check(text)} />}
      >
        {!!problem && <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice>}
        <Notice tone="info" icon="information-circle-outline" style={{ marginBottom: 14 }}>
          Collez le code écrit sous le QR code du reçu (il ressemble à MP-XXXX-XXXXXX.………) ou l'adresse complète du QR.
        </Notice>
        <Field label="Code du reçu" icon="document-text-outline" value={text} onChangeText={setText} autoCapitalize="none" multiline />
        {permission?.canAskAgain !== false && <Button label="Scanner avec la caméra" kind="outline" icon="camera-outline" onPress={() => setManual(false)} />}
      </Screen>
    );
  }

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.ink} size="large" /></View>;
  }

  if (!permission.granted) {
    return (
      <Screen
        header={<NavBar onBack={() => router.back()} title="Vérifier un reçu" />}
        footer={<View style={{ gap: 10 }}><Button label="Autoriser la caméra" icon="camera-outline" onPress={requestPermission} /><Button label="Saisir le code" kind="outline" onPress={() => setManual(true)} /></View>}
      >
        <View style={{ alignItems: "center", paddingTop: 36, gap: 10 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.beige, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Ionicons name="camera-outline" size={38} color={C.ink} />
          </View>
          <UText v="title" align="center">Accès à la caméra requis</UText>
          <UText v="body" tone="muted" align="center" style={{ maxWidth: 320 }}>La caméra sert uniquement à lire le QR code imprimé sur le reçu.</UText>
        </View>
      </Screen>
    );
  }

  const corner = (pos: object) => <View style={[{ position: "absolute", width: 42, height: 42, borderColor: "#FFFFFF" }, pos]} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={busy || problem ? undefined : onScanned} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.28)" }]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 8 : 56 }}>
          <IconButton icon="chevron-back" label="Retour" onPress={() => router.back()} />
          <View style={{ paddingHorizontal: 16, height: 40, borderRadius: R.pill, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
            <UText v="bodyStrong">Vérifier un reçu</UText>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 24 }} pointerEvents="none">
          <View style={{ width: FRAME, height: FRAME }}>
            {corner({ top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 24 })}
            {corner({ top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 24 })}
            {corner({ bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 24 })}
            {corner({ bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 24 })}
          </View>
          <View style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.surface, maxWidth: "88%" }}>
            {busy ? <ActivityIndicator color={C.ink} /> : <UText v="caption" align="center">Placez le QR code du reçu dans le cadre</UText>}
          </View>
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28, alignItems: "center", gap: 10 }}>
          {!!problem && <Notice tone="danger" style={{ width: "100%" }} action="Réessayer" onAction={again}>{problem}</Notice>}
          <Button label="Saisir le code" kind="dark" small full={false} onPress={() => setManual(true)} />
        </View>
      </View>
    </View>
  );
}
