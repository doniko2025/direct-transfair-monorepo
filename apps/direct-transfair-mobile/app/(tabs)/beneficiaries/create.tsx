//apps/direct-transfair-mobile/app/(tabs)/beneficiaries/create.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";
import { showAlert } from "../../../utils/alert";
import { countriesList, CountryData } from "../../../data/countries";

export default function BeneficiaryCreateScreen() {
  const router = useRouter();

  // --- États ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  
  // 1. Pays de résidence (Adresse)
  const [addressCountry, setAddressCountry] = useState<CountryData>(countriesList[0]);
  // 2. Pays du téléphone (Indicatif)
  const [phoneCountry, setPhoneCountry] = useState<CountryData>(countriesList[0]);

  const [city, setCity] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  
  const [submitting, setSubmitting] = useState(false);

  // Modales
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);

  const canSubmit =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    city.trim().length >= 2;

  // --- Helpers Sélection ---
  const handleSelectAddressCountry = (country: CountryData) => {
    setAddressCountry(country);
    // On met à jour l'indicatif par défaut pour correspondre au pays,
    // mais l'utilisateur pourra le changer manuellement ensuite.
    setPhoneCountry(country);
    setCity(""); 
    setShowCountryModal(false);
  };

  const handleSelectCity = (cityName: string) => {
    setCity(cityName);
    setShowCityModal(false);
  };

  const handleSelectPhoneCode = (country: CountryData) => {
    // Ici, on ne change QUE l'indicatif, pas le pays de résidence
    setPhoneCountry(country);
    setShowPhoneCodeModal(false);
  };

  const handleCreate = async () => {
    if (!canSubmit) {
      showAlert("Validation", "Veuillez remplir le nom, le prénom et la ville.");
      return;
    }

    try {
      setSubmitting(true);

      let fullPhone = null;
      if (phoneNumber.trim().length > 0) {
        const dial = phoneCountry.dialCode.replace('+', ''); 
        const num = phoneNumber.trim().replace(/^0+/, '');
        fullPhone = `+${dial}${num}`;
      }

      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      await api.createBeneficiary({
        fullName: fullName,
        country: addressCountry.name, // Pays de résidence
        city: city.trim(),
        phone: fullPhone,
      });

      showAlert("Succès", "Bénéficiaire ajouté avec succès.", () => {
        router.back();
      });

    } catch (e: any) {
      console.error(e);
      const msg = e.response?.data?.message || "Erreur lors de la création.";
      showAlert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Composant Sélecteur (Pressable pour meilleure compatibilité Web) ---
  const renderSelector = (label: string, value: string, onPress: () => void, placeholder: string, icon?: string) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <Pressable 
        style={({ pressed }) => [
            styles.selectorBtn, 
            pressed && { backgroundColor: '#E5E7EB' } // Feedback visuel au clic
        ]} 
        onPress={onPress}
      >
        <View style={{flexDirection:'row', alignItems:'center'}}>
            {icon && <Text style={{fontSize: 20, marginRight: 8}}>{icon}</Text>}
            <Text style={[styles.selectorText, !value && styles.placeholderText]}>
                {value || placeholder}
            </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        
        <View style={styles.header}>
            <Text style={styles.title}>Ajouter un bénéficiaire</Text>
            <Text style={styles.subtitle}>Renseignez les informations du bénéficiaire.</Text>
        </View>

        <View style={styles.card}>
            {/* Prénom & Nom */}
            <View style={{flexDirection:'row', gap: 10}}>
                <View style={[styles.inputGroup, {flex:1}]}>
                    <Text style={styles.label}>Prénom</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Ex: Mamadou" 
                        value={firstName} onChangeText={setFirstName} 
                    />
                </View>
                <View style={[styles.inputGroup, {flex:1}]}>
                    <Text style={styles.label}>Nom</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Ex: Diallo" 
                        value={lastName} onChangeText={setLastName} 
                    />
                </View>
            </View>

            {/* Pays de RÉSIDENCE */}
            {renderSelector(
                "Pays de résidence", 
                addressCountry.name, 
                () => setShowCountryModal(true), 
                "Choisir", 
                addressCountry.flag
            )}

            {/* Ville */}
            {renderSelector(
                "Ville", 
                city, 
                () => setShowCityModal(true), 
                "Choisir une ville"
            )}

            {/* Téléphone (INDICATIF SÉPARÉ) */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Téléphone (Mobile Money)</Text>
                
                <View style={styles.phoneContainer}>
                    {/* Bouton Indicatif (Pressable pour que ça clique bien partout) */}
                    <Pressable 
                        style={({pressed}) => [
                            styles.dialBtn,
                            pressed && { backgroundColor: '#E5E7EB' }
                        ]} 
                        onPress={() => {
                            console.log("Ouverture modale indicatif"); // Debug
                            setShowPhoneCodeModal(true);
                        }}
                    >
                        <Text style={{marginRight:5, fontSize:16}}>{phoneCountry.flag}</Text>
                        <Text style={{fontWeight:'700', color:'#374151'}}>{phoneCountry.dialCode}</Text>
                        <Ionicons name="chevron-down" size={14} color="#6B7280" style={{marginLeft:4}}/>
                    </Pressable>
                    
                    {/* Champ de saisie */}
                    <TextInput 
                        style={styles.phoneInput} 
                        placeholder="77 000 00 00" 
                        keyboardType="phone-pad"
                        value={phoneNumber} onChangeText={setPhoneNumber}
                    />
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
                    <Text style={styles.cancelText}>Annuler</Text>
                </Pressable>
                <Pressable 
                    style={[styles.submitBtn, (!canSubmit || submitting) && styles.disabledBtn]} 
                    onPress={handleCreate}
                    disabled={!canSubmit || submitting}
                >
                    {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Créer</Text>}
                </Pressable>
            </View>
        </View>

        {/* --- MODALES --- */}
        
        <SelectionModal
            visible={showCountryModal}
            onClose={() => setShowCountryModal(false)}
            title="Choisir le pays de résidence"
            data={countriesList}
            renderItem={({ item }: { item: CountryData }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectAddressCountry(item)}>
                    <Text style={{fontSize:24, marginRight:10}}>{item.flag}</Text>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {addressCountry.code === item.code && <Ionicons name="checkmark" size={20} color={colors.primary}/>}
                </TouchableOpacity>
            )}
        />

        <SelectionModal
            visible={showCityModal}
            onClose={() => setShowCityModal(false)}
            title={`Villes (${addressCountry.name})`}
            data={addressCountry.cities}
            renderItem={({ item }: { item: string }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectCity(item)}>
                    <Text style={styles.modalItemText}>{item}</Text>
                    {city === item && <Ionicons name="checkmark" size={20} color={colors.primary}/>}
                </TouchableOpacity>
            )}
        />

        <SelectionModal
            visible={showPhoneCodeModal}
            onClose={() => setShowPhoneCodeModal(false)}
            title="Choisir l'indicatif"
            data={countriesList}
            renderItem={({ item }: { item: CountryData }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectPhoneCode(item)}>
                    <Text style={{fontSize:24, marginRight:10}}>{item.flag}</Text>
                    <Text style={[styles.modalItemText, {flex:1}]}>{item.name}</Text>
                    <Text style={{fontWeight:'bold', color:colors.primary}}>{item.dialCode}</Text>
                    {phoneCountry.code === item.code && <Ionicons name="checkmark" size={20} color={colors.primary}/>}
                </TouchableOpacity>
            )}
        />

      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Composant Modale Générique
