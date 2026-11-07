// apps/direct-transfair-mobile/components/profile/ProfilePhotoSheet.tsx
// =========================================================
// CHOIX DE LA PHOTO DE PROFIL v1.0 — feuille basse « Prendre une photo / Choisir dans la galerie / Retirer ».
// Recadrage carré à la prise (allowsEditing, 1:1), compression par l'appareil (qualité 0,5) puis envoi au serveur, qui contrôle le format réel
// (JPEG, PNG, WebP) et la taille (2 Mo). Les permissions sont demandées au moment du choix, avec un message clair en cas de refus.
// =========================================================

import React, { useState } from "react";
import { Platform, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Notice, UText } from "../ui";
import { ListRow, Sheet } from "../ui/Layout";
import { useProfilePhotoActions } from "../../hooks/useProfilePhoto";

const MAX_BYTES = 1_900_000; // le serveur refuse au-delà de 2 Mo
const MIN_BYTES = 2 * 1024;

export function ProfilePhotoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { save, remove, busy, error, clearError, hasOwn } = useProfilePhotoActions();
  const [problem, setProblem] = useState<string | null>(null);
  const shown = problem ?? error;

  const close = () => { if (busy) return; setProblem(null); clearError(); onClose(); };

  const accept = async (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!a.base64) { setProblem("Photo illisible, réessayez."); return; }
    const bytes = Math.floor((a.base64.length * 3) / 4);
    if (bytes > MAX_BYTES) { setProblem("Photo trop lourde. Choisissez une photo moins grande."); return; }
    if (bytes < MIN_BYTES) { setProblem("Photo trop petite ou vide, réessayez."); return; }
    if (await save(a.base64, a.uri)) { setProblem(null); onClose(); }
  };

  const options = { mediaTypes: ["images"] as any, quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] as [number, number], exif: false };

  const camera = async () => {
    setProblem(null); clearError();
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setProblem("Autorisez l'appareil photo dans les réglages de votre téléphone."); return; }
      await accept(await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front }));
    } catch { setProblem("Impossible d'ouvrir l'appareil photo."); }
  };

  const library = async () => {
    setProblem(null); clearError();
    try {
      await accept(await ImagePicker.launchImageLibraryAsync(options));
    } catch { setProblem("Impossible d'ouvrir la galerie."); }
  };

  const drop = async () => {
    setProblem(null);
    if (await remove()) onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Photo de profil">
      <View style={{ paddingBottom: 6 }}>
        {shown ? <Notice tone="danger" style={{ marginBottom: 8 }}>{shown}</Notice> : null}
        {busy ? <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>Enregistrement en cours…</UText> : null}
        {Platform.OS !== "web" && <ListRow icon="camera-outline" title="Prendre une photo" onPress={busy ? undefined : camera} chevron={false} />}
        <ListRow icon="images-outline" title="Choisir dans la galerie" onPress={busy ? undefined : library} chevron={false} last={!hasOwn} />
        {hasOwn ? <ListRow icon="trash-outline" title="Retirer la photo" danger onPress={busy ? undefined : drop} chevron={false} last /> : null}
      </View>
    </Sheet>
  );
}
