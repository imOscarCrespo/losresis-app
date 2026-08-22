import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  SELF_ASSESSMENT_STATE,
  getResidentSelfAssessments,
  selfAssessmentStateOf,
} from "../services/docenciaService";
import SelfAssessmentAnswerScreen from "./SelfAssessmentAnswerScreen";
import { countAnswered, normalizeQuestions } from "../utils/autoevaluacion";

/**
 * Las autoevaluaciones que le han mandado al residente. Es lo único de Docencia que
 * él rellena, y la app nunca las crea: solo responde lo que le llega del panel.
 *
 * Esta pantalla es la lista. Responder ocurre en su propia pantalla
 * (SelfAssessmentAnswerScreen), no en una hoja modal: el formulario es largo, lleva
 * teclado y se contesta en varias sentadas.
 */

const STATE_COPY = {
  [SELF_ASSESSMENT_STATE.PENDING]: {
    label: "Pendiente",
    color: "#B45309",
    bg: "#FFFBEB",
  },
  [SELF_ASSESSMENT_STATE.IN_PROGRESS]: {
    label: "En progreso",
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  [SELF_ASSESSMENT_STATE.SUBMITTED]: {
    label: "Enviada",
    color: "#059669",
    bg: "#ECFDF5",
  },
  [SELF_ASSESSMENT_STATE.CLOSED]: {
    label: "Cerrada",
    color: "#64748B",
    bg: "#F1F5F9",
  },
};

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
  }).format(date);
};

export default function SelfAssessmentsScreen({ userProfile, onBack }) {
  const userId = userProfile?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Se guarda el id, no la fila: al volver de responder la lista se recarga y la que
  // manda es la fila fresca, no la que se abrió.
  const [abiertaId, setAbiertaId] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setItems(await getResidentSelfAssessments(userId));
    } catch (error) {
      console.error("Error loading self assessments:", error);
      setItems([]);
    }
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    posthogLogger.logScreen("SelfAssessmentsScreen");
    setLoading(true);
    // El guard evita el setState tras desmontar si el residente sale mientras carga.
    load().finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [load]);

  const abierta = useMemo(
    () => items.find((item) => item.id === abiertaId) || null,
    [items, abiertaId]
  );

  if (abiertaId && abierta) {
    return (
      <SelfAssessmentAnswerScreen
        solicitud={abierta}
        onBack={() => setAbiertaId(null)}
        onFinished={load}
      />
    );
  }

  return (
    <HeroScreenLayout
      title="Autoevaluación"
      subtitle="Lo que tu tutor te pide que valores de tu año"
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
            items.map((item) => {
              const state = selfAssessmentStateOf(item);
              const copy = STATE_COPY[state];
              const due = formatDate(item.due_date);
              const preguntas = normalizeQuestions(item.questions);
              const respondidas = countAnswered(preguntas, item.answers);
              const meta = [
                item.period_label,
                item.speciality_name,
                item.residency_year ? `R${item.residency_year}` : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => setAbiertaId(item.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>
                      {item.template_name || item.period_label || "Autoevaluación"}
                    </Text>
                    {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
                    <Text style={styles.cardMeta}>
                      {`${respondidas} de ${preguntas.length} respondidas`}
                      {due ? ` · antes del ${due}` : ""}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: copy.bg }]}>
                    <Text style={[styles.badgeText, { color: copy.color }]}>
                      {copy.label}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.empty}>
              <Icon name="journal-outline" size={24} color="#670CF5" />
              <Text style={styles.emptyTitle}>Nada que autoevaluar todavía</Text>
              <Text style={styles.emptyText}>
                Cuando tu tutor te mande la autoevaluación del año, la responderás
                aquí.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  cardCopy: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  cardMeta: { fontSize: 12, color: "#64748B" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700" },
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
});
