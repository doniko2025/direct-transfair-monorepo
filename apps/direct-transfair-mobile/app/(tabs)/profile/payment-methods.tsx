//apps/direct-transfair-mobile/app/(tabs)/profile/payment-methods.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";

export default function PaymentMethodsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moyens de paiement</Text>
        <View style={{width: 28}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.sectionTitle}>Mes cartes bancaires</Text>
        {/* Carte enregistrée (Exemple) */}
        <View style={styles.cardItem}>
            <View style={styles.cardIcon}>
                <Ionicons name="card" size={24} color={colors.primary} />
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.cardName}>Visa terminant par 4242</Text>
                <Text style={styles.cardExp}>Expire le 12/25</Text>
            </View>
            <TouchableOpacity>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add-circle" size={24} color={colors.primary} />
            <Text style={styles.addText}>Ajouter une carte bancaire</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, {marginTop: 30}]}>Mobile Money</Text>
        
        <PaymentOption icon="phone-portrait" label="Orange Money" connected={true} phone="+221 77 000 00 00" />
        <PaymentOption icon="phone-portrait" label="Sendwave" connected={false} />

      </ScrollView>
    </View>
  );
}

function PaymentOption({ icon, label, connected, phone }: any) {
    return (
        <View style={styles.cardItem}>
            <View style={[styles.cardIcon, { backgroundColor: connected ? '#FFF7ED' : '#F3F4F6' }]}>
                <Ionicons name={icon} size={24} color={connected ? colors.primary : '#9CA3AF'} />
            </View>
            <View style={styles.cardInfo}>
                <Text style={[styles.cardName, !connected && {color: '#9CA3AF'}]}>{label}</Text>
                {connected && <Text style={styles.cardExp}>{phone}</Text>}
            </View>
            {connected ? (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>Lié</Text>
                </View>
            ) : (
                <TouchableOpacity style={styles.linkBtn}>
                    <Text style={styles.linkText}>Lier</Text>
                </TouchableOpacity>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { backgroundColor: colors.primary, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  content: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 12 },
  
  cardItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardExp: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.primary, borderRadius: 12, backgroundColor: '#FFF' },
  addText: { marginLeft: 8, fontWeight: '600', color: colors.primary },

  badge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: '#16A34A', fontSize: 12, fontWeight: '700' },
  linkBtn: { backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  linkText: { fontSize: 12, fontWeight: '600', color: '#374151' }
});