import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { HeroScreenLayout } from "../../HeroScreenLayout";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { ResiNotesSheet, SheetOption } from "../ResiNotesSheet";
import {
  flashcardErrorMessage,
  getReviewPreferences,
  resetSchedules,
  saveReviewPreferences,
} from "../../../services/flashcardService";
import {
  DAILY_LIMIT_OPTIONS,
  DEFAULT_REVIEW_PREFERENCES,
  MAX_CARD_LIMIT,
  NEW_LIMIT_OPTIONS,
  PAUSE_OPTIONS,
  WEEKDAYS,
  addDays,
  formatDay,
  formatLimit,
  formatTime,
  formatWeekdays,
  isPaused,
  localDateString,
} from "../../../utils/flashcards";
import { childFolders } from "../../../utils/resinotes";
import { PrimaryButton, SecondaryButton, flashcardStyles as fs } from "./FlashcardParts";
import { SnoozeSheet, ensureNotificationPermission } from "./ReminderParts";

/**
 * «Configuración de repaso» (ClickUp 124b4z9w0z0, pasada B): repaso diario,
 * tarjetas por día y nuevas, carpetas incluidas, recordatorios (hora y días),
 * posponer, pausar y restablecer la programación.
 *
 * Cada cambio se guarda al momento en resinotes_review_preferences. Si falla,
 * vuelve al valor anterior y lo dice.
 */

// Horas del recordatorio: cada media hora de 06:00 a 23:30.
const REMINDER_TIMES = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
});

const Row = ({ label, value, onPress, testID, disabled = false, last = false }) => (
  <TouchableOpacity
    style={[styles.row, !last && styles.rowBorder, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={`${label}: ${value}`}
    testID={testID}
  >
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={1}>
      {value}
    </Text>
    <Icon name="chevron-forward" size={18} color={COLORS.TEXT_LIGHT} />
  </TouchableOpacity>
);

const SectionSwitch = ({ title, value, onChange, testID, disabled = false, description }) => (
  <View style={styles.switchRow}>
    <View style={styles.flex}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ true: COLORS.PRIMARY, false: COLORS.GRAY_MEDIUM }}
      thumbColor={COLORS.WHITE}
      accessibilityLabel={title}
      testID={testID}
    />
  </View>
);

const Check = ({ checked }) => (
  <View style={[styles.check, checked && styles.checkOn]}>
    {checked ? <Icon name="checkmark" size={14} color={COLORS.WHITE} weight="bold" /> : null}
  </View>
);

/** Hoja de un límite: opciones fijas y «Personalizado». */
const LimitSheet = ({ sheet, onPick, onClose }) => {
  const [custom, setCustom] = useState("");
  useEffect(() => {
    if (sheet) setCustom("");
  }, [sheet]);
  if (!sheet) return null;
  const min = sheet.key === "new_card_limit" ? 0 : 1;
  const n = Number.parseInt(custom, 10);
  const valid = Number.isFinite(n) && n >= min && n <= MAX_CARD_LIMIT;
  return (
    <ResiNotesSheet visible title={sheet.title} onClose={onClose} testID="review-settings-limit-sheet">
      {sheet.options.map((value) => (
        <TouchableOpacity
          key={value}
          style={styles.choice}
          onPress={() => onPick(value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: sheet.value === value }}
          testID={`review-settings-limit-${value}`}
        >
          <Text style={styles.choiceText}>{formatLimit(value)}</Text>
          {sheet.value === value ? <Icon name="checkmark" size={20} color={COLORS.PRIMARY} weight="bold" /> : null}
        </TouchableOpacity>
      ))}
      <Text style={styles.customLabel}>Personalizado</Text>
      <View style={styles.customRow}>
        <TextInput
          value={custom}
          onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, "").slice(0, 3))}
          keyboardType="number-pad"
          placeholder={`De ${min} a ${MAX_CARD_LIMIT}`}
          placeholderTextColor={COLORS.TEXT_LIGHT}
          style={styles.customInput}
          accessibilityLabel="Número personalizado"
          testID="review-settings-limit-custom"
        />
        <PrimaryButton label="Guardar" disabled={!valid} onPress={() => onPick(n)} testID="review-settings-limit-custom-save" />
      </View>
    </ResiNotesSheet>
  );
};

