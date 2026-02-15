// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

type SubscriptionStatus = "ACTIVE" | "INACTIVE" | "EXPIRED" | "SUSPENDED" | string;
type SubscriptionType = "RENTAL" | "PURCHASE" | string;

type ClientSaas = {
  id: string;
  name: string;
  code: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionType?: SubscriptionType;
  primaryColor?: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function normalizeClients(raw: unknown): ClientSaas[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.data)
      ? (raw.data as unknown[])
      : [];

  const out: ClientSaas[] = [];

  for (const item of arr) {
    if (!isRecord(item)) continue;
    const id = toStr(item.id);
    const name = toStr(item.name);
    const code = toStr(item.code);
    if (!id || !code) continue;

    out.push({
      id,
      name: name || code,
      code,
      subscriptionStatus: toStr(item.subscriptionStatus) || undefined,
      subscriptionType: toStr(item.subscriptionType) || undefined,
      primaryColor: isRecord(item)
        ? ((item.primaryColor as string | null | undefined) ?? null)
        : null,
    });
  }

  return out;
}

function statusLabel(s?: string) {
  if (!s) return "INCONNU";
  const up = s.toUpperCase();
  if (up === "ACTIVE") return "ACTIF";
  if (up === "INACTIVE") return "INACTIF";
  if (up === "EXPIRED") return "EXPIRÉ";
  if (up === "SUSPENDED") return "SUSPENDU";
  return up;
}

function statusColor(s?: string) {
  const up = (s ?? "").toUpperCase();
  if (up === "ACTIVE") return "#10B981";
  if (up === "INACTIVE") return "#64748B";
  if (up === "EXPIRED") return "#EF4444";
  if (up === "SUSPENDED") return "#F59E0B";
  return "#94A3B8";
}

function subscriptionLabel(t?: string) {
  const up = (t ?? "").toUpperCase();
  if (up === "PURCHASE") return "ACHAT";
  if (up === "RENTAL") return "LOCATION";
  return up || "—";
}

