import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../../Icon";
import { COLOR_TOKEN_MAP } from "../../../data/libroOnboardingTemplates";
import {
  activityTree,
  canAddCustomEntry,
  customSectionCounts,
  formatCustomValue,
  liveFields,
} from "../../../utils/libroCustom";
import { formatLibroDate } from "../LibroDateField";

/**
 * Un apartado personalizado del Libro oficial: lo diseñó el hospital en el panel y
 * el residente solo registra dentro (no toca su estructura). Se pinta según el modo
 * de registro que eligió el hospital:
 *
 *   free           «Añadir registro» y la lista de lo registrado.
 *   single_form    Un único formulario: completarlo o editarlo.
 *   activity_list  La lista del hospital; se registra en cada actividad.
 *   quantitative   Contadores (+/−) por actividad o del apartado entero.
 *   grouped        Lo mismo que la lista, agrupado.
 */

const ProgressBar = ({ current, goal, color }) => (
  <View style={styles.progress}>
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.min(100, (current / goal) * 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
    <Text style={styles.progressText}>{`${current}/${goal}`}</Text>
  </View>
);

/** Título y detalle de un registro en la lista: lo que el residente reconoce. */
const describeEntry = (entry, fields, activityName) => {
  const texts = fields
    .map((field) => ({ field, text: formatCustomValue(field, entry.field_values?.[field.id]) }))
    .filter((item) => item.text && item.field.field_type !== "date");
  const title = activityName || texts[0]?.text || "Registro";
  const detail = (activityName ? texts : texts.slice(1))
    .slice(0, 2)
    .map((item) => `${item.field.label}: ${item.text}`)
    .join(" · ");
  return { title, detail };
};

export const LibroCustomSectionView = ({
  section,
  entries = [],
  loading = false,
  readOnly = false,
  busyActivityId = null,
  onCreateEntry,
  onOpenEntry,
  onIncrement,
  onDecrement,
}) => {
  const color = COLOR_TOKEN_MAP[section.color_token] || "#670CF5";
  const fields = useMemo(() => liveFields(section), [section]);
  // Los nombres de actividad, también de las retiradas: un registro viejo los usa.
  const activityNames = useMemo(
    () => new Map((section.activities || []).map((activity) => [activity.id, activity.name])),
    [section]
  );
  const tree = useMemo(() => activityTree(section), [section]);
  const { total, byActivity } = customSectionCounts(entries);
  const retired = !!section.archived_at;
  const mode = section.record_mode;
  const hasActivities = tree.length > 0;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#670CF5" />
      </View>
    );
  }

  const renderActivity = (activity) => {
    const count = byActivity.get(activity.id) || 0;
    const entriesForActivity = entries.filter((entry) => entry.activity_id === activity.id);
    const canAdd = canAddCustomEntry(section, entriesForActivity, activity.id);
    const busy = busyActivityId === activity.id;

    return (
      <View key={activity.id} style={styles.activityRow}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityName} numberOfLines={2}>
            {activity.name}
          </Text>
          {readOnly ? (
            <Text style={styles.activityCount}>{count}</Text>
          ) : mode === "quantitative" ? (
            <View style={styles.counter}>
              <TouchableOpacity
                style={[styles.counterButton, (count === 0 || busy) && styles.counterButtonDisabled]}
                onPress={() => onDecrement?.(activity.id)}
                disabled={count === 0 || busy}
                accessibilityLabel={`Quitar uno en ${activity.name}`}
              >
                <Icon name="remove" size={16} color={count === 0 ? "#CBD5E1" : "#1B0977"} />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{count}</Text>
              <TouchableOpacity
                style={[styles.counterButton, { backgroundColor: color }]}
                onPress={() => onIncrement?.(activity.id)}
                disabled={busy}
                accessibilityLabel={`Sumar uno en ${activity.name}`}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Icon name="add" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          ) : canAdd ? (
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => onCreateEntry?.(activity.id)}
              accessibilityRole="button"
            >
              <Icon name="add" size={14} color={color} />
              <Text style={[styles.registerText, { color }]}>Registrar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.doneChip}
              onPress={() => onOpenEntry?.(entriesForActivity[0])}
              accessibilityRole="button"
            >
              <Icon name="checkmark-circle" size={14} color="#059669" />
              <Text style={styles.doneText}>Completado</Text>
            </TouchableOpacity>
          )}
        </View>
        {activity.goal ? <ProgressBar current={count} goal={activity.goal} color={color} /> : null}
      </View>
    );
  };

  const showEntryList = mode !== "quantitative" || fields.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={[styles.headerIcon, { backgroundColor: `${color}1A` }]}>
          <Icon name={section.icon_name || "book-outline"} size={22} color={color} />
        </View>
        {section.description ? (
          <Text style={styles.description}>{section.description}</Text>
        ) : null}
        {section.goal ? (
          <View style={styles.sectionGoal}>
            <Text style={styles.sectionGoalLabel}>{`Objetivo: ${section.goal}`}</Text>
            <ProgressBar current={total} goal={section.goal} color={color} />
          </View>
        ) : null}
      </View>

      {retired ? (
        <View style={styles.notice}>
          <Icon name="lock-closed-outline" size={14} color="#64748B" />
          <Text style={styles.noticeText}>
            Tu hospital retiró este apartado de la plantilla. Lo que registraste se conserva, pero ya no admite registros nuevos.
          </Text>
        </View>
      ) : null}

      {!readOnly && (mode === "free" || (mode === "single_form" && entries.length === 0)) ? (
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: color }]}
          onPress={() => onCreateEntry?.(null)}
          activeOpacity={0.85}
          testID="libro-custom-add-entry"
        >
          <Icon name="add" size={16} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {mode === "single_form" ? "Completar formulario" : "Añadir registro"}
          </Text>
        </TouchableOpacity>
      ) : null}

      {mode === "quantitative" && !hasActivities ? (
        <View style={styles.activityRow}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityName}>Registros</Text>
            {readOnly ? (
              <Text style={styles.activityCount}>{total}</Text>
            ) : (
              <View style={styles.counter}>
                <TouchableOpacity
                  style={[styles.counterButton, total === 0 && styles.counterButtonDisabled]}
                  onPress={() => onDecrement?.(null)}
                  disabled={total === 0 || busyActivityId === "section"}
                  accessibilityLabel="Quitar uno"
                >
                  <Icon name="remove" size={16} color={total === 0 ? "#CBD5E1" : "#1B0977"} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{total}</Text>
                <TouchableOpacity
                  style={[styles.counterButton, { backgroundColor: color }]}
                  onPress={() => onIncrement?.(null)}
                  disabled={busyActivityId === "section"}
                  accessibilityLabel="Sumar uno"
                >
                  <Icon name="add" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {mode === "grouped"
        ? tree.map((group) => (
            <View key={group.id} style={styles.group}>
              <Text style={styles.groupTitle}>{`${group.name} · ${group.children.length}`}</Text>
              {group.children.map(renderActivity)}
            </View>
          ))
        : mode === "activity_list" || mode === "quantitative"
          ? tree.map(renderActivity)
          : null}

      {showEntryList && entries.length > 0 ? (
        <View style={styles.entries}>
          {mode !== "free" && mode !== "single_form" ? (
            <Text style={styles.entriesLabel}>Últimos registros</Text>
          ) : null}
          {entries.map((entry) => {
            const { title, detail } = describeEntry(
              entry,
              fields,
              entry.activity_id ? activityNames.get(entry.activity_id) : null
            );
            return (
              <TouchableOpacity
                key={entry.id}
                style={styles.entryCard}
                onPress={() => onOpenEntry?.(entry)}
                activeOpacity={0.85}
              >
                <View style={styles.entryCopy}>
                  {entry.performed_at ? (
                    <Text style={styles.entryDate}>{formatLibroDate(entry.performed_at)}</Text>
                  ) : null}
                  <Text style={styles.entryTitle} numberOfLines={1}>
                    {entry.count > 1 ? `${title} (×${entry.count})` : title}
                  </Text>
                  {detail ? (
                    <Text style={styles.entryDetail} numberOfLines={1}>
                      {detail}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {entries.length === 0 && (readOnly || mode === "free") && !hasActivities ? (
        <Text style={styles.empty}>
          {readOnly ? "Sin registros en este apartado." : "Todavía no has registrado nada aquí."}
        </Text>
      ) : null}
    </View>
  );
};

export default LibroCustomSectionView;

const styles = StyleSheet.create({
  container: { gap: 10 },
  loading: { paddingVertical: 30, alignItems: "center" },
  headerCard: {
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  description: { fontSize: 13, color: "#475569", textAlign: "center", lineHeight: 19 },
  sectionGoal: { alignSelf: "stretch", gap: 4 },
  sectionGoalLabel: { fontSize: 12, fontWeight: "700", color: "#1B0977" },
  notice: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  noticeText: { flex: 1, fontSize: 12, color: "#475569", lineHeight: 17 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryButtonText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  group: { gap: 8 },
  groupTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 6,
  },
  activityRow: {
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  activityHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  activityName: { flex: 1, fontSize: 14, fontWeight: "700", color: "#1B0977" },
  activityCount: { fontSize: 14, fontWeight: "700", color: "#475569" },
  counter: { flexDirection: "row", alignItems: "center", gap: 8 },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  counterButtonDisabled: { opacity: 0.5 },
  counterValue: { minWidth: 24, textAlign: "center", fontSize: 15, fontWeight: "800", color: "#1B0977" },
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F5F3FF",
  },
  registerText: { fontSize: 13, fontWeight: "700" },
  doneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
  },
  doneText: { fontSize: 12, fontWeight: "700", color: "#059669" },
  progress: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#F1F5F9", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  entries: { gap: 8 },
  entriesLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 6,
  },
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  entryCopy: { flex: 1, gap: 2 },
  entryDate: { fontSize: 11, color: "#64748B" },
  entryTitle: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  entryDetail: { fontSize: 12, color: "#64748B" },
  empty: { fontSize: 13, color: "#64748B", textAlign: "center", paddingVertical: 12 },
});
