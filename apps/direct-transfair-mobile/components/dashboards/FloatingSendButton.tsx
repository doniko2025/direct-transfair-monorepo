// apps/direct-transfair-mobile/components/dashboards/FloatingSendButton.tsx
// =========================================================
// FLOATING SEND BUTTON v1.0 — Direct Transf'air
// Bouton « Envoyer… » flottant de l'accueil client :
//   • couleur du héros (C.forest), texte blanc, anneau jaune qui clignote ;
//   • animé en boucle (halo qui pulse + léger battement) pour inciter au clic ;
//     l'animation est coupée si « Réduire les animations » est actif sur le téléphone,
//     pendant le glissement et quand la fenêtre de choix est ouverte ;
//   • déplaçable au doigt n'importe où sur l'écran (limité à la zone visible, au-dessus
//     de la barre d'onglets) ; la position est mémorisée sur l'appareil ;
//   • un simple appui ouvre une fenêtre : « Transfert avec code » (retrait en espèces)
//     ou « Virement wallet » (gratuit, sans code) → le parent redirige vers la page dédiée.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder, Pressable, View, type LayoutChangeEvent } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "../ui/Icon";
import { Text } from "../ui/Text";
import { Sheet } from "../ui/Layout";
import { UText, useUI } from "../ui";
import { TAB_SPACE } from "../ui/theme";

export type SendMode = "CASH" | "WALLET";

const STORAGE_KEY = "dt.floatingSend.pos.v1";
const MARGIN = 8;
/** Distance minimale (px) avant qu'un toucher soit considéré comme un glissement. */
const DRAG_THRESHOLD = 7;
/** Au-delà de cette durée (ms), un toucher immobile n'est plus un « appui ». */
const TAP_MAX_MS = 600;

type Pos = { x: number; y: number };

