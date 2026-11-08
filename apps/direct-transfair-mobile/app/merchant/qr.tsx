// apps/direct-transfair-mobile/app/merchant/qr.tsx
// =========================================================
// QR DE CAISSE PERMANENT v1.0 — Lot 13
// Un QR code qui ne change pas : affiché sur le comptoir ou imprimé, le client le scanne, saisit LUI-MÊME le montant puis valide
// avec son code secret. Le propriétaire (et ses caissiers, en lecture) peut l'afficher, le partager en affiche PDF, l'imprimer ;
// seul le propriétaire peut le renouveler (code secret) — l'ancien QR cesse alors de fonctionner immédiatement.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useRef, useState } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import { sharePoster } from "../../services/merchantDocs";
import { useLoader } from "../../components/wallet/useLoader";
import { useMerchantLogo } from "../../hooks/useMerchantLogo";
import { Button, Card, ErrorView, NavBar, Notice, Screen, Sheet, SkeletonRows, UText, useUI } from "../../components/ui";
import { PinPrompt, Rise, apiProblem } from "../../components/merchant/merchantUi";
import { ShopAvatar } from "../../components/merchant/ShopAvatar";

export default function StaticQrScreen() {
  const router = useRouter();
  const { C, R, S } = useUI();
  const { merchantId } = useLocalSearchParams<{ merchantId?: string }>();
  const asCashier = !!merchantId;
  const { data, status, error, reload } = useLoader(() => api.getStaticQr(merchantId ? String(merchantId) : undefined));
  const logo = useMerchantLogo(data?.shopId, data?.logoVersion);
  const qrRef = useRef<any>(null);
  const [busy, setBusy] = useState<"share" | "print" | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [rotating, setRotating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const poster = (print: boolean) => {
    if (!data || !qrRef.current?.toDataURL) return;
    setBusy(print ? "print" : "share");
    qrRef.current.toDataURL(async (b64: string) => {
      try { await sharePoster(data, b64, logo, print); } finally { setBusy(null); }
    });
  };

  const rotate = async (code: string) => {
    if (rotating || code.length !== 6) return;
    setRotating(true);
    setProblem(null);
    try {
      await api.rotateStaticQr(code);
      setRotateOpen(false);
      setPin("");
      setDone(true);
      reload();
    } catch (e) {
      setProblem(apiProblem(e).message);
      setPin("");
    } finally {
      setRotating(false);
    }
  };

  const header = <NavBar onBack={() => router.back()} title="QR de caisse" subtitle={data?.businessName} />;
  if (status === "loading") return <Screen header={header}><SkeletonRows rows={3} /></Screen>;
  if (status === "error" || !data) {
    return <Screen header={header}><ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} /></Screen>;
  }

  return (
    <Screen
      header={header}
      footer={
        <View style={{ gap: 10 }}>
          <Button label="Partager l'affiche (PDF)" icon="share-social-outline" loading={busy === "share"} onPress={() => poster(false)} />
          <Button label="Imprimer" icon="print-outline" kind="outline" loading={busy === "print"} onPress={() => poster(true)} />
        </View>
      }
    >
      {done && <Notice tone="pos" style={{ marginBottom: 12 }}>Nouveau QR code activé. Remplacez les anciennes affiches : elles ne fonctionnent plus.</Notice>}
      <Rise>
        <Card pad={22} style={[{ alignItems: "center", gap: 14, borderRadius: R.xl }, S.md]}>
          <ShopAvatar shopId={data.shopId} version={data.logoVersion} name={data.businessName} size={64} />
          <UText v="title" align="center" numberOfLines={2}>{data.businessName}</UText>
          {!!data.city && <UText v="caption" tone="muted" align="center">{data.city}</UText>}
          <View style={{ padding: 14, borderRadius: R.lg, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.line }}>
            <QRCode value={data.payload} size={224} color="#111111" backgroundColor="#FFFFFF" ecl="M" getRef={(c: any) => { qrRef.current = c; }} />
          </View>
          <UText v="bodyStrong" align="center">Scannez pour payer</UText>
        </Card>
      </Rise>

      <Notice tone="info" icon="information-circle-outline" style={{ marginTop: 14 }}>
        Ce QR code est permanent. Le client saisit le montant sur son téléphone et valide avec son code secret : vous recevez une notification à chaque paiement.
      </Notice>

      {!asCashier && (
        <Card pad={16} style={{ marginTop: 14 }}>
          <UText v="bodyStrong">QR code compromis ?</UText>
          <UText v="caption" tone="muted" style={{ marginTop: 4, marginBottom: 12 }}>
            Affiche volée ou copiée : renouvelez le QR code. L'ancien cesse de fonctionner tout de suite.
          </UText>
          <Button label="Renouveler le QR code" icon="refresh" kind="outline" small full={false} onPress={() => { setProblem(null); setPin(""); setRotateOpen(true); }} />
        </Card>
      )}

      <Sheet visible={rotateOpen} onClose={() => setRotateOpen(false)} title="Renouveler le QR code">
        <UText v="body" tone="muted" style={{ marginBottom: 14 }}>Confirmez avec votre code secret. Les affiches déjà imprimées devront être remplacées.</UText>
        {!!problem && <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice>}
        <PinPrompt value={pin} onChange={setPin} onComplete={rotate} autoFocus />
        <View style={{ height: 12 }} />
        <Button label="Renouveler" loading={rotating} disabled={pin.length !== 6} onPress={() => rotate(pin)} />
      </Sheet>
    </Screen>
  );
}
