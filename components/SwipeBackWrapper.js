import React, { useRef } from "react";
import { View, StyleSheet, Platform, Animated, Dimensions } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

const COMPLETE_THRESHOLD_RATIO = 0.35; // El swipe completa si supera el 35% del ancho
const VELOCITY_THRESHOLD = 800; // px/s: un flick rápido también completa
const COMPLETE_DURATION = 220; // ms para deslizar hasta el borde derecho

/**
 * Componente wrapper que detecta el gesto de swipe desde el borde izquierdo
 * hacia la derecha para navegar hacia atrás (gesto nativo iOS).
 *
 * Durante el gesto el contenido sigue al dedo (translateX). Al soltar:
 *  - si el desplazamiento supera el umbral (o el flick es rápido), completa la
 *    transición deslizando hasta el borde derecho y luego llama a onSwipeBack.
 *  - si no, vuelve suavemente a su posición (snap-back) sin navegar.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Contenido a envolver
 * @param {function} props.onSwipeBack - Callback que se ejecuta al completar el gesto
 * @param {number} props.edgeWidth - Ancho del área sensible desde el borde (default: 80)
 * @param {number} props.minSwipeDistance - Distancia mínima para activar el gesto (default: 30)
 */
export const SwipeBackWrapper = ({
  children,
  onSwipeBack,
  edgeWidth = 80,
  minSwipeDistance = 30,
}) => {
  // Todos los hooks deben declararse antes de cualquier return condicional.
  const startX = useRef(null);
  const isValidGesture = useRef(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const screenWidth = useRef(Dimensions.get("window").width).current;
  const maxVerticalDrift = 24;

  const completeThreshold = screenWidth * COMPLETE_THRESHOLD_RATIO;

  const animateBack = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();
  };

  const animateComplete = () => {
    Animated.timing(translateX, {
      toValue: screenWidth,
      duration: COMPLETE_DURATION,
      useNativeDriver: true,
    }).start(() => {
      onSwipeBack?.();
      // Reset defensivo: el padre normalmente desmonta el detalle tras navegar.
      translateX.setValue(0);
    });
  };

  // Gesto de pan que detecta el arrastre desde el borde izquierdo hacia la derecha.
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .hitSlop({ left: 0, width: edgeWidth })
    .activeOffsetX(minSwipeDistance)
    .failOffsetY([-maxVerticalDrift, maxVerticalDrift])
    .onStart((event) => {
      // absoluteX es la posición absoluta en la pantalla; x como fallback.
      const initialX = event.absoluteX !== undefined ? event.absoluteX : event.x;
      startX.current = initialX;
      // El gesto es válido si comienza cerca del borde izquierdo.
      isValidGesture.current = initialX <= edgeWidth;
    })
    .onUpdate((event) => {
      if (!isValidGesture.current || startX.current === null) {
        return;
      }

      const horizontalMovement = event.translationX;
      const verticalMovement = Math.abs(event.translationY);

      // Si deriva en vertical o se mueve hacia la izquierda, invalidamos y volvemos.
      if (verticalMovement > maxVerticalDrift || horizontalMovement < -5) {
        isValidGesture.current = false;
        animateBack();
        return;
      }

      // El contenido sigue al dedo, clampeado a [0, screenWidth].
      const clamped = Math.max(0, Math.min(horizontalMovement, screenWidth));
      translateX.setValue(clamped);
    })
    .onEnd((event) => {
      const valid =
        isValidGesture.current &&
        startX.current !== null &&
        startX.current <= edgeWidth &&
        Math.abs(event.translationY) <= maxVerticalDrift;

      const shouldComplete =
        valid &&
        (event.translationX > completeThreshold ||
          event.velocityX > VELOCITY_THRESHOLD);

      if (shouldComplete) {
        animateComplete();
      } else {
        animateBack();
      }

      startX.current = null;
      isValidGesture.current = false;
    })
    .onFinalize(() => {
      // Si el gesto se cancela sin pasar por onEnd, aseguramos volver a 0.
      if (isValidGesture.current) {
        animateBack();
      }
      startX.current = null;
      isValidGesture.current = false;
    });

  // Return condicional después de declarar todos los hooks.
  if (Platform.OS !== "ios") {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.container, { transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
