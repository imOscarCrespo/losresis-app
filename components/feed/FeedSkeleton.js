import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing } from "react-native";

// Placeholder del Feed para el único arranque sin snapshot (primera vez de
// siempre). Sustituye al spinner: reserva la altura de ~2 tarjetas con un
// pulso suave, así no hay salto de tamaño al llegar el contenido real ni se
// afirma "tu feed está tranquilo" antes de tiempo.
// Ver docs/adr/0004-feed-actividad-de-guardia-por-conexion.md
export default function FeedSkeleton({ count = 2 }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[styles.card, { opacity: pulse }]}>
          <View style={styles.header}>
            <View style={styles.avatar} />
            <View style={styles.headerText}>
              <View style={[styles.line, styles.name]} />
              <View style={[styles.line, styles.meta]} />
            </View>
          </View>
          <View style={[styles.line, styles.bodyLineFull]} />
          <View style={[styles.line, styles.bodyLineShort]} />
        </Animated.View>
      ))}
    </View>
  );
}

const BLOCK = "#E9E6F2";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#1B0977",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: BLOCK },
  headerText: { marginLeft: 12, flex: 1 },
  line: { backgroundColor: BLOCK, borderRadius: 6, height: 12 },
  name: { width: "50%", marginBottom: 8 },
  meta: { width: "32%", height: 10 },
  bodyLineFull: { width: "100%", marginBottom: 8 },
  bodyLineShort: { width: "70%" },
});
