//apps/direct-transfair-mobile/app/(tabs)/admin/commissions/history.tsx
import React from "react";
import { View, Text, StyleSheet, FlatList, SafeAreaView } from "react-native";
import { colors } from "../../../../theme/colors";

// Données simulées
const COMMISSIONS = [
    { id: '1', tx: 'TX-9485', total: 5000, type: 'Envoi', role: 'PARTNER', agency: 'Boutique A', amount: 1250, date: '12:30' },
    { id: '2', tx: 'TX-9485', total: 5000, type: 'Retrait', role: 'PRIVATE', agency: 'Siège Direct', amount: 0, date: '12:45' }, // 0 car privé -> va à la plateforme
    { id: '3', tx: 'TX-9485', total: 5000, type: 'Plateforme', role: 'ADMIN', agency: 'Direct Transfair', amount: 3750, date: '12:45' },
];

export default function CommissionHistoryScreen() {
  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>Journal des Commissions</Text>
        </View>
        <FlatList
            data={COMMISSIONS}
            keyExtractor={item => item.id}
            contentContainerStyle={{padding: 20}}
            renderItem={({item}) => (
                <View style={styles.row}>
                    <View>
                        <Text style={styles.txRef}>{item.tx} • {item.type}</Text>
                        <Text style={styles.agency}>{item.agency} <Text style={styles.role}>({item.role})</Text></Text>
                    </View>
                    <Text style={[styles.amount, item.role === 'ADMIN' && {color: colors.primary}]}>
                        +{item.amount} FCFA
                    </Text>
                </View>
            )}
        />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    title: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
    
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 15, marginBottom: 10, borderRadius: 12, elevation: 1 },
    txRef: { fontSize: 12, color: '#9CA3AF', fontWeight: '700', marginBottom: 4 },
    agency: { fontSize: 15, fontWeight: '600', color: '#374151' },
    role: { fontSize: 12, color: '#6B7280', fontWeight: '400' },
    amount: { fontSize: 16, fontWeight: '800', color: '#10B981' }
});