import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { COLORS } from "../constants/colors";
import { CBI_DOMAINS } from "../constants/cbiQuestionnaire";
import {
  CCAA_LIST,
  CRISIS_RESOURCES,
  getPaimeForCcaa,
} from "../constants/paimeResources";
import { useMentalHealth } from "../hooks/useMentalHealth";
import MentalHealthQuestionnaireScreen from "./MentalHealthQuestionnaireScreen";

const DOMAIN_ORDER = ["personal", "work", "patient"];

const formatDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (e) {
    return "";
  }
};

const callNumber = (phone) => {
  if (!phone) return;
  Linking.openURL(`tel:${phone}`).catch(() => {});
};

const openWeb = (url) => {
  if (!url) return;
  Linking.openURL(url).catch(() => {});
};

/** Texto neutro de evolución por dimensión (sin juicio de "bueno/malo"). */
const renderDelta = (current, previous) => {
  if (current === null || current === undefined) return null;
  if (previous === null || previous === undefined) {
    return { icon: "remove", color: COLORS.GRAY, text: "Primera medición" };
  }
  const diff = Math.round(current - previous);
  if (diff === 0) {
    return { icon: "remove", color: COLORS.GRAY, text: "Igual que la vez anterior" };
  }
  if (diff < 0) {
    return {
      icon: "arrow-down",
      color: COLORS.SUCCESS,
      text: `${Math.abs(diff)} menos que la vez anterior`,
    };
  }
  return {
    icon: "arrow-up",
    color: COLORS.ORANGE,
    text: `${diff} más que la vez anterior`,
  };
};

