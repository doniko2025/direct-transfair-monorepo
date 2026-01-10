//apps/direct-transfair-mobile/app/referral.tsx
import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Share, 
  SafeAreaView, 
  Platform, 
  ScrollView, 
  Linking,
  Alert 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, FontAwesome } from "@expo/vector-icons"; // On ajoute FontAwesome pour l'icône WhatsApp
import * as Clipboard from 'expo-clipboard';

import { useAuth } from "../providers/AuthProvider";
import { colors } from "../theme/colors";
import { showAlert } from "../utils/alert";

export default function ReferralScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Code et Lien
  const referralCode = user ? `${user.firstName?.toUpperCase().substring(0, 3)}${user.id.substring(0, 4)}` : "CODE123";
  const referralLink = `https://direct-transfair.com/register?ref=${referralCode}`;
  
  // Message à envoyer
  const messageBody = `Salut ! 👋\n\nUtilise mon code parrainage *${referralCode}* sur Direct Transfair.\n\nInscris-toi ici pour envoyer de l'argent sans frais : ${referralLink}`;

  // 1. Partage Générique (Ouvre le menu système)
  const handleSystemShare = async () => {
    try {
      await Share.share({
        message: messageBody,
        url: referralLink, // Pour iOS
        title: "Invitation Direct Transfair" // Pour Android
      });
    } catch (error) {
      console.log(error);
    }
  };

  // 2. Copier dans le presse-papier
  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    showAlert("Copié", "Code copié !");
  };

  // 3. Ouvrir WhatsApp Directement
  const handleWhatsApp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(messageBody)}`;
    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert("Erreur", "WhatsApp n'est pas installé sur cet appareil.");
        }
    } catch (e) {
        // Fallback vers le partage système si erreur
        handleSystemShare();
    }
  };

  // 4. Ouvrir SMS Directement
  const handleSMS = async () => {
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const url = `sms:${separator}body=${encodeURIComponent(messageBody)}`;
    await Linking.openURL(url);
  };

  // 5. Ouvrir Email Directement
  const handleEmail = async () => {
    const url = `mailto:?subject=Invitation Direct Transfair&body=${encodeURIComponent(messageBody)}`;
    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Parrainage</Text>
        <View style={{width: 24}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Illustration */}
        <View style={styles.hero}>
            <View style={styles.iconCircle}>
                <Ionicons name="gift" size={60} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Gagnez de l'argent !</Text>
            <Text style={styles.heroText}>
                Invitez vos amis et gagnez <Text style={{fontWeight:'bold'}}>5€</Text> pour chaque ami qui effectue son premier transfert.
            </Text>
        </View>

        {/* Code de Parrainage */}
        <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>VOTRE CODE DE PARRAINAGE</Text>
            <Pressable style={styles.codeBox} onPress={handleCopy}>
                <Text style={styles.codeValue}>{referralCode}</Text>
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
            </Pressable>
            <Text style={styles.hint}>Appuyez pour copier</Text>
        </View>

        {/* --- ACTIONS DE PARTAGE --- */}
        <Text style={styles.sectionTitleCenter}>Envoyer une invitation via :</Text>
        
        <View style={styles.shareGrid}>
            {/* WhatsApp */}
            <Pressable style={[styles.socialBtn, {backgroundColor: '#25D366'}]} onPress={handleWhatsApp}>
                <FontAwesome name="whatsapp" size={24} color="#FFF" />
                <Text style={styles.socialText}>WhatsApp</Text>
            </Pressable>

            {/* SMS */}
            <Pressable style={[styles.socialBtn, {backgroundColor: '#3B82F6'}]} onPress={handleSMS}>
                <Ionicons name="chatbubble-ellipses" size={24} color="#FFF" />
                <Text style={styles.socialText}>SMS</Text>
            </Pressable>

            {/* Email */}
            <Pressable style={[styles.socialBtn, {backgroundColor: '#6B7280'}]} onPress={handleEmail}>
                <Ionicons name="mail" size={24} color="#FFF" />
                <Text style={styles.socialText}>Email</Text>
            </Pressable>
        </View>

        {/* Bouton Partage Global */}
        <Pressable style={styles.shareBtn} onPress={handleSystemShare}>
            <Ionicons name="share-social" size={20} color={colors.primary} style={{marginRight: 10}} />
            <Text style={styles.shareBtnText}>Autres options...</Text>
        </Pressable>

        {/* Explication */}
        <View style={styles.steps}>
            <Text style={styles.sectionTitle}>Comment ça marche ?</Text>
            
            <StepItem number="1" title="Envoyez une invitation" desc="Partagez votre lien avec vos proches." />
            <StepItem number="2" title="Ils s'inscrivent" desc="Ils utilisent votre code lors de l'inscription." />
            <StepItem number="3" title="Vous gagnez tous les deux" desc="Recevez 5€ chacun après leur premier envoi." />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// Petit composant pour les étapes
const StepItem = ({ number, title, desc }: any) => (
    <View style={styles.stepRow}>
        <View style={styles.stepNumber}><Text style={styles.stepNumText}>{number}</Text></View>
        <View style={{flex:1}}>
            <Text style={styles.stepTitle}>{title}</Text>
            <Text style={styles.stepDesc}>{desc}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  
  header: { 
    backgroundColor: colors.primary, 
    paddingTop: Platform.OS === 'android' ? 40 : 10, 
    paddingBottom: 20, 
    paddingHorizontal: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  backBtn: { padding: 5, cursor: 'pointer' } as any,

  content: { padding: 20, paddingBottom: 40 },

  hero: { alignItems: 'center', marginBottom: 25, marginTop: 5 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#1F2937", marginBottom: 8 },
  heroText: { textAlign: 'center', color: "#4B5563", lineHeight: 20, fontSize: 14, paddingHorizontal: 10 },

  codeCard: { backgroundColor: "#FFF", padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 25, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  codeLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", marginBottom: 10, letterSpacing: 1 },
  codeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#F3F4F6", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, gap: 10, cursor: 'pointer' } as any,
  codeValue: { fontSize: 20, fontWeight: "800", color: "#1F2937", letterSpacing: 1 },
  hint: { fontSize: 11, color: "#9CA3AF", marginTop: 8 },

  sectionTitleCenter: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 15, textAlign: 'center' },
  
  shareGrid: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginBottom: 15 },
  socialBtn: { width: 80, height: 80, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.1, elevation: 2, cursor: 'pointer' } as any,
  socialText: { color: "#FFF", fontSize: 11, fontWeight: "700", marginTop: 5 },

  shareBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 14, marginBottom: 30, borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent', cursor: 'pointer' } as any,
  shareBtnText: { color: colors.primary, fontSize: 14, fontWeight: "700" },

  steps: { marginTop: 0 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937", marginBottom: 20 },
  stepRow: { flexDirection: 'row', marginBottom: 20 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  stepNumText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },
  stepTitle: { fontSize: 15, fontWeight: "700", color: "#374151", marginBottom: 2 },
  stepDesc: { color: "#6B7280", fontSize: 13 },
});