//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/create.tsx
import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, TextInput, ScrollView, Switch, Alert, 
  SafeAreaView, KeyboardAvoidingView, Platform, Modal, FlatList, TouchableOpacity, ActivityIndicator, StatusBar 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors"; 
import { countriesList, CountryData } from "../../../../data/countries";
import { citiesByCountry } from "../../../../data/cities";
import { api } from "../../../../services/api"; 

export default function CreateAgencyScreen() {
  const router = useRouter();
  
  // --- ÉTATS ---
  const [name, setName] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  
  const [selectedCountry, setSelectedCountry] = useState<CountryData>(countriesList[0]);
  const [selectedPhoneCode, setSelectedPhoneCode] = useState<CountryData>(countriesList[0]);
  const [selectedCity, setSelectedCity] = useState("");
  
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  
  const [isPartner, setIsPartner] = useState(false);
  const [submitting, setSubmitting] = useState(false); 

  useEffect(() => { setSelectedCity(""); }, [selectedCountry]);

  const availableCities = citiesByCountry[selectedCountry.name] || [];

  const showAlert = (title: string, message: string, onOk?: () => void) => {
      if (Platform.OS === 'web') {
          setTimeout(() => {
            if (window.confirm(`${title}\n\n${message}`)) { if (onOk) onOk(); }
          }, 100);
      } else {
          Alert.alert(title, message, [{ text: "OK", onPress: onOk }]);
      }
  };

  // ✅ Fonction de traduction des erreurs Backend
  const translateError = (msg: string | string[]) => {
      const message = Array.isArray(msg) ? msg[0] : msg;
      
      if (message.includes("adminEmail should not be empty")) return "L'email de l'administrateur est requis.";
      if (message.includes("subscriptionType must be")) return "Type de contrat invalide.";
      if (message.includes("code should not be empty")) return "Le code agence est manquant.";
      if (message.includes("email must be an email")) return "L'adresse email est invalide.";
      if (message.includes("Internal server error")) return "Erreur serveur. Vérifiez les données envoyées.";
      
      return message; // Retourne le message original si non traduit
  };

  const handleCreate = async () => {
      if (!name.trim() || !phone.trim() || !managerFirstName.trim() || !managerLastName.trim() || !selectedCity || !email.trim()) {
          showAlert("Attention", "Veuillez remplir tous les champs obligatoires (*).");
          return;
      }

      setSubmitting(true);

      try {
          const fullPhone = `${selectedPhoneCode.dialCode}${phone}`;
          const fullManagerName = `${managerFirstName.trim()} ${managerLastName.trim()}`;
          
          // ✅ Génération automatique du CODE (ex: AGE-9483)
          const autoCode = name.substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
          
          // ✅ Choix du type (Partner = PURCHASE, Filiale = RENTAL) pour satisfaire le backend
          const subscriptionType = isPartner ? 'PURCHASE' : 'RENTAL';

          const newAgency = {
              name,
              code: autoCode, // Ajout du code
              address,
              phone: fullPhone,
              email, 
              // Mapping des champs Admin requis par le backend
              adminEmail: email, 
              adminFirstName: managerFirstName,
              adminLastName: managerLastName,
              adminPassword: "Pass" + Math.floor(10000 + Math.random() * 90000), // Mot de passe provisoire
              
              managerName: fullManagerName, 
              country: selectedCountry.name,
              city: selectedCity,
              subscriptionType, // Ajout du type
              status: 'ACTIVE'
          };

          await api.createAgency(newAgency);
          showAlert("Succès 🎉", `L'agence ${name} a été créée avec succès.`, () => router.back());

      } catch (error: any) {
          console.error("Erreur création:", error);
          const rawMsg = error.response?.data?.message || "Erreur technique.";
          
          if (error.response?.status === 401) {
             showAlert("Session Expirée", "Veuillez vous déconnecter et vous reconnecter.");
          } else {
             // ✅ Affichage du message traduit en français
             showAlert("Erreur", translateError(rawMsg));
          }
      } finally {
          setSubmitting(false);
      }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle Agence</Text>
        <View style={{width: 24}} /> 
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
      >
        
        {/* CARTE TYPE */}
        <View style={styles.cardHighlight}>
            <View style={styles.rowBetween}>
                <View style={{flex:1, paddingRight:10}}>
                    <Text style={[styles.highlightTitle, { color: isPartner ? colors.primary : '#059669' }]}>
                        {isPartner ? "Agence Partenaire" : "Agence Filiale"}
                    </Text>
                    <Text style={styles.highlightDesc}>
                        {isPartner 
                            ? "Société tierce indépendante commissionnée." 
                            : "Propriété de l'entreprise. Gains à 100%."}
                    </Text>
                </View>
                <Switch 
                    value={isPartner} 
                    onValueChange={setIsPartner}
                    trackColor={{ false: "#10B981", true: colors.primary }} 
                    thumbColor="#FFF"
                />
            </View>
        </View>

        {/* IDENTITÉ */}
        <Text style={styles.sectionHeader}>IDENTITÉ</Text>
        <View style={styles.card}>
            <InputLabel label="Nom de l'agence" req />
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Agence Centre-Ville" placeholderTextColor="#9CA3AF" />

            <InputLabel label="Email contact (Admin)" req />
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="contact@agence.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
        </View>

        {/* GÉRANT */}
        <Text style={styles.sectionHeader}>RESPONSABLE</Text>
        <View style={styles.card}>
            <View style={styles.rowGap}>
                <View style={{flex:1}}>
                    <InputLabel label="Prénom" req />
                    <TextInput style={styles.input} value={managerFirstName} onChangeText={setManagerFirstName} placeholder="Moussa" placeholderTextColor="#9CA3AF" />
                </View>
                <View style={{flex:1}}>
                    <InputLabel label="Nom" req />
                    <TextInput style={styles.input} value={managerLastName} onChangeText={setManagerLastName} placeholder="DIOP" placeholderTextColor="#9CA3AF" />
                </View>
            </View>

            <InputLabel label="Téléphone Mobile" req />
            <View style={styles.phoneContainer}>
                <TouchableOpacity style={styles.phoneCodeBtn} onPress={() => setShowPhoneCodeModal(true)}>
                    <Text style={{fontSize:18}}>{selectedPhoneCode.flag}</Text>
                    <Text style={styles.phoneCodeText}>{selectedPhoneCode.dialCode}</Text>
                    <Ionicons name="caret-down" size={10} color="#6B7280" />
                </TouchableOpacity>
                <TextInput style={styles.phoneInput} value={phone} onChangeText={setPhone} placeholder="77 000 00 00" keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />
            </View>
        </View>

        {/* LOCALISATION */}
        <Text style={styles.sectionHeader}>ADRESSE & LOCALISATION</Text>
        <View style={styles.card}>
            <InputLabel label="Pays" req />
            <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCountryModal(true)}>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                    <Text style={{fontSize:20, marginRight:10}}>{selectedCountry.flag}</Text>
                    <Text style={styles.selectText}>{selectedCountry.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>

            <View style={[styles.rowGap, {marginTop: 15}]}>
                <View style={{flex:1}}>
                    <InputLabel label="Ville" req />
                    <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCityModal(true)}>
                        <Text style={[styles.selectText, !selectedCity && {color:'#9CA3AF'}]}>
                            {selectedCity || "Sélectionner"}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>
            </View>
            
            <View style={{marginTop: 15}}>
                <InputLabel label="Adresse exacte" />
                <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Quartier, Rue, N° Porte..." placeholderTextColor="#9CA3AF" />
            </View>
        </View>

        {/* BOUTON VALIDATION */}
        <TouchableOpacity 
            style={[styles.mainBtn, submitting && styles.btnDisabled]} 
            onPress={handleCreate}
            disabled={submitting}
            activeOpacity={0.9}
        >
            {submitting ? (
                <ActivityIndicator color="#FFF" />
            ) : (
                <Text style={styles.btnText}>VALIDER LA CRÉATION</Text>
            )}
        </TouchableOpacity>
        
        <View style={{height: 120}} /> 
    </ScrollView>
    </KeyboardAvoidingView>

    <SelectionModal visible={showCountryModal} onClose={() => setShowCountryModal(false)} title="Choisir le Pays" data={countriesList} onSelect={(item: CountryData) => { setSelectedCountry(item); setSelectedPhoneCode(item); setShowCountryModal(false); }} />
    <SelectionModal visible={showPhoneCodeModal} onClose={() => setShowPhoneCodeModal(false)} title="Indicatif" data={countriesList} onSelect={(item: CountryData) => { setSelectedPhoneCode(item); setShowPhoneCodeModal(false); }} />
    <CityModal visible={showCityModal} onClose={() => setShowCityModal(false)} title={`Villes (${selectedCountry.name})`} data={availableCities} onSelect={(city: string) => { setSelectedCity(city); setShowCityModal(false); }} />

    </SafeAreaView>
  );
}

