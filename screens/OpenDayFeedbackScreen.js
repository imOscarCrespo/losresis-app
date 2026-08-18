import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import {
  getHospitalOpenDayById,
  getMyHospitalOpenDayFeedback,
  submitHospitalOpenDayFeedback,
} from "../services/hospitalService";
import { formatDateOnly } from "../utils/dateUtils";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const WHITE = "#FFFFFF";
const TEXT_DARK = "#0F172A";
const TEXT_MEDIUM = "#64748B";
const BORDER = "#E2E8F0";
const STAR = "#F59E0B";

const ESCALA = [1, 2, 3, 4, 5];

const ETIQUETA_ESTRELLAS = {
  1: "Muy floja",
  2: "Mejorable",
  3: "Correcta",
  4: "Buena",
  5: "Excelente",
};

// Valoración de una jornada de puertas abiertas. Se llega desde el push que
// manda el hospital cuando la jornada ya ha pasado ("¿Qué te pareció?"), así
// que la pantalla solo conoce el id de la jornada y se carga el resto.
// Volver a enviarla corrige la valoración anterior: hay una por persona.
export default function OpenDayFeedbackScreen({ openDayId, userProfile, onBack }) {
  const userId = userProfile?.id || null;

  const [openDay, setOpenDay] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [yaValorada, setYaValorada] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!openDayId) {
      setError("No hemos podido identificar la jornada.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [jornada, valoracion] = await Promise.all([
      getHospitalOpenDayById(openDayId),
      getMyHospitalOpenDayFeedback(openDayId, userId),
    ]);

    if (!jornada.success) {
      setError(jornada.error || "No hemos podido cargar la jornada.");
      setLoading(false);
      return;
    }

    setOpenDay(jornada.openDay);

    if (valoracion.feedback) {
      setRating(valoracion.feedback.rating);
      setComment(valoracion.feedback.comment || "");
      setYaValorada(true);
    }

    setLoading(false);
  }, [openDayId, userId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const enviar = async () => {
    if (!rating) {
      Alert.alert("Falta la puntuación", "Elige de 1 a 5 estrellas.");
      return;
    }

    setEnviando(true);
    const { success, error: submitError } = await submitHospitalOpenDayFeedback(
      openDayId,
      rating,
      comment.trim()
    );
    setEnviando(false);

    if (!success) {
      Alert.alert("No se ha podido enviar", submitError || "Inténtalo de nuevo.");
      return;
    }

    posthogLogger.capture("hospital_open_day_feedback_submitted", {
      open_day_id: openDayId,
      rating,
      has_comment: Boolean(comment.trim()),
      was_update: yaValorada,
    });

    setYaValorada(true);
    Alert.alert(
      "¡Gracias!",
      "El hospital ya tiene tu valoración de la jornada.",
      [{ text: "Vale", onPress: onBack }]
    );
  };

  return (
    <HeroScreenLayout
      title="Valorar la jornada"
      subtitle={openDay?.hospital_name || "Jornada de puertas abiertas"}
      onBack={onBack}
      keyboardAvoiding
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {openDay?.image_public_url ? (
              <Image
                source={{ uri: openDay.image_public_url }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : null}
            <Text style={styles.cardTitle}>{openDay?.title}</Text>
            <View style={styles.dateRow}>
              <Icon name="calendar-outline" size={14} color={TEXT_MEDIUM} />
              <Text style={styles.dateText}>
                {formatDateOnly(openDay?.event_date)}
              </Text>
            </View>
            {openDay?.description ? (
              <Text style={styles.description}>{openDay.description}</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.question}>¿Qué te pareció la jornada?</Text>
            <View style={styles.stars}>
              {ESCALA.map((valor) => (
                <TouchableOpacity
                  key={valor}
                  onPress={() => setRating(valor)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${valor} de 5`}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Icon
                    name={valor <= rating ? "star" : "star-outline"}
                    size={36}
                    color={valor <= rating ? STAR : BORDER}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingLabel}>
              {rating ? ETIQUETA_ESTRELLAS[rating] : "Toca las estrellas"}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.question}>¿Nos cuentas algo más?</Text>
            <Text style={styles.help}>
              Opcional. Lo lee el hospital para preparar la próxima edición.
            </Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={600}
              placeholder="Qué te gustó, qué echaste en falta, qué cambiarías…"
              placeholderTextColor={TEXT_MEDIUM}
              style={styles.input}
            />
            <Text style={styles.counter}>{comment.length}/600</Text>
          </View>

          <TouchableOpacity
            style={[styles.submit, enviando && styles.submitDisabled]}
            onPress={enviar}
            disabled={enviando}
            activeOpacity={0.85}
          >
            {enviando ? (
              <ActivityIndicator size="small" color={WHITE} />
            ) : (
              <Text style={styles.submitText}>
                {yaValorada ? "Actualizar valoración" : "Enviar valoración"}
              </Text>
            )}
          </TouchableOpacity>

          {yaValorada ? (
            <Text style={styles.footnote}>
              Ya has valorado esta jornada. Si cambias algo, se guardará encima
              de lo anterior.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: { fontSize: 15, color: TEXT_MEDIUM, textAlign: "center" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  image: { width: "100%", height: 140, borderRadius: 14, marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: "800", color: TEXT_DARK },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontSize: 13, color: TEXT_MEDIUM, fontWeight: "600" },
  description: { fontSize: 14, lineHeight: 21, color: TEXT_MEDIUM },
  question: { fontSize: 16, fontWeight: "700", color: TEXT_DARK },
  help: { fontSize: 13, color: TEXT_MEDIUM },
  stars: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  ratingLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_MEDIUM,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    minHeight: 110,
    textAlignVertical: "top",
    fontSize: 15,
    color: TEXT_DARK,
  },
  counter: { fontSize: 12, color: TEXT_MEDIUM, textAlign: "right" },
  submit: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: WHITE, fontSize: 16, fontWeight: "700" },
  footnote: { fontSize: 12, color: TEXT_MEDIUM, textAlign: "center" },
});
