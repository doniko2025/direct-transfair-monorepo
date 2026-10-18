// apps/direct-transfair-mobile/components/auth/ServerStatusPill.tsx
// =========================================================
// PASTILLE D'ÉTAT DU SERVEUR v2.0 — Direct Transf'air
// ✅ v2.0 : thème clair (pilule beige / rouge doux au lieu du verre blanc sur fond sombre).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Affichée seulement quand il se passe quelque chose : vérification,
// démarrage du serveur (après une période d'inactivité) ou panne. Quand
// tout va bien, elle disparaît : aucun bruit visuel.
// =========================================================

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ServerStatus } from '../../services/serverWarmup';
import { FONT, N } from './authTheme';

export default function ServerStatusPill({ status, onRetry }: { status: ServerStatus; onRetry: () => void }) {
  if (status === 'ready') return null;

  if (status === 'down') {
    return (
      <TouchableOpacity onPress={onRetry} style={[s.pill, s.down]} accessibilityRole="button" accessibilityLabel="Réessayer la connexion au serveur">
        <Ionicons name="cloud-offline-outline" size={14} color={N.danger} />
        <Text style={[s.txt, { color: N.danger }]}>Hors ligne · Réessayer</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.pill} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={N.ink} style={{ transform: [{ scale: 0.7 }] }} />
      <Text style={s.txt}>{status === 'waking' ? 'Le serveur démarre…' : 'Connexion…'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99,
    backgroundColor: N.surface, borderWidth: 1, borderColor: N.border,
  },
  down: { backgroundColor: N.dangerBg, borderColor: N.dangerBd },
  txt:  { fontFamily: FONT.medium, fontSize: 12, fontWeight: '700', color: N.ink },
});
