import React, { useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import {
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";

/**
 * Componente wrapper que detecta el gesto de swipe desde el borde izquierdo
 * hacia la derecha para navegar hacia atrás (gesto nativo iOS/Android)
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Contenido a envolver
 * @param {function} props.onSwipeBack - Callback que se ejecuta cuando se detecta el gesto
 * @param {number} props.edgeWidth - Ancho del área sensible al gesto desde el borde (default: 80)
 * @param {number} props.minSwipeDistance - Distancia mínima de swipe para activar (default: 30)
 */
export const SwipeBackWrapper = ({
  children,
  onSwipeBack,
  edgeWidth = 80, // Aumentado significativamente para capturar gestos desde el borde izquierdo
  minSwipeDistance = 30, // Reducido para que sea más fácil de activar
}) => {
  if (Platform.OS !== "ios") {
    return <View style={styles.container}>{children}</View>;
  }

  const startX = useRef(null);
  const isValidGesture = useRef(false);
  const maxVerticalDrift = 24;

  // Crear gesto de pan (arrastre) que detecta desde el borde izquierdo
  // Configurado para activarse solo cuando comienza desde el borde izquierdo de la pantalla
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .hitSlop({ left: 0, width: edgeWidth })
    .activeOffsetX(minSwipeDistance)
    .failOffsetY([-maxVerticalDrift, maxVerticalDrift])
    .onStart((event) => {
      // Usar absoluteX que es la posición absoluta en la pantalla
      // Si no está disponible, usar x como fallback
      const initialX = event.absoluteX !== undefined ? event.absoluteX : event.x;
      startX.current = initialX;
      // El gesto es válido si comienza cerca del borde izquierdo de la pantalla
      isValidGesture.current = initialX <= edgeWidth;
    })
    .onUpdate((event) => {
      // Si el gesto no comenzó desde el borde, ignorarlo
      if (!isValidGesture.current || startX.current === null) {
        return;
      }

      // Verificar que el movimiento sea principalmente horizontal hacia la derecha
      const horizontalMovement = event.translationX;
      const verticalMovement = Math.abs(event.translationY);

      // Si el gesto se convierte en scroll vertical o se mueve hacia la izquierda, lo invalidamos
      if (verticalMovement > maxVerticalDrift || horizontalMovement < -5) {
        isValidGesture.current = false;
      }
    })
    .onEnd((event) => {
      // Verificar que el gesto comenzó desde el borde izquierdo de la pantalla
      // y se movió lo suficiente hacia la derecha
      if (
        isValidGesture.current &&
        startX.current !== null &&
        startX.current <= edgeWidth &&
        event.translationX > minSwipeDistance &&
        Math.abs(event.translationY) <= maxVerticalDrift
      ) {
        onSwipeBack?.();
      }
      // Resetear estado
      startX.current = null;
      isValidGesture.current = false;
    })
    .onFinalize(() => {
      // Resetear estado
      startX.current = null;
      isValidGesture.current = false;
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {children}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
