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
import { useT } from "../../providers/I18nProvider";

const MAX_BYTES = 1_900_000; // le serveur refuse au-delà de 2 Mo
const MIN_BYTES = 2 * 1024;

export function ProfilePhotoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { save, remove, busy, error, clearError, hasOwn } = useProfilePhotoActions();
  const [problem, setProblem] = useState<string | null>(null);
  const shown = problem ?? error;

  const close = () => { if (busy) return; setProblem(null); clearError(); onClose(); };

  const accept = async (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!a.base64) { setProblem(t("photo.unreadable")); return; }
    const bytes = Math.floor((a.base64.length * 3) / 4);
    if (bytes > MAX_BYTES) { setProblem(t("photo.tooBig")); return; }
    if (bytes < MIN_BYTES) { setProblem(t("photo.tooSmall")); return; }
    if (await save(a.base64, a.uri)) { setProblem(null); onClose(); }
  };

  const options = { mediaTypes: ["images"] as any, quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] as [number, number], exif: false };

  const camera = async () => {
    setProblem(null); clearError();
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setProblem(t("photo.camDenied")); return; }
      await accept(await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front }));
    } catch { setProblem(t("photo.camFail")); }
  };

  const library = async () => {
    setProblem(null); clearError();
    try {
      await accept(await ImagePicker.launchImageLibraryAsync(options));
    } catch { setProblem(t("photo.libFail")); }
  };

  const drop = async () => {
    setProblem(null);
    if (await remove()) onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={t("photo.title")}>
      <View style={{ paddingBottom: 6 }}>
        {shown ? <Notice tone="danger" style={{ marginBottom: 8 }}>{shown}</Notice> : null}
        {busy ? <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>{t("photo.saving")}</UText> : null}
        {Platform.OS !== "web" && <ListRow icon="camera-outline" title={t("photo.take")} onPress={busy ? undefined : camera} chevron={false} />}
        <ListRow icon="images-outline" title={t("photo.choose")} onPress={busy ? undefined : library} chevron={false} last={!hasOwn} />
        {hasOwn ? <ListRow icon="trash-outline" title={t("photo.remove")} danger onPress={busy ? undefined : drop} chevron={false} last /> : null}
      </View>
    </Sheet>
  );
}
