import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../components/ScreenHeader";
import {
  getHospitalOpenDayRegistrationStatus,
  getHospitalProfileContent,
  registerForHospitalOpenDay,
} from "../services/hospitalService";
import { getCurrentUser } from "../services/authService";
import { formatDateOnly } from "../utils/dateUtils";
import { openURL } from "../utils/courseUtils";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const WHITE = "#FFFFFF";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#F1F5F9";
const ERROR = "#EF4444";
const SURFACE_ALT = "#F3F4F8";

const getEmptyHospitalProfile = () => ({
  org_id: null,
  about: null,
  differential_points: [],
  images: [],
  open_day: null,
  plans: [],
});

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

const getFilenameFromUrl = (value, fallback = "plan-formativo.pdf") => {
  if (!value) return fallback;

  try {
    const pathname = new URL(value).pathname;
    const filename = pathname.split("/").pop();
    return filename || fallback;
  } catch {
    return fallback;
  }
};

const SectionTitle = ({ title, rightLabel = null }) => (
  <View style={styles.sectionRow}>
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionLabel}>{title}</Text>
    </View>
    {rightLabel ? <Text style={styles.sectionCount}>{rightLabel}</Text> : null}
  </View>
);

const InfoChip = ({ text }) => (
  <View style={styles.infoChip}>
    <Text style={styles.infoChipText}>{text}</Text>
  </View>
);

