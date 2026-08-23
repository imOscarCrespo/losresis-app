import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { getHospitalsWithFormativePlans } from "../services/hospitalService";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";

/**
 * Listado de hospitales que han publicado su plan formativo desde
 * losresis-panel. Solo entran los que tienen PDF: una especialidad marcada sin
 * documento no es un plan formativo publicado.
 */
export default function FormativePlansScreen({ onHospitalSelect, onBack }) {
  const insets = useSafeAreaInsets();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const { success, hospitals: data, error } =
        await getHospitalsWithFormativePlans();

      if (!success) {
        console.error("Error loading hospitals with formative plans:", error);
      }
      setHospitals(success ? data : []);
    } catch (error) {
      console.error("Exception fetching hospitals with formative plans:", error);
      setHospitals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  useEffect(() => {
    if (loading) return;
    posthogLogger.logScreen("FormativePlansScreen", {
      hospitalCount: hospitals.length,
    });
  }, [loading, hospitals.length]);

  const renderHospitalItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => onHospitalSelect?.(item)}
    >
      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={2}>
            {item.name}
          </Text>
        </View>

        <View style={styles.cardLocationRow}>
          <Icon name="location" size={14} color="#94A3B8" />
          <Text style={styles.cardLocation}>
            {item.city}, {item.region}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>
              {item.planCount}{" "}
              {item.planCount === 1 ? "PLAN FORMATIVO" : "PLANES FORMATIVOS"}
            </Text>
          </View>
          <Icon name="arrow-forward" size={20} color={PRIMARY} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <HeroScreenLayout
      title="Planes Formativos"
      onBack={onBack}
      bottomContent={
        <Text style={styles.heroSubtitle}>
          Consulta los planes formativos que los hospitales han publicado por
          especialidad.
        </Text>
      }
      containerStyle={styles.container}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando planes formativos...</Text>
        </View>
      ) : (
        <FlatList
          data={hospitals}
          renderItem={renderHospitalItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 24 + insets.bottom },
          ]}
          ListHeaderComponent={
            hospitals.length > 0 ? (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>
                  {hospitals.length}{" "}
                  {hospitals.length === 1 ? "hospital" : "hospitales"}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="document-text-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                Todavía no hay hospitales con planes formativos publicados.
              </Text>
            </View>
          }
        />
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 8,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },

  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  cardInner: {
    padding: 16,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 22,
    flex: 1,
  },
  cardLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    marginBottom: 12,
  },
  cardLocation: {
    fontSize: 12,
    color: "#64748B",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planBadge: {
    backgroundColor: `${PRIMARY}08`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.5,
  },

  /* Loading / Empty */
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#64748B",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 21,
  },
});
