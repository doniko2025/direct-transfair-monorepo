//apps/direct-transfair-mobile/app/(tabs)/admin/notifications.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

// ─── THÈMES & TYPOGRAPHIES ──────────────────────────────────────────────
const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2", bg: "#F8FAFC" },
  COMPANY_ADMIN: { primary: "#1E3A8A", light: "#EFF6FF", bg: "#F8FAFC" },
  AGENT: { primary: "#78350F", light: "#FFF7ED", bg: "#F8FAFC" },
  USER: { primary: "#065F46", light: "#ECFDF5", bg: "#F8FAFC" },
};

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif', // Simule Cormorant Garamond
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif', // Simule Sora
};

// ─── INTERFACES ─────────────────────────────────────────────────────────
type NotifType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  createdAt: string;
  isRead: boolean;
  metadata?: any;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const role = user?.role || "COMPANY_ADMIN";
  const theme = THEMES[role as keyof typeof THEMES] || THEMES.COMPANY_ADMIN;

  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── APPELS API DIRECTS ───
  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api.http.get('/notifications');
      setNotifs(res.data || []);
    } catch (e) {
      console.error("Erreur chargement notifs:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifs();
  }, [fetchNotifs]);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchNotifs();
  };

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return; // Déjà lue, on ne fait rien
    
    // Mise à jour optimiste (UI d'abord)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    
    try {
      await api.http.patch(`/notifications/${id}/read`);
    } catch (e) {
      console.error("Erreur markAsRead:", e);
      // Revert en cas d'erreur
      void fetchNotifs();
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadCount = notifs.filter(n => !n.isRead).length;
    if (unreadCount === 0) return;

    // Mise à jour optimiste
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));

    try {
      await api.http.patch('/notifications/read-all');
    } catch (e) {
      console.error("Erreur markAllAsRead:", e);
      if (Platform.OS === 'web') alert("Impossible de marquer comme lu.");
      else Alert.alert("Erreur", "Impossible de marquer comme lu.");
      void fetchNotifs(); // Revert
    }
  };

  // ─── HELPERS UI ───
  const getIcon = (type: NotifType) => {
    switch (type) {
      case 'SUCCESS': return { name: 'checkmark-circle', color: '#10B981', bg: '#ECFDF5' };
      case 'WARNING': return { name: 'alert-circle', color: '#F59E0B', bg: '#FFFBEB' };
      case 'ERROR': return { name: 'close-circle', color: '#EF4444', bg: '#FEF2F2' };
      default: return { name: 'information-circle', color: theme.primary, bg: theme.light };
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('fr-FR', { 
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    }).replace(',', ' à');
  };

  const filteredNotifs = filter === 'ALL' ? notifs : notifs.filter(n => !n.isRead);
  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      
      {/* ─── HEADER COLORÉ ─── */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={15}>
            <Ionicons name="arrow-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Centre de Notifications</Text>
          <TouchableOpacity onPress={handleMarkAllAsRead} hitSlop={15} style={styles.readAllBtn}>
            <Ionicons name="mail-open" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* ─── TABS FILTRES ─── */}
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tab, filter === 'ALL' && styles.tabActive]} 
            onPress={() => setFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'ALL' && [styles.tabTextActive, { color: theme.primary }]]}>
              Toutes
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, filter === 'UNREAD' && styles.tabActive]} 
            onPress={() => setFilter('UNREAD')}
            activeOpacity={0.8}
          >
            <View style={styles.unreadRow}>
              <Text style={[styles.tabText, filter === 'UNREAD' && [styles.tabTextActive, { color: theme.primary }]]}>
                Non lues
              </Text>
              {unreadCount > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── LISTE DES NOTIFICATIONS ─── */}
      <View style={styles.content}>
        {loading && !refreshing ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} size="large" />
        ) : (
          <FlatList
            data={filteredNotifs}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
            }
            renderItem={({ item }) => {
              const icon = getIcon(item.type);
              return (
                <TouchableOpacity 
                  style={[styles.notifCard, !item.isRead && styles.unreadCard]} 
                  activeOpacity={0.7}
                  onPress={() => handleMarkAsRead(item.id, item.isRead)}
                >
                  <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
                    <Ionicons name={icon.name as any} size={24} color={icon.color} />
                  </View>
                  
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.notifTitle, !item.isRead && { color: '#0F172A' }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.timeText}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <Text style={[styles.messageText, !item.isRead && { color: '#334155' }]} numberOfLines={3}>
                      {item.message}
                    </Text>
                  </View>
                  
                  {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="notifications-off" size={48} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>Rien à signaler</Text>
                <Text style={styles.emptySub}>
                  {filter === 'UNREAD' 
                    ? "Vous avez lu toutes vos notifications." 
                    : "Votre centre de notifications est vide."}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  
  header: { paddingBottom: 15, paddingTop: Platform.OS === 'android' ? 40 : 10, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, zIndex: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
  headerTitle: { fontSize: 22, fontFamily: FONTS.heading, color: '#FFF', fontWeight: '700' },
  readAllBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  
  tabBar: { flexDirection: 'row', paddingHorizontal: 24, gap: 12 },
  tab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive: { backgroundColor: '#FFF', shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: FONTS.body, fontWeight: '700', letterSpacing: 0.5 },
  tabTextActive: { fontWeight: '900' },
  
  unreadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeWrap: { backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 10, fontFamily: FONTS.body, fontWeight: '900' },

  content: { flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  listContainer: { padding: 20, paddingTop: 24, paddingBottom: 100 },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowOpacity: 0.06,
    elevation: 4,
  },
  
  iconBox: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  notifTitle: { fontSize: 15, fontFamily: FONTS.body, fontWeight: '800', color: '#475569', flex: 1, paddingRight: 10 },
  timeText: { fontSize: 11, fontFamily: FONTS.body, color: '#94A3B8', fontWeight: '700' },
  
  messageText: { fontSize: 13, fontFamily: FONTS.body, color: '#64748B', lineHeight: 18, fontWeight: '500' },
  
  unreadDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 12 },

  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontFamily: FONTS.heading, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: FONTS.body, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});