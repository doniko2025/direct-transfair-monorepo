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
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const accept = (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!a.base64) { setProblem("Photo illisible, réessayez."); return; }
    const bytes = sizeOf(a.base64);
    if (bytes > MAX_BYTES) { setProblem("Photo trop lourde. Reculez un peu ou choisissez une photo moins grande."); return; }
    if (bytes < MIN_BYTES) { setProblem("Photo trop petite ou vide, réessayez."); return; }
    setProblem(null);
    onPick({ uri: a.uri, base64: a.base64 });
  };

  const camera = async () => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setProblem("Autorisez l'appareil photo dans les réglages de votre téléphone pour photographier votre pièce."); return; }
      accept(await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"], quality: 0.5, base64: true, allowsEditing: false, exif: false,
        ...(selfie ? { cameraType: ImagePicker.CameraType.front } : null),
      }));
    } catch { setProblem("Impossible d'ouvrir l'appareil photo."); } finally { setBusy(false); }
  };

  const library = async () => {
    setBusy(true);
    try {
      accept(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5, base64: true, allowsEditing: false, exif: false }));
    } catch { setProblem("Impossible d'ouvrir la galerie."); } finally { setBusy(false); }
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
        accessibilityLabel={photo ? `Reprendre : ${label}` : `Ajouter : ${label}`}
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
            <UText v="caption" tone="muted">{canCamera ? "Touchez pour photographier" : "Touchez pour choisir une photo"}</UText>
          </View>
        )}
        {photo ? (
          <View style={{ position: "absolute", right: 8, top: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 26, borderRadius: R.pill, backgroundColor: C.pos }}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            <UText v="caption" color="#FFFFFF" style={{ fontWeight: "700" }}>Ajoutée</UText>
          </View>
        ) : null}
      </Pressable>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        {canCamera ? (
          <View style={{ flex: 1 }}>
            <Button label={photo ? "Reprendre" : "Photographier"} icon="camera-outline" kind="soft" small onPress={camera} loading={busy} />
          </View>
        ) : null}
        {!selfie ? (
          <View style={{ flex: 1 }}>
            <Button label="Galerie" icon="images-outline" kind="outline" small onPress={library} disabled={busy} />
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
  if (!type) problems.push("Choisissez la pièce.");
  if (needsNumber && number.trim().length < 4) problems.push("Indiquez le numéro de la pièce.");
  if (needsExpiry && !expiryIso) problems.push("Date d'expiration invalide (JJ/MM/AAAA).");
  else if (needsExpiry && expiryIso && !isFutureOrToday(expiryIso)) problems.push("Cette pièce est expirée : envoyez-en une en cours de validité.");
  if (!front) problems.push(needsBack ? "Ajoutez la photo du recto." : "Ajoutez la photo.");
  if (needsBack && !back) problems.push("Ajoutez la photo du verso.");

  const title = kind === "selfie" ? "Votre selfie" : kind === "address" ? "Justificatif de domicile" : "Pièce d'identité";

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
      setError(serverMessage(e) ?? "Envoi impossible pour le moment. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = problems.length === 0;

  if (alreadyValid) {
    return (
      <Screen header={<NavBar title={title} subtitle="Étape de vérification" onBack={() => router.back()} />}>
        <Notice tone="pos" icon="checkmark-circle" title="Déjà validé">
          {kind === "selfie" ? "Votre selfie est déjà validé." : kind === "address" ? "Votre justificatif de domicile est déjà validé." : "Votre pièce d'identité est déjà validée."} Il n'y a rien à renvoyer.
        </Notice>
        <View style={{ marginTop: 16 }}>
          <Button label="Retour à mon dossier" kind="soft" onPress={() => router.replace("/(tabs)/profile/kyc" as any)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={<NavBar title={title} subtitle="Étape de vérification" onBack={() => router.back()} />}
      footer={<Button label="Envoyer pour vérification" icon="shield-checkmark-outline" onPress={submit} loading={busy} disabled={busy || (touched && !canSubmit)} />}
    >
      {kind === "identity" ? (
        <>
          <UText v="label" tone="muted" style={{ marginBottom: 8 }}>Quelle pièce présentez-vous ?</UText>
          <TypeChoice types={KYC_IDENTITY_TYPES} value={type} onChange={(t) => { setType(t); setBack(null); }} />
        </>
      ) : kind === "address" ? (
        <>
          <UText v="label" tone="muted" style={{ marginBottom: 8 }}>Quel document envoyez-vous ?</UText>
          <TypeChoice types={KYC_ADDRESS_TYPES} value={type} onChange={setType} />
        </>
      ) : (
        <Notice tone="info" style={{ marginBottom: 14 }}>
          Prenez-vous en photo de face, visage dégagé (sans lunettes de soleil ni masque), dans un endroit bien éclairé.
        </Notice>
      )}

      {type ? (
        <>
          {needsNumber ? (
            <Field
              label="Numéro de la pièce"
              value={number}
              onChangeText={setNumber}
              autoCapitalize="characters"
              placeholder="Tel qu'écrit sur la pièce"
              maxLength={40}
              error={touched && number.trim().length < 4 ? "Indiquez le numéro de la pièce." : null}
            />
          ) : null}
          {needsExpiry ? (
            <Field
              label="Date d'expiration"
              value={expiry}
              onChangeText={(t) => setExpiry(maskFrenchDate(t))}
              keyboardType="number-pad"
              placeholder="JJ/MM/AAAA"
              maxLength={10}
              hint="Elle est écrite sur la pièce."
              error={touched && (!expiryIso || !isFutureOrToday(expiryIso)) ? (expiryIso ? "Pièce expirée." : "Date invalide.") : null}
              style={{ marginTop: needsNumber ? 12 : 0 }}
            />
          ) : null}

          <View style={{ marginTop: needsNumber || needsExpiry ? 16 : 0 }}>
            <PhotoBox
              label={kind === "selfie" ? "Selfie" : needsBack ? "Recto de la pièce" : KYC_DOC_LABEL[type]}
              hint={kind === "selfie" ? "Visage bien visible, de face." : "Les quatre coins de la pièce doivent être visibles, sans reflet."}
              photo={front}
              onPick={setFront}
              selfie={kind === "selfie"}
              error={touched && !front ? "Photo manquante." : null}
            />
            {needsBack ? (
              <PhotoBox
                label="Verso de la pièce"
                hint="Retournez la pièce et photographiez l'autre face."
                photo={back}
                onPick={setBack}
                error={touched && !back ? "Photo manquante." : null}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {error ? <Notice tone="danger" title="Envoi non effectué" style={{ marginTop: 4 }}>{error}</Notice> : null}
      {touched && problems.length > 0 && !error ? (
        <Notice tone="warn" title="Il reste à compléter" style={{ marginTop: 4 }}>{problems.join("\n")}</Notice>
      ) : null}
    </Screen>
  );
}
