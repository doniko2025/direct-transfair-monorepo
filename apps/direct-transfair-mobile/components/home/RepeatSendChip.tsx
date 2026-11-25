// apps/direct-transfair-mobile/components/home/RepeatSendChip.tsx
// =========================================================
// « RENVOYER » EN UN GESTE v2.0 — carte d'accueil : « Renvoyer 50 000 GNF » · « à Mariama · même montant ».
// ✅ v2.0 : REFONTE DU DESIGN (avant : une simple ligne grise sans style). Carte pleine couleur de la société (couleur d'accent, texte lisible calculé),
//    pastille du destinataire (initiale) + badge « renvoyer », bouton rond avec flèche qui fait un petit va-et-vient, reflet lumineux qui traverse la carte
//    de temps en temps, cercles décoratifs, effet « ressort » à l'appui. Couleurs 100 % dynamiques (useUI) ; animations coupées si « réduire les animations ».
//    Logique inchangée : même dernier envoi, même navigation vers l'écran d'envoi pré-rempli.
// (lot 19) — une seule ligne discrète sur l'accueil : « Renvoyer 50 000 GNF à Mariama ».
// Elle propose le DERNIER envoi réussi de l'utilisateur (même destinataire, même montant) ; l'appui ouvre l'écran d'envoi déjà rempli
// (modes et paramètres déjà gérés par send.tsx), le code secret reste demandé comme pour tout envoi. Rien ne s'affiche s'il n'y en a pas.
// Chargement silencieux : une panne n'affiche simplement rien.
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useT } from "../../providers/I18nProvider";
import { fmtMoney } from "../../utils/amount";
import { userCurrency } from "../../utils/currency";
import { Rise } from "../merchant/merchantUi";
import { useUI } from "../ui";
import { alpha } from "../ui/theme";
import { Text } from "../ui/Text";
import { Ionicons } from "../ui/Icon";
import { useReduceMotion } from "../auth/AuthBackdrop";

type Last = { cash: boolean; beneficiaryId?: string; phone?: string; name: string; amount: number; currency: string };

/** Dernier envoi de l'utilisateur qui a abouti et qu'on sait refaire (destinataire identifiable). */
function lastRepeatable(txs: any[], userId?: string): Last | null {
  const sorted = [...txs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const tx of sorted) {
    const type = String(tx.type ?? "").toUpperCase();
    if ((type !== "TRANSFER" && type !== "SCHEDULED") || tx.senderId !== userId) continue;
    if (!["PAID", "VALIDATED", "PENDING"].includes(String(tx.status))) continue;
    const cash = String(tx.payoutMethod ?? "").toUpperCase() === "CASH_PICKUP";
    const benId = tx.beneficiaryId ?? tx.beneficiary?.id;
    const phone = tx.beneficiary?.phone;
    const name = String(tx.beneficiary?.fullName ?? "").split(" ")[0];
    if (!name || (cash ? !benId : !phone)) continue;
    return { cash, beneficiaryId: benId ? String(benId) : undefined, phone, name, amount: Number(tx.amount), currency: String(tx.currency) };
  }
  return null;
}

