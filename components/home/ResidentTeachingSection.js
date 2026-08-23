import React, { useMemo } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Icon } from "../Icon";

/**
 * "Docencia": el punto de acceso a toda la actividad docente del residente.
 *
 * Comunicados, Tutorías y Autoevaluaciones vivían repartidos entre los iconos de
 * accesos rápidos y "Te toca a ti", y para encontrarlos había que saber ya que
 * existían. Aquí están los tres juntos, cada uno con lo único que el residente
 * necesita para decidir si entra: si hay algo nuevo, y qué es.
 *
 * **Evaluaciones no está, y es a propósito.** Es el documento que escribe el tutor:
 * el residente lo lee y no lo completa, así que una tarjeta suya nunca tendría nada
 * accionable que decir. Se sigue llegando desde su notificación, que no se ha
 * tocado.
 *
 * La sección NO es una segunda fuente de datos: los números salen de
 * `resident_teaching_home`, la misma llamada que ya alimenta "Te toca a ti", y cada
 * tarjeta abre la pantalla que ya existía. Lo único que cambia es desde dónde se
 * entra.
 *
 * Los tres estados de una tarjeta, y por qué se distinguen:
 *
 *   ACTIVA        El hospital usa el módulo. Abre su pantalla, tenga contenido o no:
 *                 una lista vacía con su "todavía no hay nada" explica mucho mejor
 *                 que un acceso que no reacciona.
 *
 *   NO DISPONIBLE El hospital todavía no usa el módulo. La tarjeta se queda —gris y
 *                 sin abrir nada— en vez de desaparecer, para que el residente sepa
 *                 que la función existe y que lo que falta es que su hospital la
 *                 estrene. Con al menos una así, la cabecera lo dice con todas las
 *                 letras.
 *
 *   SIN CARGAR    Ni una cosa ni la otra. Es el estado de "no lo sabemos": mientras
 *                 carga, y también si la consulta falla. NO se pinta el gris, porque
 *                 el gris afirma algo —"tu hospital no lo tiene"— que en ese momento
 *                 no sabemos si es verdad; se dejan abiertas, y quien contesta con
 *                 su propio error es la pantalla que abren.
 */

const MODULES = [
  {
    key: "announcements",
    title: "Comunicados",
    section: "comunicados",
    // El nombre suelto para el aviso de "no disponible". Es el mismo que el título
    // en los tres, pero se declara aparte porque el título puede acortarse para
    // caber en la tarjeta y la frase tiene que seguir leyéndose bien.
    name: "Comunicados",
    image: require("../../assets/docencia/comunicados.png"),
    imageOff: require("../../assets/docencia/comunicados-off.png"),
    tone: "violet",
  },
  {
    key: "tutoring",
    title: "Tutorías",
    section: "tutorias",
    name: "Tutorías",
    image: require("../../assets/docencia/tutorias.png"),
    imageOff: require("../../assets/docencia/tutorias-off.png"),
    tone: "violet",
  },
  {
    key: "selfAssessments",
    title: "Autoevaluaciones",
    section: "autoevaluacion",
    name: "Autoevaluaciones",
    image: require("../../assets/docencia/autoevaluacion.png"),
    imageOff: require("../../assets/docencia/autoevaluacion-off.png"),
    tone: "mint",
  },
];

const TONES = {
  violet: { bg: "#EDE4FF", color: "#5B21B6" },
  mint: { bg: "#D9F7E7", color: "#047857" },
};

/** "22 ago". Sin el punto de la abreviatura, que en un badge parece suciedad. */
const shortDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(".", "");
};

/**
 * Lo que dice cada tarjeta, derivado del estado real. Nunca texto fijo: la Imagen 1
 * enseña un caso concreto, no la única frase posible.
 *
 * El badge es solo para lo ACCIONABLE o lo inminente. Sin nada que decir no se pinta
 * badge, y la tarjeta se queda con su subtítulo.
 */
const copyFor = (key, state) => {
  if (key === "announcements") {
    const unread = state?.unread || 0;
    return {
      badge: unread > 0 ? (unread === 1 ? "1 nuevo" : `${unread} nuevos`) : null,
      subtitle: state?.count
        ? "Avisos y noticias importantes"
        : "Todavía no hay comunicados",
    };
  }

  if (key === "tutoring") {
    const pending = state?.pending || 0;
    if (pending > 0) {
      return {
        badge:
          pending === 1 ? "1 por completar" : `${pending} por completar`,
        subtitle: "Repasa lo que quedó pendiente",
      };
    }

    const next = shortDate(state?.nextAt);
    if (next) {
      return { badge: `Próx. ${next}`, subtitle: "1 próxima tutoría" };
    }

    return {
      badge: null,
      subtitle: state?.count
        ? "Tu historial de tutorías"
        : "Todavía no tienes tutorías",
    };
  }

  const pending = state?.pending || 0;
  if (pending > 0) {
    return {
      badge: pending === 1 ? "1 pendiente" : `${pending} pendientes`,
      subtitle: "Completa tu autoevaluación",
    };
  }

  return {
    badge: null,
    subtitle: state?.count
      ? "Tus autoevaluaciones enviadas"
      : "Todavía no tienes autoevaluaciones",
  };
};

