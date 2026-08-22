import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Icon } from "../Icon";
import { COLORS } from "../../constants/colors";
import { LibroEditorScreen } from "./LibroEditorScreen";
import {
  CATEGORY_ICON_OPTIONS,
  COLOR_TOKEN_MAP,
  TRACKING_MODE_OPTIONS,
  getColorTokenOptions,
} from "../../data/libroOnboardingTemplates";

/**
 * La pantalla con la que el residente monta la estructura de su Libro propio: una
 * Rotación (nodo raíz) o un procedimiento dentro de ella (nodo hijo).
 *
 * Solo aparece en el Libro propio: la estructura de un Libro oficial la define el
 * tutor y no se toca desde la app (ADR 0007).
 */
export const LibroNodeFormScreen = ({
  onClose,
  onSubmit,
  existingNode = null,
  selectedParent = null,
  loading = false,
}) => {
  const [name, setName] = useState(existingNode?.name || "");
  const [goal, setGoal] = useState(existingNode?.goal?.toString() || "");
  const [selectedIcon, setSelectedIcon] = useState(
    existingNode?.icon_name || selectedParent?.icon_name || "folder-outline"
  );
  const [selectedColor, setSelectedColor] = useState(
    existingNode?.color_token || selectedParent?.color_token || "violet"
  );
  const [trackingMode, setTrackingMode] = useState(
    existingNode?.tracking_mode || "counter"
  );
  const colorOptions = getColorTokenOptions();

  // Al editar, el padre es el que ya tiene el nodo; al crear, el que se abrió desde
  // la tarjeta de la rotación.
  const parentNodeId = existingNode
    ? existingNode.parent_node_id || null
    : selectedParent?.id || null;
  const isChildNode = !!parentNodeId;
  const isEditing = !!existingNode;
  const accentColor = COLOR_TOKEN_MAP[selectedColor] || COLORS.PRIMARY;

  const title = isEditing
    ? isChildNode
      ? "Editar procedimiento"
      : "Editar rotación"
    : isChildNode
      ? "Nuevo procedimiento"
      : "Nueva rotación";

  const handleSubmit = () => {
    if (!name.trim()) return;

    const submitData = {
      name: name.trim(),
      parent_node_id: parentNodeId,
      icon_name: selectedIcon,
      color_token: selectedColor,
    };

    if (isChildNode) {
      const goalNum = goal.trim() ? parseInt(goal.trim(), 10) : null;
      if (goalNum && goalNum > 0) {
        submitData.goal = goalNum;
      } else if (existingNode && !goal.trim()) {
        submitData.goal = null;
      }

      submitData.tracking_mode = trackingMode;
    }

    onSubmit(submitData);
  };

  return (
    <LibroEditorScreen
      title={title}
      onClose={onClose}
      saving={loading}
      primaryLabel={isEditing ? "Guardar cambios" : "Crear"}
      primaryDisabled={!name.trim()}
      onPrimary={handleSubmit}
    >
      {!isChildNode ? (
        <View style={styles.heroCard}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Diseña una rotación clara</Text>
            <Text style={styles.heroText}>
              Crea una rotación fácil de reconocer para agrupar después los
              procedimientos de tu libro.
            </Text>
          </View>
          <View
            style={[styles.heroPreview, { backgroundColor: `${accentColor}14` }]}
          >
            <Icon name={selectedIcon} size={22} color={accentColor} />
          </View>
        </View>
      ) : null}

      {!isChildNode ? (
        <View style={styles.configBlock}>
          <Text style={styles.configTitle}>Nombre de la rotación</Text>
          <Text style={styles.configText}>
            Usa un nombre corto y reconocible, por ejemplo consultas, quirófano o
            urgencias.
          </Text>
          <View style={styles.fieldCompact}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              value={name}
              onChangeText={setName}
              placeholder="Ej: Consultas"
              placeholderTextColor="#94A3B8"
              autoFocus
            />
          </View>
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>Procedimiento *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Parto eutócico"
            placeholderTextColor="#94A3B8"
            autoFocus
          />
        </View>
      )}

      {isChildNode ? (
        <View style={styles.configBlock}>
          <Text style={styles.configTitle}>Configuración del procedimiento</Text>
          <Text style={styles.configText}>
            Ajusta el objetivo y cómo quieres registrar este procedimiento.
          </Text>

          <View style={styles.fieldCompact}>
            <Text style={styles.label}>Objetivo</Text>
            <TextInput
              style={styles.input}
              value={goal}
              onChangeText={(text) => setGoal(text.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="Ej: 50"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.helperText}>
              Déjalo vacío si no quieres marcar una meta para este procedimiento.
            </Text>
          </View>

          <View style={styles.fieldCompact}>
            <Text style={styles.label}>Tipo de registro</Text>
            <Text style={styles.helperTextTop}>
              Elige si este procedimiento se registra como contador, nota o checklist.
            </Text>
            <View style={styles.modeSelectorRow}>
              {TRACKING_MODE_OPTIONS.map((option) => {
                const isActive = trackingMode === option.id;

                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.modeSelectorButton,
                      isActive && styles.modeSelectorButtonActive,
                    ]}
                    onPress={() => setTrackingMode(option.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[
                        styles.modeSelectorText,
                        isActive && styles.modeSelectorTextActive,
                      ]}
                    >
                      {option.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.configBlock}>
          <Text style={styles.configTitle}>Identidad visual</Text>
          <Text style={styles.configText}>
            Elige un icono y un color que te permitan localizar esta rotación de un
            vistazo.
          </Text>

          <View style={styles.fieldCompact}>
            <Text style={styles.label}>Icono</Text>
            <View style={styles.iconGrid}>
              {CATEGORY_ICON_OPTIONS.map((option) => {
                const isActive = selectedIcon === option.id;

                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.iconOption,
                      isActive && {
                        borderColor: accentColor,
                        backgroundColor: `${accentColor}12`,
                      },
                    ]}
                    onPress={() => setSelectedIcon(option.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Icon
                      name={option.id}
                      size={18}
                      color={isActive ? accentColor : COLORS.GRAY_DARK}
                    />
                    <Text
                      style={[
                        styles.iconOptionLabel,
                        isActive && { color: accentColor },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldCompact}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {colorOptions.map((option) => {
                const isActive = selectedColor === option.id;

                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.colorSwatchWrap,
                      isActive && styles.colorSwatchWrapActive,
                    ]}
                    onPress={() => setSelectedColor(option.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <View
                      style={[styles.colorSwatch, { backgroundColor: option.hex }]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {!isChildNode ? (
        <View style={styles.helperBanner}>
          <Icon name="sparkles-outline" size={16} color={COLORS.PRIMARY} />
          <Text style={styles.helperBannerText}>
            Después podrás añadir dentro todos los procedimientos que necesites.
          </Text>
        </View>
      ) : null}
    </LibroEditorScreen>
  );
};

export default LibroNodeFormScreen;

const styles = StyleSheet.create({
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#F7F7FC",
    borderWidth: 1,
    borderColor: "#ECECF4",
  },
  heroTextWrap: { flex: 1 },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: "#22177A",
  },
  heroText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#718096",
  },
  heroPreview: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: 8 },
  fieldCompact: { marginTop: 16 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    backgroundColor: COLORS.WHITE,
  },
  nameInput: { fontSize: 18, fontWeight: "600" },
  helperText: { fontSize: 12, color: COLORS.GRAY, marginTop: 4 },
  helperTextTop: { fontSize: 12, color: COLORS.GRAY, marginBottom: 10 },
  configBlock: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#FAFBFF",
  },
  configTitle: { fontSize: 15, fontWeight: "700", color: COLORS.GRAY_DARK },
  configText: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iconOption: {
    width: "31%",
    minHeight: 76,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    backgroundColor: COLORS.WHITE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 8,
  },
  iconOptionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    textAlign: "center",
  },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatchWrap: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
  },
  colorSwatchWrapActive: { borderColor: COLORS.GRAY_DARK },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  modeSelectorRow: { flexDirection: "row", gap: 8 },
  modeSelectorButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: COLORS.GRAY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  modeSelectorButtonActive: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#D8B4FE",
  },
  modeSelectorText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  modeSelectorTextActive: { color: COLORS.PRIMARY },
  helperBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F5F3FF",
  },
  helperBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.GRAY_DARK,
  },
});
