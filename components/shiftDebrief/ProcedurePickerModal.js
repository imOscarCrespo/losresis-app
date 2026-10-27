import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";
import {
  findProcedureByName,
  searchProcedures,
} from "../../utils/shiftDebrief";

/**
 * Añadir procedimiento: buscar en las actividades de Actividad asistencial del
 * Libro del residente o crear uno personalizado.
 *
 * Con Libro propio el personalizado se crea como actividad de un área de su
 * Libro, así cuenta en sus acumulados. Con Libro oficial la estructura es del
 * tutor y no se puede: el procedimiento se queda en las guardias.
 */
export const ProcedurePickerModal = ({
  visible,
  catalog = [],
  excludeKeys = [],
  areas = [],
  canAddToLibro = false,
  onPick,
  onCreate,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [areaId, setAreaId] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setCustomName("");
    setCreating(false);
    // Urgencias si la tiene: es donde vive casi todo lo de guardia.
    const urgencias = areas.find((area) => /urgenc/i.test(area.name || ""));
    setAreaId(urgencias?.id || areas[0]?.id || null);
  }, [visible]);

  const results = useMemo(
    () => searchProcedures(catalog, query, excludeKeys),
    [catalog, query, excludeKeys],
  );

  const trimmedCustom = customName.trim();

  const handleCreate = async () => {
    if (!trimmedCustom || creating) return;
    // Si ya existe con ese nombre, se usa ese: no se duplica la actividad.
    const existing = findProcedureByName(catalog, trimmedCustom);
    if (existing) {
      onPick?.({ node_id: existing.node_id, name: existing.name });
      return;
    }
    if (!canAddToLibro) {
      onPick?.({ node_id: null, name: trimmedCustom });
      return;
    }
    setCreating(true);
    try {
      const created = await onCreate?.(trimmedCustom, areaId);
      if (created) onPick?.(created);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} testID="procedure-picker">
        <View style={styles.header}>
          <Text style={styles.title}>Añadir procedimiento</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close" size={24} color="#1B0977" />
          </TouchableOpacity>
        </View>

        <View style={styles.search}>
          <Icon name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar procedimiento…"
            placeholderTextColor="#94A3B8"
            autoCorrect={false}
            testID="procedure-search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Icon name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ScrollView y no FlatList: el campo del personalizado en el pie de una
            FlatList perdía el cursor al escribir. El catálogo es corto. */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
        >
          {results.length ? (
            results.map((item) => (
              <TouchableOpacity
                key={item.node_id}
                style={styles.row}
                onPress={() =>
                  onPick?.({ node_id: item.node_id, name: item.name })
                }
                activeOpacity={0.8}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  {item.area_name ? (
                    <Text style={styles.rowMeta}>{item.area_name}</Text>
                  ) : null}
                </View>
                <Icon name="add-circle-outline" size={24} color="#670CF5" />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.empty}>
              {catalog.length
                ? "No hay ninguno con ese nombre en tu Libro. Créalo abajo."
                : "Tu Libro aún no tiene actividades. Crea el tuyo abajo."}
            </Text>
          )}
          <View style={styles.create}>
            <Text style={styles.createTitle}>
              Crear procedimiento personalizado
            </Text>
            <TextInput
              style={styles.createInput}
              value={customName}
              onChangeText={setCustomName}
              autoCorrect={false}
              placeholder="Escribe el nombre del procedimiento…"
              placeholderTextColor="#94A3B8"
              testID="procedure-custom-name"
            />
            {canAddToLibro && areas.length > 1 ? (
              <View style={styles.areas}>
                <Text style={styles.areasLabel}>En tu Libro, dentro de</Text>
                <View style={styles.areaChips}>
                  {areas.map((area) => (
                    <TouchableOpacity
                      key={area.id}
                      style={[
                        styles.areaChip,
                        area.id === areaId && styles.areaChipActive,
                      ]}
                      onPress={() => setAreaId(area.id)}
                    >
                      <Text
                        style={[
                          styles.areaChipText,
                          area.id === areaId && styles.areaChipTextActive,
                        ]}
                      >
                        {area.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
            {!canAddToLibro ? (
              <Text style={styles.createHint}>
                Tu Libro lo prepara tu hospital: este procedimiento se guardará
                en tus guardias, pero no se añadirá al Libro.
              </Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.createButton,
                (!trimmedCustom || creating) && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={
                !trimmedCustom || creating || (canAddToLibro && !areaId)
              }
              testID="procedure-create"
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Crear procedimiento</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default ProcedurePickerModal;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#1B0977" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  searchInput: { flex: 1, fontSize: 15, color: "#0F172A" },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  empty: {
    fontSize: 13,
    color: "#64748B",
    paddingVertical: 16,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#1B0977" },
  rowMeta: { fontSize: 12, color: "#64748B" },
  create: { marginTop: 22, gap: 10 },
  createTitle: { fontSize: 14, fontWeight: "800", color: "#1B0977" },
  createInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#0F172A",
  },
  areas: { gap: 6 },
  areasLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  areaChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  areaChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  areaChipActive: { borderColor: "#670CF5", backgroundColor: "#F1EBFF" },
  areaChipText: { fontSize: 13, color: "#475569" },
  areaChipTextActive: { color: "#670CF5", fontWeight: "700" },
  createHint: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  createButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
  },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
});
