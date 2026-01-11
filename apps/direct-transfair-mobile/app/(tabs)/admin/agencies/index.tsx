//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/index.tsx
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { api } from "../../../../services/api";

// Type adapté à ton API (Client/Agency)
type Agency = {
    id: string | number;
    name: string;
    city: string;
    type: 'PARTNER' | 'PRIVATE';
    balance?: number;
    phone?: string;
};

export default function AgenciesListScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agencies, setAgencies] = useState<Agency[]>([]);

  // Chargement des données à chaque affichage de l'écran
  useFocusEffect(
    useCallback(() => {
      loadAgencies();
    }, [])
  );

  const loadAgencies = async () => {
      try {
          // Utilisation de la méthode API réelle
          const res = await api.getAgencies(); 
          
          // Assure-toi que ton backend renvoie un tableau
          const list = Array.isArray(res) ? res : [];

          // Formatage des données si nécessaire (gestion des valeurs par défaut)
          const formattedList = list.map((a: any) => ({
              ...a,
              type: a.type || 'PARTNER', // Valeur par défaut si manquant
              balance: a.balance || 0,
              phone: a.phone || 'Non renseigné'
          }));
          
          setAgencies(formattedList);
      } catch (e) {
          console.error("Erreur chargement agences:", e);
      } finally {
          setLoading(false);
          setRefreshing(false);
      }
  };

  const onRefresh = () => {
      setRefreshing(true);
      loadAgencies();
  };

  const renderItem = ({ item }: { item: Agency }) => (
      <TouchableOpacity style={styles.card}>
          <View style={styles.cardHeader}>
              <View style={[styles.iconBox, item.type === 'PRIVATE' ? {backgroundColor: '#D1FAE5'} : {backgroundColor: '#DBEAFE'}]}>
                  <Ionicons name={item.type === 'PRIVATE' ? "business" : "people"} size={20} color={item.type === 'PRIVATE' ? "#059669" : "#2563EB"} />
              </View>
              <View style={{flex:1, marginLeft: 12}}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.details}>{item.city} {item.phone ? `• ${item.phone}` : ''}</Text>
              </View>
              <View style={[styles.badge, item.type === 'PRIVATE' ? styles.badgePrivate : styles.badgePartner]}>
                  <Text style={[styles.badgeText, item.type === 'PRIVATE' ? {color:'#065F46'} : {color:'#1E40AF'}]}>
                      {item.type === 'PRIVATE' ? 'PRIVÉE' : 'PARTENAIRE'}
                  </Text>
              </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.cardFooter}>
              <Text style={styles.balanceLabel}>Solde Caisse</Text>
              <Text style={styles.balanceValue}>{(item.balance || 0).toLocaleString('fr-FR')} FCFA</Text>
          </View>
      </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>
        <Text style={styles.title}>Mes Agences</Text>
        <Pressable onPress={() => router.push("/(tabs)/admin/agencies/create")} style={styles.addBtn}>
            <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {loading && agencies.length === 0 ? (
          <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
          </View>
      ) : (
          <FlatList
              data={agencies}
              keyExtractor={item => item.id.toString()}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={
                  <View style={styles.empty}>
                      <Text style={{color:'#666'}}>Aucune agence trouvée.</Text>
                      <Text style={{color:'#999', fontSize:12, marginTop:5}}>Créez votre première agence !</Text>
                  </View>
              }
          />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    
    header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backBtn: { padding: 5 },
    title: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
    addBtn: { backgroundColor: colors.primary, padding: 8, borderRadius: 20 },

    list: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems:'center', marginTop: 50 },

    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, marginBottom: 15, shadowColor: "#000", shadowOpacity: 0.05, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    
    iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    
    name: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
    details: { fontSize: 13, color: '#6B7280', marginTop: 2 },

    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgePrivate: { backgroundColor: '#D1FAE5' },
    badgePartner: { backgroundColor: '#DBEAFE' },
    badgeText: { fontSize: 10, fontWeight: '800' },

    divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    balanceLabel: { fontSize: 13, color: '#6B7280' },
    balanceValue: { fontSize: 16, fontWeight: '800', color: '#1F2937' }
});