export default function FloatingSendButton({
  label,
  summary,
  onChoose,
}: {
  /** Texte du bouton, ex. « Envoyer 100,00 € » ou « Envoyer de l'argent ». */
  label: string;
  /** Rappel affiché dans la fenêtre de choix (ex. « Montant : 100,00 € »). */
  summary?: string;
  /** Appelé après la fermeture de la fenêtre, avec le mode choisi. */
  onChoose: (mode: SendMode) => void;
}) {
  const { C } = useUI();
  const insets = useSafeAreaInsets();

  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // ── Position (valeur animée côté JS, mise à jour pendant le glissement) ──
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cur = useRef<Pos>({ x: 0, y: 0 });
  const startRef = useRef<Pos>({ x: 0, y: 0 });
  const touchStart = useRef(0);
  const moved = useRef(false);

  // Les gestes lisent toujours les dernières bornes / fonctions via ces références.
  const bounds = useRef({ minX: MARGIN, maxX: MARGIN, minY: MARGIN, maxY: MARGIN });
  const openRef = useRef<() => void>(() => {});

  const clampPos = useCallback((p: Pos): Pos => {
    const b = bounds.current;
    return { x: Math.min(Math.max(p.x, b.minX), Math.max(b.minX, b.maxX)), y: Math.min(Math.max(p.y, b.minY), Math.max(b.minY, b.maxY)) };
  }, []);

  const place = useCallback((p: Pos) => {
    const c = clampPos(p);
    cur.current = c;
    pos.setValue(c);
  }, [clampPos, pos]);

  // Bornes : tout l'écran visible, au-dessus de la barre d'onglets.
  useEffect(() => {
    if (!box || !size) return;
    bounds.current = {
      minX: MARGIN,
      maxX: box.w - size.w - MARGIN,
      minY: insets.top + MARGIN,
      maxY: box.h - size.h - Math.max(TAB_SPACE - 24, 0) - insets.bottom,
    };
  }, [box, size, insets.top, insets.bottom]);

  // Première mise en place : position mémorisée, sinon centré en bas.
  useEffect(() => {
    if (!box || !size || ready) return;
    let alive = true;
    (async () => {
      let saved: Pos | null = null;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) saved = { x: p.x, y: p.y };
        }
      } catch { /* stockage indisponible : position par défaut */ }
      if (!alive) return;
      const b = bounds.current;
      place(saved ?? { x: (box.w - size.w) / 2, y: b.maxY });
      setReady(true);
    })();
    return () => { alive = false; };
  }, [box, size, ready, place]);

  // Si la taille change (libellé plus long, rotation…), on ramène le bouton dans l'écran.
  useEffect(() => {
    if (ready && box && size) place(cur.current);
  }, [ready, box, size, place]);

  const persist = useCallback(async (p: Pos) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignoré */ }
  }, []);

  openRef.current = () => setOpen(true);

  // ── Geste : appui court = ouvrir ; glissement = déplacer ──
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          startRef.current = { ...cur.current };
          touchStart.current = Date.now();
          moved.current = false;
        },
        onPanResponderMove: (_e, g) => {
          if (!moved.current) {
            if (Math.abs(g.dx) < DRAG_THRESHOLD && Math.abs(g.dy) < DRAG_THRESHOLD) return;
            moved.current = true;
            setDragging(true);
          }
          const c = clampPos({ x: startRef.current.x + g.dx, y: startRef.current.y + g.dy });
          cur.current = c;
          pos.setValue(c);
        },
        onPanResponderRelease: () => {
          const wasDrag = moved.current;
          const quick = Date.now() - touchStart.current < TAP_MAX_MS;
          setDragging(false);
          if (wasDrag) persist(cur.current);
          else if (quick) openRef.current();
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          if (moved.current) persist(cur.current);
        },
      }),
    [clampPos, persist, pos],
  );

  // ── Animations ──
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduceMotion(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduceMotion(!!v));
    return () => { alive = false; (sub as any)?.remove?.(); };
  }, []);

  const halo = useRef(new Animated.Value(0)).current;   // 0 → 1 : le halo grossit et s'efface
  const blink = useRef(new Animated.Value(0)).current;  // 0 → 1 : l'anneau jaune clignote
  const beat = useRef(new Animated.Value(0)).current;   // 0 → 1 : léger battement du bouton
  const grab = useRef(new Animated.Value(0)).current;   // 0 → 1 : bouton « soulevé » pendant le glissement

  const animate = ready && !reduceMotion && !dragging && !open;

  useEffect(() => {
    if (!animate) {
      halo.setValue(0); blink.setValue(0); beat.setValue(0);
      return;
    }
    const loopOf = (v: Animated.Value, ms: number, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(delay),
        ]),
      );
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const beatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    const haloLoop = loopOf(halo, 1300, 250);
    haloLoop.start(); blinkLoop.start(); beatLoop.start();
    return () => { haloLoop.stop(); blinkLoop.stop(); beatLoop.stop(); };
  }, [animate, halo, blink, beat]);

  useEffect(() => {
    Animated.spring(grab, { toValue: dragging ? 1 : 0, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [dragging, grab]);

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.38] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });
  const ringOpacity = reduceMotion ? 1 : blink.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const bodyScale = Animated.multiply(
    beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
    grab.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }),
  );

  // ── Fenêtre de choix ──
  const choose = (mode: SendMode) => {
    setOpen(false);
    // Laisse la feuille se refermer avant de changer d'écran.
    setTimeout(() => onChoose(mode), 220);
  };

  const onBoxLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((p) => (p && p.w === width && p.h === height ? p : { w: width, h: height }));
  };
  const onSizeLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((p) => (p && Math.abs(p.w - width) < 0.5 && Math.abs(p.h - height) < 0.5 ? p : { w: width, h: height }));
  };

  const RADIUS = 28;

  return (
    <>
      {/* Couche transparente plein écran : ne bloque aucun toucher sauf sur le bouton lui-même. */}
      <View pointerEvents="box-none" onLayout={onBoxLayout} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Animated.View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, left: 0, opacity: ready ? 1 : 0, transform: pos.getTranslateTransform() }}
        >
          <View onLayout={onSizeLayout} {...pan.panHandlers} accessible accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Ouvre le choix du type de transfert. Glissez pour déplacer le bouton."
            onAccessibilityTap={() => setOpen(true)}
            accessibilityActions={[{ name: "activate" }]}
            onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === "activate") setOpen(true); }}
          >
            {/* Halo qui pulse */}
            <Animated.View
              pointerEvents="none"
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS, backgroundColor: C.forest, opacity: haloOpacity, transform: [{ scale: haloScale }] }}
            />
            <Animated.View
              style={{
                height: 56, borderRadius: RADIUS, paddingHorizontal: 22, backgroundColor: C.forest,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
                shadowColor: "#000", shadowOpacity: dragging ? 0.38 : 0.28, shadowRadius: dragging ? 16 : 10, shadowOffset: { width: 0, height: dragging ? 10 : 6 }, elevation: dragging ? 12 : 8,
                transform: [{ scale: bodyScale }],
              }}
            >
              {/* Anneau jaune clignotant */}
              <Animated.View
                pointerEvents="none"
                style={{ position: "absolute", top: -1, left: -1, right: -1, bottom: -1, borderRadius: RADIUS + 1, borderWidth: 2.5, borderColor: C.sun, opacity: ringOpacity }}
              />
              <Ionicons name="send" size={19} color="#FFFFFF" />
              <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={{ fontSize: 16.5, fontWeight: "800", color: "#FFFFFF" }}>
                {label}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Comment veux-tu envoyer ?">
        <View style={{ paddingTop: 6, paddingBottom: 8, gap: 12 }}>
          {!!summary && <UText v="label" tone="muted">{summary}</UText>}

          <ChoiceCard
            icon="wallet"
            title="Virement wallet"
            text="Vers le wallet d'un autre client. Instantané, sans code."
            badge="Gratuit"
            onPress={() => choose("WALLET")}
          />
          <ChoiceCard
            icon="key"
            title="Transfert avec code"
            text="Votre bénéficiaire retire l'argent en espèces avec un code de retrait."
            onPress={() => choose("CASH")}
          />
        </View>
      </Sheet>
    </>
  );
}

function ChoiceCard({
  icon, title, text, badge, onPress,
}: { icon: string; title: string; text: string; badge?: string; onPress: () => void }) {
  const { C } = useUI();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${text}`}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 20,
        backgroundColor: C.surface, borderWidth: 1, borderColor: pressed ? C.forest : C.line,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.forest, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 16.5, fontWeight: "800", color: C.ink }}>{title}</Text>
          {!!badge && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: C.sun }}>
              <Text style={{ fontSize: 11.5, fontWeight: "800", color: C.sunInk }}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 18 }}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.muted} />
    </Pressable>
  );
}