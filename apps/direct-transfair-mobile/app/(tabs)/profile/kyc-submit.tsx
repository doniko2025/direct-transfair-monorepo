// apps/direct-transfair-mobile/app/(tabs)/profile/kyc-submit.tsx
// =========================================================
// ENVOI D'UNE PIÈCE v1.0 (lot 7) — paramètre `kind` : identity | selfie | address
//   identity : choix de la pièce, numéro, date d'expiration, photo recto (+ verso selon la pièce)
//   selfie   : photo du visage prise à la caméra avant
//   address  : justificatif de domicile ou relevé bancaire
// Les photos sont compressées par l'appareil (qualité 0,5) et envoyées en base64 ; le serveur contrôle le format réel
// (JPEG, PNG, WebP, PDF), la taille et le nombre d'envois. Une page à la fois, rien n'est envoyé avant « Envoyer ».
// ✅ v1.1 : si la pièce demandée est déjà VALIDÉE (et pas à renouveler), on n'ouvre plus le formulaire : message clair et retour
//    au dossier (avant, le client pouvait rouvrir le selfie déjà validé et se heurter à un refus du serveur).
// =========================================================

import React, { useEffect, useState } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "../../../components/ui/Icon";
import { serverMessage } from "../../../components/auth/authErrors";
import { useT } from "../../../providers/I18nProvider";
import { Button, Card, Field, NavBar, Notice, Screen, UText, useUI } from "../../../components/ui";
import {
  KYC_ADDRESS_TYPES, KYC_DOC_LABEL, KYC_IDENTITY_TYPES, KYC_NEEDS_BACK, KYC_NEEDS_EXPIRY, isFutureOrToday, kycApi, maskFrenchDate, parseFrenchDate,
  type KycDocType, type KycStatusView,
} from "../../../services/kyc";

type Kind = "identity" | "selfie" | "address";
type Photo = { uri: string; base64: string };

const MAX_BYTES = 5.6 * 1024 * 1024; // le serveur refuse au-delà de 6 Mo par fichier
const MIN_BYTES = 8 * 1024;

function sizeOf(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

function PhotoBox({
  label, hint, photo, onPick, selfie, error,
}: { label: string; hint: string; photo: Photo | null; onPick: (p: Photo) => void; selfie?: boolean; error?: string | null }) {
  const { C, R } = useUI();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const accept = (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!a.base64) { setProblem(t("ksub.unreadable")); return; }
    const bytes = sizeOf(a.base64);
    if (bytes > MAX_BYTES) { setProblem(t("ksub.tooBig")); return; }
    if (bytes < MIN_BYTES) { setProblem(t("ksub.tooSmall")); return; }
    setProblem(null);
    onPick({ uri: a.uri, base64: a.base64 });
  };

  const camera = async () => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setProblem(t("ksub.camDenied")); return; }
      accept(await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"], quality: 0.5, base64: true, allowsEditing: false, exif: false,
        ...(selfie ? { cameraType: ImagePicker.CameraType.front } : null),
      }));
    } catch { setProblem(t("ksub.camFail")); } finally { setBusy(false); }
  };

  const library = async () => {
    setBusy(true);
    try {
      accept(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5, base64: true, allowsEditing: false, exif: false }));
    } catch { setProblem(t("ksub.libFail")); } finally { setBusy(false); }
  };

  const canCamera = Platform.OS !== "web";
  const shown = problem ?? error ?? null;

  return (
    <Card style={{ marginBottom: 14 }} pad={16}>
      <UText v="subheading">{label}</UText>
      <UText v="caption" tone="muted" style={{ marginTop: 2, marginBottom: 12 }}>{hint}</UText>

      <Pressable
        onPress={canCamera ? camera : library}
        accessibilityRole="button"
        accessibilityLabel={photo ? t("ksub.retake", { label }) : t("ksub.add", { label })}
        style={{
          height: selfie ? 220 : 180, borderRadius: R.md, overflow: "hidden", alignItems: "center", justifyContent: "center",
          backgroundColor: C.field, borderWidth: 1.5, borderStyle: "dashed", borderColor: shown ? C.danger : C.line,
        }}
      >
        {photo ? (
          <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
        ) : (
          <View style={{ alignItems: "center", gap: 6 }}>
            <Ionicons name={selfie ? "person-circle-outline" : "camera-outline"} size={36} color={C.muted} />
            <UText v="caption" tone="muted">{canCamera ? t("ksub.tapShoot") : t("ksub.tapChoose")}</UText>
          </View>
        )}
        {photo ? (
          <View style={{ position: "absolute", right: 8, top: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 26, borderRadius: R.pill, backgroundColor: C.pos }}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            <UText v="caption" color="#FFFFFF" style={{ fontWeight: "700" }}>{t("ksub.added")}</UText>
          </View>
        ) : null}
      </Pressable>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        {canCamera ? (
          <View style={{ flex: 1 }}>
            <Button label={photo ? t("ksub.retakeBtn") : t("ksub.shoot")} icon="camera-outline" kind="soft" small onPress={camera} loading={busy} />
          </View>
        ) : null}
        {!selfie ? (
          <View style={{ flex: 1 }}>
            <Button label={t("ksub.gallery")} icon="images-outline" kind="outline" small onPress={library} disabled={busy} />
          </View>
        ) : null}
      </View>
      {shown ? <UText v="caption" tone="danger" style={{ marginTop: 8 }}>{shown}</UText> : null}
    </Card>
  );
}

