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
import { useT } from "../../providers/I18nProvider";

export function ForgotCodeModal({
  visible, onClose, onPick,
}: { visible: boolean; onClose: () => void; onPick: (channel: "EMAIL" | "PHONE") => void }) {
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('modal.forgot.title')}>
      <View style={{ paddingBottom: 6 }}>
        <UText v="body" tone="muted" style={{ marginBottom: 10 }}>
          {t('modal.forgot.intro')}
        </UText>
        <ListRow icon="mail-outline" title={t('modal.forgot.email')} subtitle={t('modal.forgot.emailSub')} chevron={false} onPress={() => onPick("EMAIL")} />
        <ListRow icon="chatbubble-ellipses-outline" title={t('modal.forgot.sms')} subtitle={t('modal.forgot.smsSub')} chevron={false} last onPress={() => onPick("PHONE")} />
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
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('modal.options.title')}>
      <View style={{ paddingBottom: 6 }}>
        {biometricLabel ? <ListRow icon="finger-print-outline" title={biometricLabel} chevron={false} onPress={onBiometric} /> : null}
        <ListRow icon="mail-open-outline" title={t('modal.options.emailCode')} subtitle={t('modal.options.emailCodeSub')} chevron={false} onPress={onEmailCode} />
        <ListRow
          icon={method === "PHONE" ? "mail-outline" : "call-outline"}
          title={method === "PHONE" ? t('modal.options.useEmail') : t('modal.options.usePhone')}
          chevron={false}
          last
          onPress={onSwitchMethod}
        />
      </View>
    </Sheet>
  );
}