/** Hoja de carpetas: «Todas» o selección múltiple (cada una incluye sus subcarpetas). */
const FoldersSheet = ({ visible, folders, selectedIds, onSave, onClose }) => {
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    if (visible) setDraft(selectedIds ? new Set(selectedIds) : null);
  }, [visible, selectedIds]);

  const rows = useMemo(() => {
    const out = [];
    const walk = (parentId, depth) => {
      childFolders(folders, parentId).forEach((f) => {
        out.push({ folder: f, depth });
        walk(f.id, depth + 1);
      });
    };
    walk(null, 0);
    return out;
  }, [folders]);

  const toggle = (id) =>
    setDraft((prev) => {
      const next = new Set(prev || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const all = !draft || !draft.size;
  return (
    <ResiNotesSheet
      visible={visible}
      title="Carpetas incluidas"
      onClose={onClose}
      testID="review-settings-folders-sheet"
      footer={
        <View style={styles.sheetFooter}>
          <PrimaryButton label="Guardar" onPress={() => onSave(all ? null : Array.from(draft))} testID="review-settings-folders-save" />
        </View>
      }
    >
      <Text style={fs.muted}>
        Cada carpeta incluye sus subcarpetas. Las tarjetas creadas a mano, sin apunte, entran siempre.
      </Text>
      <TouchableOpacity
        style={styles.choice}
        onPress={() => setDraft(null)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: all }}
        testID="review-settings-folders-all"
      >
        <Text style={styles.choiceText}>Todas</Text>
        <Check checked={all} />
      </TouchableOpacity>
      {rows.map(({ folder, depth }) => {
        const checked = Boolean(draft?.has(folder.id));
        return (
          <TouchableOpacity
            key={folder.id}
            style={[styles.choice, { paddingLeft: 4 + depth * 18 }]}
            onPress={() => toggle(folder.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={folder.name}
            testID={`review-settings-folder-${folder.id}`}
          >
            <Text style={styles.choiceText} numberOfLines={1}>
              {folder.emoji ? `${folder.emoji} ` : "📁 "}
              {folder.name}
            </Text>
            <Check checked={checked} />
          </TouchableOpacity>
        );
      })}
      {!rows.length ? <Text style={fs.muted}>Aún no tienes carpetas.</Text> : null}
    </ResiNotesSheet>
  );
};

const foldersLabel = (ids, folders) => {
  if (!ids || !ids.length) return "Todas";
  const names = ids.map((id) => folders.find((f) => f.id === id && !f.deleted_at)?.name).filter(Boolean);
  if (!names.length) return "Todas";
  return names.length === 1 ? names[0] : `${names.length} carpetas`;
};

const formatSnooze = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return d.toDateString() === today.toDateString() ? `hoy a las ${time}` : `mañana a las ${time}`;
};

export const ReviewSettingsView = ({ userId, folders = [], onBack, onChanged }) => {
  const [prefs, setPrefs] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(null); // 'daily' | 'new' | 'folders' | 'time' | 'pause' | 'snooze'

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setPrefs(await getReviewPreferences(userId));
    } catch {
      setLoadError("No se ha podido cargar tu configuración. Revisa tu conexión.");
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Los cambios se guardan de uno en uno y en orden (tocar varios días seguidos no
  // puede dejar en la BD un valor anterior). La pantalla cambia al momento; si uno
  // falla, se vuelve a leer lo guardado.
  const queueRef = useRef(Promise.resolve());
  const pendingRef = useRef(0);
  const save = (patch) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setSheet(null);
    pendingRef.current += 1;
    setSaving(true);
    const run = queueRef.current.then(async () => {
      try {
        const saved = await saveReviewPreferences(userId, patch);
        if (pendingRef.current === 1) setPrefs(saved);
        onChanged?.();
        return true;
      } catch (error) {
        Alert.alert("No se ha guardado", flashcardErrorMessage(error, "Revisa tu conexión e inténtalo de nuevo."));
        await load();
        return false;
      } finally {
        pendingRef.current -= 1;
        if (!pendingRef.current) setSaving(false);
      }
    });
    queueRef.current = run.catch(() => {});
    return run;
  };

  const toggleReminders = async (on) => {
    if (!on) {
      save({ reminders_enabled: false, snoozed_until: null });
      return;
    }
    const granted = await ensureNotificationPermission(userId);
    if (granted) save({ reminders_enabled: true });
  };

  const togglePause = (on) => {
    if (on) setSheet("pause");
    else save({ paused_until: null });
  };

  const toggleWeekday = (day) => {
    const set = new Set(prefs.active_weekdays);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    save({ active_weekdays: Array.from(set).sort((a, b) => a - b) });
  };

  const confirmReset = () =>
    Alert.alert(
      "¿Restablecer la programación?",
      "Todas tus tarjetas volverán a empezar como nuevas. No se borra ninguna tarjeta ni tu historial de repasos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restablecer",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              const n = await resetSchedules();
              onChanged?.();
              Alert.alert(
                "Programación restablecida",
                n === 1 ? "1 tarjeta vuelve a empezar como nueva." : `${n} tarjetas vuelven a empezar como nuevas.`
              );
            } catch (error) {
              Alert.alert("No se ha restablecido", flashcardErrorMessage(error, "Revisa tu conexión e inténtalo de nuevo."));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );

  const renderBody = () => {
    if (loadError) {
      return (
        <View style={fs.center}>
          <Text style={fs.emptyText}>{loadError}</Text>
          <SecondaryButton label="Reintentar" onPress={load} />
        </View>
      );
    }
    if (!prefs) {
      return (
        <View style={fs.center}>
          <ActivityIndicator color={COLORS.PRIMARY} />
        </View>
      );
    }
    const today = localDateString();
    const paused = isPaused(prefs, today);
    const snoozed = prefs.snoozed_until && new Date(prefs.snoozed_until).getTime() > Date.now();
    const remindersOn = prefs.reminders_enabled && prefs.review_enabled;
    return (
      <ScrollView contentContainerStyle={fs.content} testID="review-settings">
        <View style={fs.card}>
          <SectionSwitch
            title="Repaso diario"
            value={prefs.review_enabled}
            onChange={(v) => save({ review_enabled: v })}
            testID="review-settings-enabled"
            description={prefs.review_enabled ? null : "No verás «Tu repaso de hoy» ni recibirás recordatorios."}
          />
          <Row
            label="Tarjetas por día"
            value={String(prefs.daily_card_limit)}
            onPress={() => setSheet("daily")}
            disabled={!prefs.review_enabled}
            testID="review-settings-daily"
          />
          <Row
            label="Tarjetas nuevas por día"
            value={String(prefs.new_card_limit)}
            onPress={() => setSheet("new")}
            disabled={!prefs.review_enabled}
            testID="review-settings-new"
          />
          <Row
            label="Incluir carpetas"
            value={foldersLabel(prefs.included_folder_ids, folders)}
            onPress={() => setSheet("folders")}
            disabled={!prefs.review_enabled}
            testID="review-settings-folders"
            last
          />
        </View>

        <View style={fs.card}>
          <SectionSwitch
            title="Recordatorios"
            value={remindersOn}
            onChange={toggleReminders}
            disabled={!prefs.review_enabled}
            testID="review-settings-reminders"
            description={remindersOn ? null : "Un aviso al día si tienes tarjetas pendientes. Desactivados hasta que tú los actives."}
          />
          {remindersOn ? (
            <>
              <Row
                label="Hora del recordatorio"
                value={prefs.reminder_time}
                onPress={() => setSheet("time")}
                testID="review-settings-time"
              />
              <View style={[styles.row, styles.rowBorder, styles.weekRow]}>
                <Text style={styles.rowLabel}>Días de la semana</Text>
                <View style={styles.weekdays}>
                  {WEEKDAYS.map((w) => {
                    const on = prefs.active_weekdays.includes(w.key);
                    return (
                      <TouchableOpacity
                        key={w.key}
                        style={[styles.weekday, on && styles.weekdayOn]}
                        onPress={() => toggleWeekday(w.key)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={w.label}
                        testID={`review-settings-day-${w.key}`}
                      >
                        <Text style={[styles.weekdayText, on && styles.weekdayTextOn]}>{w.short}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <Row
                label="Posponer el aviso de hoy"
                value={snoozed ? `Hasta ${formatSnooze(prefs.snoozed_until)}` : ""}
                onPress={() => setSheet("snooze")}
                testID="review-settings-snooze"
                last
              />
              {!prefs.active_weekdays.length ? (
                <Text style={styles.warning}>Sin días elegidos no recibirás recordatorios.</Text>
              ) : (
                <Text style={styles.description}>{formatWeekdays(prefs.active_weekdays)} a las {prefs.reminder_time}.</Text>
              )}
            </>
          ) : null}
        </View>

        <View style={fs.card}>
          <SectionSwitch
            title="Pausar repasos"
            value={paused}
            onChange={togglePause}
            disabled={!prefs.review_enabled}
            testID="review-settings-pause"
            description={
              paused
                ? `En pausa hasta el ${formatDay(prefs.paused_until)}. Sin repaso diario ni recordatorios.`
                : "Tómate un descanso sin perder tus tarjetas."
            }
          />
        </View>

        <TouchableOpacity style={styles.reset} onPress={confirmReset} accessibilityRole="button" testID="review-settings-reset">
          <Icon name="refresh-outline" size={20} color={COLORS.ERROR} />
          <Text style={styles.resetText}>Restablecer programación</Text>
        </TouchableOpacity>
        <Text style={styles.description}>Tus tarjetas vuelven a empezar como nuevas. No se borra ninguna.</Text>
      </ScrollView>
    );
  };

  const limitSheet =
    prefs && (sheet === "daily" || sheet === "new")
      ? {
          key: sheet === "daily" ? "daily_card_limit" : "new_card_limit",
          title: sheet === "daily" ? "Tarjetas por día" : "Tarjetas nuevas por día",
          options: sheet === "daily" ? DAILY_LIMIT_OPTIONS : NEW_LIMIT_OPTIONS,
          value: sheet === "daily" ? prefs.daily_card_limit : prefs.new_card_limit,
        }
      : null;

  return (
    <HeroScreenLayout
      title="Configuración de repaso"
      onBack={onBack}
      overlay={
        <>
          {saving ? (
            <View style={styles.busy} pointerEvents="none">
              <ActivityIndicator color={COLORS.PRIMARY} />
            </View>
          ) : null}
          <LimitSheet sheet={limitSheet} onPick={(value) => save({ [limitSheet.key]: value })} onClose={() => setSheet(null)} />
          <FoldersSheet
            visible={sheet === "folders"}
            folders={folders}
            selectedIds={prefs?.included_folder_ids || null}
            onSave={(ids) => save({ included_folder_ids: ids })}
            onClose={() => setSheet(null)}
          />
          <ResiNotesSheet visible={sheet === "time"} title="Hora del recordatorio" onClose={() => setSheet(null)} testID="review-settings-time-sheet">
            {REMINDER_TIMES.map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.choice}
                onPress={() => save({ reminder_time: t, snoozed_until: null })}
                accessibilityRole="radio"
                accessibilityState={{ checked: prefs?.reminder_time === t }}
                testID={`review-settings-time-${t.replace(":", "")}`}
              >
                <Text style={styles.choiceText}>{t}</Text>
                {prefs?.reminder_time === t ? <Icon name="checkmark" size={20} color={COLORS.PRIMARY} weight="bold" /> : null}
              </TouchableOpacity>
            ))}
          </ResiNotesSheet>
          <ResiNotesSheet visible={sheet === "pause"} title="Pausar repasos" onClose={() => setSheet(null)} testID="review-settings-pause-sheet">
            {PAUSE_OPTIONS.map((o) => {
              const until = addDays(localDateString(), o.days);
              return (
                <SheetOption
                  key={o.days}
                  icon="pause-circle-outline"
                  label={o.label}
                  description={`Vuelves el ${formatDay(until)}`}
                  onPress={() => save({ paused_until: until })}
                  testID={`review-settings-pause-${o.days}`}
                />
              );
            })}
          </ResiNotesSheet>
          <SnoozeSheet
            visible={sheet === "snooze"}
            reminderTime={prefs?.reminder_time || DEFAULT_REVIEW_PREFERENCES.reminder_time}
            onPick={save}
            onClose={() => setSheet(null)}
            extraOption={
              prefs?.snoozed_until ? (
                <SheetOption
                  icon="close-circle-outline"
                  label="No posponer"
                  description={`Volver al aviso de las ${formatTime(prefs.reminder_time)}`}
                  onPress={() => save({ snoozed_until: null })}
                  testID="review-snooze-clear"
                />
              ) : null
            }
          />
        </>
      }
    >
      {renderBody()}
    </HeroScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.45 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.PRIMARY_DARK },
  description: { fontSize: 13, color: COLORS.TEXT_LIGHT, lineHeight: 18, marginTop: 4 },
  warning: { fontSize: 13, color: "#B45309", marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  rowLabel: { flex: 1, fontSize: 15, color: COLORS.TEXT_DARK },
  rowValue: { fontSize: 15, color: COLORS.PRIMARY, fontWeight: "600", maxWidth: "45%" },
  weekRow: { flexDirection: "column", alignItems: "stretch", gap: 10 },
  weekdays: { flexDirection: "row", justifyContent: "space-between" },
  weekday: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.WHITE,
  },
  weekdayOn: { backgroundColor: COLORS.PRIMARY, borderColor: COLORS.PRIMARY },
  weekdayText: { fontSize: 14, fontWeight: "700", color: COLORS.TEXT_MEDIUM },
  weekdayTextOn: { color: COLORS.WHITE },
  reset: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 4 },
  resetText: { fontSize: 16, fontWeight: "600", color: COLORS.ERROR },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  choiceText: { flex: 1, fontSize: 16, color: COLORS.TEXT_DARK },
  customLabel: { fontSize: 13, fontWeight: "700", color: COLORS.TEXT_MEDIUM, marginTop: 16, marginBottom: 6 },
  customRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    fontSize: 16,
    color: COLORS.TEXT_DARK,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.GRAY_MEDIUM,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: COLORS.PRIMARY, borderColor: COLORS.PRIMARY },
  sheetFooter: { paddingHorizontal: 20, paddingTop: 8 },
  busy: {
    position: "absolute",
    top: 12,
    right: 16,
  },
});

export default ReviewSettingsView;
