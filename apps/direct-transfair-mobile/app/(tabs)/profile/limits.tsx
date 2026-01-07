//apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";

export default function LimitsScreen() {
  const router = useRouter();

  // Données simulées
  const dailyUsed = 150;
  const dailyLimit = 2000;
  const monthlyUsed = 450;
  const monthlyLimit = 10000;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes plafonds</Text>
        <View style={{width: 28}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#2563EB" />
            <Text style={styles.infoText}>
                Ces plafonds sont fixés pour votre sécurité et conformément à la réglementation.
            </Text>
        </View>

        <LimitCard 
            label="Plafond journalier" 
            used={dailyUsed} 
            total={dailyLimit} 
            color="#10B981" // Vert
        />

        <LimitCard 
            label="Plafond mensuel" 
            used={monthlyUsed} 
            total={monthlyLimit} 
            color="#3B82F6" // Bleu
        />

        <TouchableOpacity style={styles.helpBtn}>
            <Text style={styles.helpText}>Demander une augmentation de plafond</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function LimitCard({ label, used, total, color }: any) {
    const percentage = (used / total) * 100;
    
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.values}>{used}€ <Text style={styles.total}>/ {total}€</Text></Text>
            </View>
            
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
            </View>
            
            <Text style={styles.remaining}>Reste {total - used}€ disponible</Text>
        </View>
    )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { backgroundColor: colors.primary, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  content: { padding: 20 },
  
  infoBox: { flexDirection: 'row', backgroundColor: '#DBEAFE', padding: 12, borderRadius: 8, marginBottom: 24, alignItems: 'center' },
  infoText: { flex: 1, marginLeft: 10, color: '#1E40AF', fontSize: 13, lineHeight: 18 },

  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-end' },
  label: { fontSize: 16, fontWeight: '700', color: '#111827' },
  values: { fontSize: 16, fontWeight: '700', color: '#111827' },
  total: { fontSize: 12, color: '#9CA3AF', fontWeight: '400' },
  
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  remaining: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },

  helpBtn: { marginTop: 20, alignItems: 'center' },
  helpText: { color: colors.primary, fontWeight: '600', fontSize: 14 }
});