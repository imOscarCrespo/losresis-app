import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Icon } from "../Icon";
import { COLORS } from "../../constants/colors";
import { ResiNotesSheet } from "./ResiNotesSheet";
import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_COLORS,
  FOLDER_COLOR_KEYS,
  MAX_FOLDER_NAME,
  canMoveFolder,
  childFolders,
  folderColor,
  folderPath,
} from "../../utils/resinotes";

const EMOJI_SUGGESTIONS = ["🤰", "🌸", "🚨", "🔬", "💊", "📚", "🫀", "🧠", "🩺", "🦴", "👶", "💉"];

/** Carpetas en orden de árbol con su nivel, para el selector. */
const flattenTree = (folders, parentId = null, depth = 0, out = []) => {
  childFolders(folders, parentId).forEach((f) => {
    out.push({ folder: f, depth });
    if (depth < 30) flattenTree(folders, f.id, depth + 1, out);
  });
  return out;
};

/**
 * Elegir carpeta destino. `movingFolderId` desactiva la propia carpeta y sus
 * subcarpetas (no se puede mover una carpeta dentro de sí misma).
 * `rootLabel` es la opción sin carpeta: «Mis carpetas» para una carpeta,
 * «Sin clasificar» para un elemento.
 */
export const FolderPickerSheet = ({
  visible,
  title,
  folders,
  currentId = null,
  movingFolderId = null,
  rootLabel = "Mis carpetas",
  onSelect,
  onClose,
}) => {
  const rows = useMemo(() => flattenTree(folders || []), [folders]);

  const renderOption = (id, label, depth, emoji, color, disabled) => {
    const selected = (currentId ?? null) === (id ?? null);
    return (
      <TouchableOpacity
        key={id || "root"}
        style={[styles.pickRow, { paddingLeft: 8 + depth * 18 }, disabled && styles.disabled]}
        disabled={disabled}
        onPress={() => onSelect(id)}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected }}
        accessibilityLabel={label}
      >
        <Icon
          name={id ? "folder-outline" : "file-tray-outline"}
          size={20}
          color={id ? folderColor(color).fg : COLORS.TEXT_LIGHT}
        />
        {emoji ? <Text style={styles.pickEmoji}>{emoji}</Text> : null}
        <Text style={[styles.pickLabel, selected && styles.pickLabelSelected]} numberOfLines={1}>
          {label}
        </Text>
        {selected ? <Icon name="checkmark" size={18} color={COLORS.PRIMARY} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <ResiNotesSheet visible={visible} title={title} onClose={onClose}>
      {renderOption(null, rootLabel, 0, null, null, false)}
      {rows.map(({ folder, depth }) =>
        renderOption(
          folder.id,
          folder.name,
          depth + 1,
          folder.emoji,
          folder.color,
          Boolean(movingFolderId) && !canMoveFolder(folders, movingFolderId, folder.id)
        )
      )}
    </ResiNotesSheet>
  );
};

/**
 * Crear o editar una carpeta: nombre, emoji, color y carpeta principal.
 * Una subcarpeta nueva hereda el color de su madre; el residente lo puede cambiar.
 */
