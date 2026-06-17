import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ROOMMATE_FORM_DEFAULTS,
  ROOMMATE_OPTION_SETS,
  ROOMMATE_THEME,
} from "../../utils/roommateUtils";

const ChoicePills = ({ options, value, onChange, allowNull = false }) => (
  <View style={styles.pillsRow}>
    {options.map((option) => {
      const isActive =
        allowNull && option.value === null ? value === null : option.value === value;

      return (
        <TouchableOpacity
          key={String(option.value)}
          style={[styles.pill, isActive && styles.pillActive]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export function RoommateFiltersModal({
  visible,
  onClose,
  initialFilters,
  onSave,
}) {
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState(
    initialFilters || ROOMMATE_FORM_DEFAULTS.filters
  );

  React.useEffect(() => {
    if (visible) {
      setFilters({
        ...(initialFilters || ROOMMATE_FORM_DEFAULTS.filters),
        preferred_city: "",
      });
    }
  }, [visible, initialFilters]);

  const handleFieldChange = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleReset = () => {
    setFilters({
      ...ROOMMATE_FORM_DEFAULTS.filters,
      budget_max_eur: "",
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 28) }]}>
          <TouchableOpacity style={styles.iconButton} onPress={onClose}>
            <Icon name="close" size={24} color={ROOMMATE_THEME.ACCENT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filtros del listado</Text>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 100 + Math.max(insets.bottom, 12) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Presupuesto</Text>

            <TextInput
              style={styles.input}
              placeholder="Presupuesto máximo"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={filters.budget_max_eur ? String(filters.budget_max_eur) : ""}
              onChangeText={(value) => handleFieldChange("budget_max_eur", value)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Convivencia</Text>

            <Text style={styles.fieldLabel}>Ritmo preferido</Text>
            <ChoicePills
              options={[
                { value: "any", label: "Da igual" },
                ...ROOMMATE_OPTION_SETS.sleepSchedule,
              ]}
              value={filters.preferred_sleep_schedule}
              onChange={(value) =>
                handleFieldChange("preferred_sleep_schedule", value)
              }
            />

            <Text style={styles.fieldLabel}>Nivel mínimo de orden</Text>
            <ChoicePills
              options={[
                { value: "", label: "Flexible" },
                { value: 3, label: "Equilibrado" },
                { value: 4, label: "Muy ordenado/a" },
              ]}
              value={filters.min_cleanliness_level}
              onChange={(value) => handleFieldChange("min_cleanliness_level", value)}
            />

            <Text style={styles.fieldLabel}>Mascotas</Text>
            <ChoicePills
              options={ROOMMATE_OPTION_SETS.nullableBoolean}
              value={filters.accepts_pets}
              onChange={(value) => handleFieldChange("accepts_pets", value)}
              allowNull
            />

            <Text style={styles.fieldLabel}>Tabaco</Text>
            <ChoicePills
              options={ROOMMATE_OPTION_SETS.nullableBoolean}
              value={filters.accepts_smoking}
              onChange={(value) => handleFieldChange("accepts_smoking", value)}
              allowNull
            />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              onSave?.({
                ...filters,
                preferred_city: "",
              })
            }
          >
            <Text style={styles.primaryButtonText}>Aplicar filtros</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: ROOMMATE_THEME.ACCENT,
  },
  resetButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  resetButtonText: {
    color: ROOMMATE_THEME.PRIMARY,
    fontWeight: "800",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 18,
    gap: 18,
  },
  card: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 20,
    gap: 14,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: ROOMMATE_THEME.ACCENT,
  },
  input: {
    borderRadius: 18,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: ROOMMATE_THEME.TEXT,
    fontSize: 15,
    fontWeight: "600",
  },
  fieldLabel: {
    marginTop: 4,
    color: ROOMMATE_THEME.MUTED,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
  },
  pillActive: {
    backgroundColor: ROOMMATE_THEME.PRIMARY,
  },
  pillText: {
    color: ROOMMATE_THEME.ACCENT,
    fontWeight: "700",
    fontSize: 13,
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: "rgba(247,245,251,0.98)",
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
