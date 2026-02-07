//components/dashboards/DashboardShared.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function DashboardLayout({ title, subtitle, badge, badgeColor, children, refreshControl }: any) {
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor="#1F2937" barStyle="light-content" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <Text style={styles.headerSubtitle}>{subtitle}</Text>
                </View>
                {badge && (
                    <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
                        <Ionicons name={badge} size={24} color={badgeColor} />
                    </View>
                )}
            </View>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
                {children}
            </ScrollView>
        </SafeAreaView>
    );
}

export function MenuCard({ title, subtitle, icon, color, onPress, fullWidth = true }: any) {
    return (
        <TouchableOpacity style={[styles.card, !fullWidth && { flex: 1 }]} onPress={onPress}>
            <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={26} color={color} />
            </View>
            <View style={{flex:1}}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#E5E7EB" />
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1F2937" },
  header: { backgroundColor: "#1F2937", padding: 20, paddingBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  headerSubtitle: { color: "#9CA3AF", fontSize: 13, marginTop:2 },
  badge: { padding: 8, borderRadius: 12 },
  container: { flexGrow: 1, backgroundColor: "#F9FAFB", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 25, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 14, marginBottom: 2, borderWidth:1, borderColor:'#F3F4F6', minHeight: 80 },
  iconBox: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937" }, 
  cardSubtitle: { fontSize: 11, color: "#6B7280", marginTop: 2 },
});