import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Icon } from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { ConfirmationModal } from "../components/ConfirmationModal";
import {
  deleteCourse,
  getCourseById,
  toggleCourseLike,
} from "../services/lectureService";
import { getCurrentUser } from "../services/authService";
import {
  cancelCourseEnrollment,
  checkInCourse,
  enrollInCourse,
  getCourseEnrollmentSummary,
} from "../services/courseEnrollmentService";
import {
  getCourseDocumentUrl,
  getCourseDocuments,
} from "../services/courseDocumentService";
import { formatDateOnly, formatShortDate } from "../utils/dateUtils";
import { openURL } from "../utils/courseUtils";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const CARD_BORDER = "#F1F5F9";
const MUTED = "#64748B";
const MUTED_LIGHT = "#94A3B8";
const DANGER = "#EF4444";

function InfoPill({ icon, text, accent = "purple" }) {
  return (
    <View
      style={[
        styles.infoPill,
        accent === "purple" && styles.infoPillPurple,
        accent === "green" && styles.infoPillGreen,
        accent === "blue" && styles.infoPillBlue,
      ]}
    >
      <Icon
        name={icon}
        size={16}
        color={
          accent === "purple"
            ? PRIMARY
            : accent === "green"
              ? SECONDARY
              : "#2563EB"
        }
      />
      <Text
        style={[
          styles.infoPillText,
          accent === "purple" && styles.infoPillTextPurple,
          accent === "green" && styles.infoPillTextGreen,
          accent === "blue" && styles.infoPillTextBlue,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Icon name={icon} size={15} color={PRIMARY} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// Estado de un día del curso para quien está inscrito.
const sessionStatus = (date, today, attendedSet) => {
  if (attendedSet.has(date)) return "attended";
  if (date >= today) return "pending";
  return "missed";
};

const SESSION_STATUS_LABEL = {
  attended: "Asistencia registrada",
  pending: "Pendiente",
  missed: "No asistió",
};

export default function CourseDetailScreen({
  courseId,
  onBack,
  onEdit,
  onDelete,
  // Código de fichaje que llega por deep link (losresis://course-checkin).
  checkinCode = null,
  onCheckinCodeConsumed,
}) {
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [enrollmentBusy, setEnrollmentBusy] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [checkinVisible, setCheckinVisible] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState(null);
  const [enrollmentMessage, setEnrollmentMessage] = useState(null);
  // PDFs del organizador. Si no se pueden cargar (sin conexión) se queda vacío:
  // nunca se enseña un PDF como disponible sin haberlo leído.
  const [documents, setDocuments] = useState([]);
  const [openingDocumentId, setOpeningDocumentId] = useState(null);
  const consumedCheckinCodeRef = useRef(null);

  const isInApp = course?.enrollment_mode === "in_app";

  useEffect(() => {
    posthogLogger.logScreen("CourseDetailScreen", { courseId });
  }, [courseId]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { success, user } = await getCurrentUser();
        if (success && user) {
          setCurrentUserId(user.id);
        }
      } catch (err) {
        console.error("Error loading current user:", err);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadCourse = async () => {
      if (!courseId) {
        setError("ID de curso requerido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const fetchedCourse = await getCourseById(courseId, currentUserId);
        setCourse(fetchedCourse);
      } catch (err) {
        console.error("Error fetching course:", err);
        setError("No se pudo cargar el curso");
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [courseId, currentUserId]);

  useEffect(() => {
    let cancelled = false;
    setDocuments([]);
    getCourseDocuments(courseId).then((result) => {
      if (!cancelled) setDocuments(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // La URL se firma en el momento: caduca enseguida y apunta siempre al PDF vigente.
  const handleOpenDocument = useCallback(
    async (document) => {
      setOpeningDocumentId(document.id);
      const url = await getCourseDocumentUrl(document.storage_path);
      setOpeningDocumentId(null);
      if (!url) {
        Alert.alert(
          "No se ha podido abrir el PDF",
          "Comprueba tu conexión e inténtalo de nuevo."
        );
        return;
      }
      posthogLogger.capture("course_document_opened", {
        course_id: courseId,
        kind: document.kind,
      });
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch (err) {
        console.error("Error opening course document:", err);
        Alert.alert("No se ha podido abrir el PDF", "Inténtalo de nuevo.");
      }
    },
    [courseId]
  );

  const loadSummary = useCallback(async () => {
    if (!courseId) return null;
    const result = await getCourseEnrollmentSummary(courseId);
    if (result.success) {
      setSummary(result.data);
      setSummaryFailed(false);
      return result.data;
    }
    setSummaryFailed(true);
    return null;
  }, [courseId]);

  useEffect(() => {
    if (isInApp && currentUserId) {
      loadSummary();
    } else {
      setSummary(null);
    }
  }, [isInApp, currentUserId, loadSummary]);

  const runCheckIn = useCallback(
    async (code, method) => {
      setCheckingIn(true);
      setCheckinError(null);
      const result = await checkInCourse(courseId, code);
      setCheckingIn(false);

      if (!result.success) {
        return { ok: false, error: result.error };
      }

      if (result.data?.status === "checked_in") {
        posthogLogger.capture("course_checked_in", {
          course_id: courseId,
          method,
        });
      }
      setEnrollmentMessage({
        kind: "success",
        text:
          result.data?.status === "already_checked_in"
            ? "Ya tenías la asistencia de hoy registrada."
            : "Asistencia registrada. ¡Buen curso!",
      });
      await loadSummary();
      return { ok: true, error: null };
    },
    [courseId, loadSummary]
  );

  // Deep link: se ficha en cuanto el curso está cargado. El código caduca en
  // menos de un minuto, así que se consume una sola vez y no se persiste.
  useEffect(() => {
    if (!checkinCode) {
      // Consumido (o sin enlace): un nuevo escaneo del mismo QR vuelve a fichar.
      consumedCheckinCodeRef.current = null;
      return;
    }
    if (!course || !currentUserId) return;
    if (consumedCheckinCodeRef.current === checkinCode) return;
    consumedCheckinCodeRef.current = checkinCode;
    onCheckinCodeConsumed?.();

    (async () => {
      const { ok, error: checkinFailure } = await runCheckIn(checkinCode, "deep_link");
      if (!ok) {
        // Sin modal abierto: el error se enseña junto al botón del curso.
        setEnrollmentMessage({ kind: "error", text: checkinFailure });
      }
    })();
  }, [checkinCode, course, currentUserId, onCheckinCodeConsumed, runCheckIn]);

  const handleEnroll = useCallback(async () => {
    if (!currentUserId) {
      Alert.alert("Inicia sesión", "Necesitas haber iniciado sesión para inscribirte.");
      return;
    }
    setEnrollmentBusy(true);
    setEnrollmentMessage(null);
    const result = await enrollInCourse(courseId);
    setEnrollmentBusy(false);
    if (!result.success) {
      setEnrollmentMessage({ kind: "error", text: result.error });
      await loadSummary();
      return;
    }
    if (result.data?.status === "enrolled") {
      posthogLogger.capture("course_enrolled", { course_id: courseId });
    }
    setEnrollmentMessage({
      kind: "success",
      text: "Inscripción hecha. Hemos añadido los días del curso a tu agenda.",
    });
    await loadSummary();
  }, [courseId, currentUserId, loadSummary]);

  const handleConfirmCancel = useCallback(async () => {
    setCancelVisible(false);
    setEnrollmentBusy(true);
    setEnrollmentMessage(null);
    const result = await cancelCourseEnrollment(courseId);
    setEnrollmentBusy(false);
    if (!result.success) {
      setEnrollmentMessage({ kind: "error", text: result.error });
      await loadSummary();
      return;
    }
    posthogLogger.capture("course_enrollment_cancelled", { course_id: courseId });
    setEnrollmentMessage({ kind: "success", text: "Has cancelado tu inscripción." });
    await loadSummary();
  }, [courseId, loadSummary]);

  const openCheckinModal = useCallback(() => {
    setCodeInput("");
    setCheckinError(null);
    setCheckinVisible(true);
  }, []);

  const handleSubmitCode = useCallback(async () => {
    if (codeInput.length !== 6 || checkingIn) return;
    const { ok, error: checkinFailure } = await runCheckIn(codeInput, "code");
    if (ok) {
      setCheckinVisible(false);
    } else {
      setCheckinError(checkinFailure);
    }
  }, [codeInput, checkingIn, runCheckIn]);

  const attendedSet = useMemo(
    () => new Set(summary?.attended_dates ?? []),
    [summary?.attended_dates]
  );
  const attendedToday = Boolean(summary?.today && attendedSet.has(summary.today));
  const seatsLeft =
    summary?.seats_available != null
      ? Math.max(0, summary.seats_available - (summary.enrolled_count ?? 0))
      : null;

  const sortedDates = useMemo(
    () => (Array.isArray(course?.event_dates) ? [...course.event_dates].sort() : []),
    [course?.event_dates]
  );

  const dateLabel = useMemo(() => {
    if (sortedDates.length === 0) return "Sin fecha";
    if (sortedDates.length === 1) return formatDateOnly(sortedDates[0]);
    return `${formatDateOnly(sortedDates[0])} - ${formatDateOnly(
      sortedDates[sortedDates.length - 1]
    )}`;
  }, [sortedDates]);

  const quickStats = useMemo(
    () =>
      [
        { key: "date", icon: "calendar-outline", label: dateLabel, accent: "purple" },
        course?.teaching_hours
          ? {
              key: "hours",
              icon: "time-outline",
              label: course.teaching_hours,
              accent: "blue",
            }
          : null,
        course?.price_text
          ? {
              key: "price",
              icon: "cash-outline",
              label: course.price_text,
              accent: "green",
            }
          : null,
        course?.seats_available != null && course?.seats_available !== ""
          ? {
              key: "seats",
              icon: "people-outline",
              label: `${course.seats_available} plazas`,
              accent: "purple",
            }
          : null,
      ].filter(Boolean),
    [course?.price_text, course?.seats_available, course?.teaching_hours, dateLabel]
  );

  const canEditCourse = Boolean(
    currentUserId && course?.created_by_id && currentUserId === course.created_by_id
  );

  const handleRegister = useCallback(() => {
    if (course?.registration_url) {
      openURL(course.registration_url);
    }
  }, [course?.registration_url]);

  const handleDelete = useCallback(() => {
    if (!course?.id) return;

    Alert.alert(
      "Eliminar curso",
      "Esta acción eliminará el curso y no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCourse(course.id);
              onDelete?.(course.id);
            } catch (err) {
              console.error("Error deleting course:", err);
              Alert.alert("Error", "No se pudo eliminar el curso.");
            }
          },
        },
      ]
    );
  }, [course?.id, onDelete]);

  const handleToggleFavorite = useCallback(async () => {
    if (!course?.id || favoriteLoading) {
      return;
    }

    if (!currentUserId) {
      Alert.alert(
        "Inicia sesión",
        "Necesitas haber iniciado sesión para guardar cursos."
      );
      return;
    }

    try {
      setFavoriteLoading(true);
      const liked = await toggleCourseLike(currentUserId, course.id);
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              is_liked: liked,
            }
          : prev
      );
    } catch (err) {
      console.error("Error toggling course like:", err);
      Alert.alert("Error", "No se pudo guardar el curso.");
    } finally {
      setFavoriteLoading(false);
    }
  }, [course?.id, currentUserId, favoriteLoading]);

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.stateText}>Cargando curso...</Text>
      </View>
    );
  }

  if (error || !course) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.stateIconWrap}>
          <Icon name="alert-circle-outline" size={32} color={DANGER} />
        </View>
        <Text style={styles.stateTitle}>{error || "Curso no encontrado"}</Text>
        <Text style={styles.stateText}>
          Revisa el identificador o vuelve al listado para seguir explorando.
        </Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Volver a cursos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <HeroScreenLayout
      title="Cursos"
      onBack={onBack}
      overlay={
        <>
          <ConfirmationModal
            visible={cancelVisible}
            title="Cancelar inscripción"
            message="Dejarás tu plaza libre y quitaremos los días del curso de tu agenda."
            confirmText="Cancelar inscripción"
            cancelText="Volver"
            onCancel={() => setCancelVisible(false)}
            onConfirm={handleConfirmCancel}
          />
          <Modal
            visible={checkinVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setCheckinVisible(false)}
          >
            <KeyboardAvoidingView
              style={styles.modalOverlay}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Fichar asistencia</Text>
                <Text style={styles.modalText}>
                  Introduce el código de 6 dígitos que aparece en la pantalla de
                  la sala.
                </Text>
                <TextInput
                  value={codeInput}
                  onChangeText={(value) => {
                    setCodeInput(value.replace(/\D/g, "").slice(0, 6));
                    setCheckinError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  placeholderTextColor={MUTED_LIGHT}
                  style={styles.codeInput}
                  onSubmitEditing={handleSubmitCode}
                  textContentType="oneTimeCode"
                />
                {checkinError ? (
                  <Text style={styles.codeError}>{checkinError}</Text>
                ) : null}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => setCheckinVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalCancelText}>Cerrar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalConfirm,
                      (codeInput.length !== 6 || checkingIn) &&
                        styles.primaryButtonDisabled,
                    ]}
                    onPress={handleSubmitCode}
                    disabled={codeInput.length !== 6 || checkingIn}
                    activeOpacity={0.88}
                  >
                    {checkingIn ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Fichar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </>
      }
      rightSlot={
        canEditCourse ? (
          <View style={styles.headerActions}>
            {onEdit ? (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => onEdit(course.id)}
                activeOpacity={0.7}
              >
                <Icon name="pencil-outline" size={18} color="#670CF5" />
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                style={[styles.headerIconButton, styles.headerDangerButton]}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Icon name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null
      }
    >
        <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 32, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Icon name="school-outline" size={16} color={PRIMARY} />
              <Text style={styles.heroBadgeText}>Curso</Text>
            </View>
            {course.is_liked ? (
              <View style={styles.savedBadge}>
                <Icon name="heart" size={14} color={SECONDARY} />
                <Text style={styles.savedBadgeText}>Guardado</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.heroTitle}>{course.title}</Text>

          {course.organization ? (
            <Text style={styles.heroSubtitle}>{course.organization}</Text>
          ) : null}

          <View style={styles.quickStats}>
            {quickStats.map((item) => (
              <InfoPill
                key={item.key}
                icon={item.icon}
                text={item.label}
                accent={item.accent}
              />
            ))}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.favoriteButton,
                course.is_liked && styles.favoriteButtonActive,
                favoriteLoading && styles.favoriteButtonDisabled,
              ]}
              onPress={handleToggleFavorite}
              activeOpacity={0.88}
              disabled={favoriteLoading}
            >
              <Icon
                name={course.is_liked ? "heart" : "heart-outline"}
                size={18}
                color={course.is_liked ? "#FFFFFF" : PRIMARY}
              />
              <Text
                style={[
                  styles.favoriteButtonText,
                  course.is_liked && styles.favoriteButtonTextActive,
                ]}
              >
                {course.is_liked ? "En mis cursos" : "Guardar"}
              </Text>
            </TouchableOpacity>

            {isInApp ? (
              !summary && summaryFailed ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={loadSummary}
                  activeOpacity={0.88}
                >
                  <Icon name="refresh" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>
                    No se pudo cargar la inscripción. Reintentar
                  </Text>
                </TouchableOpacity>
              ) : !summary ? (
                <View style={[styles.primaryButton, styles.primaryButtonDisabled]}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : summary.is_enrolled ? (
                <View style={[styles.primaryButton, styles.primaryButtonEnrolled]}>
                  <Icon name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Inscrito</Text>
                </View>
              ) : summary.is_full || summary.is_finished ? (
                <View style={[styles.primaryButton, styles.primaryButtonDisabled]}>
                  <Text style={styles.primaryButtonText}>
                    {summary.is_finished ? "Curso finalizado" : "Completo"}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    enrollmentBusy && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleEnroll}
                  activeOpacity={0.88}
                  disabled={enrollmentBusy}
                >
                  {enrollmentBusy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Inscribirme</Text>
                      <Icon name="arrow-forward" size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              )
            ) : course.registration_url ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRegister}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonText}>Inscribirme</Text>
                <Icon name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>

          {isInApp && summary ? (
            <View style={styles.enrollmentMeta}>
              {seatsLeft != null && !summary.is_enrolled && !summary.is_finished ? (
                <Text style={styles.enrollmentMetaText}>
                  {seatsLeft === 1 ? "Queda 1 plaza" : `Quedan ${seatsLeft} plazas`}
                </Text>
              ) : null}
              {summary.can_cancel ? (
                <TouchableOpacity
                  onPress={() => setCancelVisible(true)}
                  disabled={enrollmentBusy}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelLink}>Cancelar inscripción</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {enrollmentMessage ? (
            <View
              style={[
                styles.messageBox,
                enrollmentMessage.kind === "error"
                  ? styles.messageBoxError
                  : styles.messageBoxSuccess,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  enrollmentMessage.kind === "error"
                    ? styles.messageTextError
                    : styles.messageTextSuccess,
                ]}
              >
                {enrollmentMessage.text}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          {isInApp && summary?.is_enrolled && summary.is_session_today ? (
            <SectionCard title="Asistencia de hoy">
              {attendedToday ? (
                <View style={styles.attendedRow}>
                  <Icon name="checkmark-circle" size={22} color={SECONDARY} />
                  <Text style={styles.attendedText}>Asistencia registrada</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.cardBody}>
                    {summary.checkin_open_now
                      ? "Escanea el QR de la sala o introduce el código que aparece en la pantalla."
                      : "Cuando la organización abra el fichaje, escanea el QR de la sala o introduce el código."}
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.checkinButton]}
                    onPress={openCheckinModal}
                    activeOpacity={0.88}
                  >
                    <Icon name="qr-code-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Fichar</Text>
                  </TouchableOpacity>
                </>
              )}
            </SectionCard>
          ) : null}

          {isInApp && summary?.is_enrolled && summary.session_dates?.length ? (
            <SectionCard title="Tus días del curso">
              {summary.session_dates.map((date) => {
                const status = sessionStatus(date, summary.today, attendedSet);
                return (
                  <View key={date} style={styles.sessionRow}>
                    <Text style={styles.timelineText}>{formatShortDate(date)}</Text>
                    <View
                      style={[
                        styles.sessionBadge,
                        status === "attended" && styles.sessionBadgeAttended,
                        status === "missed" && styles.sessionBadgeMissed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sessionBadgeText,
                          status === "attended" && styles.sessionBadgeTextAttended,
                          status === "missed" && styles.sessionBadgeTextMissed,
                        ]}
                      >
                        {SESSION_STATUS_LABEL[status]}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </SectionCard>
          ) : null}

          {(course.hospital?.name || course.venue_name || course.venue_address) && (
            <SectionCard title="Dónde se imparte">
              {course.hospital?.name ? (
                <InfoRow
                  icon="business-outline"
                  label="Hospital"
                  value={`${course.hospital.name}${
                    course.hospital.city ? ` · ${course.hospital.city}` : ""
                  }`}
                />
              ) : null}
              {course.venue_name ? (
                <InfoRow icon="location-outline" label="Sede" value={course.venue_name} />
              ) : null}
              {course.venue_address ? (
                <InfoRow
                  icon="navigate-outline"
                  label="Dirección"
                  value={course.venue_address}
                />
              ) : null}
            </SectionCard>
          )}

          {sortedDates.length > 1 ? (
            <SectionCard title="Calendario">
              {sortedDates.map((date) => (
                <View key={date} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <Text style={styles.timelineText}>{formatShortDate(date)}</Text>
                </View>
              ))}
            </SectionCard>
          ) : null}

          {course.speciality || course.course_code || course.course_directors ? (
            <SectionCard title="Ficha del curso">
              {course.speciality ? (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Especialidad</Text>
                  <Text style={styles.dataValue}>{course.speciality.name}</Text>
                </View>
              ) : null}
              {course.course_code ? (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Código</Text>
                  <Text style={styles.dataValue}>{course.course_code}</Text>
                </View>
              ) : null}
              {course.course_directors ? (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Dirección</Text>
                  <Text style={styles.dataValue}>{course.course_directors}</Text>
                </View>
              ) : null}
            </SectionCard>
          ) : null}

          {documents.length > 0 ? (
            <SectionCard title="Documentos">
              {documents.map((document, index) => (
                <TouchableOpacity
                  key={document.id}
                  testID={`course-document-${document.kind}`}
                  style={[
                    styles.documentRow,
                    index < documents.length - 1 && styles.documentRowDivider,
                  ]}
                  onPress={() => handleOpenDocument(document)}
                  disabled={openingDocumentId !== null}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${document.label}`}
                >
                  <View style={styles.infoIconWrap}>
                    <Icon name="document-text-outline" size={15} color={PRIMARY} />
                  </View>
                  <View style={styles.infoCopy}>
                    <Text style={styles.infoLabel}>{document.label}</Text>
                    <Text style={styles.documentName} numberOfLines={1}>
                      {document.file_name}
                    </Text>
                  </View>
                  {openingDocumentId === document.id ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : (
                    <Icon name="chevron-forward" size={18} color={MUTED_LIGHT} />
                  )}
                </TouchableOpacity>
              ))}
            </SectionCard>
          ) : null}

          {!isInApp && course.registration_url ? (
            <SectionCard title="Inscripción">
              <Text style={styles.cardBody}>
                Accede al enlace oficial para revisar plazas, requisitos y el
                formulario de inscripción.
              </Text>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={handleRegister}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryActionText}>Abrir enlace</Text>
                <Icon name="open-outline" size={16} color={PRIMARY} />
              </TouchableOpacity>
            </SectionCard>
          ) : null}

          {course.objectives ? (
            <SectionCard title="Objetivos">
              <Text style={styles.cardBody}>{course.objectives}</Text>
            </SectionCard>
          ) : null}

          {course.more_info ? (
            <SectionCard title="Más información">
              <Text style={styles.cardBody}>{course.more_info}</Text>
            </SectionCard>
          ) : null}
        </View>
        </ScrollView>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(103,12,245,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerDangerButton: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: BG_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  stateText: {
    marginTop: 10,
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
  },
  secondaryButton: {
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}24`,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginTop: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${PRIMARY}12`,
  },
  heroBadgeText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${SECONDARY}14`,
  },
  savedBadgeText: {
    color: SECONDARY,
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 31,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: MUTED,
    lineHeight: 22,
  },
  quickStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
    alignItems: "flex-start",
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "100%",
    flexShrink: 1,
  },
  infoPillPurple: {
    backgroundColor: `${PRIMARY}10`,
  },
  infoPillGreen: {
    backgroundColor: `${SECONDARY}12`,
  },
  infoPillBlue: {
    backgroundColor: "#DBEAFE",
  },
  infoPillText: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    lineHeight: 18,
  },
  infoPillTextPurple: {
    color: PRIMARY,
  },
  infoPillTextGreen: {
    color: SECONDARY,
  },
  infoPillTextBlue: {
    color: "#2563EB",
  },
  actionsRow: {
    marginTop: 18,
    gap: 12,
  },
  favoriteButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${PRIMARY}24`,
    backgroundColor: `${PRIMARY}08`,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  favoriteButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  favoriteButtonDisabled: {
    opacity: 0.7,
  },
  favoriteButtonText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  favoriteButtonTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonEnrolled: {
    backgroundColor: SECONDARY,
  },
  enrollmentMeta: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  enrollmentMetaText: {
    fontSize: 13,
    fontWeight: "600",
    color: MUTED,
  },
  cancelLink: {
    fontSize: 13,
    fontWeight: "700",
    color: DANGER,
  },
  messageBox: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBoxSuccess: {
    backgroundColor: `${SECONDARY}14`,
  },
  messageBoxError: {
    backgroundColor: "#FEF2F2",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  messageTextSuccess: {
    color: SECONDARY,
  },
  messageTextError: {
    color: DANGER,
  },
  checkinButton: {
    marginTop: 14,
  },
  attendedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  attendedText: {
    fontSize: 15,
    fontWeight: "700",
    color: SECONDARY,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: 12,
  },
  sessionBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: BG_LIGHT,
  },
  sessionBadgeAttended: {
    backgroundColor: `${SECONDARY}14`,
  },
  sessionBadgeMissed: {
    backgroundColor: "#FEF2F2",
  },
  sessionBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
  },
  sessionBadgeTextAttended: {
    color: SECONDARY,
  },
  sessionBadgeTextMissed: {
    color: DANGER,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
  },
  modalText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
  },
  codeInput: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: `${PRIMARY}30`,
    borderRadius: 16,
    paddingVertical: 14,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 10,
    textAlign: "center",
    color: ACCENT,
  },
  codeError: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: DANGER,
    textAlign: "center",
  },
  modalActions: {
    marginTop: 20,
    flexDirection: "row",
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: BG_LIGHT,
  },
  modalCancelText: {
    color: MUTED,
    fontSize: 15,
    fontWeight: "700",
  },
  modalConfirm: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
  },
  content: {
    paddingTop: 18,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: {
    flex: 1,
    gap: 3,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED_LIGHT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    lineHeight: 22,
    color: ACCENT,
    fontWeight: "600",
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  documentRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  documentName: {
    fontSize: 15,
    color: ACCENT,
    fontWeight: "600",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
  timelineText: {
    fontSize: 15,
    color: ACCENT,
    fontWeight: "600",
  },
  cardBody: {
    fontSize: 15,
    color: MUTED,
    lineHeight: 23,
  },
  dataRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED_LIGHT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
    lineHeight: 22,
  },
  secondaryAction: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: `${PRIMARY}10`,
    borderWidth: 1,
    borderColor: `${PRIMARY}18`,
  },
  secondaryActionText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
});