export default function HospitalInfoScreen({ hospital, onBack }) {
  const [hospitalProfile, setHospitalProfile] = useState(getEmptyHospitalProfile());
  const [profileLoading, setProfileLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [downloadingPlanId, setDownloadingPlanId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [openDayRegistered, setOpenDayRegistered] = useState(false);
  const [openDayRegistrationLoading, setOpenDayRegistrationLoading] = useState(false);

  useEffect(() => {
    posthogLogger.logScreen("HospitalInfoScreen", {
      hospitalId: hospital?.id,
    });
  }, [hospital?.id]);

  useEffect(() => {
    setSelectedPlanId(null);
    setOpenDayRegistered(false);
  }, [hospital?.id]);

  useEffect(() => {
    if (!hospital?.id) return;
    fetchHospitalProfile();
  }, [hospital?.id]);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const openDayId = hospitalProfile?.open_day?.id;
    if (!openDayId || !currentUserId) {
      setOpenDayRegistered(false);
      return;
    }

    fetchOpenDayRegistrationStatus(openDayId, currentUserId);
  }, [hospitalProfile?.open_day?.id, currentUserId]);

  const fetchHospitalProfile = async () => {
    setProfileLoading(true);
    try {
      const { success, profile, error } = await getHospitalProfileContent(hospital.id);
      if (success && profile) {
        setHospitalProfile(profile);
      } else {
        console.error("Error loading hospital profile:", error);
        setHospitalProfile(getEmptyHospitalProfile());
      }
    } catch (error) {
      console.error("Exception fetching hospital profile:", error);
      setHospitalProfile(getEmptyHospitalProfile());
    } finally {
      setProfileLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const { success, user } = await getCurrentUser();
      setCurrentUserId(success && user?.id ? user.id : null);
    } catch (error) {
      console.error("Exception loading current user:", error);
      setCurrentUserId(null);
    }
  };

  const fetchOpenDayRegistrationStatus = async (openDayId, userId) => {
    try {
      const { success, isRegistered } =
        await getHospitalOpenDayRegistrationStatus(openDayId, userId);
      if (success) {
        setOpenDayRegistered(isRegistered);
      }
    } catch (error) {
      console.error("Exception fetching open day registration status:", error);
    }
  };

  const selectedPlan = useMemo(
    () =>
      (hospitalProfile?.plans || []).find(
        (plan) => plan.speciality_id === selectedPlanId
      ) || null,
    [hospitalProfile?.plans, selectedPlanId]
  );

  const handleOpenPlanPdf = (plan) => {
    if (!plan?.plan_formativo_url) return;
    openURL(plan.plan_formativo_url, () => {
      Alert.alert("Error", "No se pudo abrir el plan formativo.");
    });
  };

  const handleDownloadPlanPdf = async (plan) => {
    if (!plan?.plan_formativo_url || downloadingPlanId) return;

    setDownloadingPlanId(plan.speciality_id);
    try {
      const [{ File, Paths }, Sharing] = await Promise.all([
        import("expo-file-system"),
        import("expo-sharing"),
      ]);

      const downloadedFile = await File.downloadFileAsync(
        plan.plan_formativo_url,
        Paths.cache,
        { idempotent: true }
      );

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: "application/pdf",
          dialogTitle: `Plan formativo de ${plan.speciality_name}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        await Linking.openURL(downloadedFile.uri);
      }
    } catch (error) {
      console.error("Error downloading hospital formative plan:", error);
      handleOpenPlanPdf(plan);
    } finally {
      setDownloadingPlanId(null);
    }
  };

  const handleOpenDayRegistration = async (openDay) => {
    if (!openDay?.id || openDayRegistered) return;

    if (!currentUserId) {
      Alert.alert(
        "Inicia sesión",
        "Necesitas haber iniciado sesión para inscribirte a una jornada de puertas abiertas."
      );
      return;
    }

    setOpenDayRegistrationLoading(true);
    try {
      const { success, error } = await registerForHospitalOpenDay(
        openDay.id,
        currentUserId
      );

      if (!success) {
        Alert.alert(
          "Error",
          error || "No se pudo completar la inscripción a la jornada."
        );
        return;
      }

      setOpenDayRegistered(true);
      Alert.alert("Inscripción completada", "Tu plaza ha quedado registrada.");
    } catch (error) {
      console.error("Exception registering for open day:", error);
      Alert.alert("Error", "No se pudo completar la inscripción a la jornada.");
    } finally {
      setOpenDayRegistrationLoading(false);
    }
  };

  const handleOpenDayUrl = (openDay) => {
    if (!openDay?.cta_url) return;

    openURL(openDay.cta_url, () => {
      Alert.alert("Error", "No se pudo abrir la jornada.");
    });
  };

  const renderOpenDayCard = () => {
    const openDay = hospitalProfile?.open_day;
    if (!openDay) return null;

    const dateParts = getOpenDayParts(openDay.event_date);
    const hasExternalUrl = Boolean(openDay.cta_url);
    const urlLabel = openDay.cta_label?.trim() || "Ver jornada";

    return (
      <View style={styles.openDayHero}>
        <View style={styles.openDayGlowLarge} />
        <View style={styles.openDayGlowSmall} />
        <View style={styles.openDayContent}>
          <View style={styles.openDayBadge}>
            <Ionicons name="calendar-outline" size={14} color={WHITE} />
            <Text style={styles.openDayBadgeText}>Próximo evento</Text>
          </View>

          <View style={styles.openDayTextBlock}>
            <Text style={styles.openDayTitle}>{openDay.title}</Text>
            {openDay.description ? (
              <Text style={styles.openDayDescription}>{openDay.description}</Text>
            ) : null}
            <Text style={styles.openDayFullDate}>
              {formatDateOnly(openDay.event_date)}
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
                  openDayRegistered && styles.openDayCtaRegistered,
                ]}
                activeOpacity={0.85}
                onPress={() => handleOpenDayRegistration(openDay)}
                disabled={openDayRegistrationLoading || openDayRegistered}
              >
                {openDayRegistrationLoading ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Text style={styles.openDayCtaText}>
                    {openDayRegistered ? "Inscrito" : "Inscribirme"}
                  </Text>
                )}
              </TouchableOpacity>

              {hasExternalUrl ? (
                <TouchableOpacity
                  style={styles.openDaySecondaryCta}
                  activeOpacity={0.85}
                  onPress={() => handleOpenDayUrl(openDay)}
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

  const renderPlanDetail = () => {
    if (!selectedPlan) return null;

    const fileName = getFilenameFromUrl(
      selectedPlan.plan_formativo_url,
      `${selectedPlan.speciality_name}.pdf`
    );
    const hasDifferentialPoints =
      (selectedPlan.differential_points || []).length > 0;
    const hasPdf = Boolean(selectedPlan.plan_formativo_url);

    return (
      <View style={styles.planDetailStack}>
        <View style={styles.planDetailHero}>
          <View style={styles.planDetailHeroGlow} />
          <View style={styles.planDetailHeroContent}>
            <View style={styles.planDetailIconWrap}>
              <Ionicons name="medkit-outline" size={24} color={PRIMARY} />
            </View>
            <View style={styles.planDetailHeader}>
              <Text style={styles.planDetailTitle}>{selectedPlan.speciality_name}</Text>
              <Text style={styles.planDetailSubtitle}>Especialidad médica</Text>
              <Text style={styles.planDetailHospital}>{hospital.name}</Text>
            </View>

            <Text style={styles.planDetailDescription}>
              {selectedPlan.description?.trim()
                ? selectedPlan.description
                : "El hospital todavía no ha publicado una descripción editorial para esta especialidad."}
            </Text>

            {hasDifferentialPoints ? (
              <View style={styles.planDetailChips}>
                {selectedPlan.differential_points.map((point) => (
                  <InfoChip key={point} text={point} />
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Plan formativo</Text>
          {hasPdf ? (
            <>
              <View style={styles.pdfCardHeader}>
                <View style={styles.pdfIconWrap}>
                  <Ionicons name="document-text-outline" size={28} color={ERROR} />
                  <Text style={styles.pdfIconLabel}>PDF</Text>
                </View>
                <View style={styles.pdfCopy}>
                  <Text style={styles.pdfTitle}>Documento oficial del hospital</Text>
                  <Text style={styles.pdfFilename} numberOfLines={1}>
                    {fileName}
                  </Text>
                </View>
              </View>

              <View style={styles.pdfActions}>
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  activeOpacity={0.85}
                  onPress={() => handleOpenPlanPdf(selectedPlan)}
                >
                  <Ionicons name="eye-outline" size={16} color={WHITE} />
                  <Text style={styles.primaryActionButtonText}>Ver documento</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryActionButton}
                  activeOpacity={0.85}
                  onPress={() => handleDownloadPlanPdf(selectedPlan)}
                  disabled={downloadingPlanId === selectedPlan.speciality_id}
                >
                  {downloadingPlanId === selectedPlan.speciality_id ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : (
                    <Ionicons name="download-outline" size={16} color={PRIMARY} />
                  )}
                  <Text style={styles.secondaryActionButtonText}>
                    {downloadingPlanId === selectedPlan.speciality_id
                      ? "Preparando descarga..."
                      : "Descargar PDF"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.infoCardBody}>
              El hospital no ha adjuntado un PDF para esta especialidad.
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.planBackButton}
          activeOpacity={0.82}
          onPress={() => setSelectedPlanId(null)}
        >
          <Ionicons name="chevron-back" size={16} color={PRIMARY} />
          <Text style={styles.planBackButtonText}>Ver otras especialidades</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (!hospital) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.errorTitle}>Hospital no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <ScreenHeader
        title={selectedPlan ? selectedPlan.speciality_name : "Información del hospital"}
        onBack={selectedPlan ? () => setSelectedPlanId(null) : onBack}
        compact
        variant="brand"
        titleNumberOfLines={selectedPlan ? 2 : 1}
      />

      <View style={styles.scrollContent}>
        {profileLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={PRIMARY} />
            <Text style={styles.loadingText}>Cargando información del hospital...</Text>
          </View>
        ) : selectedPlan ? (
          renderPlanDetail()
        ) : (
          <>
            <SectionTitle title="Información del hospital" />

            <View style={styles.infoSectionStack}>
              {(hospitalProfile?.about ||
                (hospitalProfile?.differential_points || []).length > 0) && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardTitle}>Resumen general</Text>
                  {hospitalProfile?.about ? (
                    <Text style={styles.infoCardBody}>{hospitalProfile.about}</Text>
                  ) : null}
                  {(hospitalProfile?.differential_points || []).length > 0 ? (
                    <View style={styles.infoChipsWrap}>
                      {hospitalProfile.differential_points.map((point) => (
                        <InfoChip key={point} text={point} />
                      ))}
                    </View>
                  ) : null}
                </View>
              )}

              {renderOpenDayCard()}

              {(hospitalProfile?.images || []).length > 0 && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardTitle}>Galería de imágenes</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.galleryScrollContent}
                    nestedScrollEnabled
                  >
                    {hospitalProfile.images.map((image, index) => (
                      <View
                        key={image.id || `${image.public_url}-${index}`}
                        style={styles.galleryItem}
                      >
                        <Image
                          source={{ uri: image.public_url }}
                          style={styles.galleryImage}
                          resizeMode="cover"
                        />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.infoCard}>
                <View style={styles.infoCardHeaderRow}>
                  <View style={styles.infoCardHeaderContent}>
                    <Text style={styles.infoCardTitle}>Planes formativos</Text>
                    <Text style={styles.infoCardCaption}>
                      Explora las especialidades publicadas por el hospital
                    </Text>
                  </View>
                  {(hospitalProfile?.plans || []).length > 0 ? (
                    <View style={styles.infoCardCountBadge}>
                      <Text style={styles.infoCardCount}>
                        {(hospitalProfile?.plans || []).length}{" "}
                        {(hospitalProfile?.plans || []).length === 1
                          ? "PLAN"
                          : "PLANES"}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {(hospitalProfile?.plans || []).length > 0 ? (
                  <>
                    <View style={styles.planCardsList}>
                      {(hospitalProfile?.plans || []).map((plan) => (
                          <TouchableOpacity
                            key={plan.speciality_id}
                            style={styles.planCard}
                            activeOpacity={0.82}
                            onPress={() => setSelectedPlanId(plan.speciality_id)}
                          >
                            <View style={styles.planCardCopy}>
                              <Text style={styles.planCardTitle}>
                                {plan.speciality_name}
                              </Text>
                              <Text style={styles.planCardDescription}>
                                {plan.description?.trim()
                                  ? plan.description
                                  : "Información editorial pendiente de publicación."}
                              </Text>
                            </View>

                            <View style={styles.planCardFooter}>
                              <Text style={styles.planCardAction}>Ver detalle</Text>
                              <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={PRIMARY}
                              />
                            </View>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </>
                ) : (
                  <Text style={styles.infoCardBody}>
                    El hospital no ha publicado planes formativos por especialidad.
                  </Text>
                )}
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_LIGHT },
  scrollContent: { padding: 16, paddingTop: 14, paddingBottom: 32 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 6,
    gap: 12,
  },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  sectionBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: PRIMARY },
  sectionLabel: { fontSize: 17, fontWeight: "700", color: ACCENT },
  sectionCount: { fontSize: 10, fontWeight: "700", color: PRIMARY, letterSpacing: 0.8 },
  infoSectionStack: { gap: 14, marginBottom: 8 },
  infoCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoCardTitle: { fontSize: 18, fontWeight: "700", color: ACCENT, marginBottom: 10 },
  infoCardBody: { fontSize: 14, lineHeight: 21, color: TEXT_MEDIUM },
  infoCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  infoCardHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  infoCardCaption: { fontSize: 13, color: TEXT_MEDIUM, marginTop: 2 },
  infoCardCountBadge: {
    maxWidth: "40%",
    alignSelf: "flex-start",
    backgroundColor: `${PRIMARY}10`,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}18`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 1,
  },
  infoCardCount: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.7,
    textAlign: "center",
  },
  infoChipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  infoChip: {
    backgroundColor: SURFACE_ALT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: `${PRIMARY}14`,
  },
  infoChipText: { fontSize: 12, fontWeight: "600", color: ACCENT },
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
  galleryScrollContent: { gap: 12, paddingRight: 2 },
  galleryItem: {
    width: 240,
    height: 156,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: SURFACE_ALT,
  },
  galleryImage: { width: "100%", height: "100%" },
  planCardsList: { gap: 12 },
  planCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  planCardCopy: { gap: 8 },
  planCardTitle: { fontSize: 16, fontWeight: "700", color: ACCENT },
  planCardDescription: { fontSize: 13, lineHeight: 19, color: TEXT_MEDIUM },
  planCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  planCardAction: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  emptyInlineState: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: SURFACE_ALT,
  },
  emptyInlineStateText: { fontSize: 13, color: TEXT_MEDIUM, textAlign: "center" },
  loadingContainer: { alignItems: "center", paddingVertical: 36, gap: 12 },
  loadingText: { fontSize: 14, color: TEXT_MEDIUM, textAlign: "center" },
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: BG_LIGHT,
  },
  errorTitle: { fontSize: 17, fontWeight: "700", color: ACCENT, textAlign: "center" },
  planDetailStack: { gap: 14 },
  planDetailHero: {
    backgroundColor: WHITE,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    position: "relative",
  },
  planDetailHeroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: `${PRIMARY}08`,
    top: -70,
    right: -40,
  },
  planDetailHeroContent: { padding: 20 },
  planDetailIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: `${PRIMARY}10`,
    borderWidth: 1,
    borderColor: `${PRIMARY}16`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  planDetailHeader: { gap: 4, marginBottom: 14 },
  planDetailTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: ACCENT },
  planDetailSubtitle: { fontSize: 13, fontWeight: "600", color: TEXT_MEDIUM },
  planDetailHospital: { fontSize: 13, color: PRIMARY, fontWeight: "600" },
  planDetailDescription: { fontSize: 14, lineHeight: 22, color: TEXT_MEDIUM },
  planDetailChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  pdfCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 18 },
  pdfIconWrap: {
    width: 68,
    height: 82,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  pdfIconLabel: { marginTop: 4, fontSize: 10, fontWeight: "800", color: ERROR, letterSpacing: 0.8 },
  pdfCopy: { flex: 1, gap: 6, paddingTop: 2 },
  pdfTitle: { fontSize: 16, fontWeight: "700", color: ACCENT },
  pdfFilename: { fontSize: 12, color: TEXT_MEDIUM },
  pdfActions: { gap: 10 },
  primaryActionButton: {
    borderRadius: 18,
    backgroundColor: PRIMARY,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionButtonText: { fontSize: 15, fontWeight: "700", color: WHITE },
  secondaryActionButton: {
    borderRadius: 18,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: `${PRIMARY}22`,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionButtonText: { fontSize: 15, fontWeight: "700", color: PRIMARY },
  planBackButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  planBackButtonText: { fontSize: 13, fontWeight: "700", color: PRIMARY },
});
