import React, { useMemo, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LibroEditorScreen } from "./LibroEditorScreen";
import { LibroAttachmentField } from "./LibroAttachmentField";
import { LibroDateField } from "./LibroDateField";
import {
  getLibroSectionChildLabel,
  isLibroFormFieldVisible,
} from "../../data/libroSections";

/**
 * La pantalla con la que el residente crea o edita una fila de un apartado del
 * arquetipo `form`: un curso, una aportación a un congreso, una sesión clínica, un
 * trabajo de investigación.
 *
 * Los campos NO están escritos aquí: salen de `libro_template_block.config`, o sea de
 * lo que el tutor haya activado en la Plantilla del Libro. Los condicionales son parte
 * de ese contrato ("Trabajo presentado" solo si participa presentando).
 */
export const LibroFormEntryScreen = ({
  section,
  fields = [],
  entry = null,
  userId,
  saving = false,
  onClose,
  onSave,
  onDelete,
}) => {
  const [values, setValues] = useState(() => entry?.payload || {});

  const visibleFields = useMemo(
    () => fields.filter((field) => isLibroFormFieldVisible(field, values)),
    [fields, values]
  );

  // Un adjunto es un objeto, así que no vale mirar .trim() sobre el valor: se
  // comprueba que haya algo, no que el texto no esté vacío.
  const missingRequired = visibleFields
    .filter((field) => field.required)
    .filter((field) =>
      field.type === "attachment"
        ? !values[field.key]
        : !String(values[field.key] || "").trim()
    );

  const childLabel = getLibroSectionChildLabel(section);

  const setValue = (key, value) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <LibroEditorScreen
      title={entry ? `Editar ${childLabel}` : `Añadir ${childLabel}`}
      onClose={onClose}
      saving={saving}
      primaryLabel={
        missingRequired.length
          ? `Falta ${missingRequired[0].label.toLowerCase()}`
          : "Guardar"
      }
      primaryDisabled={!!missingRequired.length}
      onPrimary={() => onSave?.(values)}
      destructiveLabel={entry ? `Eliminar ${childLabel}` : null}
      onDestructive={
        entry
          ? () =>
              Alert.alert(
                `Eliminar ${childLabel}`,
                "Se borrará de tu libro. No se puede deshacer.",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: () => onDelete?.(entry),
                  },
                ]
              )
          : null
      }
    >
      {visibleFields.map((field) => (
        <View key={field.key} style={styles.field}>
          {field.type === "date" ? (
            <LibroDateField
              label={field.label}
              required={field.required}
              value={values[field.key] || ""}
              onChange={(next) => setValue(field.key, next)}
            />
          ) : (
            <>
              <Text style={styles.fieldLabel}>
                {field.label}
                {field.required ? " *" : ""}
              </Text>

              {field.type === "choice" ? (
                <View style={styles.choiceRow}>
                  {(field.choices || []).map((choice) => {
                    const active = values[field.key] === choice;
                    return (
                      <TouchableOpacity
                        key={choice}
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                        onPress={() => setValue(field.key, choice)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text
                          style={[
                            styles.choiceChipText,
                            active && styles.choiceChipTextActive,
                          ]}
                        >
                          {choice}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : field.type === "attachment" ? (
                // Sube de verdad al bucket privado, y su tutor lo puede abrir con la
                // política de alcance de Docencia: el adjunto es la PRUEBA de lo que
                // el residente declara, no una nota para él mismo.
                <LibroAttachmentField
                  value={values[field.key]}
                  userId={userId}
                  section={section}
                  onChange={(next) => setValue(field.key, next)}
                />
              ) : (
                <TextInput
                  style={[
                    styles.input,
                    field.type === "textarea" && styles.inputMultiline,
                  ]}
                  value={values[field.key] || ""}
                  onChangeText={(text) => setValue(field.key, text)}
                  placeholder={field.label}
                  placeholderTextColor="#94A3B8"
                  multiline={field.type === "textarea"}
                />
              )}
            </>
          )}
        </View>
      ))}
    </LibroEditorScreen>
  );
};

export default LibroFormEntryScreen;

const styles = StyleSheet.create({
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  inputMultiline: { minHeight: 110, textAlignVertical: "top" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  choiceChipActive: { backgroundColor: "#F5F3FF", borderColor: "#670CF5" },
  choiceChipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  choiceChipTextActive: { color: "#670CF5" },
});
