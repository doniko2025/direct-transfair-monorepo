//apps/direct-transfair-mobile/components/CommissionFilter.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';

const FONTS = {
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const FILTERS = [
  { key: 'TODAY', label: "Aujourd'hui" },
  { key: 'WEEK', label: '7 Jours' },
  { key: 'MONTH', label: 'Ce Mois' },
  { key: 'QUARTER', label: 'Trimestre' },
  { key: 'YEAR', label: 'Cette Année' },
];

export default function CommissionFilter({ selected, onSelect }: { selected: string; onSelect: (k: string) => void; }) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {FILTERS.map((f) => {
          const isActive = selected === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => onSelect(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.text, isActive && styles.textActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, backgroundColor: '#F8FAFC' },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: "#000",
    shadowOpacity: 0.02,
    elevation: 1
  },
  pillActive: { 
    backgroundColor: '#1E3A8A', // THEME.primary
    borderColor: '#1E3A8A',
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.2,
    elevation: 3
  },
  text: { color: '#64748B', fontFamily: FONTS.body, fontWeight: '700', fontSize: 13 },
  textActive: { color: '#FFFFFF', fontWeight: '900' }
}); 