const TeachingCard = ({ module, state, resolved, onPress }) => {
  // Solo se apaga cuando SABEMOS que el hospital no lo tiene. Mientras no lo
  // sabemos la tarjeta se queda abierta: ver "SIN CARGAR" arriba.
  const disabled = resolved && !state?.available;
  const tone = TONES[module.tone] || TONES.violet;
  const { badge, subtitle } = resolved
    ? copyFor(module.key, state)
    : { badge: null, subtitle: "" };

  const body = (
    <>
      <View
        style={[styles.art, disabled && styles.artOff]}
        pointerEvents="none"
      >
        <Image
          source={disabled ? module.imageOff : module.image}
          style={[styles.artImage, disabled && styles.artImageOff]}
          resizeMode="cover"
        />
      </View>

      <View style={styles.panel}>
        {/* `adjustsFontSizeToFit` es el seguro de "Autoevaluaciones", que es el
            título más largo de los tres y el que se queda al borde del ancho de la
            tarjeta. Prefiere encogerlo un punto antes que cortarlo: un
            "Autoevaluacione…" no es un título. */}
        <Text
          style={[styles.title, disabled && styles.titleOff]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {module.title}
        </Text>

        {disabled ? (
          <View style={styles.badgeOff}>
            <Icon name="lock-closed" size={11} color="#94A3B8" />
            <Text style={styles.badgeOffText}>No disponible</Text>
          </View>
        ) : badge ? (
          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.badgeText, { color: tone.color }]}>
              {badge}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          {/* Tres líneas cuando está apagada: la frase nombra el módulo y en el
              ancho de una tarjeta no cabe en dos. Como la fila iguala alturas, lo
              que crece es la sección entera y no una tarjeta suelta. */}
          <Text
            style={[styles.subtitle, disabled && styles.subtitleOff]}
            numberOfLines={disabled ? 3 : 2}
          >
            {disabled
              ? `Tu hospital aún no ha habilitado ${module.name}.`
              : subtitle}
          </Text>
          <View style={[styles.arrow, disabled && styles.arrowOff]}>
            <Icon
              name="arrow-forward"
              size={16}
              color={disabled ? "#B6BECC" : "#670CF5"}
            />
          </View>
        </View>
      </View>
    </>
  );

  if (disabled) {
    return (
      <View
        style={[styles.card, styles.cardOff]}
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel={`${module.title}. No disponible. Tu hospital aún no ha habilitado ${module.name}.`}
      >
        {body}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(module)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={[module.title, badge, subtitle]
        .filter(Boolean)
        .join(". ")}
    >
      {body}
    </TouchableOpacity>
  );
};

export const ResidentTeachingSection = ({ modules, loading = false, onPress }) => {
  // "Ya sabemos qué tiene el hospital". Mientras carga no lo sabemos, y si la
  // consulta falló tampoco: en los dos casos `loaded` viene a false y ninguna
  // tarjeta se apaga.
  const resolved = !loading && !!modules?.loaded;

  const someUnavailable = useMemo(
    () =>
      resolved &&
      MODULES.some((module) => !modules?.[module.key]?.available),
    [modules, resolved]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.bar} />
        <Text style={styles.sectionTitle}>Docencia</Text>
      </View>

      {/* El aviso solo aparece si de verdad falta algo. Con los tres módulos
          disponibles la cabecera se queda limpia. */}
      {someUnavailable ? (
        <View style={styles.notice}>
          <Icon name="information-circle" size={16} color="#7C3AED" />
          <Text style={styles.noticeText}>
            Tu hospital todavía no ha habilitado todas las funciones de Docencia.
          </Text>
        </View>
      ) : null}

      {/* Las tres tarjetas no caben a lo ancho de un móvil sin partir los títulos,
          así que se deslizan. El orden es fijo —Comunicados, Tutorías,
          Autoevaluaciones— y no se reordena por estado: un acceso que cambia de
          sitio según lo que haya pendiente deja de ser un sitio. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {MODULES.map((module) => (
          <TeachingCard
            key={module.key}
            module={module}
            state={modules?.[module.key]}
            resolved={resolved}
            onPress={onPress}
          />
        ))}
      </ScrollView>
    </View>
  );
};

// Las tres no caben a lo ancho de un móvil, así que la fila desliza y el ancho lo
// manda el contenido: 196 es lo que necesita "Autoevaluaciones" para caber en una
// línea junto a su badge, y deja asomando la siguiente tarjeta lo justo para que se
// vea que hay más.
const CARD_WIDTH = 196;

const styles = StyleSheet.create({
  // El margen horizontal y la separación vertical los pone el contenedor del
  // inicio (padding de styles.content y gap de residentTopStack).
  wrap: {},
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  bar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: "#670CF5",
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F3EEFF",
    marginBottom: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#5B21B6",
  },
  // `alignItems: stretch` iguala la altura de las tres: sin él, la tarjeta sin
  // badge queda más baja que sus vecinas y la fila se ve rota.
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    paddingRight: 4,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 22,
    backgroundColor: "#F1E8FB",
    padding: 6,
    gap: 6,
  },
  cardOff: {
    backgroundColor: "#F1F2F5",
  },
  art: {
    height: 138,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#F1E8FB",
  },
  artOff: {
    backgroundColor: "#EDEEF1",
  },
  artImage: {
    width: "100%",
    height: "100%",
  },
  // La ilustración apagada ya viene en gris (assets `-off`); la opacidad solo la
  // aclara para que no pese más que la tarjeta activa de al lado.
  artImageOff: {
    opacity: 0.55,
  },
  panel: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 12,
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  titleOff: { color: "#94A3B8" },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
  badgeOff: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EDEEF1",
  },
  badgeOffText: { fontSize: 11, fontWeight: "700", color: "#94A3B8" },
  // `marginTop: auto` pega el pie al fondo del panel, para que las flechas de las
  // tres tarjetas queden a la misma altura aunque el badge falte en alguna.
  footer: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  subtitle: { flex: 1, fontSize: 12, lineHeight: 16, color: "#64748B" },
  subtitleOff: { color: "#A3ABB8" },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE4FF",
    shadowColor: "#670CF5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  arrowOff: {
    backgroundColor: "#EDEEF1",
    borderColor: "#E4E6EB",
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default ResidentTeachingSection;
