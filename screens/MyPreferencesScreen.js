import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePreferences } from "../hooks/usePreferences";
import { useHospitals } from "../hooks/useHospitals";
import { SelectFilter } from "../components/SelectFilter";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { prepareHospitalOptions } from "../utils/profileOptions";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Card de preferencia individual
 */
const PreferenceCard = ({
  preference,
  index,
  editingOrder,
  onMoveUp,
  onMoveDown,
  onViewHospital,
  onDelete,
  canMoveUp,
  canMoveDown,
}) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <View style={styles.preferenceCard}>
      <View style={styles.cardContent}>
        {/* Left side - Rank and info */}
        <View style={styles.cardLeft}>
          {/* Rank badge */}
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>

          {/* Specialty */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Especialidad</Text>
            <View style={styles.infoRow}>
              <Ionicons name="school" size={20} color={COLORS.PURPLE} />
              <Text style={styles.infoValue}>{preference.specialty.name}</Text>
            </View>
          </View>

          {/* Hospital */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Ionicons name="heart" size={16} color={COLORS.RED} />
              <Text style={styles.infoLabel}>Hospital</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="business" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.infoValue}>{preference.hospital.name}</Text>
            </View>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={COLORS.GRAY} />
              <Text style={styles.locationText}>
                {preference.hospital.city}, {preference.hospital.region}
              </Text>
            </View>
          </View>
        </View>

        {/* Right side - Position and controls */}
        <View style={styles.cardRight}>
          <View style={styles.positionBadge}>
            <Text style={styles.positionText}>
              Posición {editingOrder ? index + 1 : preference.position}
            </Text>
          </View>

          {editingOrder && (
            <View style={styles.orderControls}>
              <TouchableOpacity
                style={[
                  styles.orderButton,
                  !canMoveUp && styles.orderButtonDisabled,
                ]}
                onPress={() => onMoveUp(preference.id)}
                disabled={!canMoveUp}
              >
                <Ionicons
                  name="chevron-up"
                  size={20}
                  color={canMoveUp ? COLORS.GRAY_DARK : COLORS.GRAY}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.orderButton,
                  !canMoveDown && styles.orderButtonDisabled,
                ]}
                onPress={() => onMoveDown(preference.id)}
                disabled={!canMoveDown}
              >
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={canMoveDown ? COLORS.GRAY_DARK : COLORS.GRAY}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Footer - Date and actions */}
      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          Añadido el {formatDate(preference.created_at)}
        </Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              onViewHospital(preference.hospital_id, preference.speciality_id)
            }
          >
            <Ionicons name="eye" size={18} color={COLORS.PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onDelete(preference.id)}
          >
            <Ionicons name="trash" size={18} color={COLORS.RED} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

/**
 * Modal para añadir nueva preferencia
 */
