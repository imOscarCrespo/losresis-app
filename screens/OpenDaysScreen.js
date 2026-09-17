import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import {
  getMyOpenDayRegistrations,
  getUpcomingHospitalOpenDays,
  registerForHospitalOpenDay,
} from "../services/hospitalService";
import { formatDateOnly } from "../utils/dateUtils";
import { openURL } from "../utils/courseUtils";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const WHITE = "#FFFFFF";

const getDateFromDayString = (value) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getOpenDayParts = (value) => {
  const date = getDateFromDayString(value);
  if (!date) {
    return { day: "—", month: "" };
  }

  return {
    day: date.toLocaleDateString("es-ES", { day: "2-digit" }),
    month: date.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
  };
};

/**
 * Jornadas de puertas abiertas publicadas por los hospitales desde
 * losresis-panel. Solo salen las que aún no se han celebrado, y todas las de un
 * hospital: si publica tres, se ven las tres.
 *
 * Antes esta tarjeta vivía dentro del perfil de hospital al que se entra desde
 * Planes Formativos, donde solo la encontraba quien ya estaba mirando ese
 * hospital. Aquí las jornadas son su propio destino, y desde el detalle de un
 * hospital se entra filtrado por él (`hospitalId`).
 */
export default function OpenDaysScreen({
  hospitalId = null,
  hospitalName = null,
  userProfile,
  onBack,
}) {
  const insets = useSafeAreaInsets();
  const userId = userProfile?.id || null;

  const [openDays, setOpenDays] = useState([]);
  const [registeredIds, setRegisteredIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registeringId, setRegisteringId] = useState(null);
  // El filtro que llega del detalle del hospital se puede quitar sin salir.
  const [filterHospitalId, setFilterHospitalId] = useState(hospitalId);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setFilterHospitalId(hospitalId);
  }, [hospitalId]);

  // `isActive` descarta el resultado de una carga que ya no interesa: se ha
  // vuelto atrás y la pantalla está desmontada, o el usuario ha cambiado
  // mientras llegaba la respuesta.
  const fetchOpenDays = useCallback(
    async (isActive = () => isMountedRef.current) => {
      try {
        const [openDaysResult, registrationsResult] = await Promise.all([
          getUpcomingHospitalOpenDays(),
          getMyOpenDayRegistrations(userId),
        ]);

        if (!openDaysResult.success) {
          console.error("Error loading open days:", openDaysResult.error);
        }
        if (!registrationsResult.success) {
          console.error(
            "Error loading my open day registrations:",
            registrationsResult.error
          );
        }

        if (!isActive()) return;

        setOpenDays(openDaysResult.success ? openDaysResult.openDays : []);
        setRegisteredIds(new Set(registrationsResult.openDayIds || []));
      } catch (error) {
        console.error("Exception fetching open days:", error);
        if (!isActive()) return;
        setOpenDays([]);
        setRegisteredIds(new Set());
      }
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;
    const isActive = () => !cancelled && isMountedRef.current;

    const load = async () => {
      setLoading(true);
      await fetchOpenDays(isActive);
      if (isActive()) {
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [fetchOpenDays]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOpenDays();
    if (isMountedRef.current) {
      setRefreshing(false);
    }
  }, [fetchOpenDays]);

  const visibleOpenDays = useMemo(
    () =>
      filterHospitalId
        ? openDays.filter((openDay) => openDay.hospital_id === filterHospitalId)
        : openDays,
    [openDays, filterHospitalId]
  );

  useEffect(() => {
    if (loading) return;
    posthogLogger.logScreen("OpenDaysScreen", {
      jornadaCount: openDays.length,
      hospitalFilter: filterHospitalId || null,
    });
  }, [loading, openDays.length, filterHospitalId]);

  const handleRegistration = async (openDay) => {
    if (!openDay?.id || registeredIds.has(openDay.id)) return;

    if (!userId) {
      Alert.alert(
        "Inicia sesión",
        "Necesitas haber iniciado sesión para inscribirte a una jornada de puertas abiertas."
      );
      return;
    }

    setRegisteringId(openDay.id);
    try {
      const { success, error } = await registerForHospitalOpenDay(
        openDay.id,
        userId
      );

      if (!success) {
        Alert.alert(
          "Error",
          error || "No se pudo completar la inscripción a la jornada."
        );
        return;
      }

      setRegisteredIds((current) => new Set(current).add(openDay.id));
      posthogLogger.capture("hospital_open_day_registered", {
        open_day_id: openDay.id,
        hospital_id: openDay.hospital_id,
        source: "open_days_screen",
      });
      Alert.alert("Inscripción completada", "Tu plaza ha quedado registrada.");
    } catch (error) {
      console.error("Exception registering for open day:", error);
      Alert.alert("Error", "No se pudo completar la inscripción a la jornada.");
    } finally {
      setRegisteringId(null);
    }
  };

  const handleOpenDayUrl = (openDay) => {
    if (!openDay?.cta_url) return;

    openURL(openDay.cta_url, () => {
      Alert.alert("Error", "No se pudo abrir la jornada.");
    });
  };

  const renderOpenDayCard = ({ item }) => {
    const dateParts = getOpenDayParts(item.event_date);
    const isRegistered = registeredIds.has(item.id);
    const isRegistering = registeringId === item.id;
    const hasExternalUrl = Boolean(item.cta_url);
    const urlLabel = item.cta_label?.trim() || "Ver jornada";
    const location = [item.hospital_city, item.hospital_region]
      .filter(Boolean)
      .join(", ");

    return (
      <View style={styles.openDayHero}>
        <View style={styles.openDayGlowLarge} />
        <View style={styles.openDayGlowSmall} />
        <View style={styles.openDayContent}>
          {item.image_public_url ? (
            <Image
              source={{ uri: item.image_public_url }}
              style={styles.openDayImage}
              resizeMode="cover"
            />
          ) : null}

          <View style={styles.openDayBadge}>
            <Icon name="calendar-outline" size={14} color={WHITE} />
            <Text style={styles.openDayBadgeText}>Próximo evento</Text>
          </View>

          <View style={styles.openDayTextBlock}>
            <Text style={styles.openDayHospital} numberOfLines={2}>
              {item.hospital_name}
            </Text>
            {location ? (
              <Text style={styles.openDayLocation}>{location}</Text>
            ) : null}
            <Text style={styles.openDayTitle}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.openDayDescription}>{item.description}</Text>
            ) : null}
            <Text style={styles.openDayFullDate}>
              {formatDateOnly(item.event_date)}
            </Text>
          </View>

          <View style={styles.openDayFooter}>
            <View style={styles.openDayDateCard}>
              <Text style={styles.openDayDateDay}>{dateParts.day}</Text>
              <Text style={styles.openDayDateMonth}>{dateParts.month}</Text>
            </View>

            <View style={styles.openDayActions}>
              <TouchableOpacity
                style={[
                  styles.openDayCta,
                  isRegistered && styles.openDayCtaRegistered,
                ]}
                activeOpacity={0.85}
                onPress={() => handleRegistration(item)}
                disabled={isRegistering || isRegistered}
              >
                {isRegistering ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Text style={styles.openDayCtaText}>
                    {isRegistered ? "Inscrito" : "Inscribirme"}
                  </Text>
                )}
              </TouchableOpacity>

              {hasExternalUrl ? (
                <TouchableOpacity
                  style={styles.openDaySecondaryCta}
                  activeOpacity={0.85}
                  onPress={() => handleOpenDayUrl(item)}
                >
                  <Text style={styles.openDaySecondaryCtaText}>{urlLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Con filtro activo el nombre sale del hospital de origen y no de la lista:
  // si su jornada se despublica entre pantallas, el chip sigue explicando qué
  // se está filtrando en vez de quedarse vacío.
  const filterLabel = filterHospitalId
    ? hospitalName ||
      openDays.find((openDay) => openDay.hospital_id === filterHospitalId)
        ?.hospital_name ||
      "Hospital"
    : null;

  const renderListHeader = () => {
    if (!filterHospitalId && visibleOpenDays.length === 0) return null;

    return (
      <View style={styles.headerRow}>
        {filterHospitalId ? (
          <>
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText} numberOfLines={1}>
                {filterLabel}
              </Text>
              <TouchableOpacity
                onPress={() => setFilterHospitalId(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Quitar el filtro de hospital"
              >
                <Icon name="close" size={14} color={PRIMARY} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setFilterHospitalId(null)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.filterClearText}>Ver todas</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.sectionLabel}>
            {visibleOpenDays.length}{" "}
            {visibleOpenDays.length === 1 ? "jornada" : "jornadas"}
          </Text>
        )}
      </View>
    );
  };

  return (
    <HeroScreenLayout
      title="Jornadas de puertas abiertas"
      onBack={onBack}
      bottomContent={
        <Text style={styles.heroSubtitle}>
          Visita los hospitales que abren sus puertas antes de elegir plaza.
        </Text>
      }
      containerStyle={styles.container}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando jornadas...</Text>
        </View>
      ) : (
        <FlatList
          data={visibleOpenDays}
          renderItem={renderOpenDayCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 24 + insets.bottom },
          ]}
          ListHeaderComponent={renderListHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="calendar-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {filterHospitalId
                  ? "Este hospital no tiene jornadas de puertas abiertas pendientes."
                  : "Todavía no hay jornadas de puertas abiertas publicadas."}
              </Text>
              {filterHospitalId ? (
                <TouchableOpacity
                  onPress={() => setFilterHospitalId(null)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Text style={styles.filterClearText}>
                    Ver todas las jornadas
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 2,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    backgroundColor: `${PRIMARY}0F`,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
    flexShrink: 1,
  },
  filterClearText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },

  /* Tarjeta de jornada */
  openDayHero: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: PRIMARY,
    padding: 22,
    position: "relative",
  },
  openDayGlowLarge: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    top: -60,
    right: -50,
  },
  openDayGlowSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    bottom: -30,
    right: 24,
  },
  openDayContent: { gap: 16 },
  // La imagen que sube el hospital desde el panel. Va dentro del hero, encima
  // del badge: es lo primero que se ve de la jornada.
  openDayImage: {
    width: "100%",
    height: 150,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  openDayBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  openDayBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  openDayTextBlock: { gap: 6 },
  // En una lista nacional el hospital es lo que sitúa la jornada, así que va
  // antes del título y no escondido en el cuerpo.
  openDayHospital: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  openDayLocation: {
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    marginTop: -2,
  },
  openDayTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: WHITE },
  openDayDescription: { fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.88)" },
  openDayFullDate: { fontSize: 12, color: "rgba(255,255,255,0.82)", fontWeight: "600", marginTop: 2 },
  openDayFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  openDayActions: {
    flex: 1,
    gap: 10,
  },
  openDayDateCard: {
    minWidth: 84,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  openDayDateDay: { fontSize: 24, fontWeight: "800", color: WHITE, lineHeight: 28 },
  openDayDateMonth: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.76)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  openDayCta: {
    backgroundColor: WHITE,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  openDayCtaRegistered: { backgroundColor: "rgba(255,255,255,0.92)" },
  openDayCtaText: { fontSize: 15, fontWeight: "700", color: PRIMARY },
  openDaySecondaryCta: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  openDaySecondaryCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: WHITE,
  },

  /* Loading / Empty */
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#64748B",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 21,
  },
});