export default function RepeatSendChip() {
  const { C, S } = useUI();
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const reduce = useReduceMotion();
  const [last, setLast] = useState<Last | null>(null);
  const [w, setW] = useState(0);                                   // largeur de la carte (pour le trajet du reflet)

  // Animations (toutes natives) : ressort à l'appui · flèche qui avance de 4 px puis revient · reflet qui traverse la carte · badge qui tourne une fois.
  const press = useRef(new Animated.Value(1)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const visible = !!last && last.amount > 0;
  useEffect(() => {
    if (!visible || reduce) return;
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(nudge, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.delay(2600),
        Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
    ];
    loops.forEach((l) => l.start());
    Animated.timing(spin, { toValue: 1, duration: 900, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    return () => loops.forEach((l) => l.stop());
  }, [visible, reduce, nudge, sweep, spin]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    api.getTransactions({ limit: 20, space: "client" } as any)
      .then((txs: any) => { if (alive) setLast(lastRepeatable(Array.isArray(txs) ? txs : [], user?.id)); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [user?.id]));

  if (!last || !(last.amount > 0)) return null;
  const sameCurrency = last.currency === userCurrency(user);
  const amountText = `${fmtMoney(last.amount, last.currency)} ${last.currency}`;
  const go = () => router.push({
    pathname: "/(tabs)/send",
    params: {
      mode: last.cash ? "CASH" : "WALLET",
      ...(last.cash ? { beneficiaryId: last.beneficiaryId } : { phone: last.phone }),
      ...(sameCurrency ? { amount: String(last.amount) } : {}),
    },
  } as any);
  const spring = (to: number) => Animated.spring(press, { toValue: to, friction: 6, tension: 180, useNativeDriver: true }).start();
  const initial = (last.name.trim().charAt(0) || "?").toUpperCase();
  const ink = C.accentInk;

  return (
    <Rise>
      <Animated.View style={[{ marginTop: 14, borderRadius: 22, backgroundColor: C.accent, transform: [{ scale: press }] }, S.md]}>
        <Pressable
          onPress={go}
          onPressIn={() => spring(0.97)}
          onPressOut={() => spring(1)}
          accessibilityRole="button"
          accessibilityLabel={t("rep.chip", { amount: amountText, name: last.name })}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          style={{ borderRadius: 22, backgroundColor: C.accent, overflow: "hidden", paddingVertical: 11, paddingHorizontal: 14 }}
        >
          {/* Décor : deux cercles translucides */}
          <View pointerEvents="none" style={{ position: "absolute", right: -34, top: -48, width: 150, height: 150, borderRadius: 75, backgroundColor: alpha(ink, 0.07) }} />
          <View pointerEvents="none" style={{ position: "absolute", left: -26, bottom: -52, width: 100, height: 100, borderRadius: 50, backgroundColor: alpha(ink, 0.06) }} />
          {/* Reflet lumineux qui traverse la carte de temps en temps */}
          {!reduce && w > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute", top: -20, bottom: -20, width: 46, backgroundColor: alpha(ink, 0.12),
                transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-80, w + 40] }) }, { rotate: "18deg" }],
              }}
            />
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {/* Pastille du destinataire + badge « renvoyer » */}
            <View style={{ width: 46, height: 46 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: alpha(ink, 0.16), borderWidth: 1.5, borderColor: alpha(ink, 0.32), alignItems: "center", justifyContent: "center" }}>
                <Text allowFontScaling={false} style={{ fontSize: 18, lineHeight: 22, fontWeight: "800", color: ink }}>{initial}</Text>
              </View>
              <Animated.View
                style={{
                  position: "absolute", right: 0, bottom: 0, width: 19, height: 19, borderRadius: 9.5, backgroundColor: C.surface,
                  alignItems: "center", justifyContent: "center",
                  transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["-180deg", "0deg"] }) }],
                }}
              >
                <Ionicons name={"refresh" as any} size={12} color={C.accent} />
              </Animated.View>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} allowFontScaling={false} style={{ fontSize: 10.5, lineHeight: 13, fontWeight: "800", letterSpacing: 0.9, textTransform: "uppercase", color: ink, opacity: 0.72 }}>
                {t("rep.kicker")}
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: 17, lineHeight: 22, fontWeight: "800", letterSpacing: -0.2, color: ink, marginTop: 1 }}>
                {t("rep.title", { amount: amountText })}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 16, fontWeight: "500", color: ink, opacity: 0.82, marginTop: 1 }}>
                {t("rep.toName", { name: last.name })}
              </Text>
            </View>

            {/* Bouton rond : la flèche fait un petit va-et-vient pour inviter à toucher */}
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
              <Animated.View style={{ transform: [{ translateX: nudge.interpolate({ inputRange: [0, 1], outputRange: [-2, 3] }) }] }}>
                <Ionicons name={"arrow-forward" as any} size={19} color={C.accent} />
              </Animated.View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Rise>
  );
}