const AddPreferenceModal = ({
  visible,
  onClose,
  onAdd,
  hospitals,
  specialties,
  initialHospitals,
  errorMessage,
  loading,
}) => {
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  // Preparar opciones para los selectores
  // Usamos siempre 'hospitals' que contiene todos los hospitales
  // Aplicamos el mismo filtrado que en ProfileScreen (excluye hospitales que empiezan con "ud")
  const hospitalOptions = useMemo(() => {
    // Usar hospitals que tiene todos los hospitales cargados
    const allHospitals = hospitals.length > 0 ? hospitals : initialHospitals;

    // Usar la misma función de preparación que ProfileScreen para mantener consistencia
    const prepared = prepareHospitalOptions(allHospitals);

    // Ajustar el formato para incluir la región (ProfileScreen solo muestra ciudad)
    return prepared.map((option) => {
      // Buscar el hospital original para obtener la región
      const hospital = allHospitals.find((h) => h.id === option.id);
      if (hospital && hospital.region) {
        return {
          ...option,
          name: `${option.name}, ${hospital.region}`,
        };
      }
      return option;
    });
  }, [hospitals, initialHospitals]);

  const specialtyOptions = useMemo(() => {
    return specialties
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((specialty) => ({
        id: specialty.id,
        name: specialty.name,
      }));
  }, [specialties]);

  const handleAdd = () => {
    if (!selectedHospital || !selectedSpecialty) {
      return;
    }
    onAdd(selectedHospital, selectedSpecialty);
  };

  const handleClose = () => {
    setSelectedHospital("");
    setSelectedSpecialty("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity
          style={styles.modalOverlayTouchable}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Añadir Nueva Preferencia</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Form */}
          <ScrollView
            style={styles.modalForm}
            contentContainerStyle={styles.modalFormContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Hospital *</Text>
                <SelectFilter
                  value={selectedHospital}
                  onSelect={setSelectedHospital}
                  options={hospitalOptions}
                  placeholder="Selecciona un hospital"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Especialidad *</Text>
                <SelectFilter
                  value={selectedSpecialty}
                  onSelect={setSelectedSpecialty}
                  options={specialtyOptions}
                  placeholder="Selecciona una especialidad"
                />
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[
                styles.addButton,
                (!selectedHospital || !selectedSpecialty) &&
                  styles.addButtonDisabled,
              ]}
              onPress={handleAdd}
              disabled={!selectedHospital || !selectedSpecialty || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.addButtonText}>Añadir Preferencia</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Pantalla de Mis Preferencias
 * Permite gestionar las preferencias de hospital y especialidad del usuario
 */
export default function MyPreferencesScreen({
  onSectionChange,
  currentSection,
  userProfile,
  onHospitalSelect,
}) {
  const {
    preferences,
    loading,
    error,
    initialHospitals,
    fetchInitialHospitals,
    addPreference,
    removePreference,
    saveOrder,
  } = usePreferences();

  const { hospitals, specialties } = useHospitals();

  const [adding, setAdding] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [orderDraft, setOrderDraft] = useState([]);
  const [addError, setAddError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [addingPreference, setAddingPreference] = useState(false);

  // Cargar hospitales iniciales cuando se abre el modal
  useEffect(() => {
    if (adding) {
      fetchInitialHospitals();
    }
  }, [adding, fetchInitialHospitals]);

  // Inicializar orderDraft cuando se entra en modo edición
  useEffect(() => {
    if (editingOrder) {
      setOrderDraft([...preferences]);
    }
  }, [editingOrder, preferences]);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("MyPreferencesScreen");
  }, []);

  const displayPreferences = editingOrder ? orderDraft : preferences;

  // Manejar añadir preferencia
  const handleAddPreference = async (hospitalId, specialtyId) => {
    setAddError("");
    setAddingPreference(true);

    try {
      const { success, error: err } = await addPreference(
        hospitalId,
        specialtyId
      );

      if (success) {
        setAdding(false);
        setAddError("");
      } else {
        setAddError(err || "Error al añadir la preferencia");
      }
    } finally {
      setAddingPreference(false);
    }
  };

  // Manejar eliminar preferencia
  const handleDeletePreference = (preferenceId) => {
    Alert.alert(
      "Eliminar preferencia",
      "¿Estás seguro de que quieres eliminar esta preferencia?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await removePreference(preferenceId);
            if (editingOrder) {
              setOrderDraft((prev) =>
                prev.filter((pref) => pref.id !== preferenceId)
              );
            }
          },
        },
      ]
    );
  };

  // Manejar ver detalle del hospital
  const handleViewHospital = async (hospitalId, specialityId) => {
    if (onHospitalSelect) {
      // Buscar el hospital en la lista de hospitales
      const hospital = hospitals.find((h) => h.id === hospitalId);
      if (hospital) {
        // Pasar la sección actual (myPreferences) como tercer parámetro
        onHospitalSelect(hospital, specialityId || null, "myPreferences");
      }
    }
  };

  // Iniciar edición de orden
  const handleStartEditingOrder = () => {
    setEditingOrder(true);
    setOrderDraft([...preferences]);
  };

  // Cancelar edición de orden
  const handleCancelEditingOrder = () => {
    setEditingOrder(false);
    setOrderDraft([]);
  };

  // Mover preferencia arriba
  const handleMoveUp = (preferenceId) => {
    setOrderDraft((prev) => {
      const current = [...prev];
      const index = current.findIndex((pref) => pref.id === preferenceId);
      if (index <= 0) return prev;

      const updated = [...current];
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;

      return updated;
    });
  };

  // Mover preferencia abajo
  const handleMoveDown = (preferenceId) => {
    setOrderDraft((prev) => {
      const current = [...prev];
      const index = current.findIndex((pref) => pref.id === preferenceId);
      if (index < 0 || index >= current.length - 1) return prev;

      const updated = [...current];
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;

      return updated;
    });
  };

  // Guardar orden
  const handleSaveOrder = async () => {
    if (orderDraft.length === 0) return;

    setSavingOrder(true);
    try {
      const { success, error: err } = await saveOrder(orderDraft);
      if (success) {
        setEditingOrder(false);
        setOrderDraft([]);
      } else {
        Alert.alert("Error", err || "No se pudo guardar el orden");
      }
    } finally {
      setSavingOrder(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>Cargando preferencias...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Mis Preferencias</Text>
          <Text style={styles.resultsText}>
            {preferences.length}{" "}
            <Text style={styles.resultsLabel}>
              {preferences.length === 1 ? "preferencia" : "preferencias"}
            </Text>
          </Text>
        </View>
      </View>

      {/* Editing Mode Bar */}
      {editingOrder && (
        <View style={styles.editingBar}>
          <View style={styles.editingBarContent}>
            <Ionicons name="brush" size={20} color={COLORS.PRIMARY} />
            <Text style={styles.editingBarText}>
              Modo edición: Reorganiza tus preferencias
            </Text>
          </View>
          <View style={styles.editingBarActions}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveOrder}
              disabled={savingOrder}
            >
              <Ionicons name="checkmark" size={20} color={COLORS.WHITE} />
              <Text style={styles.saveButtonText}>
                {savingOrder ? "Guardando..." : "Guardar"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelEditingOrder}
              disabled={savingOrder}
            >
              <Ionicons name="close" size={20} color={COLORS.TEXT_MEDIUM} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {preferences.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="heart-outline"
              size={64}
              color={COLORS.TEXT_LIGHT}
            />
            <Text style={styles.emptyTitle}>No tienes preferencias aún</Text>
            <Text style={styles.emptySubtitle}>
              Añade tus combinaciones favoritas de hospital y especialidad
            </Text>
          </View>
        ) : (
          <View style={styles.preferencesList}>
            {displayPreferences.map((preference, index) => (
              <PreferenceCard
                key={preference.id}
                preference={preference}
                index={index}
                editingOrder={editingOrder}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onViewHospital={handleViewHospital}
                onDelete={handleDeletePreference}
                canMoveUp={index > 0}
                canMoveDown={index < displayPreferences.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Buttons */}
      {!editingOrder && (
        <>
          {/* Main FAB - Add Preference */}
          <FloatingActionButton
            onPress={() => setAdding(true)}
            icon="add"
            backgroundColor={COLORS.PRIMARY}
            bottom={20}
            right={20}
          />

          {/* Secondary FAB - Edit Order (only if 2+ preferences) */}
          {preferences.length >= 2 && (
            <FloatingActionButton
              onPress={handleStartEditingOrder}
              icon="brush-outline"
              backgroundColor={COLORS.PURPLE}
              size={48}
              bottom={88}
              right={20}
            />
          )}
        </>
      )}

      {/* Add Preference Modal */}
      <AddPreferenceModal
        visible={adding}
        onClose={() => {
          setAdding(false);
          setAddError("");
        }}
        onAdd={handleAddPreference}
        hospitals={hospitals}
        specialties={specialties}
        initialHospitals={initialHospitals}
        errorMessage={addError}
        loading={addingPreference}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_LIGHT,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.TEXT_MEDIUM,
  },
  header: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.TEXT_DARK,
  },
  resultsText: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  resultsLabel: {
    fontSize: 14,
    fontWeight: "normal",
    color: COLORS.TEXT_MEDIUM,
  },
  editingBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.BADGE_BLUE_BG,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  editingBarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  editingBarText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.PRIMARY,
    flex: 1,
  },
  editingBarActions: {
    flexDirection: "row",
    gap: 8,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.SUCCESS,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  preferencesList: {
    gap: 16,
  },
  preferenceCard: {
    backgroundColor: COLORS.CARD_BACKGROUND,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: COLORS.BLACK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  cardContent: {
    flexDirection: "row",
    gap: 16,
  },
  cardLeft: {
    flex: 1,
    gap: 12,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.BADGE_PURPLE_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.PURPLE,
  },
  infoSection: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.TEXT_MEDIUM,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    flex: 1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  positionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.BADGE_BLUE_BG,
  },
  positionText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  orderControls: {
    flexDirection: "row",
    gap: 4,
  },
  orderButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
  },
  orderButtonDisabled: {
    opacity: 0.5,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
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
    maxHeight: "85%",
    minHeight: "60%",
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
    color: COLORS.TEXT_DARK,
  },
  closeButton: {
    padding: 4,
  },
  errorContainer: {
    margin: 20,
    padding: 12,
    backgroundColor: COLORS.ERROR_LIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.ERROR,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.ERROR,
  },
  modalForm: {
    flex: 1,
  },
  modalFormContent: {
    padding: 20,
    paddingBottom: 20,
  },
  formRow: {
    gap: 16,
  },
  formField: {
    gap: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
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
  addButtonDisabled: {
    backgroundColor: COLORS.TEXT_LIGHT,
    opacity: 0.5,
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
    backgroundColor: COLORS.TEXT_LIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
});
