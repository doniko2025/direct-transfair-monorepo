// apps/direct-transfair-mobile/components/auth/ServerStatusPill.tsx
// =========================================================
// PASTILLE D'ÉTAT DU SERVEUR v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Affichée seulement quand il se passe quelque chose : vérification,
// démarrage du serveur (après une période d'inactivité) ou panne. Quand
// tout va bien, elle disparaît : aucun bruit visuel.
// =========================================================

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ServerStatus } from '../../services/serverWarmup';
import { FONT } from './authTheme';

export default function ServerStatusPill({ status, onRetry }: { status: ServerStatus; onRetry: () => void }) {
  if (status === 'ready') return null;

  if (status === 'down') {
    return (
      <TouchableOpacity onPress={onRetry} style={[s.pill, s.down]} accessibilityRole="button" accessibilityLabel="Réessayer la connexion au serveur">
        <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
        <Text style={s.txt}>Hors ligne · Réessayer</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.pill} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.7 }] }} />
      <Text style={s.txt}>{status === 'waking' ? 'Le serveur démarre…' : 'Connexion…'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)',
  },
  down: { backgroundColor: 'rgba(180,35,24,0.85)', borderColor: 'rgba(255,255,255,0.3)' },
  txt:  { fontFamily: FONT.medium, fontSize: 12, fontWeight: '700', color: '#fff' },
});
