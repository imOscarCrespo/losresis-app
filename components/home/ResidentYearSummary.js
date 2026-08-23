import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useSalaryVisibility } from "../../hooks/useSalaryVisibility";
import { Icon } from "../Icon";

const HIDDEN_VALUE = "••••";

const formatEur = (value) => {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value).toLocaleString("es-ES")} €`;
};

/**
 * "Tu año de un vistazo": los tres números del año del residente, cada uno
 * puerta de su pantalla.
 *
 * Las tres cifras NO comparten calendario, y es a propósito: el Progreso y las
 * Guardias van por año de residencia (junio-mayo, ver utils/residencyYear),
 * mientras el neto va por año natural, que es como se cobra y se declara. Por
 * eso cada tile lleva su propio pie con el marco temporal en vez de un titular
 * común que sería mentira para alguna de las tres.
 *
 * Las Guardias son las que ya ha hecho: las que tiene puestas en la agenda para
 * los próximos días no cuentan (ver `countResidencyYearShifts`), porque este
 * número se lee como "lo que llevas de año", no como "lo que tienes apuntado".
 *
 * El Progreso solo mide los objetivos que ha fijado el tutor (ADR 0008); sin
 * plantilla publicada no hay denominador y se muestra "—" en lugar de un 0 %,
 * que se leería como "no has hecho nada".
 *
 * El ojo de la cabecera esconde **solo el Neto** (ver `useSalaryVisibility`):
 * el sueldo es lo único de esta fila que el residente no quiere que lea el
 * compañero al que le está enseñando el móvil, y el Progreso o las Guardias no
 * le dan ninguna vergüenza. Está arriba y no dentro del tile porque ahí es un
 * botón que se acierta a la primera; el precio es que parece gobernar la sección
 * entera, y por eso el tile oculto se sigue marcando con su punteado.
 */
export const ResidentYearSummary = ({ year, userId, onPressSection }) => {
  const residencyLabel = year?.residencyYear ? `R${year.residencyYear}` : "Año";
  const { hidden: salaryHidden, toggle: toggleSalary } =
    useSalaryVisibility(userId);

  const tiles = [
    {
      key: "progress",
      value: year?.progress ? `${year.progress.percent} %` : "—",
      label: "Progreso",
      footer: year?.progress
        ? `${year.progress.done}/${year.progress.total} objetivos`
        : residencyLabel,
      section: "residenceLibrary",
    },
    {
      key: "shifts",
      value: String(year?.shifts ?? 0),
      label: "Guardias",
      footer: residencyLabel,
      section: "agenda",
    },
    {
      // El importe sale de `gross_total_eur`, pero lo que el residente teclea en
      // "Total nómina" es lo que le entra en la cuenta: aquí se llama Neto, que
      // es como lo lee él. El nombre de la columna es anterior y se queda.
      key: "net",
      value: salaryHidden ? HIDDEN_VALUE : formatEur(year?.grossEur),
      label: "Neto",
      footer: String(year?.calendarYear || ""),
      section: "residentPayouts",
      hideable: true,
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.bar} />
        <Text style={styles.title}>Tu año de un vistazo</Text>
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={toggleSalary}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={
            salaryHidden ? "Mostrar el neto" : "Ocultar el neto"
          }
        >
          <Icon
            name={salaryHidden ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={salaryHidden ? "#670CF5" : "#64748B"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        {tiles.map((tile) => (
          <TouchableOpacity
            key={tile.key}
            style={styles.tile}
            onPress={() => onPressSection?.(tile.section)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              tile.hideable && salaryHidden
                ? `${tile.label} oculto. ${tile.footer}`
                : `${tile.label}: ${tile.value}. ${tile.footer}`
            }
          >
            <Text
              style={[
                styles.tileValue,
                tile.hideable && salaryHidden && styles.tileValueHidden,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {tile.value}
            </Text>
            <Text style={styles.tileLabel}>{tile.label}</Text>
            <Text style={styles.tileFooter} numberOfLines={1}>
              {tile.footer}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

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
    backgroundColor: "#00BD7C",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  // El ojo vive en la cabecera y no dentro del tile: ahí es un botón de 36 que
  // se acierta con el pulgar, y dentro era un icono de 14 pegado al texto.
  eyeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  tile: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tileValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
  },
  // Oculto el número pesa menos: los puntos no deben leerse como una cifra.
  tileValueHidden: {
    color: "#CBD5E1",
    letterSpacing: 2,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  tileFooter: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
  },
});

export default ResidentYearSummary;
