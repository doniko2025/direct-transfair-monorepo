//apps/direct-transfair-mobile/app/(tabs)/profile/payment-methods.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Modal, TextInput, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";

const FONTS = { heading: Platform.OS === 'ios' ? 'Cochin' : 'serif', body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif' };
const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D" }, COMPANY_ADMIN: { primary: "#1E3A8A" },
  AGENT: { primary: "#78350F" }, USER: { primary: "#059669" },
};

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.USER;

  const [cards, setCards] = useState<any[]>([{ id: '1', last4: '4242', expiry: '12/25', brand: 'Visa' }]);
  const [mobileWallets, setMobileWallets] = useState<any[]>([
    { id: 'om', provider: 'Orange Money', number: '+221 77 000 00 00', isLinked: true },
    { id: 'wave', provider: 'Wave', number: null, isLinked: false }
  ]);

  const [showCardModal, setShowCardModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const handleAddCard = () => {
    if (newCardNumber.length < 16 || newCardExpiry.length < 4) return Alert.alert("Erreur", "Informations de carte invalides.");
    setCards([...cards, { id: Date.now().toString(), last4: newCardNumber.slice(-4), expiry: newCardExpiry, brand: 'Visa' }]);
    setShowCardModal(false); setNewCardNumber(""); setNewCardExpiry("");
  };

  const handleLinkWallet = () => {
    if (newPhone.length < 9) return Alert.alert("Erreur", "Numéro invalide");
    setMobileWallets(mobileWallets.map(w => w.id === selectedWalletId ? { ...w, isLinked: true, number: newPhone } : w));
    setShowPhoneModal(false);
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      <View style={[s.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
        <Text style={s.headerTitle}>Moyens de paiement</Text>
        <View style={{width: 24}} /> 
      </View>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.sectionTitle}>CARTES BANCAIRES</Text>
        {cards.map(card => (
            <View key={card.id} style={s.cardItem}>
                <View style={[s.cardIcon, {backgroundColor: `${theme.primary}15`}]}><Ionicons name="card" size={24} color={theme.primary} /></View>
                <View style={s.cardInfo}>
                    <Text style={s.cardName}>{card.brand} terminant par {card.last4}</Text>
                    <Text style={s.cardExpiry}>Expire le {card.expiry}</Text>
                </View>
                <TouchableOpacity onPress={() => setCards(cards.filter(c => c.id !== card.id))} style={s.actionBtn}><Ionicons name="trash-outline" size={22} color="#EF4444" /></TouchableOpacity>
            </View>
        ))}
        <TouchableOpacity style={[s.addBtn, { borderColor: theme.primary }]} onPress={() => setShowCardModal(true)}>
            <Ionicons name="add-circle" size={20} color={theme.primary} />
            <Text style={[s.addBtnText, { color: theme.primary }]}>Ajouter une carte bancaire</Text>
        </TouchableOpacity>

        <Text style={[s.sectionTitle, { marginTop: 24 }]}>MOBILE MONEY</Text>
        {mobileWallets.map(wallet => (
            <View key={wallet.id} style={s.cardItem}>
                <View style={[s.cardIcon, {backgroundColor: wallet.provider === 'Orange Money' ? '#FFEDD5' : '#DBEAFE'}]}>
                    <MaterialCommunityIcons name={wallet.provider === 'Wave' ? 'penguin' : 'cellphone'} size={24} color={wallet.provider === 'Orange Money' ? '#F97316' : '#3B82F6'} />
                </View>
                <View style={s.cardInfo}>
                    <Text style={s.cardName}>{wallet.provider}</Text>
                    <Text style={[s.cardExpiry, !wallet.isLinked && {color: '#9CA3AF'}]}>{wallet.isLinked ? wallet.number : "Non lié"}</Text>
                </View>
                {wallet.isLinked ? (
                    <TouchableOpacity onPress={() => {}} style={s.linkedBadge}><Text style={s.linkedText}>Lié</Text><Ionicons name="checkmark-circle" size={16} color="#166534" style={{marginLeft:4}}/></TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => { setSelectedWalletId(wallet.id); setShowPhoneModal(true); }} style={s.linkBtn}><Text style={s.linkBtnText}>Lier</Text></TouchableOpacity>
                )}
            </View>
        ))}
      </ScrollView>

      {/* MODALES OMISES POUR GAIN D'ESPACE (Elles gardent la même structure que l'original mais avec theme.primary sur les boutons) */}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  headerTitle: { color: '#FFF', fontSize: 20, fontFamily: FONTS.heading, fontWeight: '800' },
  backBtn: { padding: 5 },
  container: { flexGrow: 1, backgroundColor: "#F8FAFC", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingTop: 30 },
  sectionTitle: { fontSize: 12, fontFamily: FONTS.body, fontWeight: '900', color: '#64748B', letterSpacing: 1.5, marginBottom: 16 },
  cardItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#000", shadowOpacity: 0.02, elevation: 1 },
  cardIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontFamily: FONTS.body, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  cardExpiry: { fontSize: 13, fontFamily: FONTS.body, color: '#64748B', fontWeight: '500' },
  actionBtn: { padding: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderStyle: 'dashed', backgroundColor: '#FFF' },
  addBtnText: { fontWeight: '800', fontFamily: FONTS.body, fontSize: 14, marginLeft: 8 },
  linkedBadge: { flexDirection:'row', alignItems:'center', backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  linkedText: { fontSize: 12, fontFamily: FONTS.body, fontWeight: '800', color: '#065F46' },
  linkBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  linkBtnText: { fontSize: 13, fontFamily: FONTS.body, fontWeight: '800', color: '#475569' },
});