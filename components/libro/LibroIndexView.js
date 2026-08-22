import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../Icon";
import { LibroProgressRing } from "./LibroProgressRing";
import {
  getLibroSectionDescription,
  getLibroSectionIcon,
} from "../../data/libroSections";
import { COLOR_TOKEN_MAP } from "../../data/libroOnboardingTemplates";
import { LIBRO_SECTION_BY_CODE } from "../../data/libroSections";

/**
 * La pantalla principal del Libro del Residente.
 *
 * Lo que se pinta NO es una lista fija de apartados: son los que su hospital ha
 * configurado para su especialidad y su año. Dos residentes del mismo hospital y
 * distinta especialidad ven cosas distintas, y eso es lo normal.
 *
 * El contador de cada tarjeta significa algo distinto según el arquetipo, así que el
 * texto lo dice: "2 de 6" en un itinerario no es lo mismo que "28 registros".
 */

const countLabel = (item) => {
  if (item.archetype === "itinerary") {
    return `${item.count} de ${item.total ?? 0}`;
  }
  return `${item.count}`;
};

export const LibroIndexView = ({
  residencyYear,
  progress,
  sections = [],
  onOpenSection,
  isArchived = false,
}) => (
  <View style={styles.container}>
    <View style={styles.progressCard}>
      <View style={styles.progressIcon}>
        <Icon name="book-outline" size={18} color="#670CF5" />
      </View>
      <View style={styles.progressCopy}>
        <Text style={styles.progressTitle}>Tu progreso general</Text>
        <Text style={styles.progressSubtitle}>
          {progress
            ? `${progress.done} de ${progress.total} objetivos de tu tutor`
            : "Tu tutor no ha fijado objetivos para este año"}
        </Text>
      </View>
      {progress ? (
        <LibroProgressRing percent={progress.percent} />
      ) : (
        <Text style={styles.progressDash}>—</Text>
      )}
    </View>

    <Text style={styles.sectionLabel}>Apartados del libro</Text>

    {sections.length ? (
      sections.map((item) => {
        const color =
          COLOR_TOKEN_MAP[LIBRO_SECTION_BY_CODE[item.section]?.color_token] ||
          "#670CF5";

        return (
          <TouchableOpacity
            key={item.section}
            style={styles.card}
            onPress={() => onOpenSection?.(item)}
            activeOpacity={0.85}
          >
            <View style={[styles.cardIcon, { backgroundColor: `${color}1A` }]}>
              <Icon name={getLibroSectionIcon(item.section)} size={18} color={color} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {getLibroSectionDescription(item.section)}
              </Text>
            </View>
            <View style={styles.cardCount}>
              <Text style={styles.cardCountText}>{countLabel(item)}</Text>
            </View>
            <Icon name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        );
      })
    ) : (
      <View style={styles.empty}>
        <Icon name="book-outline" size={22} color="#670CF5" />
        <Text style={styles.emptyTitle}>{`R${residencyYear} sin apartados`}</Text>
        <Text style={styles.emptyText}>
          {isArchived
            ? "Este año quedó archivado sin contenido."
            : "Tu tutor todavía no ha configurado el libro de este año."}
        </Text>
      </View>
    )}
  </View>
);

export default LibroIndexView;

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    marginBottom: 6,
  },
  progressIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  progressCopy: {
    flex: 1,
    gap: 2,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1B0977",
  },
  progressSubtitle: {
    fontSize: 12,
    color: "#6D28D9",
    lineHeight: 17,
  },
  progressDash: {
    fontSize: 20,
    fontWeight: "800",
    color: "#A78BFA",
    paddingHorizontal: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
    marginBottom: 2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1B0977",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748B",
  },
  cardCount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  cardCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  empty: {
    alignItems: "center",
    gap: 8,
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1B0977",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
});
