import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { getMyConnections } from "../services/connectionsService";
import { openDirectChat } from "../services/directChatsService";
import {
  getHospitalByIdFromCatalog,
  getSpecialityByIdFromCatalog,
} from "../services/staticCatalogService";
import { getRoommateAvatarUrl } from "../utils/roommateUtils";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const MUTED = "#64748B";
const MUTED_LIGHT = "#94A3B8";

const buildSubtitle = (connection) => {
  const year = parseInt(connection.resident_year, 10);
  const yearLabel = Number.isFinite(year) && year > 0 ? `R${year}` : null;
  const specialtyName = getSpecialityByIdFromCatalog(
    connection.speciality_id
  )?.name;
  const parts = [yearLabel, specialtyName].filter(Boolean);
  return parts.join(" · ");
};

function ConnectionCard({ connection, isBusy, onPress }) {
  const avatarUri = connection.avatar_url
    ? getRoommateAvatarUrl(connection.avatar_url)
    : null;
  const subtitle = buildSubtitle(connection);
  const hospitalName = getHospitalByIdFromCatalog(connection.hospital_id)?.name;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={isBusy}
      activeOpacity={0.85}
    >
      <View style={styles.avatar}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person-outline" size={22} color={PRIMARY} />
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>
          {connection.name} {connection.surname}
        </Text>
        {subtitle ? (
          <View style={styles.metaRow}>
            <Ionicons name="medkit-outline" size={14} color={PRIMARY} />
            <Text style={styles.metaText} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        ) : null}
        {hospitalName ? (
          <View style={styles.metaRow}>
            <Ionicons name="business-outline" size={14} color={MUTED_LIGHT} />
            <Text style={styles.metaText} numberOfLines={1}>
              {hospitalName}
            </Text>
          </View>
        ) : null}
      </View>

      {isBusy ? (
        <ActivityIndicator size="small" color={PRIMARY} />
      ) : (
        <Ionicons name="chatbubble-ellipses-outline" size={22} color={PRIMARY} />
      )}
    </TouchableOpacity>
  );
}

export default function MyConnectionsScreen({ onBack, onSectionChange }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    posthogLogger.logScreen("MyConnectionsScreen");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { success, connections: rows, error } = await getMyConnections();
    if (!success) {
      console.warn("Error cargando conexiones:", error);
      setConnections([]);
    } else {
      setConnections(rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenChat = useCallback(
    async (connection) => {
      if (busyId) return;
      setBusyId(connection.user_id);
      try {
        const response = await openDirectChat({
          otherUserId: connection.user_id,
          otherUserName: `${connection.name || ""} ${
            connection.surname || ""
          }`.trim(),
          onSectionChange,
        });
        if (!response.success) {
          Alert.alert(
            "No se pudo abrir el chat",
            response.error || "Inténtalo de nuevo."
          );
        }
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onSectionChange]
  );

  return (
    <HeroScreenLayout title="Mis conexiones" onBack={onBack}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : connections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={MUTED_LIGHT} />
          <Text style={styles.emptyTitle}>Aún no tienes conexiones</Text>
          <Text style={styles.emptyText}>
            Conecta con otros residentes desde el directorio para poder chatear
            con ellos.
          </Text>
        </View>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.connection_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ConnectionCard
              connection={item}
              isBusy={busyId === item.user_id}
              onPress={() => handleOpenChat(item)}
            />
          )}
        />
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B0977",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3EEFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  cardBody: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B0977",
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontSize: 13,
    color: MUTED,
    flex: 1,
  },
});
