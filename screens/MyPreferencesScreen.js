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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePreferences } from "../hooks/usePreferences";
import { useHospitals } from "../hooks/useHospitals";
import { SelectFilter } from "../components/SelectFilter";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { ScreenScaffold } from "../components/ScreenScaffold";
import posthogLogger from "../services/posthogService";

// ============================================================================
// COLORS
// ============================================================================

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const WHITE = "#FFFFFF";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#F1F5F9";
const ERROR = "#EF4444";

// ============================================================================
// PREFERENCE CARD
// ============================================================================

const PreferenceCard = ({
  preference,
  index,
  editingOrder,
  onMoveUp,
  onMoveDown,
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
    <View style={styles.card}>
      {/* Rank badge */}
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>

      {/* Top row: specialty + position badge */}
      <View style={styles.cardTitleRow}>
        <View style={styles.specialtyRow}>
          <Ionicons name="school" size={15} color={PRIMARY} />
          <Text style={styles.cardSpecialty} numberOfLines={1}>
            {preference.specialty.name}
          </Text>
        </View>
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>
            Pos. {editingOrder ? index + 1 : preference.position}
          </Text>
        </View>
      </View>

      {/* Hospital info */}
      <View style={styles.hospitalBlock}>
        <View style={styles.hospitalRow}>
          <Ionicons name="business" size={14} color={ACCENT} />
          <Text style={styles.hospitalName} numberOfLines={2}>
            {preference.hospital.name}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={TEXT_MEDIUM} />
          <Text style={styles.locationText} numberOfLines={1}>
            {preference.hospital.city}, {preference.hospital.region}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          Añadido el {formatDate(preference.created_at)}
        </Text>
        {editingOrder ? (
          <View style={styles.orderControls}>
            <TouchableOpacity
              style={[styles.orderBtn, !canMoveUp && styles.orderBtnDisabled]}
              onPress={() => onMoveUp(preference.id)}
              disabled={!canMoveUp}
            >
              <Ionicons
                name="chevron-up"
                size={18}
                color={canMoveUp ? ACCENT : TEXT_LIGHT}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.orderBtn, !canMoveDown && styles.orderBtnDisabled]}
              onPress={() => onMoveDown(preference.id)}
              disabled={!canMoveDown}
            >
              <Ionicons
                name="chevron-down"
                size={18}
                color={canMoveDown ? ACCENT : TEXT_LIGHT}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(preference.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={17} color={ERROR} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ============================================================================
// ADD PREFERENCE MODAL
// ============================================================================

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
  const insets = useSafeAreaInsets();
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  const hospitalOptions = useMemo(() => {
    const allHospitals = hospitals.length > 0 ? hospitals : initialHospitals;
    if (!allHospitals || allHospitals.length === 0) return [];
    return allHospitals
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((hospital) => {
        const baseName = `${hospital.name} - ${hospital.city}`;
        const nameWithRegion = hospital.region
          ? `${baseName}, ${hospital.region}`
          : baseName;
        return { id: hospital.id, name: nameWithRegion };
      });
  }, [hospitals, initialHospitals]);

  const specialtyOptions = useMemo(() => {
    return specialties
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((specialty) => ({ id: specialty.id, name: specialty.name }));
  }, [specialties]);

  const handleAdd = () => {
    if (!selectedHospital || !selectedSpecialty) return;
    onAdd(selectedHospital, selectedSpecialty);
  };

  const handleClose = () => {
    setSelectedHospital("");
    setSelectedSpecialty("");
    onClose();
  };

  const canAdd = !!(selectedHospital && selectedSpecialty && !loading);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={modal.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity
          style={modal.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={[modal.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Handle bar */}
          <View style={modal.handle} />

          {/* Header */}
          <View style={modal.header}>
            <TouchableOpacity style={modal.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={ACCENT} />
            </TouchableOpacity>
            <Text style={modal.title}>Nueva preferencia</Text>
            <TouchableOpacity
              style={[modal.addBtn, !canAdd && modal.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!canAdd}
            >
              {loading ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <Text style={modal.addBtnText}>Añadir</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Error */}
          {errorMessage ? (
            <View style={modal.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={ERROR} />
              <Text style={modal.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Form */}
          <ScrollView
            style={modal.form}
            contentContainerStyle={modal.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={modal.formField}>
              <Text style={modal.fieldLabel}>Hospital *</Text>
              <SelectFilter
                value={selectedHospital}
                onSelect={setSelectedHospital}
                options={hospitalOptions}
                placeholder="Selecciona un hospital"
              />
            </View>
            <View style={modal.formField}>
              <Text style={modal.fieldLabel}>Especialidad *</Text>
              <SelectFilter
                value={selectedSpecialty}
                onSelect={setSelectedSpecialty}
                options={specialtyOptions}
                placeholder="Selecciona una especialidad"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MyPreferencesScreen({
  onSectionChange,
  currentSection,
  userProfile,
  onHospitalSelect,
  onBack,
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

  useEffect(() => {
    if (adding) fetchInitialHospitals();
  }, [adding, fetchInitialHospitals]);

  useEffect(() => {
    if (editingOrder) setOrderDraft([...preferences]);
  }, [editingOrder, preferences]);

  useEffect(() => {
    posthogLogger.logScreen("MyPreferencesScreen");
  }, []);

  const displayPreferences = editingOrder ? orderDraft : preferences;

  const handleAddPreference = async (hospitalId, specialtyId) => {
    setAddError("");
    setAddingPreference(true);
    try {
      const { success, error: err } = await addPreference(hospitalId, specialtyId);
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

  const handleDeletePreference = (preferenceId) => {
    Alert.alert(
      "Eliminar preferencia",
      "¿Estás seguro de que quieres eliminar esta preferencia?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await removePreference(preferenceId);
            if (editingOrder) {
              setOrderDraft((prev) =>
                prev.filter((p) => p.id !== preferenceId)
              );
            }
          },
        },
      ]
    );
  };

  const handleMoveUp = (preferenceId) => {
    setOrderDraft((prev) => {
      const arr = [...prev];
      const i = arr.findIndex((p) => p.id === preferenceId);
      if (i <= 0) return prev;
      const updated = [...arr];
      [updated[i], updated[i - 1]] = [updated[i - 1], updated[i]];
      return updated;
    });
  };

  const handleMoveDown = (preferenceId) => {
    setOrderDraft((prev) => {
      const arr = [...prev];
      const i = arr.findIndex((p) => p.id === preferenceId);
      if (i < 0 || i >= arr.length - 1) return prev;
      const updated = [...arr];
      [updated[i], updated[i + 1]] = [updated[i + 1], updated[i]];
      return updated;
    });
  };

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

  const header = (
    <ScreenHeader
      title="Mis Preferencias"
      onBack={onBack}
      compact
      rightSlot={
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {preferences.length} {preferences.length === 1 ? "ENTRADA" : "ENTRADAS"}
          </Text>
        </View>
      }
    />
  );

  if (loading) {
    return (
      <ScreenScaffold header={header} contentSurfaceStyle={styles.contentSurface}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando preferencias...</Text>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold header={header} contentSurfaceStyle={styles.contentSurface}>
      {/* Editing mode bar */}
      {editingOrder && (
        <View style={styles.editBar}>
          <View style={styles.editBarLeft}>
            <Ionicons name="brush" size={17} color={PRIMARY} />
            <Text style={styles.editBarText}>Reorganiza tus preferencias</Text>
          </View>
          <View style={styles.editBarActions}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveOrder}
              disabled={savingOrder}
              activeOpacity={0.85}
            >
              {savingOrder ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={17} color={WHITE} />
                  <Text style={styles.saveBtnText}>Guardar</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setEditingOrder(false);
                setOrderDraft([]);
              }}
              disabled={savingOrder}
            >
              <Ionicons name="close" size={20} color={TEXT_MEDIUM} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Section label */}
        {preferences.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>
              {editingOrder ? "Modo edición" : "Tus hospitales favoritos"}
            </Text>
            <Text style={styles.sectionCount}>
              {displayPreferences.length}{" "}
              {displayPreferences.length === 1 ? "preferencia" : "preferencias"}
            </Text>
          </View>
        )}

        {/* Empty state */}
        {preferences.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="heart-outline" size={40} color={PRIMARY} />
            </View>
            <Text style={styles.emptyTitle}>Aún no tienes preferencias</Text>
            <Text style={styles.emptySubtitle}>
              Añade tus combinaciones favoritas de hospital y especialidad
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {displayPreferences.map((preference, index) => (
              <PreferenceCard
                key={preference.id}
                preference={preference}
                index={index}
                editingOrder={editingOrder}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onDelete={handleDeletePreference}
                canMoveUp={index > 0}
                canMoveDown={index < displayPreferences.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FABs */}
      {!editingOrder && (
        <>
          <FloatingActionButton
            onPress={() => setAdding(true)}
            icon="add"
            backgroundColor={PRIMARY}
            bottom={20}
            right={20}
          />
          {preferences.length >= 2 && (
            <FloatingActionButton
              onPress={() => {
                setEditingOrder(true);
                setOrderDraft([...preferences]);
              }}
              icon="brush-outline"
              backgroundColor={ACCENT}
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
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG_LIGHT,
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    color: TEXT_MEDIUM,
  },

  // ── Editing bar ──
  editBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: `${PRIMARY}10`,
    borderBottomWidth: 1,
    borderBottomColor: `${PRIMARY}20`,
  },
  editBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  editBarText: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
    flex: 1,
  },
  editBarActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: SECONDARY,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: WHITE,
  },
  cancelBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },

  countBadge: {
    backgroundColor: `${PRIMARY}12`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}25`,
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.8,
  },

  // ── Section row ──
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 6,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // ── Empty state ──
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_MEDIUM,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── List ──
  list: {
    gap: 14,
  },

  // ── Card ──
  card: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  rankBadge: {
    alignSelf: "flex-start",
    backgroundColor: `${PRIMARY}12`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}25`,
    marginBottom: 12,
  },
  rankText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.3,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  specialtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  cardSpecialty: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    flex: 1,
  },
  positionBadge: {
    backgroundColor: `${SECONDARY}18`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${SECONDARY}30`,
    flexShrink: 0,
  },
  positionText: {
    fontSize: 11,
    fontWeight: "700",
    color: SECONDARY,
  },
  hospitalBlock: {
    gap: 6,
    marginBottom: 12,
    paddingLeft: 2,
  },
  hospitalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hospitalName: {
    fontSize: 14,
    fontWeight: "600",
    color: ACCENT,
    flex: 1,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 20,
  },
  locationText: {
    fontSize: 12,
    color: TEXT_MEDIUM,
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  dateText: {
    fontSize: 11,
    color: TEXT_LIGHT,
  },
  deleteBtn: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: `${ERROR}0D`,
  },
  orderControls: {
    flexDirection: "row",
    gap: 4,
  },
  orderBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: WHITE,
  },
  orderBtnDisabled: {
    opacity: 0.4,
  },
});

// ============================================================================
// MODAL STYLES
// ============================================================================

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    minHeight: "55%",
    paddingTop: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
    marginHorizontal: 12,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    minWidth: 72,
    alignItems: "center",
  },
  addBtnDisabled: {
    opacity: 0.45,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: WHITE,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: `${ERROR}0D`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${ERROR}30`,
  },
  errorText: {
    fontSize: 13,
    color: ERROR,
    flex: 1,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 8,
  },
  formField: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: 0.2,
  },
});
