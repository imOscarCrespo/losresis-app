import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "./Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACCENT = "#670CF5";

const fullName = (connection) =>
  `${connection?.name || ""} ${connection?.surname || ""}`.trim() || "Residente";

const initials = (connection) => {
  const name = connection?.name?.[0] || "";
  const surname = connection?.surname?.[0] || "";
  return `${name}${surname}`.toUpperCase() || "?";
};

// Selector multi-seleccion de Conexiones para compartir un Evento de agenda.
// Recibe la lista ya cargada (get_my_connections) y devuelve los user_id elegidos.
export const ShareConnectionsPicker = ({
  visible,
  onClose,
  connections = [],
  selectedIds = [],
  onConfirm,
}) => {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [tempSelected, setTempSelected] = useState(() => new Set(selectedIds));

  useEffect(() => {
    if (visible) {
      setTempSelected(new Set(selectedIds));
      setSearch("");
    }
  }, [visible, selectedIds]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return connections;
    }
    return connections.filter((connection) =>
      fullName(connection).toLowerCase().includes(query)
    );
  }, [connections, search]);

  const toggle = (userId) => {
    setTempSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm?.(Array.from(tempSelected));
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Icon name="arrow-back" size={22} color={ACCENT} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            Compartir con
          </Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.searchWrap}>
          <Icon name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar conexión..."
            placeholderTextColor="#94A3B8"
            returnKeyType="done"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Icon name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.user_id)}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = tempSelected.has(item.user_id);
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.85}
                onPress={() => toggle(item.user_id)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item)}</Text>
                </View>
                <Text style={styles.rowName} numberOfLines={1}>
                  {fullName(item)}
                </Text>
                <View
                  style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                >
                  {isSelected ? (
                    <Icon name="checkmark" size={16} color="#FFFFFF" />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sin resultados</Text>
            </View>
          }
        />

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.9}
          >
            <Text style={styles.confirmText}>
              {tempSelected.size > 0
                ? `Compartir con ${tempSelected.size}`
                : "Listo"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    color: "#0F172A",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
    paddingVertical: 12,
  },
  listContent: {
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EFEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: ACCENT,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  confirmBtn: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});

export default ShareConnectionsPicker;
