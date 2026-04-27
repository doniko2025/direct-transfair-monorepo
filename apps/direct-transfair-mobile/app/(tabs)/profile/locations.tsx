//apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Platform, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";

const FONTS = { heading: Platform.OS === 'ios' ? 'Cochin' : 'serif', body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif' };
const THEMES = { SUPER_ADMIN: { primary: "#7F1D1D" }, COMPANY_ADMIN: { primary: "#1E3A8A" }, AGENT: { primary: "#78350F" }, USER: { primary: "#059669" } };

const AGENCIES = [
    { id: '1', name: 'Agence Paris 18ème', address: '12 Rue Marcadet, 75018 Paris', distance: '1.2 km' },
    { id: '2', name: 'Agence Montreuil', address: '45 Rue de Paris, 93100 Montreuil', distance: '5.4 km' },
];

export default function LocationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.USER;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <View style={[s.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
        <Text style={s.headerTitle}>Points Direct Transf'AIR</Text>
        <View style={{width: 24}} /> 
      </View>

      <View style={s.container}>
          <FlatList
            data={AGENCIES}
            keyExtractor={item => item.id}
            contentContainerStyle={s.list}
            ListHeaderComponent={() => <Text style={s.listHeader}>AGENCES À PROXIMITÉ</Text>}
            renderItem={({ item }) => (
                <TouchableOpacity style={s.card}>
                    <View style={[s.iconBox, { backgroundColor: `${theme.primary}15` }]}>
                        <Ionicons name="location" size={24} color={theme.primary} />
                    </View>
                    <View style={s.info}>
                        <Text style={s.name}>{item.name}</Text>
                        <Text style={s.address}>{item.address}</Text>
                    </View>
                    <View style={s.distBox}>
                        <Ionicons name="navigate-circle" size={16} color="#64748B" style={{marginRight: 4}}/>
                        <Text style={s.distText}>{item.distance}</Text>
                    </View>
                </TouchableOpacity>
            )}
          />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  headerTitle: { color: '#FFF', fontSize: 20, fontFamily: FONTS.heading, fontWeight: '800' },
  backBtn: { padding: 5 },
  container: { flex: 1, backgroundColor: "#F8FAFC", borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  list: { padding: 24, paddingTop: 30 },
  listHeader: { fontSize: 12, fontFamily: FONTS.body, fontWeight: '900', color: '#64748B', marginBottom: 16, letterSpacing: 1.5 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, elevation: 1 },
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  info: { flex: 1, paddingRight: 10 },
  name: { fontSize: 15, fontFamily: FONTS.body, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  address: { fontSize: 12, fontFamily: FONTS.body, color: '#64748B', fontWeight: '500' },
  distBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  distText: { fontSize: 12, fontFamily: FONTS.body, fontWeight: '800', color: '#475569' }
});