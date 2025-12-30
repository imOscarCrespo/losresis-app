import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  PanResponder,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { useLibroSection } from "../hooks/useLibroSection";
import { updateNodesPositions } from "../services/libroService";
import { useResidentReviewCheck } from "../hooks/useResidentReviewCheck";
import {
  InfoBanner,
  LibroNodeItem,
  LibroNodeModal,
  LibroEntryModal,
  ConfirmationModal,
  FloatingActionButton,
  ScreenHeader,
} from "../components";
import posthogLogger from "../services/posthogService";

/**
 * Pantalla del Libro de Residente
 * Permite al usuario registrar y contar sus actividades diarias como médico
 */
export default function ResidenceLibraryScreen({
  userProfile,
  navigation,
  residentHasReview = true,
}) {
  const userId = userProfile?.id;

  // Por ahora usamos "clinical_practice" como sección por defecto
  // Más adelante se puede agregar el selector de secciones
  const section = "clinical_practice";

  // Hook para verificar si el residente tiene reseña (backup check)
  const { hasReview } = useResidentReviewCheck(userId, userProfile);

  // Determinar si debe mostrar el mensaje de review requerida
  const shouldShowReviewPrompt =
    userProfile?.is_resident &&
    !userProfile?.is_super_admin &&
    !residentHasReview;

  // Hook para gestionar el libro
  const {
    nodeTree,
    loading,
    isAddingNode,
    setIsAddingNode,
    editingNode,
    setEditingNode,
    isAddingEntry,
    setIsAddingEntry,
    selectedNode,
    setSelectedNode,
    addNode,
    updateNode,
    deleteNode,
    addEntry,
    createTemplate,
    fetchAllData,
  } = useLibroSection(userId, section);

  // Estados para modales
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedParentForChild, setSelectedParentForChild] = useState(null);

  // Estado temporal para el orden durante el drag (se guarda en BD al soltar)
  const [draggingOrder, setDraggingOrder] = useState(null);

  // Obtener el orden actual de los nodos (usar draggingOrder si está en drag, sino nodeTree)
  const currentOrder = draggingOrder || nodeTree || [];

  // Obtener todos los nodos planos para el selector de padres
  const allNodes = useMemo(() => {
    const flattenNodes = (nodes) => {
      let result = [];
      nodes.forEach((node) => {
        result.push(node);
        if (node.children && node.children.length > 0) {
          result = result.concat(flattenNodes(node.children));
        }
      });
      return result;
    };
    return flattenNodes(nodeTree);
  }, [nodeTree]);

  // Obtener solo nodos padre (sin hijos) para el selector
  const parentNodes = useMemo(() => {
    return allNodes.filter((node) => !node.parent_node_id);
  }, [allNodes]);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("ResidenceLibraryScreen");
  }, []);

  // Manejar toggle de expansión de nodos
  const handleToggleExpand = (nodeId) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Manejar agregar nodo
  const handleAddNode = async (formData) => {
    const success = await addNode(formData);
    if (success) {
      setShowNodeModal(false);
      setIsAddingNode(false);
      setSelectedParentForChild(null);
    } else {
      Alert.alert("Error", "No se pudo crear el nodo");
    }
  };

  // Manejar agregar hijo a un padre
  const handleAddChild = (parentNode) => {
    setSelectedParentForChild(parentNode);
    setShowNodeModal(true);
    setIsAddingNode(true);
  };

  // Manejar editar nodo
  const handleEditNode = async (formData) => {
    if (!editingNode) return;

    const success = await updateNode({
      ...editingNode,
      name: formData.name,
      goal: formData.goal !== undefined ? formData.goal : editingNode.goal,
    });

    if (success) {
      setShowNodeModal(false);
      setEditingNode(null);
    } else {
      Alert.alert("Error", "No se pudo actualizar el nodo");
    }
  };

  // Manejar eliminar nodo
  const handleDeleteNode = async (nodeId) => {
    const success = await deleteNode(nodeId);
    if (success) {
      setShowDeleteConfirm(null);
      // Si el nodo estaba expandido, removerlo del set
      setExpandedNodes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    } else {
      Alert.alert("Error", "No se pudo eliminar el nodo");
    }
  };

  // Manejar incrementar contador
  const handleIncrement = async (node) => {
    try {
      // Obtener el año de residencia del perfil o usar 1 por defecto
      const residencyYear = userProfile?.resident_year || 1;

      // Crear entrada directamente con count = 1
      const success = await addEntry(node.id, {
        count: 1,
        residency_year: residencyYear,
        notes: "",
      });

      if (!success) {
        Alert.alert("Error", "No se pudo incrementar el contador");
      }
    } catch (error) {
      console.error("Error incrementing counter:", error);
      Alert.alert("Error", "Error al incrementar el contador");
    }
  };

  // Manejar decrementar contador
  const handleDecrement = async (node) => {
    try {
      // Verificar que el contador no sea 0
      const currentCount = node.total_count || 0;
      if (currentCount <= 0) {
        return; // No hacer nada si el contador ya es 0
      }

      // Obtener el año de residencia del perfil o usar 1 por defecto
      const residencyYear = userProfile?.resident_year || 1;

      // Crear entrada con count = -1 para restar 1 al contador
      const success = await addEntry(node.id, {
        count: -1,
        residency_year: residencyYear,
        notes: "",
      });

      if (!success) {
        Alert.alert("Error", "No se pudo decrementar el contador");
      }
    } catch (error) {
      console.error("Error decrementing counter:", error);
      Alert.alert("Error", "Error al decrementar el contador");
    }
  };

  // Manejar agregar entrada
  const handleAddEntry = async (formData) => {
    if (!selectedNode) return;

    const success = await addEntry(selectedNode.id, formData);
    if (success) {
      setShowEntryModal(false);
      setIsAddingEntry(false);
      setSelectedNode(null);
    } else {
      Alert.alert("Error", "No se pudo agregar la entrada");
    }
  };

  // Estados para el drag-and-drop
  const [draggingIndex, setDraggingIndex] = useState(null);
  const nodePositions = useRef({});
  const scrollViewRef = useRef(null);
  const scrollOffset = useRef(0);

  // Medir posiciones de los nodos
  const measureNode = (index, y, height) => {
    const currentOrderArray = draggingOrder || nodeTree;
    if (index >= 0 && index < currentOrderArray.length) {
      nodePositions.current[index] = { y, height, centerY: y + height / 2 };
    }
  };

  // Manejar el inicio del arrastre
  const handleDragStartIndex = (index) => {
    setDraggingIndex(index);
  };

  // Manejar el movimiento durante el arrastre
  const handleDragMove = (index, gestureY) => {
    if (draggingIndex === null) return;

    // Usar el orden actual (draggingOrder o nodeTree)
    const currentOrderArray = draggingOrder || nodeTree;
    const currentIndex = draggingIndex;
    if (currentIndex < 0 || currentIndex >= currentOrderArray.length) return;

    // Obtener la posición inicial del nodo arrastrado
    const initialPos =
      nodePositions.current[currentIndex] || nodePositions.current[index];
    if (!initialPos) return;

    // Calcular la nueva posición Y del centro del nodo arrastrado
    const draggedCenterY = initialPos.y + gestureY;

    // Encontrar el índice de destino
    let targetIndex = currentIndex;

    // Buscar hacia arriba
    for (let i = currentIndex - 1; i >= 0; i--) {
      const pos = nodePositions.current[i];
      if (pos && draggedCenterY < pos.centerY) {
        targetIndex = i;
      } else {
        break;
      }
    }

    // Buscar hacia abajo
    for (let i = currentIndex + 1; i < currentOrderArray.length; i++) {
      const pos = nodePositions.current[i];
      if (pos && draggedCenterY > pos.centerY) {
        targetIndex = i;
      } else {
        break;
      }
    }

    // Reordenar si el índice cambió
    if (targetIndex !== currentIndex) {
      const newOrder = [...currentOrderArray];
      const [removed] = newOrder.splice(currentIndex, 1);
      newOrder.splice(targetIndex, 0, removed);
      setDraggingOrder(newOrder);
      setDraggingIndex(targetIndex);
    }
  };

  // Manejar el fin del arrastre
  const handleDragEnd = async () => {
    // Limpiar intervalo de auto-scroll
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }

    // Guardar el orden en la base de datos si hay cambios
    if (draggingOrder && draggingOrder.length > 0 && userId) {
      try {
        // Preparar array con id y posición de cada nodo padre
        const nodesWithPositions = draggingOrder.map((node, index) => ({
          id: node.id,
          position: index,
        }));

        // Actualizar posiciones en la base de datos
        const success = await updateNodesPositions(nodesWithPositions, userId);

        if (success) {
          // Refrescar los datos para obtener el orden actualizado desde la BD
          if (fetchAllData) {
            await fetchAllData();
          }
        } else {
          Alert.alert("Error", "No se pudo guardar el orden de los nodos");
        }
      } catch (error) {
        console.error("Error saving nodes positions:", error);
        Alert.alert("Error", "No se pudo guardar el orden de los nodos");
      }
    }

    // Limpiar estado temporal de drag
    setDraggingOrder(null);
    nodePositions.current = {};

    // Desactivar el drag completamente
    setDraggingIndex(null);
  };

  // Auto-scroll cuando se arrastra cerca de los bordes
  const autoScrollInterval = useRef(null);
  const handleAutoScroll = (gestureState) => {
    if (!scrollViewRef.current || draggingIndex === null) return;

    const { pageY } = gestureState;
    const SCROLL_THRESHOLD = 80; // Distancia desde el borde para activar scroll (en píxeles)
    const SCROLL_SPEED = 8; // Velocidad de scroll (píxeles por frame)

    // Obtener dimensiones de la ventana
    const windowHeight = Dimensions.get("window").height;

    // Calcular distancia desde los bordes de la pantalla
    const distanceFromTop = pageY;
    const distanceFromBottom = windowHeight - pageY;

    // Limpiar intervalo anterior
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }

    // Scroll hacia arriba (cuando el dedo está cerca del borde superior)
    if (distanceFromTop < SCROLL_THRESHOLD && distanceFromTop > 0) {
      const scrollAmount = Math.max(
        1,
        ((SCROLL_THRESHOLD - distanceFromTop) / SCROLL_THRESHOLD) * SCROLL_SPEED
      );
      autoScrollInterval.current = setInterval(() => {
        const newOffset = Math.max(0, scrollOffset.current - scrollAmount);
        scrollOffset.current = newOffset;
        scrollViewRef.current?.scrollTo({
          y: newOffset,
          animated: false,
        });
      }, 16); // ~60fps
    }
    // Scroll hacia abajo (cuando el dedo está cerca del borde inferior)
    else if (distanceFromBottom < SCROLL_THRESHOLD && distanceFromBottom > 0) {
      const scrollAmount = Math.max(
        1,
        ((SCROLL_THRESHOLD - distanceFromBottom) / SCROLL_THRESHOLD) *
          SCROLL_SPEED
      );
      autoScrollInterval.current = setInterval(() => {
        const newOffset = scrollOffset.current + scrollAmount;
        scrollOffset.current = newOffset;
        scrollViewRef.current?.scrollTo({
          y: newOffset,
          animated: false,
        });
      }, 16); // ~60fps
    }
  };

  // Limpiar intervalo cuando termina el drag
  React.useEffect(() => {
    if (draggingIndex === null && autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }
    return () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
      }
    };
  }, [draggingIndex]);

  // Renderizar nodos hijos recursivamente (no se reordenan)
  const renderChildNode = (node, level = 1) => {
    const isExpanded = expandedNodes.has(node.id);

    return (
      <View key={node.id}>
        <LibroNodeItem
          node={node}
          isParent={false}
          isExpanded={isExpanded}
          onToggleExpand={() => handleToggleExpand(node.id)}
          onIncrement={() => handleIncrement(node)}
          onDecrement={() => handleDecrement(node)}
          onEdit={() => {
            setEditingNode(node);
            setShowNodeModal(true);
          }}
          onDelete={() => setShowDeleteConfirm(node)}
          onAddChild={() => handleAddChild(node)}
          level={level}
        />
      </View>
    );
  };

  // Componente para nodo padre arrastrable
  const DraggableParentNode = ({ node, index }) => {
    const isExpanded = expandedNodes.has(node.id);
    const isDragging = draggingIndex === index;
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const nodeRef = useRef(null);
    const startY = useRef(0);
    const currentY = useRef(0);
    const isDraggingRef = useRef(false);

    // Actualizar ref cuando isDragging cambia
    React.useEffect(() => {
      isDraggingRef.current = isDragging;
    }, [isDragging]);

    // Función para iniciar el drag (long press de 2 segundos en el nodo)
    const handleDragStart = () => {
      if (draggingIndex !== null) return;

      // Inicializar el orden temporal con el orden actual de nodeTree
      if (!draggingOrder) {
        setDraggingOrder([...nodeTree]);
      }

      // Medir la posición del nodo actual
      nodeRef.current?.measure((x, y, width, height, pageX, pageY) => {
        measureNode(index, pageY, height);
      });

      // Iniciar arrastre
      handleDragStartIndex(index);
      translateY.setValue(0);
      translateY.setOffset(0);
      currentY.current = 0;
      isDraggingRef.current = true;

      // Animaciones de inicio
      Animated.parallel([
        Animated.spring(opacity, {
          toValue: 0.9,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1.05,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => isDraggingRef.current,
        onMoveShouldSetPanResponder: () => isDraggingRef.current,
        onPanResponderGrant: (_, gestureState) => {
          if (isDraggingRef.current) {
            startY.current = gestureState.y0;
            translateY.setOffset(0);
            translateY.setValue(0);
          }
        },
        onPanResponderMove: (_, gestureState) => {
          if (isDraggingRef.current) {
            const dy = gestureState.dy;
            translateY.setValue(dy);
            currentY.current = dy;
            handleDragMove(index, dy);

            // Auto-scroll cuando se acerca a los bordes
            handleAutoScroll(gestureState);
          }
        },
        onPanResponderRelease: () => {
          if (isDraggingRef.current || isDragging) {
            // Desactivar inmediatamente el ref
            isDraggingRef.current = false;

            // Desactivar el drag en el estado principal INMEDIATAMENTE
            // No esperar a que termine la animación
            handleDragEnd();

            // Animar de vuelta a la posición original
            translateY.flattenOffset();
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
              }),
              Animated.spring(opacity, {
                toValue: 1,
                useNativeDriver: true,
              }),
              Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
        onPanResponderTerminate: () => {
          if (isDraggingRef.current || isDragging) {
            // Desactivar inmediatamente el ref
            isDraggingRef.current = false;

            // Desactivar el drag en el estado principal INMEDIATAMENTE
            handleDragEnd();

            // Animar de vuelta a la posición original
            translateY.flattenOffset();
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.spring(opacity, {
                toValue: 1,
                useNativeDriver: true,
              }),
              Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      })
    ).current;

    return (
      <Animated.View
        ref={nodeRef}
        style={[
          styles.parentNodeContainer,
          isDragging && styles.draggingNode,
          {
            transform: [{ translateY }, { scale }],
            opacity,
            zIndex: isDragging ? 1000 : 1,
          },
        ]}
        {...(isDragging ? panResponder.panHandlers : {})}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          // Medir posición cuando el layout cambia
          const currentOrderArray = draggingOrder || nodeTree;
          const currentIndex = currentOrderArray.findIndex(
            (n) => n.id === node.id
          );
          if (currentIndex !== -1 && !isDragging) {
            nodeRef.current?.measure((x, y, width, heightPos, pageX, pageY) => {
              measureNode(currentIndex, pageY, heightPos);
            });
          }
        }}
      >
        <TouchableOpacity
          onLongPress={handleDragStart}
          delayLongPress={2000}
          activeOpacity={1}
          disabled={draggingIndex !== null}
          style={{ width: "100%" }}
        >
          <LibroNodeItem
            node={node}
            isParent={true}
            isExpanded={isExpanded}
            onToggleExpand={() => handleToggleExpand(node.id)}
            onIncrement={() => handleIncrement(node)}
            onDecrement={() => handleDecrement(node)}
            onEdit={() => {
              setEditingNode(node);
              setShowNodeModal(true);
            }}
            onDelete={() => setShowDeleteConfirm(node)}
            onAddChild={() => handleAddChild(node)}
            level={0}
            onDragStart={handleDragStart}
            isDragging={isDragging}
          />
        </TouchableOpacity>

        {/* Renderizar hijos si está expandido */}
        {isExpanded && node.children && node.children.length > 0 && (
          <View style={styles.childrenContainer}>
            {node.children.map((child) => renderChildNode(child, 1))}
          </View>
        )}
      </Animated.View>
    );
  };

  // Renderizar un nodo padre con sus hijos
  const renderParentNode = (node, index) => {
    return <DraggableParentNode key={node.id} node={node} index={index} />;
  };

  // Abrir modal para agregar nodo raíz o crear plantilla
  const handleAddRootNode = () => {
    if (
      userProfile?.is_resident &&
      !userProfile?.is_super_admin &&
      !hasReview
    ) {
      Alert.alert(
        "Reseña requerida",
        "Debes tener una reseña para usar esta funcionalidad",
        [
          {
            text: "Ir a mi reseña",
            onPress: () => {
              // Navegar a la sección de reseña
              navigation.navigate("Dashboard", { section: "mi-resena" });
            },
          },
          { text: "Cancelar", style: "cancel" },
        ]
      );
      return;
    }

    // Si no hay nodos, crear plantilla; si no, abrir modal para crear nodo
    if (nodeTree.length === 0) {
      handleCreateTemplate();
    } else {
      // Asegurar que no hay padre seleccionado cuando se crea desde el botón flotante
      setSelectedParentForChild(null);
      setIsAddingNode(true);
      setShowNodeModal(true);
    }
  };

  // Manejar creación de plantilla
  const handleCreateTemplate = async () => {
    const success = await createTemplate();
    if (success) {
      Alert.alert("Éxito", "Plantilla creada correctamente");
    } else {
      Alert.alert("Error", "No se pudo crear la plantilla");
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Libro de Residente" />

      <View style={styles.containerContent}>
        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        ) : (
          <>
            {/* Lista de nodos */}
            {currentOrder.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={64}
                  color={COLORS.GRAY}
                />
                <Text style={styles.emptyTitle}>
                  ¡Comienza a registrar tus actividades!
                </Text>
                <Text style={styles.emptySubtext}>
                  Presiona el botón + para crear una plantilla con ejemplos
                </Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={draggingIndex === null}
                nestedScrollEnabled={false}
                onScroll={(event) => {
                  scrollOffset.current = event.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
              >
                <View style={styles.nodesContainer}>
                  {currentOrder.map((node, index) =>
                    renderParentNode(node, index)
                  )}
                </View>
              </ScrollView>
            )}
          </>
        )}
      </View>

      {/* Floating Action Button - Solo mostrar si tiene review */}
      {!shouldShowReviewPrompt && (
        <FloatingActionButton onPress={handleAddRootNode} icon="add" />
      )}

      {/* Overlay para residentes sin reseña */}
      {shouldShowReviewPrompt && (
        <View style={styles.reviewPromptOverlay}>
          <View style={styles.reviewPromptContent}>
            <View style={styles.reviewPromptIcon}>
              <Ionicons name="document-text" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.reviewPromptTitle}>
              ¡Comienza tu libro de residente!
            </Text>
            <Text style={styles.reviewPromptText}>
              Para acceder al libro de residente y registrar tus actividades,
              primero comparte tu experiencia con una reseña.
            </Text>
            <TouchableOpacity
              style={styles.reviewPromptButton}
              onPress={() => navigation?.navigate("myReview")}
            >
              <Ionicons name="heart" size={20} color="#FFFFFF" />
              <Text style={styles.reviewPromptButtonText}>
                Compartir mi experiencia
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal para agregar/editar nodo */}
      <LibroNodeModal
        visible={showNodeModal}
        onClose={() => {
          setShowNodeModal(false);
          setIsAddingNode(false);
          setEditingNode(null);
          setSelectedParentForChild(null);
        }}
        onSubmit={editingNode ? handleEditNode : handleAddNode}
        existingNode={editingNode}
        parentNodes={parentNodes}
        selectedParent={selectedParentForChild}
        loading={loading}
      />

      {/* Modal para agregar entrada */}
      <LibroEntryModal
        visible={showEntryModal}
        onClose={() => {
          setShowEntryModal(false);
          setIsAddingEntry(false);
          setSelectedNode(null);
        }}
        onSubmit={handleAddEntry}
        node={selectedNode}
        loading={loading}
      />

      {/* Modal de confirmación para eliminar */}
      <ConfirmationModal
        visible={!!showDeleteConfirm}
        title="Eliminar Nodo"
        message={`¿Estás seguro de que quieres eliminar "${showDeleteConfirm?.name}"? Esta acción eliminará también todos sus hijos y entradas asociadas.`}
        onConfirm={() => handleDeleteNode(showDeleteConfirm?.id)}
        onCancel={() => setShowDeleteConfirm(null)}
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmColor={COLORS.ERROR}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  containerContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  parentNodeContainer: {
    marginBottom: 8,
  },
  dragHandle: {
    width: "100%",
  },
  draggingNode: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bannerContainer: {
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.GRAY,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  nodesContainer: {
    gap: 8,
  },
  childrenContainer: {
    marginLeft: 20,
    marginTop: 4,
  },
  reviewPromptOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  reviewPromptContent: {
    alignItems: "center",
    maxWidth: 400,
  },
  reviewPromptIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  reviewPromptTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
  },
  reviewPromptText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  reviewPromptButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  reviewPromptButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
