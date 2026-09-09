import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LibroEditorScreen } from "./LibroEditorScreen";
import { getLibroSectionChildLabel } from "../../data/libroSections";

/**
 * La pantalla con la que el residente monta la LISTA de un apartado `itinerary` de su
 * Libro propio: una rotación o una competencia.
 *
 * Solo existe en el Libro propio. En el Libro oficial la lista es del tutor y no se
 * toca desde la app (ADR 0007), así que el Libro ni siquiera ofrece abrir esto.
 *
 * Es la hermana de LibroFichaScreen y no la misma pantalla a propósito: aquí se
 * declara QUÉ es el elemento (lo que en un libro oficial escribe el tutor desde el
 * panel), y allí se anota CÓMO le ha ido al residente. Mezclarlas dejaría al
 * residente de libro oficial viendo campos que no puede tocar.
 *
 * Los campos son los mismos que el panel ofrece al tutor, para que las dos listas se
 * lean igual: nombre, descripción y —solo en Rotaciones— centro y duración prevista.
 */

const DURATION_UNITS = [
  { id: "months", label: "Meses" },
  { id: "weeks", label: "Semanas" },
];

export const LibroItineraryItemScreen = ({
  section,
  item = null,
  saving = false,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [center, setCenter] = useState(item?.center || "");
  const [durationAmount, setDurationAmount] = useState(
    item?.duration_amount ? String(item.duration_amount) : ""
  );
  const [durationUnit, setDurationUnit] = useState(
    item?.duration_unit || "months"
  );

  const childLabel = getLibroSectionChildLabel(section);
  const isEditing = !!item;
  // Centro y duración son de una rotación: una competencia no se hace en ningún
  // sitio ni dura un número de meses.
  const hasPlacement = section === "rotations";

  const handleSave = () => {
    if (!name.trim()) return;

    const amount = durationAmount.trim()
      ? parseInt(durationAmount.trim(), 10)
      : null;

    onSave?.({
      name,
      description,
      center: hasPlacement ? center : null,
      durationAmount: hasPlacement && amount > 0 ? amount : null,
      durationUnit: hasPlacement ? durationUnit : null,
    });
  };

  return (
    <LibroEditorScreen
      title={isEditing ? `Editar ${childLabel}` : `Nueva ${childLabel}`}
      onClose={onClose}
      saving={saving}
      primaryLabel={isEditing ? "Guardar cambios" : "Añadir"}
      primaryDisabled={!name.trim()}
      onPrimary={handleSave}
      destructiveLabel={isEditing ? `Eliminar ${childLabel}` : null}
      onDestructive={isEditing ? () => onDelete?.(item) : null}
    >
      <View style={styles.field}>
        <Text style={styles.label}>
          {section === "rotations" ? "Nombre de la rotación" : "Competencia"}
        </Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={
            section === "rotations"
              ? "Ej: Urgencias"
              : "Ej: Manejo de la vía aérea"
          }
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Qué incluye y qué esperas sacar de aquí"
          placeholderTextColor="#94A3B8"
          multiline
        />
      </View>

      {hasPlacement ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Centro o servicio previsto</Text>
            <TextInput
              style={styles.input}
              value={center}
              onChangeText={setCenter}
              placeholder="Dónde está previsto que la hagas"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Duración prevista</Text>
            <View style={styles.durationRow}>
              <TextInput
                style={[styles.input, styles.durationInput]}
                value={durationAmount}
                onChangeText={setDurationAmount}
                placeholder="2"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />
              <View style={styles.unitRow}>
                {DURATION_UNITS.map((unit) => {
                  const active = durationUnit === unit.id;
                  return (
                    <TouchableOpacity
                      key={unit.id}
                      style={[styles.unitChip, active && styles.unitChipActive]}
                      onPress={() => setDurationUnit(unit.id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.unitChipText,
                          active && styles.unitChipTextActive,
                        ]}
                      >
                        {unit.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Text style={styles.hint}>
              Opcional. Es lo previsto: las fechas reales las anotas después en la
              ficha.
            </Text>
          </View>
        </>
      ) : null}
    </LibroEditorScreen>
  );
};

export default LibroItineraryItemScreen;

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: "#1B0977" },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1B0977",
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  durationInput: { width: 84, textAlign: "center" },
  unitRow: { flexDirection: "row", gap: 8, flex: 1 },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    backgroundColor: "#FFFFFF",
  },
  unitChipActive: { borderColor: "#670CF5", backgroundColor: "#F5F3FF" },
  unitChipText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  unitChipTextActive: { color: "#670CF5" },
  hint: { fontSize: 12, color: "#94A3B8", lineHeight: 17 },
});