function TypeChoice({ types, value, onChange }: { types: KycDocType[]; value: KycDocType | null; onChange: (t: KycDocType) => void }) {
  const { C, R } = useUI();
  return (
    <View style={{ gap: 8, marginBottom: 14 }}>
      {types.map((t) => {
        const on = value === t;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{
              flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: R.md,
              backgroundColor: on ? C.accentSoft : C.surface, borderWidth: 1.5, borderColor: on ? C.accent : C.line,
            }}
          >
            <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? C.accentDeep : C.muted} />
            <UText v="body" style={{ flex: 1 }}>{KYC_DOC_LABEL[t]}</UText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function KycSubmitScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: Kind = params.kind === "selfie" ? "selfie" : params.kind === "address" ? "address" : "identity";

  const [type, setType] = useState<KycDocType | null>(kind === "selfie" ? "SELFIE" : null);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [front, setFront] = useState<Photo | null>(null);
  const [back, setBack] = useState<Photo | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pièce déjà validée ? (on ne laisse pas renvoyer ce que le serveur refuserait)
  const [known, setKnown] = useState<KycStatusView | null>(null);
  useEffect(() => {
    let alive = true;
    kycApi.me().then((d) => { if (alive) setKnown(d); }).catch(() => { /* sans incidence : le serveur reste juge */ });
    return () => { alive = false; };
  }, []);
  const types: readonly string[] = kind === "selfie" ? ["SELFIE"] : kind === "address" ? KYC_ADDRESS_TYPES : KYC_IDENTITY_TYPES;
  const approved = known?.documents.find((d) => types.includes(d.type) && d.status === "APPROVED") ?? null;
  const renewable = kind === "identity" && !!known?.expiry && !known.expiry.expired; // pièce qui expire bientôt : renouvellement permis
  const alreadyValid = !!approved && !renewable && !(approved.expiryDate && !isFutureOrToday(approved.expiryDate));

  const needsBack = !!type && KYC_NEEDS_BACK.includes(type);
  const needsExpiry = !!type && KYC_NEEDS_EXPIRY.includes(type);
  const needsNumber = kind === "identity";
  const expiryIso = parseFrenchDate(expiry);

  const problems: string[] = [];
  if (!type) problems.push(t("ksub.pChoose"));
  if (needsNumber && number.trim().length < 4) problems.push(t("ksub.pNumber"));
  if (needsExpiry && !expiryIso) problems.push(t("ksub.pExpiryFmt", { fmt: t("ksub.dateFmt") }));
  else if (needsExpiry && expiryIso && !isFutureOrToday(expiryIso)) problems.push(t("ksub.pExpired"));
  if (!front) problems.push(needsBack ? t("ksub.pFront") : t("ksub.pPhoto"));
  if (needsBack && !back) problems.push(t("ksub.pBack"));

  const title = kind === "selfie" ? t("ksub.titleSelfie") : kind === "address" ? t("kycs.addressTitle") : t("kycs.idTitle");

  const submit = async () => {
    setTouched(true);
    if (problems.length > 0 || !type || !front) return;
    setBusy(true);
    setError(null);
    try {
      await kycApi.submit({
        type,
        front: front.base64,
        ...(needsBack && back ? { back: back.base64 } : {}),
        ...(needsNumber ? { documentNumber: number.trim() } : {}),
        ...(needsExpiry && expiryIso ? { expiryDate: expiryIso } : {}),
      });
      router.replace("/(tabs)/profile/kyc" as any);
    } catch (e) {
      setError(serverMessage(e) ?? t("ksub.sendFail"));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = problems.length === 0;

  if (alreadyValid) {
    return (
      <Screen header={<NavBar title={title} subtitle={t("ksub.step")} onBack={() => router.back()} />}>
        <Notice tone="pos" icon="checkmark-circle" title={t("ksub.alreadyTitle")}>
          {kind === "selfie" ? t("ksub.alreadySelfie") : kind === "address" ? t("ksub.alreadyAddress") : t("ksub.alreadyId")}{t("ksub.nothingToResend")}
        </Notice>
        <View style={{ marginTop: 16 }}>
          <Button label={t("ksub.backToFile")} kind="soft" onPress={() => router.replace("/(tabs)/profile/kyc" as any)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={<NavBar title={title} subtitle={t("ksub.step")} onBack={() => router.back()} />}
      footer={<Button label={t("ksub.submit")} icon="shield-checkmark-outline" onPress={submit} loading={busy} disabled={busy || (touched && !canSubmit)} />}
    >
      {kind === "identity" ? (
        <>
          <UText v="label" tone="muted" style={{ marginBottom: 8 }}>{t("ksub.whichId")}</UText>
          <TypeChoice types={KYC_IDENTITY_TYPES} value={type} onChange={(k) => { setType(k); setBack(null); }} />
        </>
      ) : kind === "address" ? (
        <>
          <UText v="label" tone="muted" style={{ marginBottom: 8 }}>{t("ksub.whichDoc")}</UText>
          <TypeChoice types={KYC_ADDRESS_TYPES} value={type} onChange={setType} />
        </>
      ) : (
        <Notice tone="info" style={{ marginBottom: 14 }}>
          {t("ksub.selfieTip")}
        </Notice>
      )}

      {type ? (
        <>
          {needsNumber ? (
            <Field
              label={t("ksub.numberLabel")}
              value={number}
              onChangeText={setNumber}
              autoCapitalize="characters"
              placeholder={t("ksub.numberPh")}
              maxLength={40}
              error={touched && number.trim().length < 4 ? t("ksub.pNumber") : null}
            />
          ) : null}
          {needsExpiry ? (
            <Field
              label={t("ksub.expiryLabel")}
              value={expiry}
              onChangeText={(v) => setExpiry(maskFrenchDate(v))}
              keyboardType="number-pad"
              placeholder={t("ksub.dateFmt")}
              maxLength={10}
              hint={t("ksub.expiryHint")}
              error={touched && (!expiryIso || !isFutureOrToday(expiryIso)) ? (expiryIso ? t("ksub.expiredShort") : t("ksub.invalidDate")) : null}
              style={{ marginTop: needsNumber ? 12 : 0 }}
            />
          ) : null}

          <View style={{ marginTop: needsNumber || needsExpiry ? 16 : 0 }}>
            <PhotoBox
              label={kind === "selfie" ? KYC_DOC_LABEL.SELFIE : needsBack ? t("ksub.front") : KYC_DOC_LABEL[type]}
              hint={kind === "selfie" ? t("ksub.selfieHint") : t("ksub.docHint")}
              photo={front}
              onPick={setFront}
              selfie={kind === "selfie"}
              error={touched && !front ? t("ksub.photoMissing") : null}
            />
            {needsBack ? (
              <PhotoBox
                label={t("ksub.back")}
                hint={t("ksub.backHint")}
                photo={back}
                onPick={setBack}
                error={touched && !back ? t("ksub.photoMissing") : null}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {error ? <Notice tone="danger" title={t("ksub.notSent")} style={{ marginTop: 4 }}>{error}</Notice> : null}
      {touched && problems.length > 0 && !error ? (
        <Notice tone="warn" title={t("ksub.toComplete")} style={{ marginTop: 4 }}>{problems.join("\n")}</Notice>
      ) : null}
    </Screen>
  );
}
