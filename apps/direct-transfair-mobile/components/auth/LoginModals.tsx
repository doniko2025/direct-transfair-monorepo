// apps/direct-transfair-mobile/components/auth/LoginModals.tsx
// =========================================================
// FENÊTRES DE L'ÉCRAN DE CONNEXION v1.0 — l'écran principal reste épuré ; le détail s'ouvre à la demande.
//   • <ForgotCodeModal />    : « Code oublié ? » → « Comment voulez-vous recevoir le code ? » (par email / par SMS) ;
//   • <LoginOptionsModal />  : « Autres options de connexion » → empreinte digitale (si activée), connexion par code reçu par email,
//                              email et mot de passe ↔ téléphone et code secret.
// =========================================================

import React from "react";
import { View } from "react-native";
import { ListRow, Sheet, UText } from "../ui";

export function ForgotCodeModal({
  visible, onClose, onPick,
}: { visible: boolean; onClose: () => void; onPick: (channel: "EMAIL" | "PHONE") => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Code oublié ?">
      <View style={{ paddingBottom: 6 }}>
        <UText v="body" tone="muted" style={{ marginBottom: 10 }}>
          Choisissez comment recevoir votre code de vérification pour en définir un nouveau.
        </UText>
        <ListRow icon="mail-outline" title="Par email" subtitle="Recevoir le code dans votre boîte mail" chevron={false} onPress={() => onPick("EMAIL")} />
        <ListRow icon="chatbubble-ellipses-outline" title="Par SMS" subtitle="Recevoir le code sur votre téléphone" chevron={false} last onPress={() => onPick("PHONE")} />
      </View>
    </Sheet>
  );
}

export function LoginOptionsModal({
  visible, onClose, method, biometricLabel, onBiometric, onEmailCode, onSwitchMethod,
}: {
  visible: boolean;
  onClose: () => void;
  method: "PHONE" | "EMAIL";
  /** Libellé de l'empreinte / Face ID ; absent = non disponible sur cet appareil (ou pas activée). */
  biometricLabel?: string | null;
  onBiometric: () => void;
  onEmailCode: () => void;
  onSwitchMethod: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Autres options de connexion">
      <View style={{ paddingBottom: 6 }}>
        {biometricLabel ? <ListRow icon="finger-print-outline" title={biometricLabel} chevron={false} onPress={onBiometric} /> : null}
        <ListRow icon="mail-open-outline" title="Code reçu par email" subtitle="Sans mot de passe : un code à 6 chiffres vous est envoyé" chevron={false} onPress={onEmailCode} />
        <ListRow
          icon={method === "PHONE" ? "mail-outline" : "call-outline"}
          title={method === "PHONE" ? "Email et mot de passe" : "Téléphone et code secret"}
          chevron={false}
          last
          onPress={onSwitchMethod}
        />
      </View>
    </Sheet>
  );
}
