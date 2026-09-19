import React, { useEffect, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";

function RadioDot({ selected }) {
  return (
    <View
      style={[
        modal.radioDot,
        selected ? modal.radioDotSelected : modal.radioDotUnselected,
      ]}
    >
      {selected && <View style={modal.radioDotInner} />}
    </View>
  );
}

/**
 * Selector de un filtro a pantalla completa: buscador, lista de opciones con
 * radio y botón de confirmar. La primera fila borra el filtro cuando ya hay uno
 * puesto.
 *
 * Vive fuera de las pantallas porque el listado de hospitales y el de jornadas
 * filtran por lo mismo (comunidad, ciudad, orden) y tienen que verse igual.
 */
export function FilterModal({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
  placeholder,
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    if (visible) setTempValue(value);
  }, [visible, value]);

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  const handleConfirm = () => {
    onSelect(tempValue);
    setSearch("");
    onClose();
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(lower));
  }, [options, search]);

  const listData = useMemo(() => {
    const data = [];
    if (value) data.push({ id: "", name: placeholder });
    data.push(...filtered);
    return data;
  }, [filtered, value, placeholder]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#FFF" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[modal.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={modal.backBtn} onPress={handleClose}>
            <Icon name="arrow-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={modal.title}>{title}</Text>
          <View style={modal.backBtn} />
        </View>

        {/* Search */}
        <View style={modal.searchWrap}>
          <View style={modal.searchInner}>
            <Icon name="search" size={20} color="#94A3B8" />
            <TextInput
              style={modal.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar..."
              placeholderTextColor="#94A3B8"
              returnKeyType="done"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Icon name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Options list */}
        <FlatList
          data={listData}
          keyExtractor={(item, i) => String(item.id ?? "") + i}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={modal.listContent}
          renderItem={({ item }) => {
            const isSelected = item.id !== "" && item.id === tempValue;
            const isClear = item.id === "";
            return (
              <Pressable
                style={({ pressed }) => [
                  modal.option,
                  isSelected && modal.optionSelected,
                  isClear && modal.optionClear,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => setTempValue(isClear ? "" : item.id)}
              >
                <View style={modal.optionBody}>
                  <Text
                    style={[
                      modal.optionName,
                      isSelected && modal.optionNameSelected,
                      isClear && modal.optionNameClear,
                    ]}
                  >
                    {item.name}
                  </Text>
                </View>
                {!isClear && <RadioDot selected={isSelected} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={modal.empty}>
              <Text style={modal.emptyText}>Sin resultados</Text>
            </View>
          }
        />

        {/* Confirm button */}
        <View
          style={[modal.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <TouchableOpacity
            style={modal.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text style={modal.confirmText}>Confirmar selección</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modal = StyleSheet.create({
  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
    paddingTop: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: ACCENT,
    textAlign: "center",
    letterSpacing: -0.3,
  },

  /* Search */
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: ACCENT,
    padding: 0,
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: `${PRIMARY}08`,
  },
  optionClear: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  optionBody: {
    flex: 1,
  },
  optionName: {
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
  },
  optionNameSelected: {
    color: PRIMARY,
    fontWeight: "700",
  },
  optionNameClear: {
    color: "#EF4444",
    fontWeight: "600",
  },

  /* Radio dot */
  radioDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioDotSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  radioDotUnselected: {
    borderColor: "#CBD5E1",
    backgroundColor: "transparent",
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFF",
  },

  /* Footer */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  /* Empty */
  empty: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
  },
});

export default FilterModal;