const InputLabel = ({label, req}: {label:string, req?:boolean}) => (
    <Text style={styles.label}>
        {label} {req && <Text style={{color:'#EF4444'}}>*</Text>}
    </Text>
);

const SelectionModal = ({ visible, onClose, title, data, onSelect }: any) => (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Ionicons name="close" size={20} color="#374151" /></TouchableOpacity>
                </View>
                <FlatList data={data} keyExtractor={item => item.code} renderItem={({item}) => (
                        <TouchableOpacity style={styles.modalItem} onPress={() => onSelect(item)}>
                            <Text style={{fontSize:24, marginRight:12}}>{item.flag}</Text>
                            <Text style={styles.modalText}>{item.name}</Text>
                            <Text style={styles.modalCode}>{item.dialCode}</Text>
                        </TouchableOpacity>
                    )} />
            </View>
        </View>
    </Modal>
);

const CityModal = ({ visible, onClose, title, data, onSelect }: any) => (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Ionicons name="close" size={20} color="#374151" /></TouchableOpacity>
                </View>
                <FlatList data={data} keyExtractor={(item, i) => item + i} renderItem={({item}) => (
                        <TouchableOpacity style={styles.modalItem} onPress={() => onSelect(item)}>
                            <Text style={styles.modalText}>{item}</Text>
                            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                        </TouchableOpacity>
                    )} ListEmptyComponent={<Text style={{padding:20, textAlign:'center', color:'#999'}}>Aucune ville disponible.</Text>} />
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backIcon: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    content: { padding: 20, paddingBottom: 150 }, 

    sectionHeader: { fontSize: 12, fontWeight: '800', color: '#6B7280', marginTop: 25, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
    
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1, borderWidth:1, borderColor:'#F9FAFB' },
    
    cardHighlight: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    highlightTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    highlightDesc: { fontSize: 12, color: '#6B7280', lineHeight: 16 },

    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
    input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937' },
    
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowGap: { flexDirection: 'row', gap: 12 },

    phoneContainer: { flexDirection: 'row', gap: 8 },
    phoneCodeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, gap: 6 },
    phoneCodeText: { fontWeight: '600', color: '#374151' },
    phoneInput: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937' },

    selectBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
    selectText: { fontSize: 15, color: '#1F2937' },

    mainBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 30, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
    btnDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0 },
    btnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContainer: { backgroundColor: '#FFF', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    closeBtn: { padding: 4, backgroundColor: '#F3F4F6', borderRadius: 12 },
    modalItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
    modalText: { fontSize: 15, color: '#374151', flex: 1, fontWeight: '500' },
    modalCode: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' }
});