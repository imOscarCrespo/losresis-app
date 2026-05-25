import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const CARD_BORDER = "#F1F5F9";
const MUTED = "#64748B";
const MUTED_LIGHT = "#94A3B8";

function RadioDot({ selected }) {
  return (
    <View
      style={[
        styles.radioDot,
        selected ? styles.radioDotSelected : styles.radioDotUnselected,
      ]}
    >
      {selected ? <View style={styles.radioDotInner} /> : null}
    </View>
  );
}

export default function FilterRadioModal({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
  placeholder,
  searchable = true,
  searchPlaceholder = "Buscar...",
}) {
  const insets = useSafeAreaInsets();
  const [tempValue, setTempValue] = useState(value);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (visible) {
      setTempValue(value);
      setSearch("");
    }
  }, [value, visible]);

  const handleClose = useCallback(() => {
    setSearch("");
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    onSelect(tempValue);
    setSearch("");
    onClose();
  }, [onClose, onSelect, tempValue]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const lower = search.trim().toLowerCase();
    return options.filter((o) =>
      String(o?.name || "")
        .toLowerCase()
        .includes(lower)
    );
  }, [options, search, searchable]);

  const listData = useMemo(() => {
    const data = [];
    if (value) {
      data.push({ id: "", name: placeholder });
    }
    data.push(...filteredOptions);
    return data;
  }, [filteredOptions, placeholder, value]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleClose}>
            <Ionicons name="arrow-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.backBtn} />
        </View>

        {searchable ? (
          <View style={styles.searchWrap}>
            <View style={styles.searchInner}>
              <Ionicons name="search" size={20} color={MUTED_LIGHT} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor={MUTED_LIGHT}
                returnKeyType="done"
                autoCorrect={false}
              />
              {search.length > 0 ? (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={18} color={MUTED_LIGHT} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        <FlatList
          data={listData}
          keyExtractor={(item, index) => `${String(item.id ?? "")}-${index}`}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isClear = item.id === "";
            const isSelected = !isClear && item.id === tempValue;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  isClear && styles.optionClear,
                  pressed && { opacity: 0.78 },
                ]}
                onPress={() => setTempValue(isClear ? "" : item.id)}
              >
                <Text
                  style={[
                    styles.optionName,
                    isSelected && styles.optionNameSelected,
                    isClear && styles.optionNameClear,
                  ]}
                >
                  {item.name}
                </Text>
                {isClear ? null : <RadioDot selected={isSelected} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sin resultados</Text>
            </View>
          }
        />

        <View
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Confirmar selección</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: ACCENT,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  option: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionSelected: {
    borderColor: `${PRIMARY}40`,
    backgroundColor: `${PRIMARY}10`,
  },
  optionClear: {
    backgroundColor: "#F8FAFC",
  },
  optionName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
  },
  optionNameSelected: {
    color: PRIMARY,
  },
  optionNameClear: {
    color: MUTED,
  },
  empty: {
    paddingTop: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: MUTED,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  radioDotSelected: {
    borderColor: PRIMARY,
  },
  radioDotUnselected: {
    borderColor: "#CBD5E1",
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
});
