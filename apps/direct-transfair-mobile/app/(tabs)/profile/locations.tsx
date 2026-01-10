//apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Platform, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";

const AGENCIES = [
    { id: '1', name: 'Agence Paris 18ème', address: '12 Rue Marcadet, 75018 Paris', distance: '1.2 km' },
    { id: '2', name: 'Agence Montreuil', address: '45 Rue de Paris, 93100 Montreuil', distance: '5.4 km' },
    { id: '3', name: 'Partenaire Saint-Denis', address: '8 Rue de la République, 93200 Saint-Denis', distance: '8.1 km' },
    { id: '4', name: 'Agence Lyon Part-Dieu', address: '10 Blvd Vivier Merle, 69003 Lyon', distance: '460 km' },
];

export default function LocationsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={20}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Points Direct Transf'AIR</Text>
        <View style={{width: 24}} /> 
      </View>

      {/* Contenu */}
      <View style={styles.container}>
          <FlatList
            data={AGENCIES}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={() => (
                <Text style={styles.listHeader}>Agences à proximité</Text>
            )}
            renderItem={({ item }) => (
                <TouchableOpacity style={styles.card}>
                    <View style={styles.iconBox}>
                        <Ionicons name="location" size={24} color={colors.primary} />
                    </View>
                    
                    <View style={styles.info}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.address}>{item.address}</Text>
                    </View>
                    
                    <View style={styles.distBox}>
                        <Ionicons name="navigate-circle" size={14} color="#4B5563" style={{marginRight: 4}}/>
                        <Text style={styles.distText}>{item.distance}</Text>
                    </View>
                </TouchableOpacity>
            )}
          />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: colors.primary, // Pour que le haut (notch) soit de la bonne couleur
    paddingTop: Platform.OS === 'android' ? 30 : 0 
  },
  
  header: { 
    backgroundColor: colors.primary, 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20,
    paddingBottom: 10
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 5 },

  container: { 
    flex: 1, 
    backgroundColor: "#F9FAFB",
    borderTopLeftRadius: 24, // Effet arrondi comme sur les autres pages
    borderTopRightRadius: 24,
    overflow: 'hidden'
  },
  
  list: { padding: 20 },
  listHeader: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 15, textTransform: 'uppercase' },

  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    // Ombres légères
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.03, 
    shadowRadius: 4, 
    elevation: 2 
  },
  
  iconBox: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#EFF6FF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 14 
  },
  
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  address: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  
  distBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F3F4F6', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 20 
  },
  distText: { fontSize: 12, fontWeight: '600', color: '#374151' }
});