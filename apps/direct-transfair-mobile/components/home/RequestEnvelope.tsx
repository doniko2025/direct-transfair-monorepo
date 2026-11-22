// apps/direct-transfair-mobile/components/home/RequestEnvelope.tsx
// =========================================================
// ENVELOPPE « DEMANDE D'ARGENT » v1.0 — accueil client
// Dès que la personne se connecte (et à chaque retour sur l'accueil), si quelqu'un lui a demandé de l'argent et que la demande
// attend encore, une ENVELOPPE s'affiche en haut de l'accueil : elle se balance doucement, puis son rabat s'ouvre et la lettre
// glisse (qui demande, combien, le motif, la date limite) avec « Payer » en un geste. Une demande jamais ouverte s'ouvre toute seule ;
// une demande déjà vue reste fermée (un appui l'ouvre). « Plus tard » referme l'enveloppe, « Voir tout » ouvre la liste.
// Rien ne s'affiche s'il n'y a aucune demande à régler. Un échec réseau n'affiche rien de cassé (carte simplement absente).
// Données : GET /money-requests (déjà utilisé par les raccourcis de l'accueil). Couleurs : thème de l'app uniquement.
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutAnimation, Platform, Pressable, UIManager, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { MoneyRequestView } from "../../services/growthTypes";
import { useAuth } from "../../providers/AuthProvider";
import { useT } from "../../providers/I18nProvider";
import { fmtDate } from "../../i18n/runtime";
import { fmtMoney } from "../../utils/amount";
import { useUI } from "../ui";
import { Text } from "../ui/Text";
import { Ionicons } from "../ui/Icon";

if (Platform.OS === "android" && (UIManager as any).setLayoutAnimationEnabledExperimental) {
  try { (UIManager as any).setLayoutAnimationEnabledExperimental(true); } catch { /* sans effet */ }
}

const SEEN_KEY = (userId: string) => `dt_mr_seen_${userId}`;
const ENV_W = 64;
const ENV_H = 46;
const FLAP_H = 26;

