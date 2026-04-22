import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StarRating } from "../components/StarRating";
import { ScreenHeader } from "../components/ScreenHeader";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useMyReview } from "../hooks/useMyReview";
import { useHospitals } from "../hooks/useHospitals";
import { formatShortDate } from "../utils/dateUtils";
import posthogLogger from "../services/posthogService";
import { COLORS } from "../constants/colors";
import {
  canWriteResidentHospitalReview,
  formatResidentTransitionDeadline,
  isResidentLockedMissingCorporateEmail,
} from "../utils/residentAccess";
import { StudentQuestionsSection } from "../components/StudentQuestionsSection";

// ============================================================================
// COLORS
// ============================================================================

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = COLORS.BACKGROUND;
const WHITE = "#FFFFFF";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#F1F5F9";
const ERROR = "#EF4444";
const WARNING = "#FBBF24";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MyReviewScreen({
  userProfile,
  navigation,
  onReviewCreated,
  onReviewDeleted,
  autoOpenCreateReview = false,
  onAutoOpenCreateReviewHandled,
  onCreateReview,
  onEditReview,
  onBack,
  autoFocusQuestions = false,
  highlightedQuestionId = null,
  onAutoFocusQuestionsHandled,
  onHighlightedQuestionHandled,
}) {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const scrollViewRef = useRef(null);

  const { hospitals, specialties } = useHospitals();
  const hospital = hospitals.find((h) => h.id === userProfile?.hospital_id);
  const specialty = specialties.find((s) => s.id === userProfile?.speciality_id);

  const {
    existingReview,
    loading,
    loadingQuestions,
    error,
    success,
    handleDeleteReview,
    clearError,
    clearSuccess,
  } = useMyReview(
    userProfile?.id,
    userProfile?.hospital_id,
    userProfile?.speciality_id
  );

  const isResident = userProfile?.is_resident;
  const reviewWritingDisabled = !canWriteResidentHospitalReview(userProfile);
  const headerStatusChip = existingReview ? (
    <View
      style={[
        styles.statusChip,
        existingReview.is_approved ? styles.statusChipGreen : styles.statusChipOrange,
      ]}
    >
      <Ionicons
        name={existingReview.is_approved ? "checkmark-circle" : "time-outline"}
        size={13}
        color={existingReview.is_approved ? SECONDARY : "#D97706"}
      />
      <Text
        style={[
          styles.statusChipText,
          existingReview.is_approved
            ? styles.statusChipTextGreen
            : styles.statusChipTextOrange,
        ]}
      >
        {existingReview.is_approved ? "Aprobada" : "Pendiente"}
      </Text>
    </View>
  ) : null;
  const header = (
    <ScreenHeader
      title="Mi Reseña"
      onBack={onBack}
      compact
      variant="brand"
      rightSlot={headerStatusChip}
    />
  );

  useEffect(() => {
    posthogLogger.logScreen("MyReviewScreen");
  }, []);

  const handleStartReview = useCallback(() => {
    onCreateReview?.();
  }, [onCreateReview]);

  const handleEditReview = useCallback(() => {
    onEditReview?.();
  }, [onEditReview]);

  useEffect(() => {
    if (
      autoOpenCreateReview &&
      !existingReview &&
      !loading &&
      !loadingQuestions
    ) {
      onAutoOpenCreateReviewHandled?.();
      handleStartReview();
    }
  }, [
    autoOpenCreateReview,
    existingReview,
    loading,
    loadingQuestions,
    onAutoOpenCreateReviewHandled,
    handleStartReview,
  ]);

  useEffect(() => {
    if (!autoFocusQuestions || !existingReview) return;

    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
      onAutoFocusQuestionsHandled?.();
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [autoFocusQuestions, existingReview, onAutoFocusQuestionsHandled]);

  const handleDelete = useCallback(async () => {
    if (!existingReview) return;
    const ok = await handleDeleteReview(existingReview.id);
    if (ok) {
      setShowDeleteConfirmation(false);
      if (onReviewDeleted) onReviewDeleted();
    }
  }, [existingReview, handleDeleteReview, onReviewDeleted]);

  // ── Not a resident ──
  if (!isResident) {
    return (
      <ScreenScaffold
        header={header}
        headerShellVariant="brand"
        contentSurfaceStyle={styles.contentSurface}
      >
        <View style={styles.scrollContent}>
          <View style={styles.messageCard}>
            <View style={styles.messageIconWrap}>
              <Ionicons name="alert-circle-outline" size={36} color={WARNING} />
            </View>
            <Text style={styles.messageTitle}>Solo para residentes</Text>
            <Text style={styles.messageText}>
              Esta funcionalidad está disponible únicamente para usuarios residentes.
            </Text>
          </View>
        </View>
      </ScreenScaffold>
    );
  }

  // ── Incomplete profile ──
  if (!hospital || !specialty) {
    return (
      <ScreenScaffold
        header={header}
        headerShellVariant="brand"
        contentSurfaceStyle={styles.contentSurface}
      >
        <View style={styles.scrollContent}>
          <View style={styles.messageCard}>
            <View style={styles.messageIconWrap}>
              <Ionicons name="alert-circle-outline" size={36} color={WARNING} />
            </View>
            <Text style={styles.messageTitle}>Perfil incompleto</Text>
            <Text style={styles.messageText}>
              Para crear una reseña necesitas tener asignado un hospital y una
              especialidad en tu perfil.
            </Text>
          </View>
        </View>
      </ScreenScaffold>
    );
  }

  if (reviewWritingDisabled) {
    const isLocked = isResidentLockedMissingCorporateEmail(userProfile);
    return (
      <ScreenScaffold
        header={header}
        headerShellVariant="brand"
        contentSurfaceStyle={styles.contentSurface}
      >
        <View style={styles.scrollContent}>
          <View style={styles.messageCard}>
            <View style={styles.messageIconWrap}>
              <Ionicons
                name={isLocked ? "mail-outline" : "time-outline"}
                size={36}
                color={WARNING}
              />
            </View>
            <Text style={styles.messageTitle}>
              {isLocked ? "Correo corporativo requerido" : "Reseña temporalmente bloqueada"}
            </Text>
            <Text style={styles.messageText}>
              {isLocked
                ? "La ventana MIR temporal ya ha terminado. Añade tu correo corporativo en tu perfil para continuar."
                : `Mientras estás en alta temporal MIR puedes usar el resto de funciones de residente, pero no publicar la reseña del hospital. Fecha límite actual: ${formatResidentTransitionDeadline(
                    userProfile?.resident_transition_expires_at
                  ) || "pendiente de configurar"}.`}
            </Text>
          </View>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      header={header}
      headerShellVariant="brand"
      contentSurfaceStyle={styles.contentSurface}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Alerts */}
        {success && (
          <View style={styles.alertSuccess}>
            <Ionicons name="checkmark-circle" size={18} color={SECONDARY} />
            <Text style={styles.alertText}>
              {existingReview
                ? "Reseña eliminada correctamente."
                : "Operación completada correctamente."}
            </Text>
            <TouchableOpacity onPress={clearSuccess}>
              <Ionicons name="close" size={18} color={SECONDARY} />
            </TouchableOpacity>
          </View>
        )}
        {error && (
          <View style={styles.alertError}>
            <Ionicons name="alert-circle" size={18} color={ERROR} />
            <Text style={[styles.alertText, { color: ERROR }]}>{error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Ionicons name="close" size={18} color={ERROR} />
            </TouchableOpacity>
          </View>
        )}

        {/* Hospital & Specialty cards */}
        <View style={styles.infoCardsRow}>
          <View style={[styles.infoCard, styles.infoCardPrimary]}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="business" size={20} color={PRIMARY} />
              <Text style={styles.infoCardLabel}>Tu Hospital</Text>
            </View>
            <Text style={styles.infoCardValue} numberOfLines={2}>
              {hospital.name}
            </Text>
            <Text style={styles.infoCardSub}>
              {hospital.city}, {hospital.region}
            </Text>
          </View>

          <View style={[styles.infoCard, styles.infoCardSecondary]}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="school" size={20} color={SECONDARY} />
              <Text style={[styles.infoCardLabel, { color: SECONDARY }]}>
                Tu Especialidad
              </Text>
            </View>
            <Text style={styles.infoCardValue} numberOfLines={2}>
              {specialty.name}
            </Text>
            <Text style={styles.infoCardSub}>
              R{userProfile.resident_year || "–"}
            </Text>
          </View>
        </View>

        {/* Review status card */}
        <View style={styles.card}>
          {loading ? (
            <View style={styles.loadingInCard}>
              <ActivityIndicator size="small" color={PRIMARY} />
              <Text style={styles.loadingText}>Cargando reseña...</Text>
            </View>
          ) : existingReview ? (
            // ── Existing review ──
            <View>
              <View style={styles.reviewHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Tu Reseña</Text>
                  <Text style={styles.reviewDate}>
                    Creada el {formatShortDate(existingReview.created_at)}
                  </Text>
                  {existingReview.is_anonymous && (
                    <View style={styles.anonBadge}>
                      <Ionicons name="eye-off-outline" size={12} color={PRIMARY} />
                      <Text style={styles.anonBadgeText}>Anónima</Text>
                    </View>
                  )}
                </View>
                <View style={styles.reviewActions}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={handleEditReview}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="pencil" size={15} color={WHITE} />
                    <Text style={styles.editBtnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => setShowDeleteConfirmation(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trash-outline" size={15} color={ERROR} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Answers */}
              {existingReview.review_answer && existingReview.review_answer.length > 0 && (
                <View style={styles.answersSection}>
                  <View style={styles.sectionLabelRow}>
                    <View style={styles.sectionBar} />
                    <Text style={styles.sectionLabelText}>Respuestas</Text>
                  </View>
                  {existingReview.review_answer.map((answer) => (
                    <View key={answer.question_id} style={styles.answerItem}>
                      <View style={styles.answerHeaderRow}>
                        <Text style={styles.answerQuestion} numberOfLines={3}>
                          {answer.question?.text}
                        </Text>
                        <View
                          style={[
                            styles.typeBadge,
                            answer.question?.type === "rating"
                              ? styles.typeBadgeRating
                              : styles.typeBadgeText,
                          ]}
                        >
                          <Text style={styles.typeBadgeLabel}>
                            {answer.question?.type === "rating" ? "Rating" : "Texto"}
                          </Text>
                        </View>
                      </View>
                      {answer.question?.type === "rating" && answer.rating_value && (
                        <View style={styles.answerRatingRow}>
                          <StarRating
                            rating={answer.rating_value}
                            size={16}
                            disabled
                          />
                          <Text style={styles.ratingValue}>
                            ({answer.rating_value}/5)
                          </Text>
                        </View>
                      )}
                      {answer.question?.type === "text" && answer.text_value && (
                        <View style={styles.answerTextBox}>
                          <Text style={styles.answerTextValue}>
                            {answer.text_value}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Free comment */}
              {existingReview.free_comment && (
                <View style={styles.freeCommentBlock}>
                  <View style={styles.sectionLabelRow}>
                    <View style={[styles.sectionBar, { backgroundColor: SECONDARY }]} />
                    <Text style={styles.sectionLabelText}>Comentario adicional</Text>
                  </View>
                  <View style={styles.commentBox}>
                    <Text style={styles.commentText}>
                      {existingReview.free_comment}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            // ── No review yet ──
            <View>
              <View style={styles.warningBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={ERROR} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Completa tu reseña</Text>
                  <Text style={styles.warningText}>
                    Para desbloquear todas las funcionalidades, añade tu reseña. ¡Ayudarás a otros estudiantes!
                  </Text>
                </View>
              </View>

              <View style={styles.createSection}>
                <View style={styles.createIconWrap}>
                  <Ionicons name="star" size={28} color={WHITE} />
                </View>
                <Text style={styles.createTitle}>¡Crea tu primera reseña!</Text>
                <Text style={styles.createSubtitle}>
                  Comparte tu experiencia en {hospital.name} · {specialty.name}
                </Text>
                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={handleStartReview}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={20} color={WHITE} />
                  <Text style={styles.createBtnText}>Añadir Reseña</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {existingReview && (
          <StudentQuestionsSection
            hospitalId={existingReview.hospital_id}
            specialityId={existingReview.speciality_id}
            userProfile={userProfile}
            highlightedQuestionId={highlightedQuestionId}
            onHighlightedQuestionHandled={onHighlightedQuestionHandled}
          />
        )}
      </ScrollView>

      {/* ── Delete confirmation modal ── */}
      <Modal
        visible={showDeleteConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteSheet}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash-outline" size={28} color={ERROR} />
            </View>
            <Text style={styles.deleteTitle}>Eliminar reseña</Text>
            <Text style={styles.deleteSubtitle}>
              ¿Estás seguro? Esta acción no se puede deshacer y perderás todas las respuestas.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setShowDeleteConfirmation(false)}
                disabled={loading}
              >
                <Text style={styles.deleteCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={WHITE} />
                ) : (
                  <Text style={styles.deleteConfirmText}>Eliminar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  contentSurface: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipGreen: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.24)",
  },
  statusChipOrange: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.28)",
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusChipTextGreen: {
    color: "#FFFFFF",
  },
  statusChipTextOrange: {
    color: "#FFFFFF",
  },

  // ── Alerts ──
  alertSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: `${SECONDARY}12`,
    borderWidth: 1,
    borderColor: `${SECONDARY}30`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  alertError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: `${ERROR}0D`,
    borderWidth: 1,
    borderColor: `${ERROR}30`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: SECONDARY,
    lineHeight: 18,
  },

  // ── Info cards ──
  infoCardsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  infoCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  infoCardPrimary: {
    backgroundColor: `${PRIMARY}08`,
    borderColor: `${PRIMARY}20`,
  },
  infoCardSecondary: {
    backgroundColor: `${SECONDARY}10`,
    borderColor: `${SECONDARY}25`,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  infoCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.3,
  },
  infoCardValue: {
    fontSize: 13,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 4,
    lineHeight: 18,
  },
  infoCardSub: {
    fontSize: 11,
    color: TEXT_MEDIUM,
  },

  // ── Card ──
  card: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: -0.1,
  },

  // ── Loading ──
  loadingInCard: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: TEXT_MEDIUM,
  },

  // ── Review header ──
  reviewHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  reviewDate: {
    fontSize: 12,
    color: TEXT_MEDIUM,
    marginTop: 4,
    marginBottom: 8,
  },
  anonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: `${PRIMARY}10`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
  },
  anonBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: WHITE,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${ERROR}0D`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${ERROR}25`,
  },

  // ── Answers display ──
  answersSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: PRIMARY,
  },
  sectionLabelText: {
    fontSize: 13,
    fontWeight: "700",
    color: ACCENT,
  },
  answerItem: {
    borderLeftWidth: 3,
    borderLeftColor: `${PRIMARY}40`,
    paddingLeft: 12,
    marginBottom: 14,
  },
  answerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  answerQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: ACCENT,
    lineHeight: 18,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  typeBadgeRating: {
    backgroundColor: "#FEF3C7",
  },
  typeBadgeText: {
    backgroundColor: `${PRIMARY}10`,
  },
  typeBadgeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: ACCENT,
  },
  answerRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingValue: {
    fontSize: 12,
    color: TEXT_MEDIUM,
    fontWeight: "600",
  },
  answerTextBox: {
    backgroundColor: BG_LIGHT,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  answerTextValue: {
    fontSize: 13,
    color: ACCENT,
    lineHeight: 19,
  },

  // ── Free comment display ──
  freeCommentBlock: {
    marginTop: 8,
  },
  commentBox: {
    backgroundColor: `${PRIMARY}08`,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${PRIMARY}18`,
  },
  commentText: {
    fontSize: 13,
    color: ACCENT,
    lineHeight: 19,
  },

  // ── No review (create prompt) ──
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: `${ERROR}0D`,
    borderWidth: 1,
    borderColor: `${ERROR}25`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: ERROR,
    marginBottom: 3,
  },
  warningText: {
    fontSize: 12,
    color: ERROR,
    lineHeight: 17,
    opacity: 0.85,
  },
  createSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  createIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
  },
  createSubtitle: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: WHITE,
  },

  // ── Message card ──
  messageCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 32,
    alignItems: "center",
    marginTop: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  messageIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
    textAlign: "center",
  },
  messageText: {
    fontSize: 14,
    color: TEXT_MEDIUM,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Form modal ──
  modalContainer: {
    flex: 1,
    backgroundColor: WHITE,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
    marginHorizontal: 12,
  },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    minWidth: 80,
    alignItems: "center",
  },
  modalSubmitBtnDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: "700",
    color: WHITE,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 32,
  },

  // ── Anonymous card (in form) ──
  anonCard: {
    backgroundColor: `${PRIMARY}08`,
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  anonCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  anonCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  anonCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 2,
  },
  anonCardSubtitle: {
    fontSize: 12,
    color: TEXT_MEDIUM,
    lineHeight: 17,
  },
  anonInfo: {
    marginTop: 12,
    padding: 10,
    backgroundColor: `${PRIMARY}10`,
    borderRadius: 8,
  },
  anonInfoText: {
    fontSize: 12,
    color: ACCENT,
    lineHeight: 17,
  },

  // ── Questions ──
  questionsSection: {
    marginBottom: 20,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    backgroundColor: WHITE,
  },
  questionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  questionText: {
    fontSize: 14,
    fontWeight: "600",
    color: ACCENT,
    lineHeight: 20,
    marginBottom: 3,
  },
  optionalText: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: "500",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: ACCENT,
    textAlignVertical: "top",
    backgroundColor: BG_LIGHT,
  },

  // ── Free comment form ──
  freeCommentFormBlock: {
    marginBottom: 8,
  },

  // ── Delete modal ──
  deleteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  deleteSheet: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  deleteIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${ERROR}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
    textAlign: "center",
  },
  deleteSubtitle: {
    fontSize: 14,
    color: TEXT_MEDIUM,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: "center",
  },
  deleteActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: BORDER,
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: ERROR,
    shadowColor: ERROR,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: WHITE,
  },
});
