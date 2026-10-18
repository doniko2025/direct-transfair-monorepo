// apps/direct-transfair-mobile/app/(tabs)/qr.tsx
// =========================================================
// QR CODE SCREEN v6.0 — Direct Transf'air
// ✅ v6.0 : REFONTE THÈME CLAIR — fond crème, carte blanche avec identité (avatar beige),
//    grand QR noir sur blanc dans un cadre aux coins d'accent, deux boutons pilule
//    (Scanner / Copier l'ID). Les teintes par rôle (ambre, vert écrits en dur) sont
//    supprimées : tout vient de la couleur de marque du tenant. Police système.
//    LOGIQUE INCHANGÉE (deep link `directtransfair://pay/{userId}`, copie via
//    expo-clipboard, partage natif, navigation vers /scan).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v5.3 : WHITE-LABEL — couleurs suivent la marque ; nom = branding.name du tenant.
// ✅ v5.2 : QR CODE RÉEL + ACTIONS FONCTIONNELLES (react-native-qrcode-svg, expo-clipboard,
//    Share natif, bouton Scanner → /scan). Scheme déclaré dans app.json.
// ✅ v5.1 : fond neutre unifié sur tous les rôles.
// =========================================================

import React, { useState } from "react";
import { Share, View } from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { useTenant } from "../../providers/TenantProvider";
import { Avatar, Button, Card, IconButton, NavBar, Pill, Screen, UText, useUI } from "../../components/ui";

// Scheme déclaré dans app.json ("scheme": "directtransfair")
const DEEP_LINK_SCHEME = "directtransfair";

/** QR sur fond blanc, entouré de quatre coins à la couleur de la société. */
function QRFrame({ value, accent, ink }: { value: string | null; accent: string; ink: string }) {
  const CORNER = 30;
  const THICK = 4;
  const corners = [
    { top: 0, left: 0, borderTopWidth: THICK, borderLeftWidth: THICK, borderTopLeftRadius: 10 },
    { top: 0, right: 0, borderTopWidth: THICK, borderRightWidth: THICK, borderTopRightRadius: 10 },
    { bottom: 0, left: 0, borderBottomWidth: THICK, borderLeftWidth: THICK, borderBottomLeftRadius: 10 },
    { bottom: 0, right: 0, borderBottomWidth: THICK, borderRightWidth: THICK, borderBottomRightRadius: 10 },
  ];
  return (
    <View style={{ width: 232, height: 232, justifyContent: "center", alignItems: "center" }}>
      {corners.map((c, i) => (
        <View key={i} style={[{ position: "absolute", width: CORNER, height: CORNER, borderColor: accent }, c as any]} />
      ))}
      {value ? (
        <QRCode value={value} size={184} color={ink} backgroundColor="#FFFFFF" />
      ) : (
        <Ionicons name="qr-code" size={184} color={ink} style={{ opacity: 0.2 }} />
      )}
    </View>
  );
}

export default function QRCodeScreen() {
  const { C } = useUI();
  const { branding } = useTenant();
  const router = useRouter();
  const { user } = useAuth();

  const [copied, setCopied] = useState(false);

  const displayName = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Client";
  const userId = user?.id?.slice(0, 12).toUpperCase() ?? "—";

  // Lien de paiement encodé dans le QR
  const qrValue = user?.id ? `${DEEP_LINK_SCHEME}://pay/${user.id}` : null;

  const handleCopyId = async () => {
    if (!user?.id) return;
    try {
      await Clipboard.setStringAsync(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const handleShare = async () => {
    if (!qrValue) return;
    try {
      await Share.share({
        message: `Envoyez-moi de l'argent sur ${branding.name} 💸\n\n${displayName}\n${qrValue}`,
      });
    } catch { /* noop */ }
  };

  return (
    <Screen
      header={
        <NavBar
          title="Mon QR code"
          onBack={() => router.back()}
          right={<IconButton icon="share-outline" label="Partager mon lien de paiement" onPress={handleShare} />}
        />
      }
      footer={
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button
            style={{ flex: 1 }}
            label={copied ? "Copié !" : "Copier l'ID"}
            kind="outline"
            icon={copied ? "checkmark" : "copy-outline"}
            onPress={handleCopyId}
          />
          <Button style={{ flex: 1 }} label="Scanner" icon="scan-outline" onPress={() => router.push("/scan" as any)} />
        </View>
      }
    >
      <UText v="body" tone="muted" style={{ marginBottom: 18 }}>
        Présente ce code pour recevoir de l'argent instantanément.
      </UText>

      <Card pad={0} style={{ overflow: "hidden" }}>
        {/* Identité */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 20 }}>
          <Avatar name={displayName} size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <UText v="subheading" numberOfLines={1}>{displayName}</UText>
            <UText v="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
              {user?.phone ?? user?.email ?? branding.name}
            </UText>
            <Pill label={`#${userId}`} tone="neutral" style={{ marginTop: 8 }} />
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: C.line, marginHorizontal: 20 }} />

        {/* QR */}
        <View style={{ alignItems: "center", paddingVertical: 28, gap: 18 }}>
          <View style={{ padding: 16, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.line }}>
            <QRFrame value={qrValue} accent={C.accent} ink={C.ink} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pos }} />
            <UText v="overline" tone="muted">QR actif · {branding.name}</UText>
          </View>
        </View>

        {/* Atouts */}
        <View style={{ flexDirection: "row", backgroundColor: C.sunken, paddingVertical: 14 }}>
          {[
            { icon: "flash-outline", label: "Instantané" },
            { icon: "shield-checkmark-outline", label: "Sécurisé" },
            { icon: "lock-closed-outline", label: "Chiffré" },
          ].map((it, i) => (
            <View
              key={it.label}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: C.line }}
            >
              <Ionicons name={it.icon as any} size={15} color={C.ink} />
              <UText v="label">{it.label}</UText>
            </View>
          ))}
        </View>
      </Card>

      <UText v="caption" tone="muted" align="center" style={{ marginTop: 16 }}>
        Code sécurisé · valide uniquement pour ton compte
      </UText>
    </Screen>
  );
}
