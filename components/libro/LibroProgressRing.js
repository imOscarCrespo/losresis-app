import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

/**
 * El anillo del Progreso del año.
 *
 * Mide SOLO lo que el tutor ha fijado como objetivo (docs/adr/0008): fichas de
 * itinerario completadas más actividades con meta. Sin objetivos no hay anillo:
 * un 0% cuando nadie te ha pedido nada sería mentira, así que quien llama pinta
 * cifras en su lugar.
 */
export const LibroProgressRing = ({
  percent = 0,
  size = 52,
  strokeWidth = 5,
  color = "#670CF5",
  trackColor = "#E9D5FF",
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const dash = (safePercent / 100) * circumference;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          // Empieza arriba, no a la derecha.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.label}>
        <Text style={[styles.labelText, { color }]}>{`${safePercent}%`}</Text>
      </View>
    </View>
  );
};

export default LibroProgressRing;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  labelText: {
    fontSize: 12,
    fontWeight: "800",
  },
});
