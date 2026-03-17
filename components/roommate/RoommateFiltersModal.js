import React, { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ROOMMATE_FORM_DEFAULTS,
  ROOMMATE_OPTION_SETS,
  ROOMMATE_THEME,
} from "../../utils/roommateUtils";
import { SelectorModal } from "../SelectorModal";

const sanitizeCityOptions = (options = []) => {
  const seen = new Set();

  return options.filter((option) => {
    const id = String(option?.id ?? "").trim();
    const name = String(option?.name ?? "").trim();

    if (!id || !name) {
      return false;
    }

    const key = id.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

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
  cityOptions = [],
  onSave,
}) {
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState(
    initialFilters || ROOMMATE_FORM_DEFAULTS.filters
  );
  const [cityModalVisible, setCityModalVisible] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setFilters(initialFilters || ROOMMATE_FORM_DEFAULTS.filters);
      setCityModalVisible(false);
    }
  }, [visible, initialFilters]);

  const resolvedCityOptions = useMemo(() => {
    const cleanedOptions = sanitizeCityOptions(cityOptions);

    if (!filters.preferred_city) {
      return cleanedOptions;
    }

    const exists = cleanedOptions.some(
      (option) => option.id === filters.preferred_city
    );

    if (exists) {
      return cleanedOptions;
    }

    return [
      { id: filters.preferred_city, name: filters.preferred_city },
      ...cleanedOptions,
    ];
  }, [cityOptions, filters.preferred_city]);

  const handleFieldChange = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleReset = () => {
    setFilters({
      ...ROOMMATE_FORM_DEFAULTS.filters,
      preferred_city: "",
      budget_max_eur: "",
    });
  };

  const cityActive = Boolean(filters.preferred_city);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 28) }]}>
          <TouchableOpacity style={styles.iconButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={ROOMMATE_THEME.ACCENT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filtros de swipe</Text>
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
            <Text style={styles.cardTitle}>Ubicación y presupuesto</Text>

            <TouchableOpacity
              style={[styles.citySelectorButton, cityActive && styles.citySelectorButtonActive]}
              onPress={() => setCityModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="business"
                size={16}
                color={cityActive ? ROOMMATE_THEME.PRIMARY : ROOMMATE_THEME.ACCENT}
              />
              <Text
                style={[
                  styles.citySelectorText,
                  cityActive && styles.citySelectorTextActive,
                  !cityActive && styles.citySelectorPlaceholder,
                ]}
                numberOfLines={1}
              >
                {filters.preferred_city || "Ciudad"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={cityActive ? ROOMMATE_THEME.PRIMARY : ROOMMATE_THEME.ACCENT}
              />
            </TouchableOpacity>

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
            onPress={() => onSave?.(filters)}
          >
            <Text style={styles.primaryButtonText}>Aplicar filtros</Text>
          </TouchableOpacity>
        </View>

        <SelectorModal
          visible={cityModalVisible}
          onClose={() => setCityModalVisible(false)}
          title="Filtrar por ciudad"
          options={resolvedCityOptions}
          value={filters.preferred_city}
          onSelect={(value) => handleFieldChange("preferred_city", value)}
          placeholder="Todas las ciudades"
          accentColor={ROOMMATE_THEME.ACCENT}
          primaryColor={ROOMMATE_THEME.PRIMARY}
        />
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
  citySelectorButton: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9DFFB",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  citySelectorButtonActive: {
    backgroundColor: "#F8F5FF",
    borderColor: "#D8C7FF",
  },
  citySelectorText: {
    flex: 1,
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 14,
    fontWeight: "700",
  },
  citySelectorTextActive: {
    color: ROOMMATE_THEME.PRIMARY,
  },
  citySelectorPlaceholder: {
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
