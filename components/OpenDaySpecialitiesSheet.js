import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { canConfirmOpenDaySpecialities } from "../utils/openDaySpecialities";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const WHITE = "#FFFFFF";
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Bottom sheet para marcar las especialidades que el postMIR quiere conocer en
 * una jornada de puertas abiertas. Sirve para inscribirse y para modificar la
 * selección: la marca es un borrador hasta pulsar el botón, así que cerrar el
 * sheet no cambia nada.
 *
 * @param {boolean} visible
 * @param {Array<{id: string, name: string}>} options - Especialidades del hospital
 * @param {string[]} initialSelectedIds - Selección guardada (vacía al inscribirse)
 * @param {string} confirmLabel - "Confirmar inscripción" o "Guardar cambios"
 * @param {boolean} saving - Bloquea el sheet mientras se guarda
 * @param {function} onConfirm - Recibe los ids marcados
 * @param {function} onClose
 */
export const OpenDaySpecialitiesSheet = ({
  visible,
  options,
  initialSelectedIds,
  confirmLabel,
  saving = false,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set(initialSelectedIds || []));
    }
  }, [visible, initialSelectedIds]);

  const toggle = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedList = Array.from(selectedIds);
  const canConfirm = canConfirmOpenDaySpecialities(selectedList, options);
  const handleClose = () => {
    if (!saving) onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>¿Qué especialidades te gustaría conocer?</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={HIT_SLOP}
              disabled={saving}
              accessibilityLabel="Cerrar"
            >
              <Icon name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>
          <Text style={styles.description}>
            Selecciona las especialidades que te interesan para que el hospital
            pueda organizar mejor su jornada de puertas abiertas.
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {(options || []).map((option) => {
              const isSelected = selectedIds.has(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  testID={`open-day-speciality-${option.id}`}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  activeOpacity={0.8}
                  onPress={() => toggle(option.id)}
                  disabled={saving}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected ? (
                      <Icon name="checkmark" size={14} color={WHITE} weight="bold" />
                    ) : null}
                  </View>
                  <Text style={styles.optionText}>{option.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {!canConfirm ? (
            <Text style={styles.hint}>Selecciona al menos una especialidad.</Text>
          ) : null}

          <TouchableOpacity
            testID="open-day-specialities-confirm"
            style={[styles.confirm, (!canConfirm || saving) && styles.confirmDisabled]}
            activeOpacity={0.85}
            onPress={() => onConfirm?.(selectedList)}
            disabled={!canConfirm || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={WHITE} />
            ) : (
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
    color: ACCENT,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  list: { flexGrow: 0 },
  listContent: { gap: 8, paddingVertical: 4 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: WHITE,
  },
  optionSelected: {
    borderColor: PRIMARY,
    backgroundColor: "#F4EFFE",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
  },
  hint: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  confirm: {
    backgroundColor: PRIMARY,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDisabled: { opacity: 0.45 },
  confirmText: { fontSize: 15, fontWeight: "700", color: WHITE },
});
