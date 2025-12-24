import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

/**
 * Tarjeta para la reseña del usuario en rotaciones externas
 */
export const MyRotationReviewCard = ({
  existingReview,
  onEdit,
  onDelete,
  onCreate,
}) => {
  return (
    <View style={styles.card}>
      {existingReview ? (
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={COLORS.SUCCESS}
            />
            <Text style={styles.statusText}>
              Reseña enviada
              {existingReview.is_approved
                ? " y aprobada"
                : " (pendiente de aprobación)"}
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Ionicons name="pencil" size={18} color={COLORS.PRIMARY} />
              <Text style={styles.editText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Ionicons name="trash" size={18} color={COLORS.ERROR} />
              <Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={48} color={COLORS.GRAY} />
          <Text style={styles.emptyText}>
            Aún no has creado una reseña de tu rotación externa
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  content: {
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.PRIMARY + "15",
    paddingVertical: 10,
    borderRadius: 8,
  },
  editText: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
    fontSize: 14,
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.ERROR + "15",
    paddingVertical: 10,
    borderRadius: 8,
  },
  deleteText: {
    color: COLORS.ERROR,
    fontWeight: "600",
    fontSize: 14,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: COLORS.WHITE,
    fontWeight: "600",
    fontSize: 14,
  },
});
