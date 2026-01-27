//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/agents.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { api } from "../../../../services/api";

export default function AgencyAgentsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [agents, setAgents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchAgents();
    }, [id]);

    const fetchAgents = async () => {
        try {
            // On récupère l'agence complète qui contient les agents
            const data = await api.getAgency(id as string);
            setAgents(data.agents || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const renderAgent = ({ item }: { item: any }) => (
        <View style={styles.agentCard}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                    {item.firstName?.[0]}{item.lastName?.[0]}
                </Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
                <Text style={styles.email}>{item.email}</Text>
                <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{item.role}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Agents Connectés</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={agents}
                    keyExtractor={(item) => item.id}
                    renderItem={renderAgent}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>Aucun agent assigné à cette agence.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    list: { padding: 20 },
    
    agentCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, elevation: 1 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    avatarText: { fontSize: 16, fontWeight: '700', color: '#2563EB' },
    name: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
    email: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
    roleBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
    roleText: { fontSize: 10, fontWeight: '700', color: '#4B5563' },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 10, color: '#9CA3AF' }
});