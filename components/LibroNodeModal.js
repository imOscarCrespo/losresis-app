import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Icon } from "./Icon";
import { COLORS } from "../constants/colors";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenScaffold } from "./ScreenScaffold";
import {
  CATEGORY_ICON_OPTIONS,
  COLOR_TOKEN_MAP,
  TRACKING_MODE_OPTIONS,
  getColorTokenOptions,
} from "../data/libroOnboardingTemplates";

/**
 * Modal para agregar o editar un nodo del libro
 * @param {Object} props
 * @param {boolean} props.visible - Si el modal es visible
 * @param {function} props.onClose - Callback para cerrar el modal
 * @param {function} props.onSubmit - Callback al enviar (recibe { name, parent_node_id })
 * @param {Object} props.existingNode - Nodo existente para editar (opcional)
 * @param {Array} props.parentNodes - Lista de nodos padre disponibles (opcional)
 * @param {Object} props.selectedParent - Padre preseleccionado para crear hijo (opcional)
 * @param {boolean} props.loading - Si está cargando
 */
export const LibroNodeModal = ({
  visible,
  onClose,
  onSubmit,
  existingNode = null,
  parentNodes = [],
  selectedParent = null,
  loading = false,
  asScreen = false,
}) => {
  const [name, setName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [goal, setGoal] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("folder-outline");
  const [selectedColor, setSelectedColor] = useState("violet");
  const [trackingMode, setTrackingMode] = useState("counter");
  const colorOptions = getColorTokenOptions();

  useEffect(() => {
    if (existingNode) {
      setName(existingNode.name || "");
      setSelectedParentId(existingNode.parent_node_id || null);
      setGoal(existingNode.goal?.toString() || "");
      setSelectedIcon(existingNode.icon_name || "folder-outline");
      setSelectedColor(existingNode.color_token || "violet");
      setTrackingMode(existingNode.tracking_mode || "counter");
    } else {
      setName("");
      setSelectedParentId(selectedParent?.id || null);
      setGoal("");
      setSelectedIcon(selectedParent?.icon_name || "folder-outline");
      setSelectedColor(selectedParent?.color_token || "violet");
      setTrackingMode("counter");
    }
  }, [existingNode, selectedParent, visible]);

  const isChildNode = !!(selectedParentId || existingNode?.parent_node_id);
  const isEditing = !!existingNode;
  const modalTitle = isEditing
    ? isChildNode
      ? "Editar procedimiento"
      : "Editar rotación"
    : isChildNode
      ? "Nuevo procedimiento"
      : "Nueva rotación";
  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }

    const submitData = {
      name: name.trim(),
      parent_node_id: existingNode
        ? existingNode.parent_node_id
        : selectedParentId,
    };

    // Si tiene un padre (es un hijo), incluir el goal
    const isChild = existingNode
      ? existingNode.parent_node_id
      : selectedParentId;

    if (isChild) {
      const goalNum = goal.trim() ? parseInt(goal.trim(), 10) : null;
      if (goalNum && goalNum > 0) {
        submitData.goal = goalNum;
      } else if (existingNode && !goal.trim()) {
        submitData.goal = null;
      }

      submitData.icon_name = selectedIcon;
      submitData.color_token = selectedColor;
      submitData.tracking_mode = trackingMode;
    } else {
      submitData.icon_name = selectedIcon;
      submitData.color_token = selectedColor;
    }

    onSubmit(submitData);
  };

  const handleClose = () => {
    setName("");
    setSelectedParentId(null);
    setGoal("");
    setSelectedIcon("folder-outline");
    setSelectedColor("violet");
    setTrackingMode("counter");
    onClose();
  };

  const formBody = (
    <>
      <ScrollView
        style={styles.form}
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        {!isChildNode ? (
          <View style={styles.categoryHeroCard}>
            <View style={styles.categoryHeroTextWrap}>
              <Text style={styles.categoryHeroTitle}>Diseña una rotación clara</Text>
              <Text style={styles.categoryHeroText}>
                Crea una rotación fácil de reconocer para agrupar después los procedimientos de tu libro.
              </Text>
            </View>
            <View
              style={[
                styles.categoryHeroPreview,
                { backgroundColor: `${COLOR_TOKEN_MAP[selectedColor] || COLORS.PRIMARY}14` },
              ]}
            >
              <Icon
                name={selectedIcon}
                size={22}
                color={COLOR_TOKEN_MAP[selectedColor] || COLORS.PRIMARY}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.field}>
          {!isChildNode ? (
            <View style={styles.configBlock}>
              <Text style={styles.configTitle}>Nombre de la rotación</Text>
              <Text style={styles.configText}>
                Usa un nombre corto y reconocible, por ejemplo consultas, quirófano o urgencias.
              </Text>
              <View style={styles.fieldCompact}>
                <TextInput
                  style={[styles.input, styles.categoryNameInput]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej: Consultas"
                  autoFocus
                />
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Procedimiento *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Parto eutócico"
                autoFocus
              />
            </>
          )}
        </View>

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
                onChangeText={(text) => {
                  const numericValue = text.replace(/[^0-9]/g, "");
                  setGoal(numericValue);
                }}
                keyboardType="number-pad"
                placeholder="Ej: 50"
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
                      style={[styles.modeSelectorButton, isActive && styles.modeSelectorButtonActive]}
                      onPress={() => setTrackingMode(option.id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[styles.modeSelectorText, isActive && styles.modeSelectorTextActive]}
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
              Elige un icono y un color que te permitan localizar esta rotación de un vistazo.
            </Text>

            <View style={styles.fieldCompact}>
              <Text style={styles.label}>Icono</Text>
              <View style={styles.iconGrid}>
                {CATEGORY_ICON_OPTIONS.map((option) => {
                  const isActive = selectedIcon === option.id;
                  const accentColor = COLOR_TOKEN_MAP[selectedColor] || COLORS.PRIMARY;

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
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!name.trim() || loading) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!name.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.WHITE} />
          ) : (
            <Text style={styles.submitButtonText}>
              {isEditing ? "Guardar cambios" : "Crear"}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  if (!visible) return null;

  if (asScreen) {
    return (
      <ScreenScaffold
        style={styles.screenContainer}
        header={
          <ScreenHeader
            title={modalTitle}
            onBack={handleClose}
            compact
            variant="brand"
          />
        }
        headerShellVariant="brand"
        contentSurfaceStyle={styles.screenContent}
        keyboardAvoiding
        keyboardBehavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {formBody}
      </ScreenScaffold>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{modalTitle}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Icon name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>
          {formBody}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  screenContent: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  overlayTouchable: {
    flex: 1,
  },
  content: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "50%",
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  form: {
    flex: 1,
    maxHeight: "100%",
  },
  formContent: {
    padding: 20,
  },
  categoryHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#F7F7FC",
    borderWidth: 1,
    borderColor: "#ECECF4",
    marginBottom: 20,
  },
  categoryHeroTextWrap: {
    flex: 1,
  },
  categoryHeroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#22177A",
  },
  categoryHeroText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 24,
    color: "#718096",
  },
  categoryHeroPreview: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    marginBottom: 20,
  },
  fieldCompact: {
    marginTop: 16,
  },
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
  categoryNameInput: {
    fontSize: 18,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  helperTextTop: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginBottom: 10,
  },
  configBlock: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#FAFBFF",
    marginBottom: 20,
  },
  configTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
  },
  configText: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
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
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorSwatchWrap: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
  },
  colorSwatchWrapActive: {
    borderColor: COLORS.GRAY_DARK,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  modeSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
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
  modeSelectorTextActive: {
    color: COLORS.PRIMARY,
  },
  helperBlock: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.GRAY,
    marginTop: -4,
    marginBottom: 8,
  },
  helperBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F5F3FF",
    marginTop: -4,
    marginBottom: 8,
  },
  helperBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.GRAY_DARK,
  },
  parentOptionText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
  },
  parentOptionTextSelected: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  submitButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.GRAY_MEDIUM,
  },
  submitButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: COLORS.GRAY_DARK,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default LibroNodeModal;
