import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import posthogLogger from "../services/posthogService";
import {
  getEvaluationCompetencies,
  getResidentEvaluations,
} from "../services/docenciaService";
import { getLibroProgressLabel } from "../data/libroSections";

/**
 * Las evaluaciones que su tutor le ha compartido.
 *
 * SOLO LECTURA, y no por decisión de esta pantalla: hospital_evaluation es el
 * documento del tutor y no tiene ni una columna donde el residente escriba. Lo que
 * el residente responde y envía es la Autoevaluación anual, que es otro módulo.
 *
 * Solo llegan aquí las compartidas: la vista hospital_evaluation_for_resident filtra
 * por shared_at, así que un borrador del tutor no existe para el residente.
 */

const TYPE_LABEL = {
  rotacion: "Evaluación de rotación",
  semestral: "Evaluación semestral",
  anual: "Evaluación anual",
  extraordinaria: "Evaluación extraordinaria",
  otra: "Evaluación",
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const CONTENT_FIELDS = [
  { key: "competencies_reviewed", label: "Competencias revisadas" },
  { key: "goals_achieved", label: "Objetivos alcanzados" },
  { key: "improvements", label: "A mejorar" },
  { key: "tutor_comments", label: "Comentarios de tu tutor" },
];

export default function EvaluationsScreen({ userProfile, onBack }) {
  const userId = userProfile?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [competencies, setCompetencies] = useState([]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setItems(await getResidentEvaluations(userId));
    } catch (error) {
      console.error("Error loading evaluations:", error);
      setItems([]);
    }
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    posthogLogger.logScreen("EvaluationsScreen");
    setLoading(true);
    // El guard evita el setState tras desmontar si el residente sale mientras carga.
    load().finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [load]);

  // Las competencias de la evaluación se piden al abrirla: en el listado no aportan
  // nada y son una consulta por fila.
  useEffect(() => {
    let isMounted = true;
    if (!openItem) {
      setCompetencies([]);
      return () => {
        isMounted = false;
      };
    }

    getEvaluationCompetencies(openItem.id).then((rows) => {
      if (isMounted) setCompetencies(rows);
    });

    return () => {
      isMounted = false;
    };
  }, [openItem]);

  return (
    <HeroScreenLayout
      title="Evaluaciones"
      subtitle="Lo que tu tutor ha evaluado de ti"
      onBack={onBack}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#670CF5" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
              tintColor="#670CF5"
            />
          }
        >
          {items.length ? (
            items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => setOpenItem(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>
                    {TYPE_LABEL[item.evaluation_type] || "Evaluación"}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {formatDate(item.evaluation_date)}
                    {item.period_label ? ` · ${item.period_label}` : ""}
                  </Text>
                  {item.overall_rating ? (
                    <Text style={styles.cardRating}>{item.overall_rating}</Text>
                  ) : null}
                </View>
                <Icon name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.empty}>
              <Icon name="clipboard-outline" size={24} color="#670CF5" />
              <Text style={styles.emptyTitle}>Todavía no tienes evaluaciones</Text>
              <Text style={styles.emptyText}>
                Cuando tu tutor cierre una y la comparta contigo, aparecerá aquí.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={!!openItem}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenItem(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => setOpenItem(null)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetTitle}>
                  {openItem ? TYPE_LABEL[openItem.evaluation_type] || "Evaluación" : ""}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {openItem ? formatDate(openItem.evaluation_date) : ""}
                  {openItem?.tutor_name ? ` · ${openItem.tutor_name}` : ""}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setOpenItem(null)}>
                <Icon name="close" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent}>
              {openItem?.overall_rating ? (
                <View style={styles.ratingCard}>
                  <Text style={styles.ratingLabel}>Valoración global</Text>
                  <Text style={styles.ratingValue}>{openItem.overall_rating}</Text>
                </View>
              ) : null}

              {CONTENT_FIELDS.filter((field) => openItem?.[field.key]).map((field) => (
                <View key={field.key} style={styles.block}>
                  <Text style={styles.blockLabel}>{field.label}</Text>
                  <Text style={styles.blockText}>{openItem[field.key]}</Text>
                </View>
              ))}

              {competencies.length ? (
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>Competencias</Text>
                  {competencies.map((row) => (
                    <View key={row.node_id} style={styles.competency}>
                      <View style={styles.competencyCopy}>
                        <Text style={styles.competencyName}>
                          {row.libro_node?.name || "Competencia"}
                        </Text>
                        {row.comment ? (
                          <Text style={styles.competencyComment}>{row.comment}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.competencyLevel}>
                        {getLibroProgressLabel("competencies", row.level)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.footnote}>
                Esta evaluación la escribe tu tutor. El nivel de tus competencias que
                fija aquí es el que se ve en tu Libro del Residente.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 10, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  cardCopy: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  cardMeta: { fontSize: 12, color: "#64748B" },
  cardRating: { fontSize: 12, fontWeight: "700", color: "#059669" },
  empty: {
    alignItems: "center",
    gap: 8,
    padding: 26,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#1B0977" },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  overlayTouchable: { flex: 1 },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sheetHeaderCopy: { flex: 1, gap: 4 },
  sheetTitle: { fontSize: 19, fontWeight: "800", color: "#1B0977" },
  sheetSubtitle: { fontSize: 13, color: "#64748B" },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  sheetBody: { maxHeight: 480 },
  sheetBodyContent: { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  ratingCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 2,
  },
  ratingLabel: { fontSize: 12, fontWeight: "700", color: "#047857" },
  ratingValue: { fontSize: 16, fontWeight: "800", color: "#065F46" },
  block: { gap: 6 },
  blockLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  blockText: { fontSize: 14, color: "#0F172A", lineHeight: 21 },
  competency: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  competencyCopy: { flex: 1, gap: 2 },
  competencyName: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  competencyComment: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  competencyLevel: { fontSize: 12, fontWeight: "700", color: "#670CF5" },
  footnote: { fontSize: 12, color: "#94A3B8", lineHeight: 17, marginTop: 4 },
});
