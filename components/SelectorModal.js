import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon } from "./Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotionPressable } from "./MotionPressable";

const DEFAULT_ACCENT = "#1B0977";
const DEFAULT_PRIMARY = "#670CF5";

function RadioDot({ selected, primaryColor }) {
  return (
    <View
      style={[
        styles.radioDot,
        selected ? [styles.radioDotSelected, { borderColor: primaryColor }] : styles.radioDotUnselected,
      ]}
    >
      {selected ? (
        <View
          style={[styles.radioDotInner, { backgroundColor: primaryColor }]}
        />
      ) : null}
    </View>
  );
}

export function SelectorModal({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
  placeholder,
  allowClear = true,
  confirmText = "Confirmar selección",
  emptyText = "Sin resultados",
  enableSearch = true,
  accentColor = DEFAULT_ACCENT,
  primaryColor = DEFAULT_PRIMARY,
  backgroundColor = "#FFFFFF",
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [tempValue, setTempValue] = useState(value);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setTempValue(value);
    }
  }, [value, visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardVisible(false);
      return undefined;
    }

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible]);

  const handleClose = () => {
    setSearch("");
    onClose?.();
  };

  const handleConfirm = () => {
    onSelect?.(tempValue);
    setSearch("");
    onClose?.();
  };

  const filteredOptions = useMemo(() => {
    if (!search.trim()) {
      return options;
    }

    const lower = search.toLowerCase().trim();
    return options.filter((option) =>
      String(option?.name ?? option?.label ?? option?.id ?? option?.value ?? "")
        .toLowerCase()
        .includes(lower)
    );
  }, [options, search]);

  const listData = useMemo(() => {
    const data = [];

    if (allowClear && value) {
      data.push({ id: "", name: placeholder });
    }

    data.push(...filteredOptions);
    return data;
  }, [allowClear, filteredOptions, placeholder, value]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <MotionPressable
            style={styles.backBtn}
            onPress={handleClose}
            scaleTo={0.92}
            pressedOpacity={0.75}
          >
            <Icon name="arrow-back" size={24} color={accentColor} />
          </MotionPressable>
          <Text style={[styles.title, { color: accentColor }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.backBtn} />
        </View>

        {enableSearch ? (
          <View style={styles.searchWrap}>
            <View style={styles.searchInner}>
              <Icon name="search" size={20} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar..."
                placeholderTextColor="#94A3B8"
                returnKeyType="done"
              />
              {search.length > 0 ? (
                <MotionPressable
                  onPress={() => setSearch("")}
                  style={styles.searchClearButton}
                  scaleTo={0.9}
                  pressedOpacity={0.72}
                >
                  <Icon name="close-circle" size={18} color="#94A3B8" />
                </MotionPressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <FlatList
          data={listData}
          keyExtractor={(item, index) => String(item?.id ?? item?.value ?? "") + index}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const itemValue = item?.id ?? item?.value ?? "";
            const itemLabel = item?.name ?? item?.label ?? String(itemValue);
            const isSelected = itemValue !== "" && itemValue === tempValue;
            const isClear = itemValue === "";

            return (
              <MotionPressable
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  isClear && styles.optionClear,
                  pressed && styles.optionPressed,
                ]}
                pressedStyle={styles.optionPressed}
                onPress={() => setTempValue(isClear ? "" : itemValue)}
                scaleTo={0.985}
                pressedOpacity={0.98}
              >
                <View style={styles.optionBody}>
                  <Text
                    style={[
                      styles.optionName,
                      isSelected && [styles.optionNameSelected, { color: accentColor }],
                      isClear && styles.optionNameClear,
                    ]}
                  >
                    {itemLabel}
                  </Text>
                </View>
                {isClear ? null : (
                  <RadioDot selected={isSelected} primaryColor={primaryColor} />
                )}
              </MotionPressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          }
        />

        <View
          style={[
            styles.footer,
            {
              paddingBottom: keyboardVisible
                ? 12
                : Math.max(insets.bottom, 16),
            },
          ]}
        >
          <MotionPressable
            style={[styles.confirmBtn, { backgroundColor: primaryColor }]}
            onPress={handleConfirm}
            scaleTo={0.985}
            pressedOpacity={0.96}
          >
            <Text style={styles.confirmText}>{confirmText}</Text>
          </MotionPressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    minHeight: 52,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "500",
    paddingVertical: 14,
  },
  searchClearButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 20,
  },
  option: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  optionSelected: {
    backgroundColor: "#F8F5FF",
  },
  optionClear: {
    backgroundColor: "#FFF7F7",
  },
  optionPressed: {
    backgroundColor: "#F3F4F6",
  },
  optionBody: {
    flex: 1,
    paddingRight: 16,
  },
  optionName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
  optionNameSelected: {
    fontWeight: "800",
  },
  optionNameClear: {
    color: "#DC2626",
  },
  empty: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  confirmBtn: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#670CF5",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotSelected: {},
  radioDotUnselected: {
    borderColor: "#CBD5E1",
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
