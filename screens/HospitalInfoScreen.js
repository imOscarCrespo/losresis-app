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
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { getHospitalProfileContent } from "../services/hospitalService";
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
  plans: [],
});

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
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [planSpecialityFilter, setPlanSpecialityFilter] = useState("");
  const [downloadingPlanId, setDownloadingPlanId] = useState(null);

  useEffect(() => {
    posthogLogger.logScreen("HospitalInfoScreen", {
      hospitalId: hospital?.id,
    });
  }, [hospital?.id]);

  useEffect(() => {
    setExpandedPlanId(null);
    setPlanSpecialityFilter("");
  }, [hospital?.id]);

  useEffect(() => {
    if (!hospital?.id) return;
    fetchHospitalProfile();
  }, [hospital?.id]);

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

  const plans = hospitalProfile?.plans || [];

  const visiblePlans = useMemo(
    () =>
      planSpecialityFilter
        ? plans.filter((plan) => plan.speciality_id === planSpecialityFilter)
        : plans,
    [plans, planSpecialityFilter]
  );

  // Filtrar por una especialidad es pedir ver ESA especialidad: se abre sola
  // para que el usuario no tenga que dar un segundo toque.
  const handleSelectSpecialityFilter = (specialityId) => {
    setPlanSpecialityFilter(specialityId);
    setExpandedPlanId(specialityId || null);
  };

  const togglePlan = (specialityId) => {
    setExpandedPlanId((current) =>
      current === specialityId ? null : specialityId
    );
  };

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

  const renderPlanAccordionItem = (plan) => {
    const isExpanded = expandedPlanId === plan.speciality_id;
    const hasPdf = Boolean(plan.plan_formativo_url);
    const hasDifferentialPoints = (plan.differential_points || []).length > 0;
    const isDownloading = downloadingPlanId === plan.speciality_id;
    const fileName = getFilenameFromUrl(
      plan.plan_formativo_url,
      `${plan.speciality_name}.pdf`
    );

    return (
      <View key={plan.speciality_id} style={styles.planAccordion}>
        <TouchableOpacity
          style={styles.planAccordionHeader}
          activeOpacity={0.75}
          onPress={() => togglePlan(plan.speciality_id)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={plan.speciality_name}
        >
          <View style={styles.planAccordionHeaderCopy}>
            <Text style={styles.planAccordionTitle}>{plan.speciality_name}</Text>
            {hasPdf ? (
              <View style={styles.planAccordionPdfTag}>
                <Icon name="document-text-outline" size={12} color={ERROR} />
                <Text style={styles.planAccordionPdfTagText}>PDF</Text>
              </View>
            ) : null}
          </View>

          <Icon
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={PRIMARY}
          />
        </TouchableOpacity>

        {isExpanded ? (
          <View style={styles.planAccordionBody}>
            <Text style={styles.planAccordionDescription}>
              {plan.description?.trim()
                ? plan.description
                : "El hospital todavía no ha publicado una descripción editorial para esta especialidad."}
            </Text>

            {hasDifferentialPoints ? (
              <View style={styles.planAccordionChips}>
                {plan.differential_points.map((point) => (
                  <InfoChip key={point} text={point} />
                ))}
              </View>
            ) : null}

            {hasPdf ? (
              <View style={styles.planAccordionPdfCard}>
                <View style={styles.pdfCardHeader}>
                  <View style={styles.pdfIconWrap}>
                    <Icon name="document-text-outline" size={28} color={ERROR} />
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
                    onPress={() => handleOpenPlanPdf(plan)}
                  >
                    <Icon name="eye-outline" size={16} color={WHITE} />
                    <Text style={styles.primaryActionButtonText}>Ver documento</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    activeOpacity={0.85}
                    onPress={() => handleDownloadPlanPdf(plan)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color={PRIMARY} />
                    ) : (
                      <Icon name="download-outline" size={16} color={PRIMARY} />
                    )}
                    <Text style={styles.secondaryActionButtonText}>
                      {isDownloading ? "Preparando descarga..." : "Descargar PDF"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.planAccordionEmptyPdf}>
                El hospital no ha adjuntado un PDF para esta especialidad.
              </Text>
            )}
          </View>
        ) : null}
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
    <HeroScreenLayout title="Información del hospital" onBack={onBack}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.scrollContent}>
        {profileLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={PRIMARY} />
            <Text style={styles.loadingText}>Cargando información del hospital...</Text>
          </View>
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
                  {plans.length > 0 ? (
                    <View style={styles.infoCardCountBadge}>
                      <Text style={styles.infoCardCount}>
                        {plans.length} {plans.length === 1 ? "PLAN" : "PLANES"}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {plans.length > 0 ? (
                  <>
                    {plans.length > 1 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.planFilterRow}
                        nestedScrollEnabled
                      >
                        <TouchableOpacity
                          style={[
                            styles.planFilterChip,
                            !planSpecialityFilter && styles.planFilterChipActive,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => handleSelectSpecialityFilter("")}
                        >
                          <Text
                            style={[
                              styles.planFilterChipText,
                              !planSpecialityFilter && styles.planFilterChipTextActive,
                            ]}
                          >
                            Todas
                          </Text>
                        </TouchableOpacity>

                        {plans.map((plan) => {
                          const isActive =
                            planSpecialityFilter === plan.speciality_id;
                          return (
                            <TouchableOpacity
                              key={plan.speciality_id}
                              style={[
                                styles.planFilterChip,
                                isActive && styles.planFilterChipActive,
                              ]}
                              activeOpacity={0.8}
                              onPress={() =>
                                handleSelectSpecialityFilter(plan.speciality_id)
                              }
                            >
                              <Text
                                style={[
                                  styles.planFilterChipText,
                                  isActive && styles.planFilterChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {plan.speciality_name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    ) : null}

                    <View style={styles.planAccordionList}>
                      {visiblePlans.map(renderPlanAccordionItem)}
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
    </HeroScreenLayout>
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
  galleryScrollContent: { gap: 12, paddingRight: 2 },
  galleryItem: {
    width: 240,
    height: 156,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: SURFACE_ALT,
  },
  galleryImage: { width: "100%", height: "100%" },
  planFilterRow: { flexDirection: "row", gap: 8, paddingBottom: 14, paddingRight: 4 },
  planFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_ALT,
    maxWidth: 220,
  },
  planFilterChipActive: {
    backgroundColor: `${PRIMARY}12`,
    borderColor: `${PRIMARY}44`,
  },
  planFilterChipText: { fontSize: 13, fontWeight: "600", color: TEXT_MEDIUM },
  planFilterChipTextActive: { color: PRIMARY, fontWeight: "700" },
  planAccordionList: { gap: 12 },
  planAccordion: {
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  planAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
  },
  planAccordionHeaderCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  planAccordionTitle: { fontSize: 16, fontWeight: "700", color: ACCENT, flexShrink: 1 },
  planAccordionPdfTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: `${ERROR}12`,
  },
  planAccordionPdfTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: ERROR,
    letterSpacing: 0.6,
  },
  planAccordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 14,
    gap: 14,
  },
  planAccordionDescription: { fontSize: 14, lineHeight: 22, color: TEXT_MEDIUM },
  planAccordionChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  planAccordionPdfCard: {
    backgroundColor: SURFACE_ALT,
    borderRadius: 14,
    padding: 14,
  },
  planAccordionEmptyPdf: { fontSize: 13, lineHeight: 20, color: TEXT_LIGHT },
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
});
