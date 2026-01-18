//apps/direct-transfair-mobile/app/(tabs)/admin/super-dashboard.tsx
import React, { useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, 
  Switch, Modal, FlatList, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator, Image, Platform,
  KeyboardAvoidingView // ✅ AJOUT DE L'IMPORT MANQUANT
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker'; 
import { colors } from "../../../theme/colors";
import { api } from "../../../services/api";

const ACTIVITY_SECTORS = [
    "Transfert d'argent", "Commerce Général", "Télécoms & Services", "Micro-Finance", "Transport & Logistique", "Autre"
];

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // --- ÉTATS MODALE ---
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  // Champs Formulaire
  const [logo, setLogo] = useState<string | null>(null); 
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("#F59E0B");
  const [contractType, setContractType] = useState<'RENT' | 'BUY'>('RENT');
  const [isActive, setIsActive] = useState(false);

  // Champs Demandeur (Admin)
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [ownerBirthDate, setOwnerBirthDate] = useState("");
  const [ownerBirthPlace, setOwnerBirthPlace] = useState("");
  const [ownerCountry, setOwnerCountry] = useState(""); 
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [activitySector, setActivitySector] = useState(ACTIVITY_SECTORS[0]);
  
  // Champ Mot de passe (Uniquement pour la création)
  const [adminPassword, setAdminPassword] = useState("");

  const [showActivityModal, setShowActivityModal] = useState(false);

  useFocusEffect(useCallback(() => { loadClients(); }, []));

  const loadClients = async () => {
    setLoading(true);
    try {
        const data = await api.getClients();
        if (Array.isArray(data)) setClients(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      setLogo(result.assets[0].uri);
    }
  };

  const showUniversalAlert = (title: string, msg: string) => {
      if (Platform.OS === 'web') {
          window.alert(`${title}\n${msg}`);
      } else {
          Alert.alert(title, msg);
      }
  };

  const openModal = (client?: any) => {
      if (client) {
          setIsEditMode(true);
          setSelectedClientId(client.id);
          setName(client.name);
          setCode(client.code);
          setColor(client.primaryColor || "#F59E0B");
          setContractType(client.subscriptionType === 'PURCHASE' ? 'BUY' : 'RENT'); 
          setIsActive(client.subscriptionStatus === 'ACTIVE');
          setLogo(client.logoUrl || null);
          
          // Mapping des infos existantes
          setOwnerFirstName(client.ownerFirstName || "");
          setOwnerLastName(client.ownerLastName || "");
          setContactPhone(client.contactPhone || "");
          setContactEmail(client.contactEmail || client.email || ""); 
          setOwnerCountry(client.ownerCountry || ""); 
          setOwnerAddress(client.ownerAddress || client.address || "");
          setOwnerBirthDate(client.ownerBirthDate ? new Date(client.ownerBirthDate).toLocaleDateString('fr-FR') : "");
          setOwnerBirthPlace(client.ownerBirthPlace || "");
          setActivitySector(client.activitySector || ACTIVITY_SECTORS[0]);
          setAdminPassword(""); 
      } else {
          setIsEditMode(false);
          setSelectedClientId(null);
          resetForm();
          setCode("SOC" + Math.floor(Math.random() * 10000));
          // Mot de passe par défaut généré
          setAdminPassword("Pass" + Math.floor(1000 + Math.random() * 9000));
      }
      setModalVisible(true);
  };

  const resetForm = () => {
      setName(""); setCode(""); setColor("#F59E0B"); setIsActive(false); setLogo(null);
      setOwnerFirstName(""); setOwnerLastName(""); setOwnerAddress("");
      setContactPhone(""); setContactEmail(""); setOwnerCountry("");
      setOwnerBirthDate(""); setOwnerBirthPlace(""); setAdminPassword("");
  };

  const formatDateForBackend = (dateStr: string) => {
      if (!dateStr) return undefined;
      const parts = dateStr.split('/');
      if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).toISOString();
      }
      return undefined; 
  };

  const handleSave = async () => {
      if (!name || !code) {
          showUniversalAlert("Erreur", "Le nom et le code société sont obligatoires.");
          return;
      }
      
      // Validation Email Admin en création
      if (!isEditMode && !contactEmail) {
          showUniversalAlert("Erreur", "L'email du demandeur (Admin) est obligatoire.");
          return;
      }

      setSubmitting(true);

      const isoDate = formatDateForBackend(ownerBirthDate);

      // ✅ CONSTRUCTION DU PAYLOAD CORRECT (Match le DTO backend)
      const payload: any = {
          name,
          code: code.trim().toUpperCase(),
          primaryColor: color,
          
          // Mapping vers les Enums Backend
          subscriptionType: contractType === 'BUY' ? 'PURCHASE' : 'RENTAL',
          status: isActive ? 'ACTIVE' : 'INACTIVE', 
          
          // ✅ CHAMPS ADMIN OBLIGATOIRES (Ceux qui manquaient !)
          adminEmail: contactEmail, 
          adminFirstName: ownerFirstName,
          adminLastName: ownerLastName,
          // Mot de passe seulement si fourni (ou en création)
          ...(adminPassword ? { adminPassword } : {}),

          // Autres infos
          logoUrl: logo,
          contactPhone,
          contactEmail, 
          activitySector,
          ownerAddress, 
          ownerCountry,
          ownerBirthPlace,
          ...(isoDate && { ownerBirthDate: isoDate }),
          
          // Champs redondants pour assurer la compatibilité
          ownerFirstName,
          ownerLastName,
      };

      console.log("Payload envoyé:", payload);

      try {
          if (isEditMode && selectedClientId) {
              await api.updateClient(selectedClientId, payload);
              showUniversalAlert("Succès", "Société mise à jour !");
          } else {
              await api.createClient(payload);
              showUniversalAlert("Succès", `Société créée !\nLogin Admin: ${contactEmail}\nPass: ${adminPassword}`);
          }
          
          setModalVisible(false);
          loadClients(); 

      } catch (e: any) {
          console.error("Erreur API:", e);
          const errorMsg = e.response?.data?.message || "Erreur serveur.";
          showUniversalAlert("Erreur", Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
      } finally {
          setSubmitting(false);
      }
  };

  const renderClientItem = ({ item }: any) => {
    const isActive = item.subscriptionStatus === 'ACTIVE';
    return (
        <View style={styles.clientCard}>
            <View style={[styles.statusIndicator, { backgroundColor: isActive ? '#10B981' : '#F59E0B' }]} />
            <View style={{flex: 1, paddingLeft: 10}}>
                <Text style={styles.clientName}>{item.name}</Text>
                <Text style={styles.clientCode}>Code: {item.code}</Text>
                <View style={styles.tags}>
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>{item.subscriptionType === 'PURCHASE' ? 'ACHAT' : 'LOCATION'}</Text>
                    </View>
                    <View style={[styles.tag, isActive ? {backgroundColor:'#D1FAE5'} : {backgroundColor:'#FEF3C7'}]}>
                        <Text style={[styles.tagText, isActive ? {color:'#065F46'} : {color:'#92400E'}]}>
                            {isActive ? 'ACTIF' : 'INACTIF'}
                        </Text>
                    </View>
                </View>
            </View>
            <TouchableOpacity onPress={() => openModal(item)} style={styles.actionBtn}>
                <Ionicons name="pencil" size={20} color="#3B82F6" />
            </TouchableOpacity>
        </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.title}>Gestion Sociétés</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
            <Ionicons name="add" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={clients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderClientItem}
        contentContainerStyle={{padding: 20}}
        ListEmptyComponent={<Text style={{textAlign:'center', marginTop:50, color:'#999'}}>Aucune société.</Text>}
        refreshing={loading}
        onRefresh={loadClients}
      />

      {/* --- MODALE --- */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{flex:1, backgroundColor:'#F9FAFB'}}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditMode ? "Modifier Société" : "Nouvelle Société"}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={28} color="#333" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
            <ScrollView contentContainerStyle={styles.modalContent}>
                
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>IDENTITÉ VISUELLE</Text>
                    <View style={{alignItems:'center', marginBottom:15}}>
                        <TouchableOpacity onPress={pickImage} style={styles.logoPlaceholder}>
                            {logo ? (
                                <Image source={{ uri: logo }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                            ) : (
                                <>
                                    <Ionicons name="camera-outline" size={30} color="#CCC" />
                                    <Text style={{color:'#999', fontSize:10, marginTop:5}}>Ajouter logo</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Nom de la société</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Flash Transfert" />

                    <Text style={styles.label}>Code Unique (Identifiant)</Text>
                    <TextInput 
                        style={[styles.input, {backgroundColor:'#F3F4F6'}]} 
                        value={code} 
                        onChangeText={setCode} 
                        editable={!isEditMode} 
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>CONTRAT & ACCÈS</Text>
                    <View style={styles.rowSwitch}>
                        <View style={{flex:1}}>
                            <Text style={styles.label}>Statut du compte</Text>
                            <Text style={{color: isActive ? '#10B981' : '#F59E0B', fontWeight:'bold', fontSize:12}}>
                                {isActive ? "COMPTE ACTIF" : "COMPTE INACTIF"}
                            </Text>
                        </View>
                        <Switch 
                            value={isActive} 
                            onValueChange={setIsActive} 
                            trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                        />
                    </View>

                    <Text style={styles.label}>Type d'offre</Text>
                    <View style={{flexDirection:'row', gap:10, marginTop:5}}>
                        <TouchableOpacity 
                            style={[styles.typeBtn, contractType === 'RENT' && styles.typeBtnActive]} 
                            onPress={() => setContractType('RENT')}
                        >
                            <Text style={[styles.typeText, contractType === 'RENT' && {color:'#FFF'}]}>Location (SaaS)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.typeBtn, contractType === 'BUY' && styles.typeBtnActive]} 
                            onPress={() => setContractType('BUY')}
                        >
                            <Text style={[styles.typeText, contractType === 'BUY' && {color:'#FFF'}]}>Achat (Licence)</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>INFORMATIONS DU DEMANDEUR (ADMIN)</Text>
                    
                    <View style={{flexDirection:'row', gap:10}}>
                        <View style={{flex:1}}>
                            <Text style={styles.label}>Prénom</Text>
                            <TextInput style={styles.input} value={ownerFirstName} onChangeText={setOwnerFirstName} placeholder="Prénom" />
                        </View>
                        <View style={{flex:1}}>
                            <Text style={styles.label}>Nom</Text>
                            <TextInput style={styles.input} value={ownerLastName} onChangeText={setOwnerLastName} placeholder="Nom" />
                        </View>
                    </View>

                    <Text style={styles.label}>Email (Sera l'identifiant de connexion)</Text>
                    <TextInput 
                        style={styles.input} 
                        value={contactEmail} 
                        onChangeText={setContactEmail} 
                        keyboardType="email-address" 
                        autoCapitalize="none" 
                        placeholder="admin@societe.com"
                    />

                    {!isEditMode && (
                        <>
                            <Text style={styles.label}>Mot de passe (Admin)</Text>
                            <TextInput 
                                style={styles.input} 
                                value={adminPassword} 
                                onChangeText={setAdminPassword} 
                                secureTextEntry
                                placeholder="******" 
                            />
                        </>
                    )}

                    <Text style={styles.label}>Téléphone</Text>
                    <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" placeholder="+221..." />

                    <Text style={styles.label}>Secteur d'activité</Text>
                    <TouchableOpacity style={styles.selectInput} onPress={() => setShowActivityModal(true)}>
                        <Text>{activitySector}</Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>

                    <View style={{flexDirection:'row', gap:10}}>
                        <View style={{flex:1}}>
                            <Text style={styles.label}>Date Naissance</Text>
                            <TextInput style={styles.input} value={ownerBirthDate} onChangeText={setOwnerBirthDate} placeholder="JJ/MM/AAAA" />
                        </View>
                        <View style={{flex:1}}>
                            <Text style={styles.label}>Lieu</Text>
                            <TextInput style={styles.input} value={ownerBirthPlace} onChangeText={setOwnerBirthPlace} />
                        </View>
                    </View>

                    <Text style={styles.label}>Pays de résidence</Text>
                    <TextInput style={styles.input} value={ownerCountry} onChangeText={setOwnerCountry} placeholder="Sénégal" />

                    <Text style={styles.label}>Adresse complète</Text>
                    <TextInput style={styles.input} value={ownerAddress} onChangeText={setOwnerAddress} multiline />
                </View>

                <TouchableOpacity 
                    style={[styles.saveBtn, submitting && {opacity: 0.7}]} 
                    onPress={handleSave}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.saveText}>ENREGISTRER</Text>
                    )}
                </TouchableOpacity>
                <View style={{height:100}} />

            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showActivityModal} transparent animationType="fade" onRequestClose={() => setShowActivityModal(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalSmall}>
                    <Text style={{fontWeight:'bold', fontSize:16, marginBottom:10}}>Choisir une activité</Text>
                    <FlatList 
                        data={ACTIVITY_SECTORS}
                        keyExtractor={item => item}
                        renderItem={({item}) => (
                            <TouchableOpacity style={{paddingVertical:12, borderBottomWidth:1, borderColor:'#EEE'}} onPress={() => {setActivitySector(item); setShowActivityModal(false)}}>
                                <Text>{item}</Text>
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity style={{marginTop:10, alignSelf:'flex-end'}} onPress={() => setShowActivityModal(false)}>
                        <Text style={{color:'red'}}>Fermer</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { backgroundColor: '#1E293B', padding: 20, paddingTop: 40, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    title: { color: "#FFF", fontSize: 18, fontWeight: "700" },
    backBtn: { padding: 5 },
    addBtn: { backgroundColor: '#FFF', padding: 8, borderRadius: 20 },

    clientCard: { flexDirection:'row', backgroundColor:'#FFF', marginHorizontal:20, marginBottom:10, borderRadius:12, padding:15, alignItems:'center', shadowColor:'#000', shadowOpacity:0.05, elevation:2 },
    statusIndicator: { width:4, height:'100%', borderRadius:2, marginRight:10 },
    clientName: { fontSize:16, fontWeight:'bold', color:'#1F2937' },
    clientCode: { fontSize:12, color:'#6B7280', marginBottom:5 },
    tags: { flexDirection:'row', gap:5 },
    tag: { backgroundColor:'#F3F4F6', paddingHorizontal:6, paddingVertical:2, borderRadius:4 },
    tagText: { fontSize:10, fontWeight:'700', color:'#4B5563' },
    actions: { flexDirection:'row', gap:10 },
    actionBtn: { padding:8, backgroundColor:'#EFF6FF', borderRadius:8 },

    // Styles Modale
    modalHeader: { flexDirection:'row', justifyContent:'space-between', padding:20, borderBottomWidth:1, borderColor:'#E5E7EB', backgroundColor:'#FFF' },
    modalTitle: { fontSize:18, fontWeight:'800', color:'#1F2937' },
    modalContent: { padding:20 },
    
    section: { backgroundColor:'#FFF', borderRadius:12, padding:15, marginBottom:20, borderWidth:1, borderColor:'#E5E7EB' },
    sectionHeader: { fontSize:12, fontWeight:'800', color:'#9CA3AF', marginBottom:15, letterSpacing:1 },

    label: { fontSize:13, fontWeight:'600', color:'#374151', marginBottom:6, marginTop:10 },
    input: { borderWidth:1, borderColor:'#D1D5DB', borderRadius:8, padding:12, fontSize:15, backgroundColor:'#FFF' },
    selectInput: { borderWidth:1, borderColor:'#D1D5DB', borderRadius:8, padding:12, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },

    logoPlaceholder: { width:80, height:80, borderRadius:40, backgroundColor:'#F3F4F6', justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:'#E5E7EB', borderStyle:'dashed', overflow: 'hidden' },

    rowSwitch: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15, backgroundColor:'#F9FAFB', padding:10, borderRadius:8 },
    
    typeBtn: { flex:1, padding:12, borderRadius:8, borderWidth:1, borderColor:'#E5E7EB', alignItems:'center', backgroundColor:'#FFF' },
    typeBtnActive: { backgroundColor:'#F59E0B', borderColor:'#F59E0B' },
    typeText: { fontWeight:'700', color:'#374151' },

    saveBtn: { backgroundColor:'#F59E0B', padding:18, borderRadius:12, alignItems:'center', marginTop:10, zIndex: 999, elevation: 5 },
    saveText: { color:'#FFF', fontWeight:'800', fontSize:16 },

    modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding:30 },
    modalSmall: { backgroundColor:'#FFF', borderRadius:12, padding:20 }
});