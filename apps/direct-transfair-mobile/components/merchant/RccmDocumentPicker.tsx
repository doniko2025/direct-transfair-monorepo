// apps/direct-transfair-mobile/components/merchant/RccmDocumentPicker.tsx
// =========================================================
// PIÈCE JUSTIFICATIVE DU RCCM — en plus du numéro, le marchand joint la photo du document (appareil photo ou galerie).
// L'administrateur de la société la consulte depuis la fiche du marchand.
//  • <RccmDocumentPicker> : champ réutilisable (inscription, activation) — garde la photo choisie, l'envoi se fait après la création du compte ;
//  • <RccmDocumentCard>   : carte des réglages du commerce — envoi / remplacement immédiat, état « envoyé le … ».
// Contrôles côté téléphone : taille (8 Ko à 5,5 Mo) ; le serveur vérifie le format réel (JPEG, PNG, WebP, PDF) et la taille (6 Mo).
// =========================================================

import React, { useState } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "../ui/Icon";
import { Text } from "../ui/Text";
import { Button, Card, Notice, UText, useUI } from "../ui";
import { api } from "../../services/api";
import type { MerchantMe } from "../../services/merchantTypes";
import { apiProblem } from "./merchantUi";
import { fmtDate } from "../../i18n/runtime";
import { useT } from "../../providers/I18nProvider";

export interface RccmPick { uri: string; base64: string }

const MAX_BYTES = 5_500_000; // le serveur refuse au-delà de 6 Mo
const MIN_BYTES = 8 * 1024;
const OPTIONS = { mediaTypes: ["images"] as any, quality: 0.65, base64: true, allowsEditing: false, exif: false };

/** Date « 10 nov. 2026 » à partir d'une date ISO. */
const shortDate = (iso?: string | null): string => (iso ? fmtDate(iso, { day: "numeric", month: "short", year: "numeric" }) : "");

export function RccmDocumentPicker({
  value, onChange, uploadedAt, disabled, label,
}: { value: RccmPick | null; onChange: (v: RccmPick | null) => void; uploadedAt?: string | null; disabled?: boolean; label?: string }) {
  const { C, R } = useUI();
  const t = useT();
  const [problem, setProblem] = useState<string | null>(null);

  const accept = (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!a.base64) { setProblem(t('rccmDoc.unreadable')); return; }
    const bytes = Math.floor((a.base64.length * 3) / 4);
    if (bytes > MAX_BYTES) { setProblem(t('rccmDoc.tooBig')); return; }
    if (bytes < MIN_BYTES) { setProblem(t('rccmDoc.tooSmall')); return; }
    setProblem(null);
    onChange({ uri: a.uri, base64: a.base64 });
  };

  const camera = async () => {
    setProblem(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setProblem(t('rccmDoc.cameraPerm')); return; }
      accept(await ImagePicker.launchCameraAsync(OPTIONS));
    } catch { setProblem(t('rccmDoc.cameraFail')); }
  };

  const library = async () => {
    setProblem(null);
    try { accept(await ImagePicker.launchImageLibraryAsync(OPTIONS)); }
    catch { setProblem(t('rccmDoc.galleryFail')); }
  };

  const Choice = ({ icon, text, onPress }: { icon: string; text: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={text}
      style={({ pressed }) => ({
        flex: 1, minWidth: 130, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46,
        borderRadius: 23, borderWidth: 1.5, borderColor: C.lineStrong, backgroundColor: C.surface, opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon as any} size={19} color={C.ink} />
      <Text allowFontScaling={false} style={{ fontSize: 14, fontWeight: "700", color: C.ink }}>{text}</Text>
    </Pressable>
  );

  return (
    <View style={{ marginBottom: 18 }}>
      <UText v="label" tone="muted" style={{ marginBottom: 8 }}>{label ?? t('rccmDoc.title')}</UText>
      {value ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: R.lg, backgroundColor: C.field }}>
          <Image source={{ uri: value.uri }} style={{ width: 64, height: 84, borderRadius: 10, backgroundColor: C.line }} resizeMode="cover" accessibilityLabel={t('rccmDoc.preview')} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <UText v="bodyStrong">{t('rccmDoc.ready')}</UText>
            <UText v="caption" tone="muted">{t('rccmDoc.readyHint')}</UText>
            <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('rccmDoc.removeA11y')}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.danger }}>{t('rccmDoc.remove')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {Platform.OS !== "web" ? <Choice icon="camera-outline" text={t('rccmDoc.camera')} onPress={camera} /> : null}
            <Choice icon="images-outline" text={t('rccmDoc.gallery')} onPress={library} />
          </View>
          <UText v="caption" tone="muted" style={{ marginTop: 8 }}>
            {uploadedAt
              ? t('rccmDoc.sentOn', { date: shortDate(uploadedAt) })
              : t('rccmDoc.tip')}
          </UText>
        </>
      )}
      {problem ? <Notice tone="danger" style={{ marginTop: 10 }}>{problem}</Notice> : null}
    </View>
  );
}

/** Carte des réglages : envoi / remplacement immédiat de la pièce. */
export function RccmDocumentCard({ me, onChanged }: { me: MerchantMe; onChanged: () => void }) {
  const t = useT();
  const doc = me.profile?.rccmDocument ?? null;
  const [pick, setPick] = useState<RccmPick | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "pos" | "danger"; text: string } | null>(null);

  const send = async () => {
    if (!pick) return;
    setBusy(true); setMsg(null);
    try {
      await api.saveMerchantRccmDocument(pick.base64);
      setPick(null);
      setMsg({ tone: "pos", text: t('rccmDoc.sentOk') });
      onChanged();
    } catch (e) {
      setMsg({ tone: "danger", text: apiProblem(e).message });
    } finally { setBusy(false); }
  };

  return (
    <Card pad={20}>
      <UText v="heading" style={{ marginBottom: 4 }}>{t('rccmDoc.title')}</UText>
      {!doc && !pick ? (
        <Notice tone="warn" icon="document-attach-outline" style={{ marginBottom: 14 }}>
          {t('rccmDoc.missing')}
        </Notice>
      ) : null}
      {msg ? <Notice tone={msg.tone} style={{ marginBottom: 14 }}>{msg.text}</Notice> : null}
      <RccmDocumentPicker value={pick} onChange={setPick} uploadedAt={doc?.uploadedAt} disabled={busy} label={doc ? t('rccmDoc.replace') : t('rccmDoc.attach')} />
      {pick ? <Button label={t('rccmDoc.send')} icon="cloud-upload-outline" loading={busy} onPress={send} /> : null}
    </Card>
  );
}

export default RccmDocumentPicker;
