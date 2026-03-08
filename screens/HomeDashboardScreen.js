import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHospitals } from "../hooks/useHospitals";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "BUENOS DÍAS";
  if (h < 20) return "BUENAS TARDES";
  return "BUENAS NOCHES";
}

export default function HomeDashboardScreen({
  userProfile,
  onHospitalSelect,
  onSectionChange,
}) {
  const insets = useSafeAreaInsets();
  const [searchInput, setSearchInput] = useState("");

  const {
    filteredHospitals,
    searchTerm,
    setSearchTerm,
    loadingHospitals,
  } = useHospitals();

  const displayName = useMemo(() => {
    const name = userProfile?.name || "";
    const surname = userProfile?.surname || "";
    return [name, surname].filter(Boolean).join(" ").trim() || "Usuario";
  }, [userProfile]);

  const firstName = userProfile?.name || displayName.split(" ")[0] || "Usuario";
  const lastName = userProfile?.surname || displayName.split(" ").slice(1).join(" ") || "";

  const bestMatchHospitals = useMemo(
    () => filteredHospitals.slice(0, 3),
    [filteredHospitals]
  );
  const alsoInterestedHospitals = useMemo(
    () => filteredHospitals.slice(3, 7),
    [filteredHospitals]
  );

  const handleSearchSubmit = () => setSearchTerm(searchInput.trim());

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header púrpura */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerBlur} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>
              {firstName}
              {lastName ? (
                <Text style={styles.userNameSecondary}> {lastName}</Text>
              ) : null}
            </Text>
            <Text style={styles.headerSubtitle}>
              Tu próxima residencia te espera
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifButton}
            onPress={() => {}}
          >
            <Ionicons name="notifications-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Card puntuación MIR */}
        <View style={styles.mirCard}>
          <View>
            <Text style={styles.mirScore}>6.842</Text>
            <View style={styles.mirRow}>
              <View style={styles.mirDot} />
              <Text style={styles.mirText}>Top 12% · ~Posición 1.800</Text>
            </View>
          </View>
          <View style={styles.mirRight}>
            <Text style={styles.mirLabel}>PUNTUACIÓN MIR</Text>
            <Text style={styles.mirYear}>Convocatoria 2024</Text>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => onSectionChange?.("nota-mir")}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: `${PRIMARY}20` }]}>
            <Ionicons name="bar-chart" size={22} color={PRIMARY} />
          </View>
          <Text style={styles.quickActionLabel}>Simulador MIR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => onSectionChange?.("hospitales")}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: `${SECONDARY}20` }]}>
            <Ionicons name="medkit" size={22} color={SECONDARY} />
          </View>
          <Text style={styles.quickActionLabel}>Especialidades</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => onSectionChange?.("myPreferences")}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: `${ACCENT}20` }]}>
            <Ionicons name="heart-outline" size={22} color={ACCENT} />
          </View>
          <Text style={styles.quickActionLabel}>Preferencias</Text>
        </TouchableOpacity>
      </View>

      {/* Búsqueda */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar hospital o especialidad..."
          placeholderTextColor="#9CA3AF"
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
      </View>

      {/* Hospitales + filtros */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hospitales</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{filteredHospitals.length} RESULTADOS</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          <TouchableOpacity style={styles.filterChip}>
            <Ionicons name="options" size={14} color={ACCENT} />
            <Text style={styles.filterChipText}>Ordenar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Ionicons name="location" size={14} color={ACCENT} />
            <Text style={styles.filterChipText}>Provincia</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Ionicons name="medkit" size={14} color={ACCENT} />
            <Text style={styles.filterChipText}>Especialidad</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Mejor match para ti */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBarGreen} />
          <View style={styles.sectionTitleBlock}>
            <Text style={styles.sectionTitle}>Mejor match para ti</Text>
            <Text style={styles.sectionSubtitle}>
              Basado en tu puntuación y especialidad
            </Text>
          </View>
        </View>
        {loadingHospitals ? (
          <ActivityIndicator size="small" color={PRIMARY} style={styles.loader} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalCards}
          >
            {bestMatchHospitals.map((hospital, idx) => (
              <TouchableOpacity
                key={hospital.id}
                style={[
                  styles.hospitalCard,
                  idx % 2 === 1 && styles.hospitalCardPurple,
                ]}
                onPress={() => onHospitalSelect?.(hospital, null, "inicio")}
                activeOpacity={0.8}
              >
                <Text style={styles.hospitalCardName} numberOfLines={2}>
                  {hospital.name}
                </Text>
                <View style={styles.hospitalCardRow}>
                  <Ionicons name="location" size={12} color="#6B7280" />
                  <Text style={styles.hospitalCardMeta}>
                    {hospital.city}, {hospital.region}
                  </Text>
                </View>
                <View style={styles.hospitalCardRow}>
                  <Ionicons name="school" size={12} color={SECONDARY} />
                  <Text style={styles.hospitalCardSpecialty}>
                    {hospital.specialtyCount ?? 0} especialidades MIR
                  </Text>
                </View>
                <View style={styles.hospitalCardDivider} />
                <View style={styles.hospitalCardRow}>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={styles.hospitalCardRating}>4.8</Text>
                  <Text style={styles.hospitalCardReviews}>· 214 reseñas</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Banner Buscar vivienda */}
      <TouchableOpacity
        style={styles.housingBanner}
        onPress={() => onSectionChange?.("vivienda")}
        activeOpacity={0.9}
      >
        <View style={styles.housingBannerBlur} />
        <View style={styles.housingBannerContent}>
          <View>
            <View style={styles.housingBadge}>
              <Text style={styles.housingBadgeText}>NUEVO</Text>
            </View>
            <Text style={styles.housingBannerTitle}>Buscar vivienda</Text>
            <Text style={styles.housingBannerSubtitle}>
              Pisos y habitaciones cerca de tu hospital
            </Text>
          </View>
          <View style={styles.housingBannerIcon}>
            <Ionicons name="home" size={40} color={SECONDARY} />
          </View>
        </View>
      </TouchableOpacity>

      {/* También te puede interesar */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBarPurple} />
          <Text style={[styles.sectionTitle, styles.sectionTitleOnly]}>
            También te puede interesar
          </Text>
        </View>
        {loadingHospitals ? (
          <ActivityIndicator size="small" color={PRIMARY} style={styles.loader} />
        ) : (
          <View style={styles.verticalCards}>
            {alsoInterestedHospitals.map((hospital, idx) => (
              <TouchableOpacity
                key={hospital.id}
                style={[
                  styles.alsoCard,
                  idx % 2 === 1 && styles.alsoCardPurple,
                ]}
                onPress={() => onHospitalSelect?.(hospital, null, "inicio")}
                activeOpacity={0.8}
              >
                <Text style={styles.alsoCardName}>{hospital.name}</Text>
                <Text style={styles.alsoCardLocation}>
                  {hospital.city}, {hospital.region}
                </Text>
                <View style={styles.alsoCardRow}>
                  <View style={styles.alsoCardStars}>
                    <Ionicons name="star" size={14} color="#FBBF24" />
                    <Text style={styles.alsoCardRating}>4.7</Text>
                  </View>
                  <Text style={styles.alsoCardSpecialty}>
                    {hospital.specialtyCount ?? 0} especialidades
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    backgroundColor: PRIMARY,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerBlur: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  greeting: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
  },
  userNameSecondary: {
    color: SECONDARY,
    fontStyle: "italic",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  mirCard: {
    backgroundColor: "rgba(27,9,119,0.4)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  mirScore: {
    fontSize: 44,
    fontWeight: "800",
    color: "#FFF",
  },
  mirRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  mirDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SECONDARY,
  },
  mirText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFF",
  },
  mirRight: {
    alignItems: "flex-end",
  },
  mirLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.6)",
  },
  mirYear: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFF",
    marginTop: 2,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 44,
    paddingRight: 16,
    marginBottom: 24,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    position: "absolute",
    left: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ACCENT,
    padding: 0,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
  },
  sectionTitleBlock: {
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(27,9,119,0.5)",
    marginTop: 2,
    textTransform: "uppercase",
  },
  badge: {
    backgroundColor: "rgba(27,9,119,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(27,9,119,0.5)",
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(27,9,119,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleOnly: {
    marginBottom: 0,
  },
  sectionBarGreen: {
    width: 4,
    height: 24,
    backgroundColor: SECONDARY,
    borderRadius: 2,
  },
  sectionBarPurple: {
    width: 4,
    height: 24,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },
  horizontalCards: {
    flexDirection: "row",
    gap: 16,
    paddingBottom: 16,
  },
  hospitalCard: {
    minWidth: 280,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderBottomWidth: 4,
    borderBottomColor: SECONDARY,
    shadowColor: SECONDARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  hospitalCardPurple: {
    borderBottomColor: PRIMARY,
    shadowColor: PRIMARY,
  },
  hospitalCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
  },
  hospitalCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  hospitalCardMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
  hospitalCardSpecialty: {
    fontSize: 12,
    fontWeight: "700",
    color: SECONDARY,
  },
  hospitalCardDivider: {
    height: 1,
    backgroundColor: "rgba(27,9,119,0.06)",
    marginVertical: 16,
  },
  hospitalCardRating: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  hospitalCardReviews: {
    fontSize: 12,
    color: "rgba(27,9,119,0.5)",
    marginLeft: 4,
  },
  loader: {
    marginVertical: 16,
  },
  housingBanner: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    overflow: "hidden",
    position: "relative",
  },
  housingBannerBlur: {
    position: "absolute",
    right: -32,
    bottom: -32,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(0,189,124,0.15)",
  },
  housingBannerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  housingBadge: {
    backgroundColor: SECONDARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  housingBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: ACCENT,
    letterSpacing: 0.5,
  },
  housingBannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
  },
  housingBannerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  housingBannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(0,189,124,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  verticalCards: {
    gap: 12,
  },
  alsoCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderBottomWidth: 4,
    borderBottomColor: SECONDARY,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  alsoCardPurple: {
    borderBottomColor: PRIMARY,
  },
  alsoCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  alsoCardLocation: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 4,
  },
  alsoCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  alsoCardStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alsoCardRating: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  alsoCardSpecialty: {
    fontSize: 12,
    fontWeight: "700",
    color: SECONDARY,
  },
});
