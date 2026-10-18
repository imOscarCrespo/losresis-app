import React, { useMemo, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LibroEditorScreen } from "../LibroEditorScreen";
import { LibroAttachmentField } from "../LibroAttachmentField";
import { LibroDateField } from "../LibroDateField";
import {
  CUSTOM_SECTION_CODE,
  buildCustomFieldValues,
  formatCustomValue,
  liveFields,
  liveOptions,
  validateCustomEntry,
} from "../../../utils/libroCustom";

/**
 * El registro de un apartado personalizado: los campos que configuró el hospital,
 * con su tipo, sus opciones y su obligatoriedad. Crea o edita; en solo lectura (año
 * pasado, plan del tutor, apartado retirado) solo enseña.
 *
 * Los números se escriben como texto y se convierten al guardar, para que «1,5» o un
 * campo a medio escribir no se pierdan por el camino.
 */

const NUMERIC_TYPES = new Set(["integer", "decimal"]);

const toNumber = (text) => {
  if (text === undefined || text === null || String(text).trim() === "") return undefined;
  const parsed = Number(String(text).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
};

// Lo que se escribe a mano (números, horas, duraciones) vive como texto en `raw`.
const initialRaw = (fields, values) => {
  const raw = {};
  fields.forEach((field) => {
    const value = values[field.id];
    if (NUMERIC_TYPES.has(field.field_type) && typeof value === "number") {
      raw[field.id] = String(value).replace(".", ",");
    }
    if (field.field_type === "duration" && typeof value === "number") {
      raw[`${field.id}:h`] = String(Math.floor(value / 60));
      raw[`${field.id}:m`] = String(value % 60);
    }
    if (field.field_type === "datetime" && typeof value === "string") {
      const [date, time] = value.split("T");
      raw[`${field.id}:date`] = date || "";
      raw[`${field.id}:time`] = time || "";
    }
  });
  return raw;
};

export const LibroCustomEntryScreen = ({
  section,
  entry = null,
  activity = null,
  userId,
  readOnly = false,
  saving = false,
  onClose,
  onSave,
  onDelete,
}) => {
  const fields = useMemo(() => liveFields(section), [section]);
  const [values, setValues] = useState(() => ({ ...(entry?.field_values || {}) }));
  const [raw, setRaw] = useState(() => initialRaw(fields, entry?.field_values || {}));
  const [showErrors, setShowErrors] = useState(false);

  // Los valores tal como se guardarían: lo escrito a mano ya convertido.
  const resolved = useMemo(() => {
    const next = { ...values };
    fields.forEach((field) => {
      if (NUMERIC_TYPES.has(field.field_type)) {
        next[field.id] = toNumber(raw[field.id]);
      } else if (field.field_type === "duration") {
        const hours = toNumber(raw[`${field.id}:h`]);
        const minutes = toNumber(raw[`${field.id}:m`]);
        next[field.id] =
          hours === undefined && minutes === undefined
            ? undefined
            : Math.round((hours || 0) * 60 + (minutes || 0));
      } else if (field.field_type === "datetime") {
        const date = raw[`${field.id}:date`];
        const time = raw[`${field.id}:time`];
        next[field.id] = date || time ? `${date || ""}T${time || ""}` : undefined;
      }
    });
    return next;
  }, [values, raw, fields]);

  const errors = useMemo(() => validateCustomEntry(fields, resolved), [fields, resolved]);
  const errorFor = (fieldId) =>
    showErrors ? errors.find((error) => error.fieldId === fieldId)?.message : null;

  // Respuestas en campos que el hospital retiró: se leen, no se editan.
  const retiredAnswers = useMemo(
    () =>
      (section.fields || [])
        .filter((field) => field.archived_at)
        .map((field) => ({ field, text: formatCustomValue(field, entry?.field_values?.[field.id]) }))
        .filter((item) => item.text),
    [section, entry]
  );

  const setValue = (fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }));
  const setRawValue = (key, value) => setRaw((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (errors.length) {
      setShowErrors(true);
      Alert.alert(
        "Revisa el registro",
        errors.map((error) => error.message).join("\n")
      );
      return;
    }
    onSave?.(buildCustomFieldValues(fields, resolved, entry?.field_values));
  };

  const title = readOnly
    ? section.name
    : entry
      ? "Editar registro"
      : section.record_mode === "single_form"
        ? section.name
        : "Nuevo registro";

  const renderInput = (field) => {
    const value = values[field.id];

    if (readOnly) {
      return (
        <Text style={styles.readValue}>
          {formatCustomValue(field, resolved[field.id]) || "—"}
        </Text>
      );
    }

    switch (field.field_type) {
      case "long_text":
      case "short_text":
        return (
          <TextInput
            style={[styles.input, field.field_type === "long_text" && styles.inputMultiline]}
            value={value || ""}
            onChangeText={(text) => setValue(field.id, text)}
            placeholder={field.description || field.label}
            placeholderTextColor="#94A3B8"
            multiline={field.field_type === "long_text"}
            testID={`libro-custom-field-${field.label}`}
          />
        );
      case "integer":
      case "decimal":
        return (
          <View style={styles.inline}>
            <TextInput
              style={[styles.input, styles.inputNumber]}
              value={raw[field.id] || ""}
              onChangeText={(text) => setRawValue(field.id, text)}
              keyboardType={field.field_type === "integer" ? "number-pad" : "decimal-pad"}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              selectTextOnFocus
              testID={`libro-custom-field-${field.label}`}
            />
            {field.unit ? <Text style={styles.unit}>{field.unit}</Text> : null}
          </View>
        );
      case "scale": {
        const min = Number(field.min_value ?? 1);
        const max = Number(field.max_value ?? 5);
        const steps = [];
        for (let step = min; step <= max && steps.length <= 21; step += 1) steps.push(step);
        return (
          <View style={styles.choiceRow}>
            {steps.map((step) => {
              const active = value === step;
              return (
                <TouchableOpacity
                  key={step}
                  style={[styles.scaleChip, active && styles.choiceChipActive]}
                  onPress={() => setValue(field.id, active ? undefined : step)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                    {step}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }
      case "boolean":
        return (
          <View style={styles.choiceRow}>
            {[
              { label: "Sí", value: true },
              { label: "No", value: false },
            ].map((option) => {
              const active = value === option.value;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[styles.choiceChip, active && styles.choiceChipActive]}
                  onPress={() => setValue(field.id, active ? undefined : option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      case "single_choice":
      case "multi_choice": {
        const multiple = field.field_type === "multi_choice";
        const selected = multiple ? (Array.isArray(value) ? value : []) : value;
        return (
          <View style={styles.choiceRow}>
            {liveOptions(field).map((option) => {
              const active = multiple ? selected.includes(option.id) : selected === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.choiceChip, active && styles.choiceChipActive]}
                  onPress={() => {
                    if (multiple) {
                      setValue(
                        field.id,
                        active ? selected.filter((id) => id !== option.id) : [...selected, option.id]
                      );
                    } else {
                      setValue(field.id, active ? undefined : option.id);
                    }
                  }}
                  accessibilityRole={multiple ? "checkbox" : "radio"}
                  accessibilityState={{ selected: active, checked: active }}
                >
                  <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }
      case "time":
        return (
          <TextInput
            style={[styles.input, styles.inputNumber]}
            value={value || ""}
            onChangeText={(text) => setValue(field.id, text.trim())}
            placeholder="HH:MM"
            placeholderTextColor="#94A3B8"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        );
      case "datetime":
        return (
          <View style={styles.stack}>
            <LibroDateField
              label="Día"
              value={raw[`${field.id}:date`] || ""}
              onChange={(next) => setRawValue(`${field.id}:date`, next)}
            />
            <TextInput
              style={[styles.input, styles.inputNumber]}
              value={raw[`${field.id}:time`] || ""}
              onChangeText={(text) => setRawValue(`${field.id}:time`, text.trim())}
              placeholder="HH:MM"
              placeholderTextColor="#94A3B8"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        );
      case "duration":
        return (
          <View style={styles.inline}>
            <TextInput
              style={[styles.input, styles.inputShort]}
              value={raw[`${field.id}:h`] || ""}
              onChangeText={(text) => setRawValue(`${field.id}:h`, text)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              selectTextOnFocus
            />
            <Text style={styles.unit}>h</Text>
            <TextInput
              style={[styles.input, styles.inputShort]}
              value={raw[`${field.id}:m`] || ""}
              onChangeText={(text) => setRawValue(`${field.id}:m`, text)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              selectTextOnFocus
            />
            <Text style={styles.unit}>min</Text>
          </View>
        );
      case "attachment":
      case "image":
        return (
          <LibroAttachmentField
            value={value}
            userId={userId}
            section={CUSTOM_SECTION_CODE}
            imagesOnly={field.field_type === "image"}
            onChange={(next) => setValue(field.id, next)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <LibroEditorScreen
      title={title}
      onClose={onClose}
      saving={saving}
      primaryLabel={readOnly ? "Volver" : "Guardar"}
      onPrimary={readOnly ? onClose : handleSave}
      destructiveLabel={!readOnly && entry ? "Eliminar registro" : null}
      onDestructive={
        !readOnly && entry
          ? () =>
              Alert.alert("Eliminar registro", "Se borrará de tu libro. No se puede deshacer.", [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: () => onDelete?.(entry) },
              ])
          : null
      }
    >
      {activity ? (
        <View style={styles.activityBanner}>
          <Text style={styles.activityLabel}>Actividad</Text>
          <Text style={styles.activityName}>{activity.name}</Text>
        </View>
      ) : null}

      {fields.length === 0 && !readOnly ? (
        <Text style={styles.hint}>
          Este apartado no pide datos: al guardar queda registrado con la fecha de hoy.
        </Text>
      ) : null}

      {fields.map((field) => {
        const error = errorFor(field.id);
        return (
          <View key={field.id} style={styles.field}>
            {field.field_type === "date" && !readOnly ? (
              <LibroDateField
                label={field.label}
                required={field.required}
                value={values[field.id] || ""}
                onChange={(next) => setValue(field.id, next)}
              />
            ) : (
              <>
                <Text style={styles.fieldLabel}>
                  {field.label}
                  {field.required && !readOnly ? " *" : ""}
                </Text>
                {field.description && !readOnly ? (
                  <Text style={styles.fieldHelp}>{field.description}</Text>
                ) : null}
                {renderInput(field)}
              </>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        );
      })}

      {retiredAnswers.length ? (
        <View style={styles.retired}>
          <Text style={styles.retiredTitle}>Campos que tu hospital ya no pide</Text>
          {retiredAnswers.map(({ field, text }) => (
            <Text key={field.id} style={styles.retiredText}>
              {`${field.label}: ${text}`}
            </Text>
          ))}
        </View>
      ) : null}
    </LibroEditorScreen>
  );
};

export default LibroCustomEntryScreen;

const styles = StyleSheet.create({
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  fieldHelp: { fontSize: 12, color: "#94A3B8" },
  readValue: { fontSize: 14, color: "#0F172A" },
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
  inputNumber: { minWidth: 110 },
  inputShort: { width: 72, textAlign: "center" },
  inline: { flexDirection: "row", alignItems: "center", gap: 8 },
  stack: { gap: 8 },
  unit: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  scaleChip: {
    minWidth: 42,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  choiceChipActive: { backgroundColor: "#F5F3FF", borderColor: "#670CF5" },
  choiceChipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  choiceChipTextActive: { color: "#670CF5" },
  error: { fontSize: 12, fontWeight: "600", color: "#DC2626" },
  hint: { fontSize: 13, color: "#64748B", lineHeight: 19 },
  activityBanner: {
    gap: 2,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F5F3FF",
  },
  activityLabel: { fontSize: 11, fontWeight: "700", color: "#6D28D9", textTransform: "uppercase" },
  activityName: { fontSize: 15, fontWeight: "700", color: "#1B0977" },
  retired: { gap: 4, padding: 12, borderRadius: 14, backgroundColor: "#F8FAFC" },
  retiredTitle: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  retiredText: { fontSize: 13, color: "#475569" },
});