const SelectionModal = ({ visible, onClose, title, data, renderItem }: any) => (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#374151" />
                    </TouchableOpacity>
                </View>
                <FlatList 
                    data={data} 
                    keyExtractor={(item, i) => (item.code || item) + i}
                    renderItem={renderItem}
                    contentContainerStyle={{paddingBottom: 20}}
                />
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "800", color: "#1F2937", marginBottom: 5 },
  subtitle: { color: "#6B7280", fontSize: 14 },

  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: "#F9FAFB" },
  
  selectorBtn: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: "#E5E7EB", 
    borderRadius: 10, 
    padding: 12, 
    backgroundColor: "#F9FAFB",
    // @ts-ignore (Web specific)
    cursor: 'pointer'
  },
  selectorText: { fontSize: 16, color: "#1F2937" },
  placeholderText: { color: "#9CA3AF" },

  phoneContainer: { 
    flexDirection: 'row', 
    borderWidth: 1, 
    borderColor: "#E5E7EB", 
    borderRadius: 10, 
    backgroundColor: "#F9FAFB", 
    overflow:'hidden' 
  },
  dialBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: "#F3F4F6", 
    paddingHorizontal: 12, 
    borderRightWidth: 1, 
    borderRightColor: "#E5E7EB",
    // @ts-ignore
    cursor: 'pointer'
  },
  phoneInput: { flex: 1, padding: 12, fontSize: 16 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, cursor: 'pointer' } as any,
  cancelText: { fontWeight: "700", color: "#6B7280" },
  submitBtn: { flex: 2, padding: 15, alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, cursor: 'pointer' } as any,
  disabledBtn: { opacity: 0.5 },
  submitText: { fontWeight: "700", color: "#FFF" },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: "#FFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  closeBtn: { padding: 5, backgroundColor: "#F3F4F6", borderRadius: 20, cursor: 'pointer' } as any,
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", cursor: 'pointer' } as any,
  modalItemText: { fontSize: 16, color: "#374151", fontWeight: "500" },
});