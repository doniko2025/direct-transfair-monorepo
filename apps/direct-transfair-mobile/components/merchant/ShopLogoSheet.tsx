// apps/direct-transfair-mobile/components/merchant/ShopLogoSheet.tsx
// =========================================================
// LOGO DU COMMERCE (lot 13) — feuille « Galerie / Appareil photo / Retirer ». Recadrage carré, compression par l'appareil, envoi au
// serveur qui vérifie le format réel (JPEG, PNG, WebP) et la taille (1 Mo). Le logo apparaît sur l'écran de paiement du client,
// les reçus et l'affiche du QR de caisse.
// =========================================================

import React, { useState } from "react";
import { Platform, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Notice, UText } from "../ui";
import { ListRow, Sheet } from "../ui/Layout";
import { api } from "../../services/api";
import { forgetMerchantLogo } from "../../hooks/useMerchantLogo";
import { apiProblem } from "./merchantUi";
import { useT } from "../../providers/I18nProvider";

const MAX_BYTES = 950_000; // le serveur refuse au-delà de 1 Mo
const MIN_BYTES = 8 * 1024;

export function ShopLogoSheet({
  visible, onClose, shopId, hasLogo, onChanged,
}: { visible: boolean; onClose: () => void; shopId?: string | null; hasLogo: boolean; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const close = () => { if (busy) return; setProblem(null); onClose(); };

  const done = () => { forgetMerchantLogo(shopId); setProblem(null); onChanged(); onClose(); };

  const accept = async (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!a.base64) { setProblem(t("mlogo.unreadable")); return; }
    const bytes = Math.floor((a.base64.length * 3) / 4);
    if (bytes > MAX_BYTES) { setProblem(t("mlogo.tooBig")); return; }
    if (bytes < MIN_BYTES) { setProblem(t("mlogo.tooSmall")); return; }
    setBusy(true);
    try { await api.saveMerchantLogo(a.base64); done(); }
    catch (e) { setProblem(apiProblem(e).message); }
    finally { setBusy(false); }
  };

  const options = { mediaTypes: ["images"] as any, quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] as [number, number], exif: false };

  const camera = async () => {
    setProblem(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setProblem(t("photo.camDenied")); return; }
      await accept(await ImagePicker.launchCameraAsync(options));
    } catch { setProblem(t("photo.camFail")); }
  };

  const library = async () => {
    setProblem(null);
    try { await accept(await ImagePicker.launchImageLibraryAsync(options)); }
    catch { setProblem(t("photo.libFail")); }
  };

  const drop = async () => {
    setBusy(true); setProblem(null);
    try { await api.removeMerchantLogo(); done(); }
    catch (e) { setProblem(apiProblem(e).message); }
    finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={close} title={t("mlogo.title")}>
      <View style={{ paddingBottom: 6 }}>
        {problem ? <Notice tone="danger" style={{ marginBottom: 8 }}>{problem}</Notice> : null}
        {busy ? <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>{t("photo.saving")}</UText> : null}
        {Platform.OS !== "web" && <ListRow icon="camera-outline" title={t("photo.take")} onPress={busy ? undefined : camera} chevron={false} />}
        <ListRow icon="images-outline" title={t("photo.choose")} onPress={busy ? undefined : library} chevron={false} last={!hasLogo} />
        {hasLogo ? <ListRow icon="trash-outline" title={t("mlogo.remove")} danger onPress={busy ? undefined : drop} chevron={false} last /> : null}
      </View>
    </Sheet>
  );
}

export default ShopLogoSheet;
