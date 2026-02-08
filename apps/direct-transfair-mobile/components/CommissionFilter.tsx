//apps/direct-transfair-mobile/components/CommissionFilter.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';

const FILTERS = [
  { key: 'TODAY', label: 'Jour' },
  { key: 'WEEK', label: 'Hebdo' },
  { key: 'MONTH', label: 'Mensuel' },
  { key: 'QUARTER', label: 'Trimestre' },
  { key: 'YEAR', label: 'Annuel' },
];

export default function CommissionFilter({
  selected,
  onSelect
}: {
  selected: string;
  onSelect: (k: string) => void;
}) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {FILTERS.map((f) => {
          const isActive = selected === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => onSelect(f.key)}
            >
              <Text style={[styles.text, isActive && styles.textActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 15, backgroundColor: '#F8F9FA' },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 10
  },
  pillActive: { backgroundColor: colors.primary },
  text: { color: '#4B5563', fontWeight: '600', fontSize: 13 },
  textActive: { color: '#FFF' }
});
