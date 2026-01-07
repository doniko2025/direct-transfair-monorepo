//apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";

const AGENCIES = [
    { id: '1', name: 'Agence Paris 18ème', address: '12 Rue Marcadet, 75018 Paris', distance: '1.2 km' },
    { id: '2', name: 'Agence Montreuil', address: '45 Rue de Paris, 93100 Montreuil', distance: '5.4 km' },
    { id: '3', name: 'Partenaire Saint-Denis', address: '8 Rue de la République, 93200 Saint-Denis', distance: '8.1 km' },
];

export default function LocationsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Points Direct Transf'AIR</Text>
        <View style={{width: 28}} />
      </View>

      <FlatList
        data={AGENCIES}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
            <TouchableOpacity style={styles.card}>
                <View style={styles.iconBox}>
                    <Ionicons name="location" size={24} color="#FFF" />
                </View>
                <View style={styles.info}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.address}>{item.address}</Text>
                </View>
                <View style={styles.distBox}>
                    <Text style={styles.distText}>{item.distance}</Text>
                </View>
            </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { backgroundColor: colors.primary, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  list: { padding: 16 },
  
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  address: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  distBox: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  distText: { fontSize: 12, fontWeight: '600', color: '#374151' }
});