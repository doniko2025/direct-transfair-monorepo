// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/[id].tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../../../services/api";
import type { Beneficiary, CreateBeneficiaryPayload } from "../../../services/types";
import { colors } from "../../../theme/colors";
import { showAlert, showConfirm } from "../../../utils/alert";
import { countriesList, CountryData } from "../../../data/countries";

function getIdParam(params: Record<string, string | string[] | undefined>): string | null {
  const raw = params.id;
  if (typeof raw === "string") {
    const v = raw.trim();
    if (v.length > 0 && v !== "undefined") return v;
    return null;
  }
  if (Array.isArray(raw)) {
    const v = (raw[0] ?? "").trim();
    if (v.length > 0 && v !== "undefined") return v;
    return null;
  }
  return null;
}

export default function BeneficiaireDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = useMemo(() => getIdParam(params as Record<string, string | string[] | undefined>), [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [item, setItem] = useState<Beneficiary | null>(null);
  const [editing, setEditing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  
  const [addressCountry, setAddressCountry] = useState<CountryData>(countriesList[0]);
  const [phoneCountry, setPhoneCountry] = useState<CountryData>(countriesList[0]);
  
  const [city, setCity] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);

  const hydrateForm = (b: Beneficiary) => {
    const parts = (b.fullName || "").split(" ");
    if (parts.length > 1) {
        setFirstName(parts.slice(0, -1).join(" "));
        setLastName(parts[parts.length - 1]);
    } else {
        setFirstName(b.fullName || "");
        setLastName("");
    }

    const foundCountry = countriesList.find(c => c.name === b.country);
    if (foundCountry) {
        setAddressCountry(foundCountry);
        if (!b.phone) setPhoneCountry(foundCountry);
    }
    setCity(b.city || "");

    if (b.phone) {
        const sortedCountries = [...countriesList].sort((a, b) => b.dialCode.length - a.dialCode.length);
        const matchingCountry = sortedCountries.find(c => b.phone?.startsWith(c.dialCode));
        
        if (matchingCountry) {
            setPhoneCountry(matchingCountry);
            setPhoneNumber(b.phone.replace(matchingCountry.dialCode, ""));
        } else {
            setPhoneNumber(b.phone); 
        }
    } else {
        setPhoneNumber("");
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const b = await api.getBeneficiary(id);
      setItem(b);
      hydrateForm(b);
    } catch (e) {
      console.error(e);
      showAlert("Erreur", "Impossible de charger le bénéficiaire.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setEditing(false);
      void load();
      return () => {};
    }, [load])
  );

  const handleSelectAddressCountry = (country: CountryData) => {
    setAddressCountry(country);
    setCity(""); 
    setShowCountryModal(false);
  };

  const handleSelectCity = (cityName: string) => {
    setCity(cityName);
    setShowCityModal(false);
  };

  const handleSelectPhoneCode = (country: CountryData) => {
    setPhoneCountry(country);
    setShowPhoneCodeModal(false);
  };

  const canSave = firstName.trim().length >= 2 && lastName.trim().length >= 2 && city.trim().length >= 2;

  const onSave = async () => {
    if (!id || !item) return;
    if (!canSave) {
      showAlert("Validation", "Merci de remplir nom, prénom et ville.");
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    
    let fullPhone = null;
    if (phoneNumber.trim().length > 0) {
        const dial = phoneCountry.dialCode.replace('+', ''); 
        const num = phoneNumber.trim().replace(/^0+/, '');
        fullPhone = `+${dial}${num}`;
    }

    const payload: Partial<CreateBeneficiaryPayload> = {
      fullName: fullName,
      country: addressCountry.name,
      city: city.trim(),
      phone: fullPhone,
    };

    try {
      setSaving(true);
      const updated = await api.updateBeneficiary(id, payload);
      setItem(updated);
      hydrateForm(updated);
      setEditing(false);
      showAlert("Succès", "Bénéficiaire mis à jour.");
    } catch (e) {
      console.error(e);
      showAlert("Erreur", "Impossible de mettre à jour le bénéficiaire.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!id) return;
    showConfirm(
      "Confirmation", 
      "Voulez-vous vraiment supprimer ce bénéficiaire ?", 
      async () => {
        try {
          setDeleting(true);
          await api.deleteBeneficiary(id);
          showAlert("Supprimé", "Bénéficiaire supprimé avec succès.", () => {
            router.back();
          });
        } catch (e) {
          showAlert("Erreur", "Impossible de supprimer (peut-être lié à une transaction).");
        } finally {
          setDeleting(false);
        }
      }
    );
  };

  const onCancelEdit = () => {
    if (item) hydrateForm(item);
    setEditing(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!item) return <View style={styles.center}><Text>Bénéficiaire introuvable.</Text></View>;

  const renderSelector = (label: string, value: string, onPress: () => void, placeholder: string, icon?: string) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <Pressable 
        style={({ pressed }) => [styles.selectorBtn, pressed && { backgroundColor: '#E5E7EB' }]} 
        onPress={onPress}
      >
        <View style={{flexDirection:'row', alignItems:'center'}}>
            {icon && <Text style={{fontSize: 20, marginRight: 8}}>{icon}</Text>}
            <Text style={[styles.selectorText, !value && styles.placeholderText]}>{value || placeholder}</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
    <ScrollView contentContainerStyle={styles.container}>
      
      <View style={styles.headerRow}>
         <TouchableOpacity onPress={() => router.back()} style={{padding:5}}>
            <Ionicons name="arrow-back" size={24} color="#000" />
         </TouchableOpacity>
         <Text style={styles.title}>Bénéficiaire</Text>
         <View style={{width:24}}/>
      </View>

      {!editing ? (
        <View style={styles.card}>
            <View style={styles.readOnlyRow}>
                <View style={[styles.avatar, {backgroundColor: '#E0F2FE'}]}>
                    <Text style={[styles.avatarText, {color: colors.primary}]}>{item.fullName.charAt(0)}</Text>
                </View>
                <View>
                    <Text style={styles.name}>{item.fullName}</Text>
                    <Text style={styles.line}>{item.city}, {item.country}</Text>
                    {item.phone && <Text style={styles.line}>{item.phone}</Text>}
                </View>
            </View>
        </View>
      ) : (
        <View style={styles.card}>
            <View style={{flexDirection:'row', gap: 10}}>
                <View style={[styles.inputGroup, {flex:1}]}>
                    <Text style={styles.label}>Prénom</Text>
                    <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
                </View>
                <View style={[styles.inputGroup, {flex:1}]}>
                    <Text style={styles.label}>Nom</Text>
                    <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
                </View>
            </View>

            {renderSelector("Pays de résidence", addressCountry.name, () => setShowCountryModal(true), "Choisir", addressCountry.flag)}
            {renderSelector("Ville", city, () => setShowCityModal(true), "Choisir une ville")}

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Téléphone (Mobile Money)</Text>
                <View style={styles.phoneContainer}>
                    <Pressable 
                        style={({pressed}) => [styles.dialBtn, pressed && { backgroundColor: '#E5E7EB' }]} 
                        onPress={() => setShowPhoneCodeModal(true)}
                    >
                        <Text style={{marginRight:5, fontSize:16}}>{phoneCountry.flag}</Text>
                        <Text style={{fontWeight:'700', color:'#374151'}}>{phoneCountry.dialCode}</Text>
                        <Ionicons name="chevron-down" size={14} color="#6B7280" style={{marginLeft:4}}/>
                    </Pressable>
                    <TextInput 
                        style={styles.phoneInput} 
                        value={phoneNumber} 
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        placeholder="Ex: 77 000 00 00"
                    />
                </View>
            </View>
        </View>
      )}

      {/* --- ACTIONS --- */}
      <View style={styles.actions}>
        {!editing ? (
          <Pressable style={styles.btnPrimary} onPress={() => setEditing(true)}>
            <Text style={styles.btnPrimaryText}>Modifier</Text>
          </Pressable>
        ) : (
          <View style={{gap: 10, width:'100%'}}>
              <Pressable style={styles.cancelEdit} onPress={onCancelEdit}>
                 <Text style={styles.cancelEditText}>Annuler</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.btnPrimary, (!canSave || saving) && styles.btnDisabled]} 
                onPress={onSave}
                disabled={!canSave || saving}
              >
                {saving ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnPrimaryText}>Enregistrer</Text>}
              </Pressable>
          </View>
        )}

        <Pressable 
            style={[styles.btnDanger, deleting && styles.btnDisabled]} 
            onPress={onDelete}
            disabled={deleting}
        >
             {deleting ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnDangerText}>Supprimer le bénéficiaire</Text>}
        </Pressable>
      </View>

    </ScrollView>
    </KeyboardAvoidingView>

    {/* --- MODALES --- */}
    <SelectionModal
        visible={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        title="Pays de résidence"
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
        title="Indicatif"
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
    </SafeAreaView>
  );
}

const SelectionModal = ({ visible, onClose, title, data, renderItem }: any) => (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
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
  container: { flexGrow: 1, padding: 20, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "800", color: "#1F2937" },

  card: { padding: 20, borderRadius: 16, backgroundColor: "#FFF", marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  
  readOnlyRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  name: { fontSize: 18, fontWeight: "800", color: "#1F2937" },
  line: { color: "#6B7280", marginTop: 2 },

  inputGroup: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: "#F9FAFB" },
  
  selectorBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, backgroundColor: "#F9FAFB", cursor: 'pointer' } as any,
  selectorText: { fontSize: 16, color: "#1F2937" },
  placeholderText: { color: "#9CA3AF" },

  phoneContainer: { flexDirection: 'row', borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, backgroundColor: "#F9FAFB", overflow:'hidden' },
  dialBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#F3F4F6", paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: "#E5E7EB", cursor: 'pointer' } as any,
  phoneInput: { flex: 1, padding: 12, fontSize: 16 },

  actions: { alignItems: 'center', gap: 15 },
  
  btnPrimary: { width:'100%', paddingVertical: 15, borderRadius: 10, alignItems: "center", backgroundColor: colors.primary, cursor: 'pointer' } as any,
  btnPrimaryText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  
  btnDanger: { width:'100%', paddingVertical: 15, borderRadius: 10, alignItems: "center", backgroundColor: "#EF4444", cursor: 'pointer' } as any,
  btnDangerText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  
  cancelEdit: { width:'100%', paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, backgroundColor:'#FFF', cursor: 'pointer' } as any,
  cancelEditText: { color: "#6B7280", fontWeight: "700" },

  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' } as any,

  // --- STYLES MODALE (CORRIGÉS) ---
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20 
  },
  modalContent: { 
    backgroundColor: "#FFF", 
    borderRadius: 16, 
    maxHeight: '80%', 
    width: '100%',
    maxWidth: 500,
    padding: 20,
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  closeBtn: { padding: 5, backgroundColor: "#F3F4F6", borderRadius: 20, cursor: 'pointer' } as any,
  modalItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: "#F3F4F6", 
    cursor: 'pointer' 
  } as any,
  modalItemText: { fontSize: 16, color: "#374151", fontWeight: "500" },
});