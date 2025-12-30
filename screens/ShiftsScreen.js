import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS } from "../constants/colors";
import { useShifts } from "../hooks/useShifts";
import { useShiftSwapRequests } from "../hooks/useShiftSwapRequests";
import { useShiftPurchaseRequests } from "../hooks/useShiftPurchaseRequests";
import { useResidentReviewCheck } from "../hooks/useResidentReviewCheck";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { TeamCalendarView } from "./TeamCalendarView";
import posthogLogger from "../services/posthogService";

/**
 * Pantalla de Guardias
 * Permite gestionar las guardias médicas del usuario
 */
export const ShiftsScreen = ({
  userProfile,
  navigation,
  onNavigateToSection,
}) => {
  const userId = userProfile?.id;

  const {
    allShifts,
    loading,
    statistics,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    selectedType,
    setSelectedType,
    addShift,
    updateShift,
    deleteShift,
    upcomingShifts,
  } = useShifts(userId);

  // Verificar si el residente tiene reseña
  const { hasReview } = useResidentReviewCheck(userId, userProfile);

  // Obtener solicitudes pendientes
  const { swapRequests } = useShiftSwapRequests(userId);
  const { purchaseRequests } = useShiftPurchaseRequests(userId);

  const pendingIncomingRequestsCount = useMemo(() => {
    return swapRequests.length + purchaseRequests.length;
  }, [swapRequests, purchaseRequests]);

  // Estados
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTeamCalendar, setShowTeamCalendar] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Formulario de nueva guardia
  const [formData, setFormData] = useState({
    date: new Date(),
    notes: "",
    price_eur: null,
  });

  const [showPriceInput, setShowPriceInput] = useState(false);

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const guardTypeLabels = {
    regular: "Laborable",
    saturday: "Sábado",
    sunday: "Domingo",
  };

  const guardTypeColors = {
    regular: "#DBEAFE",
    saturday: "#FED7AA",
    sunday: "#FECACA",
  };

  const guardTypeTextColors = {
    regular: "#1E40AF",
    saturday: "#C2410C",
    sunday: "#991B1B",
  };

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("ShiftsScreen");
  }, []);

  // Handler para nueva guardia
  const handleNewShiftClick = useCallback(() => {
    if (
      userProfile?.is_resident &&
      !userProfile?.is_super_admin &&
      hasReview === false
    ) {
      setShowReviewRequest(true);
    } else {
      setShowAddModal(true);
    }
  }, [userProfile, hasReview]);

  // Formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const dayName = date.toLocaleDateString("es-ES", { weekday: "long" });
    return `${
      dayName.charAt(0).toUpperCase() + dayName.slice(1)
    }, ${date.getDate()} de ${monthNames[date.getMonth()]}`;
  };

  // Calcular días restantes
  const getDaysRemaining = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shiftDate = new Date(dateString);
    shiftDate.setHours(0, 0, 0, 0);
    const diffTime = shiftDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Obtener tipo de guardia desde fecha
  const getShiftType = (date) => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) return "sunday";
    if (dayOfWeek === 6) return "saturday";
    return "regular";
  };

  // Handler para añadir guardia
  const handleAddShift = async () => {
    const shiftData = {
      day: formData.date.getDate().toString(),
      month: formData.date.getMonth(),
      year: formData.date.getFullYear(),
      notes: formData.notes,
      price_eur: showPriceInput ? formData.price_eur : null,
    };

    const success = await addShift(shiftData);
    if (success) {
      setShowAddModal(false);
      setFormData({ date: new Date(), notes: "", price_eur: null });
      setShowPriceInput(false);
    }
  };

  // Handler para editar guardia
  const handleEditShift = async () => {
    const success = await updateShift(editingShift);
    if (success) {
      setShowEditModal(false);
      setEditingShift(null);
    }
  };

  // Handler para eliminar guardia
  const handleDeleteShift = async (shiftId) => {
    const success = await deleteShift(shiftId);
    if (success) {
      setConfirmDelete(null);
    }
  };

  // Renderizar vista de analíticas
  // Mostrar vista de guardias del equipo
  if (showTeamCalendar) {
    return (
      <TeamCalendarView
        userProfile={userProfile}
        userShifts={allShifts}
        onClose={() => setShowTeamCalendar(false)}
      />
    );
  }

  if (showAnalytics) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.analyticsHeader}>
            <View>
              <Text style={styles.title}>Analíticas de Guardias</Text>
              <Text style={styles.subtitle}>
                Estadísticas y análisis de tus guardias médicas
              </Text>
            </View>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowAnalytics(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          {/* Resumen General */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconContainer}>
                <Ionicons name="bar-chart" size={24} color="white" />
              </View>
              <View style={styles.summaryTextContainer}>
                <Text style={styles.summaryTitle}>Resumen General</Text>
                <Text style={styles.summarySubtitle}>
                  Total de guardias registradas en todos los períodos
                </Text>
              </View>
            </View>
            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalNumber}>{statistics.total}</Text>
              <Text style={styles.summaryTotalLabel}>Guardias totales</Text>
            </View>
            {statistics.total > 0 && (
              <View style={styles.summaryBreakdown}>
                <View style={styles.summaryBreakdownItem}>
                  <Text
                    style={[
                      styles.summaryBreakdownNumber,
                      { color: guardTypeTextColors.regular },
                    ]}
                  >
                    {statistics.regular}
                  </Text>
                  <Text style={styles.summaryBreakdownLabel}>Laborables</Text>
                </View>
                <View style={styles.summaryBreakdownItem}>
                  <Text
                    style={[
                      styles.summaryBreakdownNumber,
                      { color: guardTypeTextColors.saturday },
                    ]}
                  >
                    {statistics.saturday}
                  </Text>
                  <Text style={styles.summaryBreakdownLabel}>Sábados</Text>
                </View>
                <View style={styles.summaryBreakdownItem}>
                  <Text
                    style={[
                      styles.summaryBreakdownNumber,
                      { color: guardTypeTextColors.sunday },
                    ]}
                  >
                    {statistics.sunday}
                  </Text>
                  <Text style={styles.summaryBreakdownLabel}>Domingos</Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Renderizar vista principal
  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader
        title="Guardias"
        subtitle="Gestiona tus guardias médicas y analiza tus estadísticas"
        notificationCount={pendingIncomingRequestsCount}
        onNotificationPress={() => {
          // TODO: Implementar navegación a solicitudes
          Alert.alert("Información", "Vista de solicitudes en desarrollo");
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowAnalytics(true)}
          >
            <Ionicons name="bar-chart" size={20} color={COLORS.GRAY_DARK} />
            <Text style={styles.secondaryButtonText}>Analíticas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowTeamCalendar(true)}
          >
            <Ionicons name="people" size={20} color={COLORS.GRAY_DARK} />
            <Text style={styles.secondaryButtonText}>Guardias Equipo</Text>
          </TouchableOpacity>
        </View>

        {/* Próximas Guardias */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={24} color={COLORS.PRIMARY} />
            <Text style={styles.sectionTitle}>Próximas Guardias</Text>
            <Text style={styles.sectionSubtitle}>• Siguientes 30 días</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Cargando guardias...</Text>
            </View>
          ) : upcomingShifts.length > 0 ? (
            <View style={styles.shiftsGrid}>
              {upcomingShifts.map((shift) => {
                const daysRemaining = getDaysRemaining(shift.date);
                const shiftDate = new Date(shift.date);

                return (
                  <View key={shift.id} style={styles.shiftCard}>
                    <View style={styles.shiftCardHeader}>
                      <View style={styles.shiftDateBadge}>
                        <Text style={styles.shiftDateNumber}>
                          {shiftDate.getDate()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.shiftTypeBadge,
                          { backgroundColor: guardTypeColors[shift.type] },
                        ]}
                      >
                        <Text
                          style={[
                            styles.shiftTypeBadgeText,
                            { color: guardTypeTextColors[shift.type] },
                          ]}
                        >
                          {guardTypeLabels[shift.type]}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.shiftCardTitle}>
                      {shiftDate.getDate()} de{" "}
                      {monthNames[shiftDate.getMonth()]}
                    </Text>
                    <Text style={styles.shiftCardDay}>
                      {formatDate(shift.date)}
                    </Text>

                    {/* Días restantes */}
                    <View style={styles.daysRemainingContainer}>
                      {daysRemaining === 0 ? (
                        <View
                          style={[
                            styles.daysRemainingBadge,
                            styles.daysRemainingToday,
                          ]}
                        >
                          <View style={styles.daysRemainingDot} />
                          <Text style={styles.daysRemainingText}>Hoy</Text>
                        </View>
                      ) : daysRemaining === 1 ? (
                        <View
                          style={[
                            styles.daysRemainingBadge,
                            styles.daysRemainingTomorrow,
                          ]}
                        >
                          <View style={styles.daysRemainingDot} />
                          <Text style={styles.daysRemainingText}>Mañana</Text>
                        </View>
                      ) : daysRemaining < 0 ? (
                        <View
                          style={[
                            styles.daysRemainingBadge,
                            styles.daysRemainingPast,
                          ]}
                        >
                          <View style={styles.daysRemainingDot} />
                          <Text style={styles.daysRemainingText}>Pasada</Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.daysRemainingBadge,
                            styles.daysRemainingFuture,
                          ]}
                        >
                          <View style={styles.daysRemainingDot} />
                          <Text style={styles.daysRemainingText}>
                            En {daysRemaining} días
                          </Text>
                        </View>
                      )}
                    </View>

                    {shift.notes && (
                      <Text style={styles.shiftNotes} numberOfLines={2}>
                        {shift.notes}
                      </Text>
                    )}

                    {/* Actions */}
                    <View style={styles.shiftCardActions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => {
                          setEditingShift(shift);
                          setShowEditModal(true);
                        }}
                      >
                        <Text style={styles.editButtonText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => setConfirmDelete(shift.id)}
                      >
                        <Text style={styles.deleteButtonText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="time" size={40} color={COLORS.GRAY} />
              </View>
              <Text style={styles.emptyStateTitle}>
                No hay guardias programadas
              </Text>
              <Text style={styles.emptyStateText}>
                No tienes guardias programadas para los próximos 30 días
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleNewShiftClick}
              >
                <Text style={styles.emptyStateButtonText}>
                  Programar Guardia
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <FloatingActionButton
        onPress={handleNewShiftClick}
        icon="add"
        backgroundColor={COLORS.PRIMARY}
        bottom={20}
        right={20}
      />

      {/* Modal para añadir guardia */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          />
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Guardia</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView
              style={styles.modalForm}
              contentContainerStyle={styles.modalFormContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formRow}>
                {/* Fecha */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Fecha de la guardia *</Text>
                  <DateTimePicker
                    value={formData.date}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setFormData({ ...formData, date: selectedDate });
                      }
                    }}
                    locale="es-ES"
                    minimumDate={new Date()}
                    style={styles.datePicker}
                  />
                </View>

                {/* Precio */}
                <View style={styles.formField}>
                  <View style={styles.checkboxRow}>
                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() => {
                        setShowPriceInput(!showPriceInput);
                        if (showPriceInput) {
                          setFormData({ ...formData, price_eur: null });
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.checkboxBox,
                          showPriceInput && styles.checkboxBoxChecked,
                        ]}
                      >
                        {showPriceInput && (
                          <Ionicons name="checkmark" size={16} color="white" />
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>
                        Quiero vender esta guardia
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showPriceInput && (
                    <View style={styles.priceInputWrapper}>
                      <Text style={styles.formLabel}>Precio (€)</Text>
                      <View style={styles.priceInputContainer}>
                        <Text style={styles.currencySymbol}>€</Text>
                        <TextInput
                          style={styles.priceInput}
                          value={
                            formData.price_eur
                              ? formData.price_eur.toString()
                              : ""
                          }
                          onChangeText={(text) => {
                            const value = parseFloat(text.replace(",", "."));
                            setFormData({
                              ...formData,
                              price_eur: isNaN(value) ? null : value,
                            });
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                        />
                      </View>
                    </View>
                  )}
                </View>

                {/* Notas */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Notas (opcional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={formData.notes}
                    onChangeText={(text) =>
                      setFormData({ ...formData, notes: text })
                    }
                    placeholder="Información adicional sobre la guardia..."
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddShift}
              >
                <Text style={styles.addButtonText}>Crear Guardia</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal para editar guardia */}
      {editingShift && (
        <Modal
          visible={showEditModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowEditModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <TouchableOpacity
              style={styles.modalOverlayTouchable}
              activeOpacity={1}
              onPress={() => setShowEditModal(false)}
            />
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Guardia</Text>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
                </TouchableOpacity>
              </View>

              {/* Form */}
              <ScrollView
                style={styles.modalForm}
                contentContainerStyle={styles.modalFormContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Preview Card */}
                <View style={styles.previewCard}>
                  <Text style={styles.previewLabel}>
                    Información de la guardia
                  </Text>
                  <View style={styles.previewContent}>
                    <View style={styles.previewDateBadge}>
                      <Text style={styles.previewDateNumber}>
                        {new Date(editingShift.date).getDate()}
                      </Text>
                    </View>
                    <View style={styles.previewInfo}>
                      <Text style={styles.previewDate}>
                        {new Date(editingShift.date).getDate()} de{" "}
                        {monthNames[new Date(editingShift.date).getMonth()]}{" "}
                        {new Date(editingShift.date).getFullYear()}
                      </Text>
                      <Text style={styles.previewDay}>
                        {formatDate(editingShift.date)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.previewTypeBadge,
                        {
                          backgroundColor: guardTypeColors[editingShift.type],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.previewTypeBadgeText,
                          {
                            color: guardTypeTextColors[editingShift.type],
                          },
                        ]}
                      >
                        {guardTypeLabels[editingShift.type]}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.formRow}>
                  {/* Precio */}
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>
                      Precio de venta (opcional)
                    </Text>
                    <View style={styles.priceInputContainer}>
                      <Text style={styles.currencySymbol}>€</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={
                          editingShift.price_eur
                            ? editingShift.price_eur.toString()
                            : ""
                        }
                        onChangeText={(text) => {
                          const value = parseFloat(text.replace(",", "."));
                          setEditingShift({
                            ...editingShift,
                            price_eur: isNaN(value) ? null : value,
                          });
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                      />
                    </View>
                    <Text style={styles.inputHint}>
                      Deja vacío si no quieres vender esta guardia
                    </Text>
                  </View>

                  {/* Notas */}
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Notas (opcional)</Text>
                    <TextInput
                      style={styles.notesInput}
                      value={editingShift.notes || ""}
                      onChangeText={(text) =>
                        setEditingShift({ ...editingShift, notes: text })
                      }
                      placeholder="Información adicional sobre la guardia..."
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleEditShift}
                >
                  <Text style={styles.addButtonText}>Guardar Cambios</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Modal de confirmación de eliminación */}
      <Modal
        visible={confirmDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <Text style={styles.confirmTitle}>Confirmar Eliminación</Text>
            <Text style={styles.confirmText}>
              ¿Estás seguro de que quieres eliminar esta guardia? Esta acción no
              se puede deshacer.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setConfirmDelete(null)}
              >
                <Text style={styles.confirmCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={() => handleDeleteShift(confirmDelete)}
              >
                <Text style={styles.confirmDeleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Review Request Modal */}
      <Modal
        visible={showReviewRequest}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewRequest(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <Ionicons name="alert-circle" size={48} color={COLORS.PRIMARY} />
            <Text style={styles.confirmTitle}>Reseña Requerida</Text>
            <Text style={styles.confirmText}>
              Para poder gestionar guardias necesitas completar tu reseña del
              hospital primero.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setShowReviewRequest(false)}
              >
                <Text style={styles.confirmCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={() => {
                  setShowReviewRequest(false);
                  onNavigateToSection?.("mi-resena");
                }}
              >
                <Text style={styles.modalSubmitButtonText}>Ir a Mi Reseña</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
  },
  notificationButton: {
    padding: 8,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: COLORS.ERROR,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: COLORS.WHITE,
    fontSize: 11,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  analyticsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  backButton: {
    padding: 8,
  },
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  summaryTotal: {
    alignItems: "center",
    marginBottom: 16,
  },
  summaryTotalNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.PRIMARY,
  },
  summaryTotalLabel: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  summaryBreakdown: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  summaryBreakdownItem: {
    alignItems: "center",
  },
  summaryBreakdownNumber: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  summaryBreakdownLabel: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  notificationIconContainer: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: COLORS.ERROR,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "white",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "white",
  },
  sectionContainer: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginLeft: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginLeft: 8,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  shiftsGrid: {
    gap: 12,
  },
  shiftCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  shiftCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  shiftDateBadge: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  shiftDateNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  shiftTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  shiftTypeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  shiftCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  shiftCardDay: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginBottom: 8,
  },
  daysRemainingContainer: {
    marginBottom: 8,
  },
  daysRemainingBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  daysRemainingToday: {
    backgroundColor: "#FEE2E2",
  },
  daysRemainingTomorrow: {
    backgroundColor: "#FED7AA",
  },
  daysRemainingPast: {
    backgroundColor: "#F3F4F6",
  },
  daysRemainingFuture: {
    backgroundColor: "#DBEAFE",
  },
  daysRemainingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY,
    marginRight: 6,
  },
  daysRemainingText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  shiftNotes: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginBottom: 12,
  },
  shiftCardActions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  editButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ERROR,
  },
  emptyState: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 48,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    marginBottom: 16,
  },
  emptyStateButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  closeButton: {
    padding: 4,
  },
  modalForm: {
    flex: 1,
  },
  modalFormContent: {
    padding: 20,
    paddingBottom: 20,
  },
  previewCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.GRAY,
    marginBottom: 12,
  },
  previewContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewDateBadge: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  previewDateNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  previewInfo: {
    flex: 1,
  },
  previewDate: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  previewDay: {
    fontSize: 12,
    color: COLORS.GRAY,
    textTransform: "capitalize",
  },
  previewTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  previewTypeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  formRow: {
    gap: 16,
  },
  formField: {
    gap: 12,
    marginBottom: 8,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  datePicker: {
    width: "100%",
    height: 180,
  },
  checkboxRow: {
    marginTop: 8,
  },
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  checkboxLabel: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
  },
  priceInputWrapper: {
    marginTop: 12,
    gap: 8,
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    color: COLORS.GRAY,
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    paddingVertical: 12,
  },
  notesInput: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    minHeight: 120,
    textAlignVertical: "top",
  },
  inputHint: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.WHITE,
  },
  addButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.SUCCESS,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.GRAY_LIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  confirmModalContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmCancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: COLORS.ERROR,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmDeleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
});

export default ShiftsScreen;
