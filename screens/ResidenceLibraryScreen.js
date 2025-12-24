import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { useLibroSection } from "../hooks/useLibroSection";
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

/**
 * Pantalla del Libro de Residente
 * Permite al usuario registrar y contar sus actividades diarias como médico
 */
export default function ResidenceLibraryScreen({ userProfile, navigation }) {
  const userId = userProfile?.id;

  // Por ahora usamos "clinical_practice" como sección por defecto
  // Más adelante se puede agregar el selector de secciones
  const section = "clinical_practice";

  // Hook para verificar si el residente tiene reseña
  const { hasReview } = useResidentReviewCheck(userId, userProfile);

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
  } = useLibroSection(userId, section);

  // Estados para modales
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedParentForChild, setSelectedParentForChild] = useState(null);

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
  const handleDecrement = (node) => {
    // Por ahora, decrementar significa agregar una entrada con count negativo
    // O podríamos mostrar un modal para seleccionar cuánto decrementar
    Alert.alert(
      "Decrementar",
      "Esta funcionalidad se implementará próximamente",
      [{ text: "OK" }]
    );
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

  // Renderizar nodos recursivamente
  const renderNode = (node, level = 0) => {
    // Un nodo es padre si no tiene parent_node_id (es nodo raíz)
    const isParent = !node.parent_node_id;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <View key={node.id}>
        <LibroNodeItem
          node={node}
          isParent={isParent}
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

        {/* Renderizar hijos si está expandido */}
        {isParent && isExpanded && node.children && (
          <View style={styles.childrenContainer}>
            {node.children.map((child) => renderNode(child, level + 1))}
          </View>
        )}
      </View>
    );
  };

  // Abrir modal para agregar nodo raíz
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

    // Asegurar que no hay padre seleccionado cuando se crea desde el botón flotante
    setSelectedParentForChild(null);
    setIsAddingNode(true);
    setShowNodeModal(true);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Libro de Residente" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        ) : (
          <>
            {/* Lista de nodos */}
            {nodeTree.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={64}
                  color={COLORS.GRAY}
                />
                <Text style={styles.emptySubtext}>
                  Presiona el botón + para crear tu primer apartado
                </Text>
              </View>
            ) : (
              <View style={styles.nodesContainer}>
                {nodeTree.map((node) => renderNode(node, 0))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FloatingActionButton onPress={handleAddRootNode} icon="add" />

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
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
  emptySubtext: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 8,
    textAlign: "center",
  },
  nodesContainer: {
    gap: 8,
  },
  childrenContainer: {
    marginLeft: 20,
    marginTop: 4,
  },
});