export const FolderFormSheet = ({ visible, folders, folder = null, defaultParentId = null, onSubmit, onClose }) => {
  const isEdit = Boolean(folder);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState(DEFAULT_FOLDER_COLOR);
  const [parentId, setParentId] = useState(null);
  const [colorTouched, setColorTouched] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Solo al abrir: si la biblioteca se recarga con la hoja abierta no se pierde lo escrito.
  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  useEffect(() => {
    if (!visible) return;
    const folders = foldersRef.current;
    const parent = (folders || []).find((f) => f.id === (folder ? folder.parent_id : defaultParentId));
    setName(folder?.name || "");
    setEmoji(folder?.emoji || "");
    setColor(folder?.color || parent?.color || DEFAULT_FOLDER_COLOR);
    setParentId(folder ? folder.parent_id ?? null : defaultParentId ?? null);
    setColorTouched(false);
    setError(null);
    setSaving(false);
  }, [visible, folder, defaultParentId]);

  const parentLabel = useMemo(() => {
    if (!parentId) return "Ninguna (carpeta principal)";
    return folderPath(folders || [], parentId).map((f) => f.name).join(" › ");
  }, [folders, parentId]);

  const handleParent = (id) => {
    setPickerOpen(false);
    setParentId(id);
    if (!isEdit && !colorTouched) {
      const parent = (folders || []).find((f) => f.id === id);
      setColor(parent?.color || DEFAULT_FOLDER_COLOR);
    }
  };

  const submit = async () => {
    const clean = name.trim();
    if (!clean) {
      setError("Ponle un nombre a la carpeta.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: clean, emoji: emoji.trim(), color, parentId });
    } catch (e) {
      setError(e?.userMessage || "No se ha podido guardar la carpeta. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  return (
    <>
      <ResiNotesSheet
        visible={visible && !pickerOpen}
        title={isEdit ? "Editar carpeta" : "Nueva carpeta"}
        onClose={onClose}
        testID="resinotes-folder-form"
        footer={
          <View style={styles.footer}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.primary, saving && styles.disabled]}
              onPress={submit}
              disabled={saving}
              accessibilityRole="button"
              testID="resinotes-folder-save"
            >
              <Text style={styles.primaryText}>
                {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear carpeta"}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Obstetricia"
          placeholderTextColor={COLORS.GRAY_MEDIUM}
          maxLength={MAX_FOLDER_NAME}
          style={styles.input}
          autoFocus={!isEdit}
          testID="resinotes-folder-name"
          accessibilityLabel="Nombre de la carpeta"
        />

        <Text style={styles.label}>Emoji (opcional)</Text>
        <View style={styles.emojiRow}>
          <TextInput
            value={emoji}
            // Por puntos de código, no por caracteres UTF-16: un emoji compuesto
            // (👩‍⚕️) son varios y no se puede partir. La BD admite 16.
            onChangeText={(v) => setEmoji(Array.from(v).slice(-8).join(""))}
            placeholder="🙂"
            style={[styles.input, styles.emojiInput]}
            accessibilityLabel="Emoji de la carpeta"
          />
          {EMOJI_SUGGESTIONS.map((e) => (
            <TouchableOpacity
              key={e}
              onPress={() => setEmoji(emoji === e ? "" : e)}
              style={[styles.emojiChip, emoji === e && styles.emojiChipActive]}
              accessibilityRole="button"
              accessibilityLabel={`Emoji ${e}`}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Color</Text>
        <View style={styles.colorRow}>
          {FOLDER_COLOR_KEYS.map((key) => {
            const c = FOLDER_COLORS[key];
            const active = color === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  setColor(key);
                  setColorTouched(true);
                }}
                style={[styles.colorChip, { backgroundColor: c.bg, borderColor: active ? c.fg : c.bg }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={c.label}
                testID={`resinotes-color-${key}`}
              >
                <Icon name={active ? "checkmark" : "folder-outline"} size={18} color={c.fg} />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Dentro de</Text>
        <TouchableOpacity
          style={styles.select}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Carpeta principal: ${parentLabel}`}
        >
          <Icon name="folder-open-outline" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.selectText} numberOfLines={1}>
            {parentLabel}
          </Text>
          <Icon name="chevron-forward" size={18} color={COLORS.TEXT_LIGHT} />
        </TouchableOpacity>
      </ResiNotesSheet>

      <FolderPickerSheet
        visible={visible && pickerOpen}
        title="Carpeta principal"
        folders={folders}
        currentId={parentId}
        movingFolderId={folder?.id || null}
        rootLabel="Ninguna (carpeta principal)"
        onSelect={handleParent}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
};

/** Guardar un enlace web. */
export const LinkFormSheet = ({ visible, onSubmit, onClose }) => {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setUrl("");
      setTitle("");
      setError(null);
      setSaving(false);
    }
  }, [visible]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ url, title });
    } catch (e) {
      setError(
        e?.message === "INVALID_URL"
          ? "Escribe un enlace web válido, por ejemplo uptodate.com."
          : "No se ha podido guardar el enlace. Inténtalo de nuevo."
      );
      setSaving(false);
    }
  };

  return (
    <ResiNotesSheet
      visible={visible}
      title="Enlace web"
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.primary, (saving || !url.trim()) && styles.disabled]}
            onPress={submit}
            disabled={saving || !url.trim()}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{saving ? "Guardando…" : "Guardar enlace"}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={styles.label}>Enlace</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://"
        placeholderTextColor={COLORS.GRAY_MEDIUM}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
        autoFocus
        accessibilityLabel="Enlace"
      />
      <Text style={styles.label}>Título (opcional)</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Guía SEGO de preeclampsia"
        placeholderTextColor={COLORS.GRAY_MEDIUM}
        maxLength={200}
        style={styles.input}
        accessibilityLabel="Título del enlace"
      />
    </ResiNotesSheet>
  );
};

/** Renombrar un elemento. */
export const RenameSheet = ({ visible, initialValue = "", onSubmit, onClose }) => {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setSaving(false);
      setError(null);
    }
  }, [visible, initialValue]);

  const submit = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onSubmit(value.trim());
    } catch {
      setError("No se ha podido renombrar. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  return (
    <ResiNotesSheet
      visible={visible}
      title="Renombrar"
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.primary, (saving || !value.trim()) && styles.disabled]}
            onPress={submit}
            disabled={saving || !value.trim()}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{saving ? "Guardando…" : "Guardar"}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <TextInput
        value={value}
        onChangeText={setValue}
        maxLength={200}
        style={styles.input}
        autoFocus
        selectTextOnFocus
        accessibilityLabel="Nuevo nombre"
      />
    </ResiNotesSheet>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.TEXT_MEDIUM,
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.TEXT_DARK,
    backgroundColor: COLORS.BACKGROUND_LIGHT,
  },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  emojiInput: { width: 64, textAlign: "center", fontSize: 20, paddingVertical: 8 },
  emojiChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.BACKGROUND_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  emojiChipActive: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY_LIGHT },
  emojiText: { fontSize: 20 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: COLORS.BACKGROUND_LIGHT,
  },
  selectText: { flex: 1, fontSize: 15, color: COLORS.TEXT_DARK },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  error: { color: COLORS.ERROR, fontSize: 14, marginBottom: 8 },
  primary: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryText: { color: COLORS.WHITE, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingRight: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.BORDER,
  },
  pickEmoji: { fontSize: 18 },
  pickLabel: { flex: 1, fontSize: 15, color: COLORS.TEXT_DARK },
  pickLabelSelected: { color: COLORS.PRIMARY, fontWeight: "700" },
});
