import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

const SWIPE_THRESHOLD = 80; // Distancia mínima para activar el swipe
const ACTION_BUTTON_WIDTH = 80; // Ancho de los botones de acción

/**
 * Componente para mostrar un nodo del libro (padre o hijo)
 * @param {Object} props
 * @param {Object} props.node - Nodo a mostrar
 * @param {boolean} props.isParent - Si es un nodo padre
 * @param {boolean} props.isExpanded - Si el nodo está expandido (solo para padres)
 * @param {function} props.onToggleExpand - Callback para expandir/colapsar (solo para padres)
 * @param {function} props.onIncrement - Callback para incrementar contador
 * @param {function} props.onDecrement - Callback para decrementar contador
 * @param {function} props.onEdit - Callback para editar nodo
 * @param {function} props.onDelete - Callback para eliminar nodo
 * @param {function} props.onAddChild - Callback para agregar hijo (solo para padres)
 * @param {number} props.level - Nivel de anidación (0 para raíz)
 */
export const LibroNodeItem = ({
  node,
  isParent = false,
  isExpanded = false,
  onToggleExpand,
  onIncrement,
  onDecrement,
  onEdit,
  onDelete,
  onAddChild,
  level = 0,
  onDragStart,
  isDragging = false,
}) => {
  const hasChildren = isParent && node.children && node.children.length > 0;
  const count = node.total_count || 0;
  const goal = node.goal || 50; // Usar 50 por defecto si no hay goal
  const progress = Math.min((count / goal) * 100, 100); // Limitar al 100%
  const marginLeft = level * 20;

  // Animación para el swipe (solo para hijos)
  const translateX = useRef(new Animated.Value(0)).current;
  const [swipePosition, setSwipePosition] = useState(0);
  const currentTranslateX = useRef(0);

  // Sincronizar el valor inicial cuando cambia swipePosition
  React.useEffect(() => {
    if (!isParent) {
      translateX.setValue(swipePosition);
      currentTranslateX.current = swipePosition;
    }
  }, [isParent, swipePosition]);

  // PanResponder para manejar el swipe (solo para hijos)
  const panResponder = useRef(
    !isParent
      ? PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: (_, gestureState) => {
            // Solo activar si el movimiento es principalmente horizontal
            return (
              Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
              Math.abs(gestureState.dx) > 10
            );
          },
          onPanResponderGrant: () => {
            // Guardar la posición inicial cuando empieza el gesto
            translateX.setOffset(swipePosition);
            translateX.setValue(0);
          },
          onPanResponderMove: (_, gestureState) => {
            // Calcular la nueva posición
            const newPosition = swipePosition + gestureState.dx;

            // Limitar el movimiento horizontal
            const maxPosition = ACTION_BUTTON_WIDTH;
            const minPosition = -ACTION_BUTTON_WIDTH;

            if (newPosition > maxPosition) {
              translateX.setValue(maxPosition - swipePosition);
              currentTranslateX.current = maxPosition;
            } else if (newPosition < minPosition) {
              translateX.setValue(minPosition - swipePosition);
              currentTranslateX.current = minPosition;
            } else {
              translateX.setValue(gestureState.dx);
              currentTranslateX.current = newPosition;
            }
          },
          onPanResponderRelease: (_, gestureState) => {
            const { dx, vx } = gestureState;
            const currentValue = swipePosition + dx;

            // Aplanar el offset para obtener el valor real
            translateX.flattenOffset();

            let targetPosition = 0;

            // Considerar velocidad y distancia
            if (dx > SWIPE_THRESHOLD || (dx > 30 && vx > 0.5)) {
              // Swipe a la derecha - mostrar editar
              targetPosition = ACTION_BUTTON_WIDTH;
            } else if (dx < -SWIPE_THRESHOLD || (dx < -30 && vx < -0.5)) {
              // Swipe a la izquierda - mostrar eliminar
              targetPosition = -ACTION_BUTTON_WIDTH;
            } else if (Math.abs(currentValue) > SWIPE_THRESHOLD / 2) {
              // Si ya está parcialmente deslizado, completar el swipe
              targetPosition =
                currentValue > 0 ? ACTION_BUTTON_WIDTH : -ACTION_BUTTON_WIDTH;
            } else {
              // Volver a la posición inicial
              targetPosition = 0;
            }

            currentTranslateX.current = targetPosition;
            setSwipePosition(targetPosition);

            // Animar directamente al valor objetivo
            Animated.spring(translateX, {
              toValue: targetPosition,
              useNativeDriver: true,
              tension: 50,
              friction: 7,
            }).start();
          },
        })
      : null
  ).current;

  const handleEditPress = () => {
    // Cerrar el swipe antes de editar
    setSwipePosition(0);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start(() => {
      onEdit();
    });
  };

  const handleDeletePress = () => {
    // Cerrar el swipe antes de eliminar
    setSwipePosition(0);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start(() => {
      onDelete();
    });
  };

  return (
    <View style={[styles.container, { marginLeft }]}>
      {/* Botones de acción ocultos (solo para hijos) */}
      {!isParent && (
        <View style={styles.hiddenActions}>
          {/* Botón de eliminar (izquierda) - aparece cuando el card se mueve a la derecha */}
          <Animated.View
            style={[
              styles.hiddenActionButton,
              styles.deleteActionButton,
              {
                width: ACTION_BUTTON_WIDTH,
                transform: [
                  {
                    scaleX: translateX.interpolate({
                      inputRange: [0, ACTION_BUTTON_WIDTH],
                      outputRange: [0, 1],
                      extrapolate: "clamp",
                    }),
                  },
                ],
                opacity: translateX.interpolate({
                  inputRange: [0, 10, ACTION_BUTTON_WIDTH],
                  outputRange: [0, 1, 1],
                  extrapolate: "clamp",
                }),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.hiddenActionTouchable}
              onPress={handleDeletePress}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={24} color={COLORS.WHITE} />
            </TouchableOpacity>
          </Animated.View>

          {/* Botón de editar (derecha) - aparece cuando el card se mueve a la izquierda */}
          <Animated.View
            style={[
              styles.hiddenActionButton,
              styles.editActionButton,
              {
                width: ACTION_BUTTON_WIDTH,
                transform: [
                  {
                    scaleX: translateX.interpolate({
                      inputRange: [-ACTION_BUTTON_WIDTH, 0],
                      outputRange: [1, 0],
                      extrapolate: "clamp",
                    }),
                  },
                ],
                opacity: translateX.interpolate({
                  inputRange: [-ACTION_BUTTON_WIDTH, -10, 0],
                  outputRange: [1, 1, 0],
                  extrapolate: "clamp",
                }),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.hiddenActionTouchable}
              onPress={handleEditPress}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={24} color={COLORS.WHITE} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Contenido principal */}
      <Animated.View
        style={[
          styles.card,
          !isParent && {
            transform: [{ translateX }],
          },
        ]}
        {...(panResponder?.panHandlers || {})}
      >
        {/* Primera fila: Icono, nombre, badge, botones */}
        <View style={styles.topRow}>
          <View style={styles.leftSection}>
            {isParent ? (
              <View style={styles.parentIconContainer}>
                <TouchableOpacity
                  onPress={onDragStart}
                  style={styles.dragHandle}
                  activeOpacity={0.7}
                  disabled={!onDragStart}
                >
                  <Ionicons
                    name="reorder-three-outline"
                    size={20}
                    color={isDragging ? COLORS.PRIMARY : COLORS.GRAY}
                    style={styles.dragIcon}
                  />
                </TouchableOpacity>
                <Ionicons
                  name="folder-outline"
                  size={24}
                  color={COLORS.PRIMARY}
                  style={styles.icon}
                />
              </View>
            ) : (
              <Ionicons
                name="document-text-outline"
                size={24}
                color={COLORS.SUCCESS}
                style={styles.icon}
              />
            )}

            <View style={styles.nameSection}>
              <View style={styles.nameRow}>
                {isParent && hasChildren && (
                  <TouchableOpacity
                    onPress={onToggleExpand}
                    style={styles.expandButton}
                  >
                    <Ionicons
                      name={isExpanded ? "chevron-down" : "chevron-forward"}
                      size={16}
                      color={COLORS.GRAY_DARK}
                    />
                  </TouchableOpacity>
                )}
                <Text style={styles.name}>{node.name}</Text>
              </View>

              {/* Contador debajo del nombre - Solo para hijos */}
              {!isParent && (
                <Text style={styles.countText}>
                  {count}/{goal}
                </Text>
              )}
            </View>
          </View>

          {/* Botones de acción */}
          <View style={styles.actions}>
            {/* Botón de menos - Solo para hijos (no padres) */}
            {!isParent && (
              <TouchableOpacity
                onPress={onDecrement}
                disabled={count <= 0}
                style={[
                  styles.actionButton,
                  styles.decrementButton,
                  count <= 0 && styles.disabledButton,
                ]}
              >
                <Ionicons
                  name="remove"
                  size={16}
                  color={count <= 0 ? COLORS.GRAY : COLORS.ERROR}
                />
              </TouchableOpacity>
            )}

            {/* Botón de más - Solo para hijos (no padres) */}
            {!isParent && (
              <TouchableOpacity
                onPress={onIncrement}
                style={[styles.actionButton, styles.incrementButton]}
              >
                <Ionicons name="add" size={16} color={COLORS.PRIMARY} />
              </TouchableOpacity>
            )}

            {/* Botones de acción - Solo para padres */}
            {isParent && (
              <>
                <TouchableOpacity
                  onPress={onAddChild}
                  style={[styles.actionButton, styles.addChildButton]}
                >
                  <Ionicons name="add" size={16} color={COLORS.GRAY} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onEdit}
                  style={[styles.actionButton, styles.editButton]}
                >
                  <Ionicons name="pencil" size={16} color={COLORS.GRAY_DARK} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onDelete}
                  style={[styles.actionButton, styles.deleteButton]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={COLORS.GRAY_DARK}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Barra de progreso - Solo para nodos hijos, debajo de todo */}
        {!isParent && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress}%` },
                  progress >= 100 && styles.progressFillComplete,
                ]}
              />
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    position: "relative",
    overflow: "visible",
  },
  hiddenActions: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    zIndex: 0,
    overflow: "visible",
  },
  hiddenActionButton: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  editActionButton: {
    backgroundColor: COLORS.PRIMARY,
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
  },
  deleteActionButton: {
    backgroundColor: COLORS.ERROR,
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  hiddenActionTouchable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    position: "relative",
    zIndex: 1,
    backgroundColor: COLORS.WHITE,
    width: "100%",
    borderRadius: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  icon: {
    marginRight: 8,
    marginTop: 2,
  },
  parentIconContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
  },
  dragIcon: {
    marginRight: 4,
    marginTop: 2,
  },
  dragHandle: {
    padding: 4,
    marginRight: 4,
  },
  nameSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandButton: {
    marginRight: 4,
    padding: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
  },
  countText: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  decrementButton: {
    backgroundColor: COLORS.ERROR_LIGHT,
  },
  incrementButton: {
    backgroundColor: COLORS.SUCCESS_LIGHT,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: COLORS.GRAY_LIGHT,
  },
  addChildButton: {
    backgroundColor: COLORS.GRAY_LIGHT,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  editButton: {
    backgroundColor: COLORS.GRAY_LIGHT,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  deleteButton: {
    backgroundColor: COLORS.GRAY_LIGHT,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 4,
  },
  progressFillComplete: {
    backgroundColor: COLORS.SUCCESS,
  },
});

export default LibroNodeItem;
