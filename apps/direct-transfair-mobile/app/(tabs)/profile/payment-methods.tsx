//apps/direct-transfair-mobile/app/(tabs)/profile/payment-methods.tsx
import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  SafeAreaView, StatusBar, Modal, TextInput, Alert, Platform 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";

// Types pour nos données
type Card = {
  id: string;
  last4: string;
  expiry: string;
  brand: 'Visa' | 'Mastercard';
};

type MobileWallet = {
  id: string;
  provider: 'Orange Money' | 'Wave';
  number: string | null; // null = non lié
  isLinked: boolean;
};

export default function PaymentMethodsScreen() {
  const router = useRouter();

  // --- ÉTATS (DONNÉES SIMULÉES) ---
  const [cards, setCards] = useState<Card[]>([
    { id: '1', last4: '4242', expiry: '12/25', brand: 'Visa' }
  ]);

  const [mobileWallets, setMobileWallets] = useState<MobileWallet[]>([
    { id: 'om', provider: 'Orange Money', number: '+221 77 000 00 00', isLinked: true },
    { id: 'wave', provider: 'Wave', number: null, isLinked: false }
  ]);

  // --- ÉTATS FORMULAIRES ---
  const [showCardModal, setShowCardModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  
  // Champs temporaires pour les formulaires
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // --- LOGIQUE CARTES BANCAIRES ---

  const handleAddCard = () => {
    if (newCardNumber.length < 16 || newCardExpiry.length < 4) {
        return Alert.alert("Erreur", "Veuillez vérifier les informations de la carte.");
    }

    const newCard: Card = {
        id: Date.now().toString(),
        last4: newCardNumber.slice(-4),
        expiry: newCardExpiry,
        brand: parseInt(newCardNumber[0]) === 5 ? 'Mastercard' : 'Visa'
    };

    setCards([...cards, newCard]);
    setShowCardModal(false);
    setNewCardNumber("");
    setNewCardExpiry("");
    Alert.alert("Succès", "Votre carte a été ajoutée.");
  };

  const handleDeleteCard = (id: string) => {
    Alert.alert(
        "Supprimer la carte",
        "Êtes-vous sûr de vouloir retirer ce moyen de paiement ?",
        [
            { text: "Annuler", style: "cancel" },
            { 
                text: "Supprimer", 
                style: "destructive", 
                onPress: () => setCards(cards.filter(c => c.id !== id)) 
            }
        ]
    );
  };

  // --- LOGIQUE MOBILE MONEY ---

  const openLinkModal = (id: string) => {
    setSelectedWalletId(id);
    setNewPhone("");
    setShowPhoneModal(true);
  };

  const handleLinkWallet = () => {
    if (newPhone.length < 9) return Alert.alert("Erreur", "Numéro invalide");

    setMobileWallets(mobileWallets.map(w => {
        if (w.id === selectedWalletId) {
            return { ...w, isLinked: true, number: newPhone };
        }
        return w;
    }));
    setShowPhoneModal(false);
  };

  const handleUnlinkWallet = (id: string) => {
    Alert.alert("Délier", "Voulez-vous retirer ce compte ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Retirer", onPress: () => {
            setMobileWallets(mobileWallets.map(w => {
                if (w.id === id) return { ...w, isLinked: false, number: null };
                return w;
            }));
        }}
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moyens de paiement</Text>
        <View style={{width: 24}} /> 
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        
        {/* --- SECTION CARTES --- */}
        <Text style={styles.sectionTitle}>Mes cartes bancaires</Text>
        
        {cards.map(card => (
            <View key={card.id} style={styles.cardItem}>
                <View style={styles.cardIcon}>
                    <Ionicons name="card" size={24} color={colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{card.brand} terminant par {card.last4}</Text>
                    <Text style={styles.cardExpiry}>Expire le {card.expiry}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteCard(card.id)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                </TouchableOpacity>
            </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCardModal(true)}>
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.addBtnText}>Ajouter une carte bancaire</Text>
        </TouchableOpacity>


        {/* --- SECTION MOBILE MONEY --- */}
        <Text style={styles.sectionTitle}>Mobile Money</Text>

        {mobileWallets.map(wallet => (
            <View key={wallet.id} style={styles.cardItem}>
                <View style={[styles.cardIcon, {backgroundColor: wallet.provider === 'Orange Money' ? '#FFEDD5' : '#DBEAFE'}]}>
                    <MaterialCommunityIcons 
                        name={wallet.provider === 'Wave' ? 'penguin' : 'cellphone'} 
                        size={24} 
                        color={wallet.provider === 'Orange Money' ? '#F97316' : '#3B82F6'} 
                    />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{wallet.provider}</Text>
                    <Text style={[styles.cardExpiry, !wallet.isLinked && {color: '#9CA3AF'}]}>
                        {wallet.isLinked ? wallet.number : "Non lié"}
                    </Text>
                </View>
                
                {wallet.isLinked ? (
                    <TouchableOpacity onPress={() => handleUnlinkWallet(wallet.id)} style={styles.linkedBadge}>
                        <Text style={styles.linkedText}>Lié</Text>
                        <Ionicons name="close-circle" size={16} color="#166534" style={{marginLeft:4}}/>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => openLinkModal(wallet.id)} style={styles.linkBtn}>
                        <Text style={styles.linkBtnText}>Lier</Text>
                    </TouchableOpacity>
                )}
            </View>
        ))}

      </ScrollView>

      {/* --- MODALE AJOUT CARTE --- */}
      <Modal visible={showCardModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Nouvelle Carte</Text>
                
                <TextInput 
                    style={styles.input} 
                    placeholder="Numéro de carte (16 chiffres)" 
                    keyboardType="numeric"
                    maxLength={16}
                    value={newCardNumber}
                    onChangeText={setNewCardNumber}
                />
                
                <View style={{flexDirection:'row', gap: 10}}>
                    <TextInput 
                        style={[styles.input, {flex:1}]} 
                        placeholder="MM/AA" 
                        maxLength={5}
                        value={newCardExpiry}
                        onChangeText={setNewCardExpiry}
                    />
                    <TextInput 
                        style={[styles.input, {flex:1}]} 
                        placeholder="CVV" 
                        maxLength={3}
                        keyboardType="numeric"
                    />
                </View>

                <TouchableOpacity style={styles.confirmBtn} onPress={handleAddCard}>
                    <Text style={styles.confirmText}>Ajouter la carte</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => setShowCardModal(false)} style={{marginTop:15}}>
                    <Text style={{color:'#6B7280', textAlign:'center'}}>Annuler</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* --- MODALE LIER MOBILE --- */}
      <Modal visible={showPhoneModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Lier un compte</Text>
                <Text style={styles.modalSubtitle}>Entrez votre numéro {mobileWallets.find(w => w.id === selectedWalletId)?.provider}</Text>
                
                <TextInput 
                    style={styles.input} 
                    placeholder="Ex: +221 77 ..." 
                    keyboardType="phone-pad"
                    value={newPhone}
                    onChangeText={setNewPhone}
                />

                <TouchableOpacity style={styles.confirmBtn} onPress={handleLinkWallet}>
                    <Text style={styles.confirmText}>Valider le numéro</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => setShowPhoneModal(false)} style={{marginTop:15}}>
                    <Text style={{color:'#6B7280', textAlign:'center'}}>Annuler</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  header: { backgroundColor: colors.primary, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 5 },

  container: { flexGrow: 1, backgroundColor: "#F9FAFB", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 15, marginBottom: 10 },

  // Card Item
  cardItem: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', 
    padding: 16, borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 5, elevation: 1
  },
  cardIcon: { 
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', 
    justifyContent: 'center', alignItems: 'center', marginRight: 14 
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  cardExpiry: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  
  actionBtn: { padding: 8 },

  // Bouton Ajouter Pointillé
  addBtn: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    padding: 15, borderRadius: 16, marginBottom: 20,
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: '#F0F9FF'
  },
  addBtnText: { color: colors.primary, fontWeight: '600', marginLeft: 8 },

  // Badges
  linkedBadge: { 
    flexDirection:'row', alignItems:'center', backgroundColor: '#DCFCE7', 
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 
  },
  linkedText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  
  linkBtn: { backgroundColor: '#E5E7EB', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  linkBtnText: { fontSize: 12, fontWeight: '600', color: '#4B5563' },

  // Modales
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 25, alignItems: 'stretch' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', textAlign: 'center', marginBottom: 20 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 15 },
  
  input: { 
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', 
    borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15 
  },
  confirmBtn: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#FFF', fontWeight: '700', fontSize: 16 }
});