type QuickAction = {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

function isEmailLike(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function onlyDigits(v: string): string {
  return v.replace(/[^\d]/g, "");
}

function normalizeUpperAlnum(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateTenantCode7(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 7; i += 1) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

function generateTempPassword6(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const isSuperAdmin = (user?.role ?? "") === "SUPER_ADMIN";

  const [clients, setClients] = useState<ClientSaas[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [q, setQ] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [contractType, setContractType] = useState<"RENTAL" | "PURCHASE">("RENTAL");

  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");

  const [addrNumber, setAddrNumber] = useState("");
  const [addrLabel, setAddrLabel] = useState("");
  const [addrPostalCode, setAddrPostalCode] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrCountry, setAddrCountry] = useState("");

  const [nationality, setNationality] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [birthCountry, setBirthCountry] = useState("");

  // ✅ GENRE: seulement 2 options (M/F). “X” supprimé.
  const [gender, setGender] = useState<"M" | "F" | "">("");

  const headerTopPadding = useMemo(() => {
    if (Platform.OS === "android") return (StatusBar.currentHeight ?? 0) + 10;
    if (Platform.OS === "web") return 18;
    return 12;
  }, []);

  const resetCreateForm = useCallback(() => {
    setCompanyName("");
    setAdminEmail("");
    setContractType("RENTAL");

    setManagerFirstName("");
    setManagerLastName("");
    setManagerPhone("");

    setAddrNumber("");
    setAddrLabel("");
    setAddrPostalCode("");
    setAddrCity("");
    setAddrCountry("");

    setNationality("");
    setBirthDate("");
    setBirthCity("");
    setBirthCountry("");
    setGender("");

    setCompanyCode(generateTenantCode7());
    setAdminPassword(generateTempPassword6());
  }, []);

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const raw = await api.getClients();
      const normalized = normalizeClients(raw).filter((c) => c.code !== "DONIKO");
      setClients(normalized);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("SuperAdminDashboard loadData error:", msg);
      Alert.alert("Erreur", "Impossible de charger la liste des clients SaaS.");
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData("init");
      return () => {};
    }, [loadData]),
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;

    return clients.filter((c) => {
      const hay = `${c.name} ${c.code} ${c.subscriptionStatus ?? ""} ${c.subscriptionType ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [clients, q]);

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => (c.subscriptionStatus ?? "").toUpperCase() === "ACTIVE").length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [clients]);

  const actions: QuickAction[] = useMemo(
    () => [
      {
        title: "Trésorerie",
        subtitle: "Super admin",
        icon: "wallet-outline",
        color: "#10B981",
        onPress: () => router.push("/(tabs)/admin/treasury"),
      },
      {
        title: "Taux EUR",
        subtitle: "Change",
        icon: "trending-up-outline",
        color: "#8B5CF6",
        onPress: () => router.push("/(tabs)/admin/rates"),
      },
      {
        title: "Audit Transac",
        subtitle: "Contrôle",
        icon: "analytics-outline",
        color: "#3B82F6",
        onPress: () => router.push("/(tabs)/admin/transactions"),
      },
      {
        title: "Gestion Users",
        subtitle: "Comptes",
        icon: "people-outline",
        color: "#64748B",
        onPress: () => router.push("/(tabs)/admin/users"),
      },
    ],
    [router],
  );

  const openClient = useCallback(
    (client: ClientSaas) => {
      router.push({ pathname: "/(tabs)/admin", params: { id: client.id } });
    },
    [router],
  );

  const handleAddNewSociety = useCallback(() => {
    if (!isSuperAdmin) {
      Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société.");
      return;
    }
    resetCreateForm();
    setCreateOpen(true);
  }, [isSuperAdmin, resetCreateForm]);

  const handleCreateCompany = useCallback(async () => {
    if (!isSuperAdmin) {
      Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société.");
      return;
    }

    const name = companyName.trim();
    const code = normalizeUpperAlnum(companyCode).slice(0, 7);
    const email = adminEmail.trim().toLowerCase();
    const pass = normalizeUpperAlnum(adminPassword).slice(0, 6);

    const mFirst = managerFirstName.trim();
    const mLast = managerLastName.trim();
    const mPhone = managerPhone.trim();

    const aNum = addrNumber.trim();
    const aLabel = addrLabel.trim();
    const aCP = addrPostalCode.trim();
    const aCity = addrCity.trim();
    const aCountry = addrCountry.trim();

    const nat = nationality.trim();
    const bDate = birthDate.trim();
    const bCity = birthCity.trim();
    const bCountry = birthCountry.trim();

    if (!name || !email) {
      Alert.alert("Erreur", "Nom de l’entreprise et email administrateur obligatoires.");
      return;
    }
    if (!/^[A-Z0-9]{7}$/.test(code)) {
      Alert.alert("Erreur", "Le code société doit contenir exactement 7 caractères (A-Z, 0-9).");
      return;
    }
    if (!isEmailLike(email)) {
      Alert.alert("Erreur", "Email administrateur invalide.");
      return;
    }
    if (!/^[A-Z0-9]{6}$/.test(pass)) {
      Alert.alert("Erreur", "Le mot de passe provisoire doit contenir 6 caractères (A-Z, 0-9).");
      return;
    }
    if (!mFirst || !mLast) {
      Alert.alert("Erreur", "Le prénom et le nom du gérant sont obligatoires.");
      return;
    }
    if (!aLabel || !aCity || !aCountry) {
      Alert.alert("Erreur", "Adresse : libellé, ville et pays sont obligatoires.");
      return;
    }
    if (!aCP) {
      Alert.alert("Erreur", "Adresse : code postal obligatoire.");
      return;
    }

    setCreating(true);

    try {
      // ✅ Normalisation: on envoie un genre standard backend (MALE/FEMALE)
      const genderBackend =
        gender === "M" ? "MALE" : gender === "F" ? "FEMALE" : undefined;

      await api.createClient({
        name,
        code,
        adminEmail: email,
        adminPassword: pass,
        subscriptionType: contractType,
        subscriptionStatus: "ACTIVE",

        manager: {
          firstName: mFirst,
          lastName: mLast,
          phone: mPhone || undefined,
          gender: genderBackend,
          nationality: nat || undefined,
          birthDate: bDate || undefined,
          birthCity: bCity || undefined,
          birthCountry: bCountry || undefined,
        },

        companyAddress: {
          number: aNum || undefined,
          label: aLabel,
          postalCode: aCP,
          city: aCity,
          country: aCountry,
        },
      });

      setCreateOpen(false);

      Alert.alert(
        "Société créée",
        `✅ Société: ${name}\nCode: ${code}\nAdmin: ${email}\nMot de passe provisoire: ${pass}`,
        [{ text: "OK" }],
      );

      void loadData("refresh");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Création impossible.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setCreating(false);
    }
  }, [
    isSuperAdmin,
    companyName,
    companyCode,
    adminEmail,
    adminPassword,
    contractType,
    managerFirstName,
    managerLastName,
    managerPhone,
    addrNumber,
    addrLabel,
    addrPostalCode,
    addrCity,
    addrCountry,
    nationality,
    birthDate,
    birthCity,
    birthCountry,
    gender,
    loadData,
  ]);

  const renderClientItem = useCallback(
    ({ item }: { item: ClientSaas }) => {
      const dot = statusColor(item.subscriptionStatus);
      const status = statusLabel(item.subscriptionStatus);
      const sub = subscriptionLabel(item.subscriptionType);

      return (
        <TouchableOpacity style={styles.clientCard} onPress={() => openClient(item)} activeOpacity={0.9}>
          <View style={[styles.statusDot, { backgroundColor: dot }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.clientMeta} numberOfLines={1}>
                Code: <Text style={styles.clientMetaStrong}>{item.code}</Text>
              </Text>

              <View style={[styles.badge, { borderColor: dot }]}>
                <Text style={[styles.badgeText, { color: dot }]}>{status}</Text>
              </View>

              <View style={[styles.badge, { borderColor: "#E2E8F0" }]}>
                <Text style={[styles.badgeText, { color: "#334155" }]}>{sub}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardActions}>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
        </TouchableOpacity>
      );
    },
    [openClient],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#0F172A" barStyle="light-content" />

      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: headerTopPadding }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Super Console</Text>
            <Text style={styles.headerSubtitle}>
              Direct Transf’air Cloud • {user?.firstName ? `${user.firstName}` : "SUPER_ADMIN"}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => void loadData("refresh")}>
              <Ionicons name="refresh-outline" size={20} color="#E2E8F0" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.profileBadge} activeOpacity={0.9}>
              <Ionicons name="shield-checkmark" size={22} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderClientItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData("refresh")} />}
          ListHeaderComponent={
            <View>
              <View style={styles.topCard}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>SOCIÉTÉS</Text>
                  <Text style={styles.statValue}>{stats.total}</Text>
                </View>
                <View style={styles.dividerV} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>ACTIVES</Text>
                  <Text style={styles.statValue}>{stats.active}</Text>
                </View>
                <View style={styles.dividerV} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>INACTIVES</Text>
                  <Text style={styles.statValue}>{stats.inactive}</Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>PILOTAGE RÉSEAU</Text>
              <View style={styles.grid}>
                {actions.map((a) => (
                  <QuickActionCard key={a.title} action={a} />
                ))}
              </View>

              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color="#94A3B8" />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Rechercher une société (nom, code, statut...)"
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!q && (
                  <TouchableOpacity onPress={() => setQ("")} style={styles.clearBtn}>
                    <Ionicons name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionLabel}>CLIENTS SAAS (SOCIÉTÉS)</Text>
                <TouchableOpacity
                  style={[styles.plusButton, !isSuperAdmin && { opacity: 0.55 }]}
                  onPress={handleAddNewSociety}
                  activeOpacity={0.9}
                >
                  <Ionicons name="add" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 18, marginBottom: 10 }} />}
            </View>
          }
          ListEmptyComponent={loading ? null : <Text style={styles.emptyText}>Aucun client SaaS trouvé.</Text>}
          ListFooterComponent={<View style={{ height: 110 }} />}
        />
      </View>

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Nouvelle société</Text>
                  <Text style={styles.modalSubtitle}>Code 7 caractères (A-Z, 0-9) • MDP provisoire 6 caractères</Text>
                </View>
                <TouchableOpacity onPress={() => setCreateOpen(false)} style={styles.modalCloseBtn} disabled={creating}>
                  <Ionicons name="close" size={22} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 }}>
                <View style={styles.formCard}>
                  <Text style={styles.blockTitle}>Société</Text>

                  <Text style={styles.label}>Nom de l’entreprise</Text>
                  <TextInput
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder="Ex: Flash Transfert"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={!creating}
                  />

                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Code société</Text>
                      <View style={styles.readonlyWrap}>
                        <Text style={styles.readonlyText}>{companyCode}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.smallBtn}
                      onPress={() => {
                        if (creating) return;
                        setCompanyCode(generateTenantCode7());
                      }}
                      activeOpacity={0.9}
                      disabled={creating}
                    >
                      <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.smallBtnText}>Regén.</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Email administrateur</Text>
                  <TextInput
                    value={adminEmail}
                    onChangeText={setAdminEmail}
                    placeholder="admin@societe.com"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!creating}
                  />

                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Mot de passe provisoire</Text>
                      <View style={styles.readonlyWrap}>
                        <Text style={styles.readonlyText}>{adminPassword}</Text>
                      </View>
                      <Text style={styles.microHelp}>À communiquer au nouvel admin (modifiable après 1ère connexion).</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.smallBtn}
                      onPress={() => {
                        if (creating) return;
                        setAdminPassword(generateTempPassword6());
                      }}
                      activeOpacity={0.9}
                      disabled={creating}
                    >
                      <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.smallBtnText}>Nouv.</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Contrat</Text>
                      <Text style={styles.helperText}>{contractType === "RENTAL" ? "Location" : "Achat"}</Text>
                    </View>
                    <Switch
                      value={contractType === "PURCHASE"}
                      onValueChange={(v) => setContractType(v ? "PURCHASE" : "RENTAL")}
                      trackColor={{ false: "#CBD5E1", true: colors.primary }}
                      thumbColor="#FFFFFF"
                      disabled={creating}
                    />
                  </View>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.blockTitle}>Gérant</Text>

                  <View style={styles.grid2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Prénom</Text>
                      <TextInput
                        value={managerFirstName}
                        onChangeText={setManagerFirstName}
                        placeholder="Ex: Amadou"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        editable={!creating}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Nom</Text>
                      <TextInput
                        value={managerLastName}
                        onChangeText={setManagerLastName}
                        placeholder="Ex: Diallo"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        editable={!creating}
                      />
                    </View>
                  </View>

                  <Text style={styles.label}>Téléphone</Text>
                  <TextInput
                    value={managerPhone}
                    onChangeText={(v) => setManagerPhone(onlyDigits(v))}
                    placeholder="Ex: 776637262"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    keyboardType="phone-pad"
                    editable={!creating}
                  />

                  <View style={styles.grid2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Genre</Text>
                      <View style={styles.pillsRow}>
                        {[
                          { k: "M" as const, label: "H" },
                          { k: "F" as const, label: "F" },
                        ].map((p) => {
                          const active = gender === p.k;
                          return (
                            <TouchableOpacity
                              key={p.k}
                              style={[styles.pill, active && styles.pillActive]}
                              onPress={() => setGender(active ? "" : p.k)}
                              activeOpacity={0.9}
                              disabled={creating}
                            >
                              <Text style={[styles.pillText, active && styles.pillTextActive]}>{p.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Nationalité</Text>
                      <TextInput
                        value={nationality}
                        onChangeText={setNationality}
                        placeholder="Ex: Sénégalaise"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        editable={!creating}
                      />
                    </View>
                  </View>

                  <View style={styles.grid2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Date de naissance</Text>
                      <TextInput
                        value={birthDate}
                        onChangeText={setBirthDate}
                        placeholder="JJ/MM/AAAA"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        editable={!creating}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Lieu de naissance</Text>
                      <TextInput
                        value={birthCity}
                        onChangeText={setBirthCity}
                        placeholder="Ville"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        editable={!creating}
                      />
                    </View>
                  </View>

                  <Text style={styles.label}>Pays de naissance</Text>
                  <TextInput
                    value={birthCountry}
                    onChangeText={setBirthCountry}
                    placeholder="Ex: Guinée"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={!creating}
                  />
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.blockTitle}>Adresse Société</Text>

                  <View style={styles.grid2}>
                    <View style={{ flex: 0.42 }}>
                      <Text style={styles.label}>N°</Text>
                      <TextInput
                        value={addrNumber}
                        onChangeText={setAddrNumber}
                        placeholder="Ex: 12"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        keyboardType="default"
                        editable={!creating}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Libellé</Text>
                      <TextInput
                        value={addrLabel}
                        onChangeText={setAddrLabel}
                        placeholder="Rue / Quartier / Avenue"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        editable={!creating}
                      />
                    </View>
                  </View>

                  <View style={styles.grid2}>
                    <View style={{ flex: 0.55 }}>
                      <Text style={styles.label}>Code postal</Text>
                      <TextInput
                        value={addrPostalCode}
                        onChangeText={(v) => setAddrPostalCode(v.trim())}
                        placeholder="Ex: 75001"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        keyboardType="default"
                        editable={!creating}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Ville</Text>
                      <TextInput
                        value={addrCity}
                        onChangeText={setAddrCity}
                        placeholder="Ex: Dakar"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        editable={!creating}
                      />
                    </View>
                  </View>

                  <Text style={styles.label}>Pays</Text>
                  <TextInput
                    value={addrCountry}
                    onChangeText={setAddrCountry}
                    placeholder="Ex: Sénégal"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={!creating}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, creating && { opacity: 0.8 }]}
                  onPress={handleCreateCompany}
                  activeOpacity={0.92}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>CRÉER LA SOCIÉTÉ</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setCreateOpen(false)}
                  activeOpacity={0.9}
                  disabled={creating}
                >
                  <Text style={styles.secondaryBtnText}>Annuler</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <TouchableOpacity style={styles.pCard} onPress={action.onPress} activeOpacity={0.9}>
      <View style={[styles.pIconBox, { backgroundColor: "rgba(15, 23, 42, 0.04)" }]}>
        <Ionicons name={action.icon} size={22} color={action.color} />
      </View>
      <Text style={styles.pTitle}>{action.title}</Text>
      {!!action.subtitle && <Text style={styles.pSubtitle}>{action.subtitle}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0F172A" },
  screen: { flex: 1, backgroundColor: "#0F172A" },

  header: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  headerSubtitle: { color: "#94A3B8", fontSize: 13, fontWeight: "500", marginTop: 3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 as any },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  listContent: {
    paddingTop: 16,
    paddingHorizontal: 18,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: "100%",
  },

  topCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  statBox: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "800", letterSpacing: 1 },
  statValue: { fontSize: 20, fontWeight: "900", color: "#1E293B", marginTop: 6 },
  dividerV: { width: 1, height: 38, backgroundColor: "#E2E8F0" },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1.4,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 18,
    elevation: 1,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  pTitle: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  pSubtitle: { marginTop: 3, fontSize: 12, color: "#64748B", fontWeight: "600" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    paddingLeft: 10,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(148,163,184,0.15)",
  },

  plusButton: {
    backgroundColor: "#F59E0B",
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#F59E0B",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },

  clientCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  statusDot: { width: 6, height: 46, borderRadius: 999, marginRight: 14 },
  clientName: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 6, gap: 8 as any },
  clientMeta: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  clientMetaStrong: { color: "#334155", fontWeight: "900" },

  badge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(248,250,252,0.7)",
  },
  badgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },

  cardActions: { paddingLeft: 10 },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 22, fontSize: 14, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: "92%",
  },
  modalHandle: {
    alignSelf: "center",
    width: 56,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  modalSubtitle: { marginTop: 2, fontSize: 12, color: "#64748B", fontWeight: "700" },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(148,163,184,0.15)",
  },

  formCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 10,
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    color: "#334155",
    letterSpacing: 0.7,
    marginBottom: 8,
    marginTop: 10,
    textTransform: "uppercase",
  },
  helperText: { fontSize: 13, color: "#64748B", fontWeight: "700", marginTop: 2 },
  microHelp: { marginTop: 6, fontSize: 11, color: "#64748B", fontWeight: "700" },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "700",
  },
  readonlyWrap: {
    backgroundColor: "rgba(148,163,184,0.18)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
  },
  readonlyText: { fontSize: 15, fontWeight: "900", color: "#0F172A" },

  row2: { flexDirection: "row", alignItems: "flex-end", gap: 10 as any },
  grid2: { flexDirection: "row", gap: 10 as any },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6 as any,
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  smallBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12, letterSpacing: 0.4 },

  switchRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  pillsRow: { flexDirection: "row", gap: 10 as any, marginTop: 2 },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { borderColor: colors.primary, backgroundColor: "rgba(245,158,11,0.12)" },
  pillText: { color: "#0F172A", fontWeight: "900", fontSize: 12, letterSpacing: 0.6 },
  pillTextActive: { color: "#92400E" },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10 as any,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1.1 },

  secondaryBtn: {
    marginTop: 10,
    backgroundColor: "rgba(148,163,184,0.18)",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: "#334155", fontWeight: "900", fontSize: 13 },
});