/** Dessin de l'enveloppe : corps, lettre qui dépasse, rabat qui se retourne à l'ouverture. */
function EnvelopeArt({ open, wiggle }: { open: boolean; wiggle: boolean }) {
  const { C } = useUI();
  const flip = useRef(new Animated.Value(open ? 1 : 0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(flip, { toValue: open ? 1 : 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, flip]);

  useEffect(() => {
    if (!wiggle) { sway.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(1400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [wiggle, sway]);

  const flapScale = flip.interpolate({ inputRange: [0, 1], outputRange: [1, -1] });
  const flapShift = flip.interpolate({ inputRange: [0, 1], outputRange: [0, -FLAP_H] });
  const letterUp = flip.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const rot = sway.interpolate({ inputRange: [-1, 1], outputRange: ["-7deg", "7deg"] });

  return (
    <Animated.View style={{ width: ENV_W, height: ENV_H + 16, justifyContent: "flex-end", transform: [{ rotate: rot }] }}>
      {/* Lettre : sort de l'enveloppe quand le rabat s'ouvre */}
      <Animated.View style={{ position: "absolute", left: 9, right: 9, bottom: 8, height: ENV_H - 8, borderRadius: 5, backgroundColor: C.surface, borderWidth: 1, borderColor: C.accentLine, paddingTop: 7, paddingHorizontal: 6, gap: 4, transform: [{ translateY: letterUp }] }}>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: C.accent, width: "70%" }} />
        <View style={{ height: 3, borderRadius: 2, backgroundColor: C.line, width: "90%" }} />
      </Animated.View>
      {/* Corps */}
      <View style={{ width: ENV_W, height: ENV_H, borderRadius: 9, backgroundColor: C.accent, overflow: "hidden" }}>
        <View style={{ position: "absolute", left: 0, bottom: 0, width: 0, height: 0, borderLeftWidth: ENV_W / 2, borderRightWidth: ENV_W / 2, borderBottomWidth: ENV_H * 0.62, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "rgba(255,255,255,0.16)" }} />
      </View>
      {/* Rabat (triangle) qui se retourne vers le haut */}
      <Animated.View style={{ position: "absolute", left: 0, bottom: ENV_H - FLAP_H, width: 0, height: 0, borderLeftWidth: ENV_W / 2, borderRightWidth: ENV_W / 2, borderTopWidth: FLAP_H, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: C.accentDeep, transform: [{ translateY: flapShift }, { scaleY: flapScale }] }} />
    </Animated.View>
  );
}

export default function RequestEnvelope() {
  const t = useT();
  const router = useRouter();
  const { C } = useUI();
  const { user } = useAuth();
  const myCurrency: string = (user as any)?.primaryCurrency || (user as any)?.currency || "XOF";

  const [items, setItems] = useState<MoneyRequestView[]>([]);
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const loaded = useRef(false);
  const rise = useRef(new Animated.Value(0)).current;
  const letter = useRef(new Animated.Value(0)).current;

  const markSeen = useCallback((ids: string[]) => {
    if (!user?.id) return;
    ids.forEach((id) => seen.current.add(id));
    void AsyncStorage.setItem(SEEN_KEY(user.id), JSON.stringify([...seen.current].slice(-50))).catch(() => undefined);
  }, [user?.id]);

  const expand = useCallback((next: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(260, "easeInEaseOut", "opacity"));
    setOpen(next);
    letter.setValue(0);
    if (next) Animated.timing(letter, { toValue: 1, duration: 420, delay: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [letter]);

  // Chargement à chaque retour sur l'accueil.
  useFocusEffect(useCallback(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        if (!loaded.current && user?.id) {
          const raw = await AsyncStorage.getItem(SEEN_KEY(user.id)).catch(() => null);
          try { (JSON.parse(raw ?? "[]") as string[]).forEach((id) => seen.current.add(id)); } catch { /* mémoire locale illisible */ }
          loaded.current = true;
        }
        const res = await api.getMoneyRequests();
        if (!alive) return;
        const pending = (res.received ?? []).filter((r) => r.status === "PENDING").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(pending);
        const fresh = pending.some((r) => !seen.current.has(r.id));
        if (pending.length > 0) {
          rise.setValue(0);
          Animated.timing(rise, { toValue: 1, duration: 480, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start();
          // Une demande jamais ouverte : l'enveloppe s'ouvre toute seule après un court instant.
          if (fresh) timer = setTimeout(() => { if (alive) { expand(true); markSeen(pending.map((r) => r.id)); } }, 900);
        } else {
          setOpen(false);
        }
      } catch {
        if (alive) setItems([]);   // indisponible : rien d'affiché
      }
    })();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]));

  if (items.length === 0) return null;
  const first = items[0]!;
  const others = items.length - 1;
  const sameCurrency = first.currency === myCurrency;

  const pay = () => {
    markSeen(items.map((r) => r.id));
    router.push({
      pathname: "/(tabs)/send",
      params: { mode: "WALLET", ...(first.counterpartPhone ? { phone: first.counterpartPhone } : {}), ...(sameCurrency ? { amount: String(first.amount) } : {}) },
    } as any);
  };
  const toggle = () => { if (!open) markSeen(items.map((r) => r.id)); expand(!open); };

  return (
    <Animated.View style={{ marginTop: 14, opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
      <View style={{ borderRadius: 22, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, padding: 12, overflow: "hidden" }}>
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={t("grw.env.title", { name: first.counterpartName })} accessibilityState={{ expanded: open }} testID="home-request-envelope" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.85 : 1 })}>
          <View>
            <EnvelopeArt open={open} wiggle={!open} />
            {!open && (
              <View style={{ position: "absolute", top: -2, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.sun, borderWidth: 2, borderColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Text allowFontScaling={false} style={{ fontSize: 10, lineHeight: 13, fontWeight: "800", color: C.sunInk, includeFontPadding: false }}>{String(items.length)}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, fontWeight: "800", color: C.ink }}>{t("grw.env.title", { name: first.counterpartName })}</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: C.muted, marginTop: 1 }}>{open ? t("grw.env.opened") : t("grw.env.tap")}</Text>
          </View>
          <Ionicons name={(open ? "chevron-up" : "chevron-down") as any} size={18} color={C.muted} />
        </Pressable>

        {open && (
          <Animated.View style={{ opacity: letter, transform: [{ translateY: letter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] }}>
            <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, padding: 14 }}>
              <Text style={{ fontSize: 12, color: C.muted }}>{t("grw.env.asks", { name: first.counterpartName })}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.4, color: C.accentDeep, marginTop: 2 }}>
                {`${fmtMoney(first.amount, first.currency)} ${first.currency}`}
              </Text>
              {!!first.note && <Text numberOfLines={3} style={{ fontSize: 13, lineHeight: 18, color: C.ink, marginTop: 6 }}>{`« ${first.note} »`}</Text>}
              <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>{t("grw.mr.expires", { date: fmtDate(first.expiresAt) })}</Text>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Pressable onPress={pay} accessibilityRole="button" accessibilityLabel={t("grw.mr.pay")} testID="home-request-pay" style={({ pressed }) => ({ flex: 1, height: 42, borderRadius: 999, backgroundColor: C.sun, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, opacity: pressed ? 0.88 : 1 })}>
                  <Ionicons name={"send" as any} size={15} color={C.sunInk} />
                  <Text style={{ fontSize: 14, fontWeight: "800", color: C.sunInk }}>{t("grw.mr.pay")}</Text>
                </Pressable>
                <Pressable onPress={() => expand(false)} accessibilityRole="button" accessibilityLabel={t("grw.env.later")} style={({ pressed }) => ({ paddingHorizontal: 16, height: 42, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink }}>{t("grw.env.later")}</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => router.push("/money-requests" as any)} accessibilityRole="link" hitSlop={8} style={{ alignSelf: "center", marginTop: 10 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.accentDeep, textDecorationLine: "underline" }}>
                  {others > 0 ? t("grw.env.others", { count: others }) : t("grw.env.seeAll")}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}
