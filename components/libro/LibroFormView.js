import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";
import {
  getLibroFormFields,
  getLibroSectionChildLabel,
} from "../../data/libroSections";
import { describeLibroAttachment } from "../../services/libroAttachmentService";
import { formatLibroDate } from "./LibroDateField";

/**
 * Arquetipo `form`: el tutor no define contenido, solo qué campos pide; las filas
 * las crea el residente. Cursos, Congresos, Sesiones clínicas e Investigación.
 *
 * El formulario se construye desde libro_template_block.config, que se lee EN VIVO
 * de la plantilla: si el tutor activa un campo, aparece aquí sin resembrar nada. Por
 * eso la app no guarda estructuras fijas para estos apartados.
 *
 * Los condicionales son parte del contrato con el panel: "Trabajo presentado" solo
 * si participa presentando, el adjunto de una sesión solo si es Presentador.
 *
 * La fila se rellena en una PANTALLA (LibroFormEntryScreen), no en un modal: aquí
 * solo se lista lo que ya hay y se avisa al Libro de cuál se ha abierto.
 */

export const LibroFormView = ({
  section,
  config,
  entries = [],
  loading = false,
  readOnly = false,
  onCreateEntry,
  onOpenEntry,
}) => {
  const fields = useMemo(() => getLibroFormFields(section, config), [section, config]);
  const childLabel = getLibroSectionChildLabel(section);

  // Las columnas del listado salen de los campos activos, igual que la
  // previsualización del panel: activar un campo lo añade, desactivarlo lo quita.
  const summaryFields = fields
    .filter((field) => field.key !== "title" && field.type !== "textarea")
    .slice(0, 3);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#670CF5" />
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {!readOnly ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => onCreateEntry?.()}
          activeOpacity={0.85}
        >
          <Icon name="add" size={16} color="#670CF5" />
          <Text style={styles.addButtonText}>{`Añadir ${childLabel}`}</Text>
        </TouchableOpacity>
      ) : null}

      {entries.length ? (
        entries.map((entry) => {
          const payload = entry.payload || {};
          const summary = summaryFields
            .map((field) => {
              const raw = payload[field.key];
              if (!raw) return null;
              // Un adjunto se resume por su nombre; imprimir el objeto daría
              // "[object Object]".
              if (typeof raw === "object") {
                return describeLibroAttachment(raw)?.name;
              }
              // La fecha se guarda como AAAA-MM-DD pero se lee en cristiano, igual
              // que en el calendario con el que se eligió.
              return field.type === "date" ? formatLibroDate(raw) || raw : raw;
            })
            .filter(Boolean)
            .join(" · ");

          return (
            <TouchableOpacity
              key={entry.id}
              style={styles.item}
              onPress={() => (readOnly ? null : onOpenEntry?.(entry))}
              activeOpacity={readOnly ? 1 : 0.85}
            >
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>
                  {payload.title || `Sin título`}
                </Text>
                {summary ? (
                  <Text style={styles.itemMeta} numberOfLines={2}>
                    {summary}
                  </Text>
                ) : null}
              </View>
              {!readOnly ? (
                <Icon name="chevron-forward" size={16} color="#94A3B8" />
              ) : null}
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.empty}>
          <Icon name="document-text-outline" size={22} color="#670CF5" />
          <Text style={styles.emptyTitle}>{`Sin ${childLabel}s todavía`}</Text>
          <Text style={styles.emptyText}>
            {readOnly
              ? "No hay nada registrado en este apartado."
              : `Añade tu primer ${childLabel} y aparecerá aquí.`}
          </Text>
        </View>
      )}
    </View>
  );
};

export default LibroFormView;

const styles = StyleSheet.create({
  loading: { paddingVertical: 28, alignItems: "center" },
  list: { gap: 8 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    backgroundColor: "#F5F3FF",
  },
  addButtonText: { fontSize: 14, fontWeight: "700", color: "#670CF5" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  itemCopy: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  itemMeta: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  empty: {
    alignItems: "center",
    gap: 8,
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#1B0977" },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
});