export default function MentalHealthScreen({ userProfile, onBack }) {
  const {
    assessments,
    lastAssessment,
    hasConsented,
    isDueThisMonth,
    loading,
    saving,
    error,
    saveConsent,
    saveAssessment,
    deleteAllData,
  } = useMentalHealth(userProfile?.id);

  const [view, setView] = useState("hub"); // 'hub' | 'consent' | 'questionnaire'
  const [selectedCcaa, setSelectedCcaa] = useState(null);
  const [showCcaaPicker, setShowCcaaPicker] = useState(false);
  const [showResources, setShowResources] = useState(false);

  // La evaluación de bienestar está abierta a todo residente (is_resident),
  // incluso si aún no ha verificado su email corporativo: el bienestar no debe
  // depender del estado de validación de la cuenta.
  const canAssess = Boolean(userProfile?.is_resident);
  const previousAssessment = assessments[1] || null;
  const paime = selectedCcaa ? getPaimeForCcaa(selectedCcaa) : null;

  const handleStart = () => {
    if (!canAssess) return;
    if (!hasConsented) {
      setView("consent");
      return;
    }
    setView("questionnaire");
  };

  const handleAcceptConsent = async () => {
    const ok = await saveConsent();
    if (ok) setView("questionnaire");
  };

  const handleSubmitAssessment = async (answers) => {
    const created = await saveAssessment(answers);
    if (created) setView("hub");
  };

  const handleDelete = () => {
    Alert.alert(
      "Borrar tu historial",
      "Se eliminarán todas tus evaluaciones de bienestar. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: () => deleteAllData(),
        },
      ]
    );
  };

  if (view === "questionnaire") {
    return (
      <MentalHealthQuestionnaireScreen
        onSubmit={handleSubmitAssessment}
        onCancel={() => setView("hub")}
        saving={saving}
      />
    );
  }

  if (view === "consent") {
    return (
      <HeroScreenLayout
        title="Antes de empezar"
        subtitle="Tu bienestar es asunto tuyo y solo tuyo"
        onBack={() => setView("hub")}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.consentTitle}>Privacidad y consentimiento</Text>
            <Text style={styles.consentText}>
              Esta evaluación es una herramienta de autoconocimiento, no un
              diagnóstico médico.
            </Text>
            <Text style={styles.consentText}>
              Tus respuestas son datos de salud y los tratamos con especial
              cuidado: se guardan de forma privada, solo tú puedes verlos y nunca
              se cruzan con el resto de tu actividad en la app.
            </Text>
            <Text style={styles.consentText}>
              Puedes borrar todo tu historial cuando quieras desde esta misma
              sección.
            </Text>
            <Text style={styles.consentText}>
              Para continuar, necesitamos tu consentimiento explícito para
              guardar estas respuestas.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={handleAcceptConsent}
            disabled={saving}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? "Guardando..." : "Acepto y continúo"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setView("hub")}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Ahora no</Text>
          </TouchableOpacity>
        </ScrollView>
      </HeroScreenLayout>
    );
  }

  return (
    <HeroScreenLayout
      title="Salud mental"
      subtitle="Cuida tu bienestar durante la residencia"
      onBack={onBack}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Nudge mensual (no bloquea nada) */}
          {canAssess && isDueThisMonth && (
            <View style={styles.nudgeCard}>
              <Ionicons name="heart-outline" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.nudgeText}>
                {lastAssessment
                  ? "Toca tu evaluación de bienestar de este mes."
                  : "Tómate 5 minutos para tu primera evaluación de bienestar."}
              </Text>
            </View>
          )}

          {/* Introducción cuando aún no hay ninguna evaluación */}
          {assessments.length === 0 && (
            <View style={styles.card}>
              <View style={styles.introIconWrap}>
                <Ionicons name="heart-circle" size={34} color={COLORS.PRIMARY} />
              </View>
              <Text style={styles.introTitle}>Cuida tu bienestar, mes a mes</Text>
              <Text style={styles.introText}>
                La residencia desgasta poco a poco y el burnout cuesta verlo desde
                dentro. En 5 minutos mides cómo estás (personal, trabajo y pacientes).
                No es un diagnóstico.
              </Text>
              <Text style={styles.introText}>
                Su valor está en repetirla: hacerla cada mes te deja ver la tendencia y
                reaccionar a tiempo. Tus respuestas son privadas.
              </Text>
            </View>
          )}

          {/* Resultado de la última evaluación */}
          {lastAssessment && (
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>
                TU ÚLTIMA EVALUACIÓN · {formatDate(lastAssessment.created_at)}
              </Text>
              {DOMAIN_ORDER.map((key) => {
                const domain = CBI_DOMAINS[key];
                const score = lastAssessment[domain.scoreField];
                const prevScore = previousAssessment
                  ? previousAssessment[domain.scoreField]
                  : null;
                const delta = renderDelta(score, prevScore);
                return (
                  <View key={key} style={styles.dimensionRow}>
                    <View style={styles.dimensionHeader}>
                      <Text style={styles.dimensionLabel}>{domain.label}</Text>
                      <Text style={styles.dimensionScore}>
                        {score === null ? "—" : Math.round(score)}
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${score === null ? 0 : score}%` },
                        ]}
                      />
                    </View>
                    {delta && (
                      <View style={styles.deltaRow}>
                        <Ionicons
                          name={delta.icon}
                          size={13}
                          color={delta.color}
                        />
                        <Text style={[styles.deltaText, { color: delta.color }]}>
                          {delta.text}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
              <Text style={styles.disclaimer}>
                Son indicadores de tu bienestar a lo largo del tiempo, no un
                diagnóstico. Lo importante es cómo evolucionan.
              </Text>
            </View>
          )}

          {/* CTA evaluación */}
          {canAssess ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStart}
              activeOpacity={0.9}
            >
              <Ionicons name="clipboard-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {lastAssessment ? "Nueva evaluación" : "Hacer mi primera evaluación"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.lockedCard}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.GRAY} />
              <Text style={styles.lockedText}>
                La evaluación de bienestar estará disponible cuando completes la
                validación de tu cuenta de residente. Mientras tanto, los recursos
                de ayuda de abajo están siempre a tu disposición.
              </Text>
            </View>
          )}

          {/* Recursos de ayuda — sección colapsable, cerrada por defecto */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.collapseHeader}
              onPress={() => setShowResources((prev) => !prev)}
              activeOpacity={0.85}
            >
              <View style={styles.collapseHeaderText}>
                <Text style={styles.cardTitle}>Recursos de ayuda</Text>
                <Text style={styles.cardSubtitle}>
                  Si lo necesitas, hablar con un profesional es un signo de
                  fortaleza.
                </Text>
              </View>
              <Ionicons
                name={showResources ? "chevron-up" : "chevron-down"}
                size={22}
                color={COLORS.PRIMARY}
              />
            </TouchableOpacity>

            {showResources && (
              <View style={styles.collapseBody}>
            {CRISIS_RESOURCES.map((res) => (
              <TouchableOpacity
                key={res.phone}
                style={styles.resourceRow}
                onPress={() => callNumber(res.phone)}
                activeOpacity={0.85}
              >
                <View style={styles.resourceIcon}>
                  <Ionicons name="call" size={18} color={COLORS.PRIMARY} />
                </View>
                <View style={styles.resourceBody}>
                  <Text style={styles.resourceName}>{res.name}</Text>
                  <Text style={styles.resourceDesc}>{res.description}</Text>
                </View>
                <Text style={styles.resourcePhone}>{res.phone}</Text>
              </TouchableOpacity>
            ))}

            {/* PAIME por CCAA (selección manual) */}
            <View style={styles.paimeBlock}>
              <Text style={styles.paimeTitle}>
                PAIME · Atención al médico
              </Text>
              <TouchableOpacity
                style={styles.ccaaSelector}
                onPress={() => setShowCcaaPicker((prev) => !prev)}
                activeOpacity={0.85}
              >
                <Text style={styles.ccaaSelectorText}>
                  {selectedCcaa || "Elige tu comunidad autónoma"}
                </Text>
                <Ionicons
                  name={showCcaaPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={COLORS.PRIMARY}
                />
              </TouchableOpacity>

              {showCcaaPicker && (
                <View style={styles.ccaaList}>
                  {CCAA_LIST.map((ccaa) => (
                    <TouchableOpacity
                      key={ccaa}
                      style={styles.ccaaOption}
                      onPress={() => {
                        setSelectedCcaa(ccaa);
                        setShowCcaaPicker(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.ccaaOptionText,
                          selectedCcaa === ccaa && styles.ccaaOptionTextActive,
                        ]}
                      >
                        {ccaa}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {paime && (
                <View style={styles.paimeCard}>
                  <Text style={styles.paimeName}>{paime.name}</Text>
                  <Text style={styles.paimeDesc}>{paime.description}</Text>
                  <View style={styles.paimeActions}>
                    {paime.phone && (
                      <TouchableOpacity
                        style={styles.paimeAction}
                        onPress={() => callNumber(paime.phone)}
                      >
                        <Ionicons name="call" size={15} color={COLORS.PRIMARY} />
                        <Text style={styles.paimeActionText}>{paime.phone}</Text>
                      </TouchableOpacity>
                    )}
                    {paime.web && (
                      <TouchableOpacity
                        style={styles.paimeAction}
                        onPress={() => openWeb(paime.web)}
                      >
                        <Ionicons name="globe" size={15} color={COLORS.PRIMARY} />
                        <Text style={styles.paimeActionText}>Más info</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
              </View>
            )}
          </View>

          {/* Borrado de datos (RGPD) */}
          {assessments.length > 0 && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.ERROR} />
              <Text style={styles.deleteButtonText}>Borrar mi historial</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 13,
    fontWeight: "600",
  },
  nudgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.PRIMARY_SOFT,
    borderRadius: 16,
    padding: 14,
  },
  nudgeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.PRIMARY_DARK,
    lineHeight: 19,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: COLORS.PRIMARY,
    marginBottom: 16,
  },
  introIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  introTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.PRIMARY_DARK,
    marginBottom: 12,
  },
  introText: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.TEXT_MEDIUM,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.PRIMARY_DARK,
  },
  collapseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  collapseHeaderText: {
    flex: 1,
  },
  collapseBody: {
    marginTop: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  dimensionRow: {
    marginBottom: 16,
  },
  dimensionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  dimensionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_DARK,
  },
  dimensionScore: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.PRIMARY_DARK,
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.GRAY_LIGHT,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.PRIMARY,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: "700",
  },
  disclaimer: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
    lineHeight: 17,
    marginTop: 4,
    fontStyle: "italic",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.TEXT_LIGHT,
  },
  lockedCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 16,
    padding: 16,
  },
  lockedText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.TEXT_MEDIUM,
  },
  consentTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.PRIMARY_DARK,
    marginBottom: 12,
  },
  consentText: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.TEXT_MEDIUM,
    marginBottom: 12,
  },
  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  resourceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  resourceBody: {
    flex: 1,
  },
  resourceName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.TEXT_DARK,
  },
  resourceDesc: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
    marginTop: 2,
    lineHeight: 16,
  },
  resourcePhone: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.PRIMARY,
  },
  paimeBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  paimeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.TEXT_DARK,
    marginBottom: 10,
  },
  ccaaSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY_SOFT,
  },
  ccaaSelectorText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.PRIMARY_DARK,
  },
  ccaaList: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: "hidden",
  },
  ccaaOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  ccaaOptionText: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
  },
  ccaaOptionTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: "800",
  },
  paimeCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.BACKGROUND,
  },
  paimeName: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.PRIMARY_DARK,
  },
  paimeDesc: {
    fontSize: 13,
    color: COLORS.TEXT_MEDIUM,
    lineHeight: 18,
    marginTop: 4,
  },
  paimeActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  paimeAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  paimeActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.PRIMARY,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.ERROR,
  },
});
