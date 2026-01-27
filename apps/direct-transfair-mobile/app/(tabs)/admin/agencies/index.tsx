//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/index.tsx
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, ActivityIndicator, TouchableOpacity, RefreshControl, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { api } from "../../../../services/api";

type Agency = {
    id: string | number;
    name: string;
    city: string;
    address?: string;
    phone?: string;
    email?: string;
    type: 'PARTNER' | 'PRIVATE'; // ou RENTAL/PURCHASE selon backend
    balance?: number;
    status?: 'ACTIVE' | 'INACTIVE';
    managerName?: string;
};

export default function AgenciesListScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [filteredAgencies, setFilteredAgencies] = useState<Agency[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadAgencies();
    }, [])
  );

  const loadAgencies = async () => {
      try {
          const res = await api.getAgencies(); 
          const list = Array.isArray(res) ? res : [];
          
          // Mapping pour sécuriser l'affichage
          const formatted: Agency[] = list.map((a: any) => ({
              ...a,
              type: a.subscriptionType === 'PURCHASE' ? 'PARTNER' : 'PRIVATE', // Adapter selon logique backend
              balance: a.balance || 0,
              phone: a.phone || 'Non renseigné',
              status: a.status || 'ACTIVE'
          }));
          
          setAgencies(formatted);
          setFilteredAgencies(formatted);
      } catch (e) {
          console.error("Erreur chargement agences:", e);
      } finally {
          setLoading(false);
          setRefreshing(false);
      }
  };

  const handleSearch = (text: string) => {
      setSearch(text);
      if (!text) {
          setFilteredAgencies(agencies);
      } else {
          const lower = text.toLowerCase();
          setFilteredAgencies(agencies.filter(a => 
              a.name.toLowerCase().includes(lower) || 
              a.city.toLowerCase().includes(lower)
          ));
      }
  };

  const renderItem = ({ item }: { item: Agency }) => (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => router.push({ pathname: "/(tabs)/admin/agencies/details", params: { id: item.id } })}
      >
          <View style={styles.cardHeader}>
              <View style={[styles.iconBox, item.type === 'PRIVATE' ? styles.bgPrivate : styles.bgPartner]}>
                  <Ionicons 
                    name={item.type === 'PRIVATE' ? "business" : "people"} 
                    size={20} 
                    color={item.type === 'PRIVATE' ? "#059669" : "#2563EB"} 
                  />
              </View>
              <View style={{flex:1, marginLeft: 12}}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.details}>{item.city} • {item.phone}</Text>
              </View>
              <View style={[styles.badge, item.status === 'ACTIVE' ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={[styles.badgeText, item.status === 'ACTIVE' ? {color:'#065F46'} : {color:'#991B1B'}]}>
                      {item.status === 'ACTIVE' ? 'ACTIF' : 'INACTIF'}
                  </Text>
              </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.cardFooter}>
              <View>
                  <Text style={styles.label}>Responsable</Text>
                  <Text style={styles.value}>{item.managerName || "Non assigné"}</Text>
              </View>
              <View style={{alignItems:'flex-end'}}>
                  <Text style={styles.label}>Solde Caisse</Text>
                  <Text style={styles.balanceValue}>{(item.balance || 0).toLocaleString('fr-FR')} FCFA</Text>
              </View>
          </View>
      </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#333" />
            </Pressable>
            <Text style={styles.title}>Réseau d'Agences</Text>
            <Pressable onPress={() => router.push("/(tabs)/admin/agencies/create")} style={styles.addBtn}>
                <Ionicons name="add" size={24} color="#FFF" />
            </Pressable>
        </View>
        
        <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput 
                placeholder="Rechercher une agence..." 
                style={styles.searchInput}
                value={search}
                onChangeText={handleSearch}
            />
        </View>
      </View>

      {loading && !refreshing ? (
          <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
          </View>
      ) : (
          <FlatList
              data={filteredAgencies}
              keyExtractor={item => item.id.toString()}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAgencies(); }} />}
              ListEmptyComponent={
                  <View style={styles.empty}>
                      <Ionicons name="storefront-outline" size={48} color="#D1D5DB" />
                      <Text style={{color:'#666', marginTop:10}}>Aucune agence trouvée.</Text>
                  </View>
              }
          />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    
    header: { backgroundColor: '#FFF', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    topRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 15 },
    backBtn: { padding: 5 },
    title: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
    addBtn: { backgroundColor: colors.primary, padding: 8, borderRadius: 12, shadowColor: colors.primary, shadowOpacity:0.3, elevation:3 },

    searchBox: { flexDirection:'row', alignItems:'center', backgroundColor:'#F9FAFB', borderRadius:10, paddingHorizontal:12, borderWidth:1, borderColor:'#E5E7EB' },
    searchInput: { flex:1, paddingVertical:10, marginLeft:8, fontSize:15 },

    list: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems:'center', marginTop: 100 },

    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    bgPrivate: { backgroundColor: '#D1FAE5' },
    bgPartner: { backgroundColor: '#DBEAFE' },
    
    name: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
    details: { fontSize: 13, color: '#6B7280', marginTop: 2 },

    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeActive: { backgroundColor: '#D1FAE5' },
    badgeInactive: { backgroundColor: '#FEE2E2' },
    badgeText: { fontSize: 10, fontWeight: '800' },

    divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 11, color: '#9CA3AF', textTransform:'uppercase', fontWeight:'700' },
    value: { fontSize: 14, color: '#374151', fontWeight:'600', marginTop:2 },
    balanceValue: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop:2 }
});