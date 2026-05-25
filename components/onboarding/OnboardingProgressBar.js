import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

/**
 * Barra de progreso segmentada: una píldora por paso, las completadas
 * (y la actual) se rellenan en blanco, las pendientes quedan translúcidas.
 */
export const OnboardingProgressBar = ({ currentStep, totalSteps }) => {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <ProgressSegment
          key={index}
          active={index <= currentStep}
        />
      ))}
    </View>
  );
};

const ProgressSegment = ({ active }) => {
  const opacity = useRef(new Animated.Value(active ? 1 : 0.25)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: active ? 1 : 0.25,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [active, opacity]);

  return <Animated.View style={[styles.segment, { opacity }]} />;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
});
