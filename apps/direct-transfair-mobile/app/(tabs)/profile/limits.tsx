//apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";

const FONTS = { heading: Platform.OS === 'ios' ? 'Cochin' : 'serif', body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif' };
const THEMES = { SUPER_ADMIN: { primary: "#7F1D1D" }, COMPANY_ADMIN: { primary: "#1E3A8A" }, AGENT: { primary: "#78350F" }, USER: { primary: "#059669" } };

export default function LimitsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.USER;

  const getProgress = (used: number, max: number) => Math.min((used / max) * 100, 100) + '%';

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <View style={[s.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
        <Text style={s.headerTitle}>Mes plafonds</Text>
        <View style={{width: 24}} /> 
      </View>

      <ScrollView contentContainerStyle={s.container}>
        <View style={[s.infoBox, { backgroundColor: `${theme.primary}15` }]}>
            <Ionicons name="information-circle" size={24} color={theme.primary} style={{marginRight: 12}} />
            <Text style={[s.infoText, { color: theme.primary }]}>Ces plafonds sont fixés pour votre sécurité et conformément à la réglementation.</Text>
        </View>

        <View style={s.limitCard}>
            <View style={s.limitHeader}>
                <Text style={s.limitTitle}>Plafond journalier</Text>
                <View style={{flexDirection:'row', alignItems:'baseline'}}>
                    <Text style={s.usedAmount}>150€</Text>
                    <Text style={s.maxAmount}> / 2000€</Text>
                </View>
            </View>
            <View style={s.progressBarBg}><View style={[s.progressBarFill, { width: getProgress(150, 2000) as any, backgroundColor: theme.primary }]} /></View>
            <Text style={s.remainingText}>Reste 1850€ disponible</Text>
        </View>

        <View style={s.limitCard}>
            <View style={s.limitHeader}>
                <Text style={s.limitTitle}>Plafond mensuel</Text>
                <View style={{flexDirection:'row', alignItems:'baseline'}}>
                    <Text style={s.usedAmount}>450€</Text>
                    <Text style={s.maxAmount}> / 10000€</Text>
                </View>
            </View>
            <View style={s.progressBarBg}><View style={[s.progressBarFill, { width: getProgress(450, 10000) as any, backgroundColor: "#3B82F6" }]} /></View>
            <Text style={s.remainingText}>Reste 9550€ disponible</Text>
        </View>

        <TouchableOpacity style={s.requestBtn}>
            <Text style={[s.requestBtnText, { color: theme.primary }]}>Demander une augmentation</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  headerTitle: { color: '#FFF', fontSize: 20, fontFamily: FONTS.heading, fontWeight: '800' },
  backBtn: { padding: 5 },
  container: { flexGrow: 1, backgroundColor: "#F8FAFC", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingTop: 30 },
  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 16, marginBottom: 24, alignItems:'center' },
  infoText: { flex: 1, fontSize: 13, fontFamily: FONTS.body, fontWeight: '600', lineHeight: 20 },
  limitCard: { backgroundColor: '#FFF', padding: 24, borderRadius: 20, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 5, elevation: 1, borderWidth: 1, borderColor: "#F1F5F9" },
  limitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  limitTitle: { fontSize: 16, fontFamily: FONTS.body, fontWeight: '800', color: '#0F172A' },
  usedAmount: { fontSize: 20, fontFamily: FONTS.heading, fontWeight: '800', color: '#0F172A' },
  maxAmount: { fontSize: 14, fontFamily: FONTS.body, color: '#94A3B8', fontWeight: '700' },
  progressBarBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, width: '100%', marginBottom: 12 },
  progressBarFill: { height: 8, borderRadius: 4 },
  remainingText: { fontSize: 12, fontFamily: FONTS.body, color: '#64748B', fontWeight: '600' },
  requestBtn: { marginTop: 24, padding: 16, alignItems: 'center', backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  requestBtnText: { fontWeight: '800', fontFamily: FONTS.body, fontSize: 14 },
});