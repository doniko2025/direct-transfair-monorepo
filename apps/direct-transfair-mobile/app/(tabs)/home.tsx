// apps/direct-transfair-mobile/app/(tabs)/home.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  SafeAreaView,
  Platform,
  ActivityIndicator
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api"; // ✅ Import de l'API pour le taux
import { colors } from "../../theme/colors";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [refreshing, setRefreshing] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  
  // États pour la simulation
  const [amount, setAmount] = useState("100");
  
  // ✅ Taux dynamique (par défaut 655.95 en attendant le chargement)
  const [rate, setRate] = useState<number>(655.95);
  const [loadingRate, setLoadingRate] = useState(true);

  // Charger le vrai taux depuis le backend
  const fetchRate = async () => {
    try {
        const rates = await api.getExchangeRates();
        const pair = rates.find(r => r.pair === "EUR_XOF");
        if (pair) {
            setRate(pair.rate);
        }
    } catch (e) {
        console.log("Erreur chargement taux", e);
    } finally {
        setLoadingRate(false);
    }
  };

  // Charger à l'ouverture de l'écran
  useFocusEffect(
    useCallback(() => {
        fetchRate();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRate();
    // Tu peux aussi ajouter ici le rechargement du user (solde)
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Calcul automatique avec le taux dynamique
  const receiveAmount = (parseFloat(amount || "0") * rate).toFixed(0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={colors.primary} barStyle="light-content" />
      
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.white]} tintColor={colors.white} />}
      >
        {/* --- HEADER BLEU/ORANGE --- */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
             <View style={styles.logoBadge}>
                <Text style={styles.logoText}>DT</Text>
             </View>
             <TouchableOpacity onPress={() => router.push("/(tabs)/profile")}>
                <View style={styles.profileIcon}>
                    <Text style={{fontWeight:'bold', color: colors.primary}}>
                        {user?.firstName ? user.firstName[0] : "U"}
                    </Text>
                </View>
             </TouchableOpacity>
          </View>

          <View style={styles.balanceContainer}>
            <TouchableOpacity onPress={() => setHideBalance(!hideBalance)} style={styles.eyeBtn}>
                <Ionicons name={hideBalance ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <Text style={styles.balanceLabel}>Mon solde</Text>
            <Text style={styles.balanceValue}>
                {hideBalance ? "••••••" : "0.00"} <Text style={{fontSize: 20}}>EUR</Text>
            </Text>
          </View>
        </View>

        {/* --- CORPS BLANC ARRONDI --- */}
        <View style={styles.body}>
            
            {/* CARTE TAUX DE CHANGE (DYNAMIQUE) */}
            <View style={styles.rateCard}>
                <View>
                    <Text style={styles.rateTitle}>Taux de change du jour</Text>
                    {loadingRate ? (
                        <ActivityIndicator size="small" color="#0C4A6E" />
                    ) : (
                        <Text style={styles.rateValue}>1 EUR = {rate} XOF</Text>
                    )}
                </View>
                <Ionicons name="sunny" size={32} color="#FDB813" />
            </View>

            <Text style={styles.limitText}>
                Vous pouvez envoyer jusqu'à <Text style={{fontWeight: 'bold', textDecorationLine: 'underline'}}>2 000€ par jour</Text>
            </Text>

            {/* SIMULATEUR */}
            <View style={styles.simulator}>
                
                {/* Montant à envoyer */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Montant à envoyer</Text>
                    <View style={styles.inputRow}>
                        <TextInput 
                            style={styles.input}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            placeholder="0"
                        />
                        <View style={styles.currencyBadge}>
                            <Text style={styles.currencyText}>EUR 🇪🇺</Text>
                        </View>
                    </View>
                </View>

                {/* Montant reçu */}
                <View style={[styles.inputGroup, { marginTop: 16 }]}>
                    <Text style={styles.inputLabel}>Montant reçu</Text>
                    <View style={styles.inputRow}>
                        <TextInput 
                            style={[styles.input, { color: colors.text }]} 
                            value={receiveAmount}
                            editable={false}
                        />
                        <View style={[styles.currencyBadge, { backgroundColor: '#F3F4F6' }]}>
                            <Text style={styles.currencyText}>XOF 🇸🇳</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.promoTag}>
                    <Text style={styles.promoText}>🎉 NOUVEAU : Frais réduits à 1.5% !</Text>
                </View>

                {/* BOUTON ACTION */}
                <TouchableOpacity 
                    style={styles.ctaButton}
                    onPress={() => router.push("/(tabs)/send")}
                >
                    <Text style={styles.ctaText}>C'EST PARTI</Text>
                    <Ionicons name="arrow-forward" size={24} color="#FFF" />
                </TouchableOpacity>

            </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  container: { flexGrow: 1, backgroundColor: colors.background },
  
  // Header
  header: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 80, 
    paddingHorizontal: 20,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logoBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  logoText: { color: '#FFF', fontWeight: '900', fontSize: 18 },
  profileIcon: { backgroundColor: '#FFF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  balanceContainer: { alignItems: 'center' },
  eyeBtn: { marginBottom: 8 },
  balanceLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  balanceValue: { color: '#FFF', fontSize: 36, fontWeight: '800' },

  // Body
  body: {
    backgroundColor: colors.background,
    marginTop: -40,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 100,
    flex: 1,
  },

  // Rate Card
  rateCard: {
    backgroundColor: '#E0F2FE', 
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rateTitle: { fontSize: 14, color: '#0369A1', fontWeight: '600', marginBottom: 4 },
  rateValue: { fontSize: 20, color: '#0C4A6E', fontWeight: '800' },

  limitText: { textAlign: 'center', color: colors.textLight, fontSize: 12, marginBottom: 24 },

  // Simulator
  simulator: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  inputGroup: {},
  inputLabel: { color: colors.primary, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    height: 60,
    alignItems: 'center',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 16,
    height: '100%',
  },
  currencyBadge: {
    height: '100%',
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  currencyText: { fontSize: 16, fontWeight: '700', color: colors.text },

  promoTag: { alignSelf: 'center', marginTop: 20, marginBottom: 10 },
  promoText: { color: '#16A34A', fontWeight: '600', fontSize: 13 },

  ctaButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 30,
    gap: 10,
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
});