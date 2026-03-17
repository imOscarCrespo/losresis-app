import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { useLibroSection } from "../hooks/useLibroSection";
import { useResidentReviewCheck } from "../hooks/useResidentReviewCheck";
import {
  LibroNodeModal,
  LibroEntryModal,
  ConfirmationModal,
} from "../components";
import posthogLogger from "../services/posthogService";

const INFO_PILLS = [
  { icon: "add-circle-outline", label: "Cada + suma 1 actividad" },
  { icon: "document-text-outline", label: "Registrar guarda detalle" },
  { icon: "trophy-outline", label: "El objetivo es orientativo" },
];

const OverviewStat = ({ value, label, tone = "purple" }) => (
  <View style={[styles.overviewStat, styles[`overviewStat${tone}`]]}>
    <Text style={styles.overviewStatValue}>{value}</Text>
    <Text style={styles.overviewStatLabel}>{label}</Text>
  </View>
);

const InfoPill = ({ icon, label }) => (
  <View style={styles.infoPill}>
    <Ionicons name={icon} size={14} color="#670CF5" />
    <Text style={styles.infoPillText}>{label}</Text>
  </View>
);

const ProgressBar = ({ progress }) => (
  <View style={styles.progressTrack}>
    <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
  </View>
);

const ProcedureRow = ({
  node,
  userResidencyYear,
  onIncrement,
  onDecrement,
  onRegister,
  onOpenActions,
}) => {
  const count = node.total_count || 0;
  const goal = node.goal || 0;
  const progress = goal > 0 ? (count / goal) * 100 : 0;

  return (
    <View style={styles.procedureCard}>
      <View style={styles.procedureHeader}>
        <View style={styles.procedureTitleWrap}>
          <Text style={styles.procedureTitle}>{node.name}</Text>
          <Text style={styles.procedureMeta}>
            {count} registradas{goal > 0 ? ` de ${goal}` : ""}
            {userResidencyYear ? ` · R${userResidencyYear}` : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => onOpenActions(node)}
          activeOpacity={0.75}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ProgressBar progress={progress} />

      <View style={styles.procedureFooter}>
        <Text style={styles.progressText}>
          {goal > 0
            ? `${Math.round(progress)}% del objetivo`
            : "Sin objetivo definido"}
        </Text>

        <View style={styles.counterActions}>
          <TouchableOpacity
            style={[styles.counterButton, count <= 0 && styles.counterButtonDisabled]}
            onPress={() => onDecrement(node)}
            disabled={count <= 0}
            activeOpacity={0.75}
          >
            <Ionicons name="remove" size={16} color={count <= 0 ? "#94A3B8" : "#1B0977"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => onIncrement(node)}
            activeOpacity={0.75}
          >
            <Ionicons name="add" size={16} color="#1B0977" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => onRegister(node)}
            activeOpacity={0.85}
          >
            <Text style={styles.registerButtonText}>Registrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const CategoryCard = ({
  node,
  userResidencyYear,
  onAddChild,
  onEditParent,
  onDeleteParent,
  onIncrement,
  onDecrement,
  onRegister,
  onOpenChildActions,
}) => {
  const children = node.children || [];
  const completedGoals = children.filter(
    (child) => child.goal && child.total_count >= child.goal
  ).length;
  const totalGoal = children.reduce((sum, child) => sum + (child.goal || 0), 0);
  const totalCount = children.reduce(
    (sum, child) => sum + (child.total_count || 0),
    0
  );
  const progress = totalGoal > 0 ? (totalCount / totalGoal) * 100 : 0;

  return (
    <View style={styles.categoryCard}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryHeaderText}>
          <Text style={styles.categoryTitle}>{node.name}</Text>
          <Text style={styles.categorySubtitle}>
            {children.length} procedimiento{children.length === 1 ? "" : "s"} ·{" "}
            {completedGoals}/{children.length} objetivos completados
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() =>
            Alert.alert(node.name, "¿Qué quieres hacer?", [
              { text: "Añadir procedimiento", onPress: () => onAddChild(node) },
              { text: "Renombrar categoría", onPress: () => onEditParent(node) },
              {
                text: "Eliminar categoría",
                style: "destructive",
                onPress: () => onDeleteParent(node),
              },
              { text: "Cancelar", style: "cancel" },
            ])
          }
          activeOpacity={0.75}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <View style={styles.categoryStatsRow}>
        <View style={styles.categoryMetric}>
          <Text style={styles.categoryMetricValue}>{totalCount}</Text>
          <Text style={styles.categoryMetricLabel}>registradas</Text>
        </View>
        <View style={styles.categoryMetric}>
          <Text style={styles.categoryMetricValue}>{totalGoal || "-"}</Text>
          <Text style={styles.categoryMetricLabel}>objetivo total</Text>
        </View>
        <View style={styles.categoryMetric}>
          <Text style={styles.categoryMetricValue}>{Math.round(progress)}%</Text>
          <Text style={styles.categoryMetricLabel}>avance</Text>
        </View>
      </View>

      <ProgressBar progress={progress} />

      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => onAddChild(node)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={16} color="#670CF5" />
          <Text style={styles.secondaryActionText}>Añadir procedimiento</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.proceduresList}>
        {children.length > 0 ? (
          children.map((child) => (
            <ProcedureRow
              key={child.id}
              node={child}
              userResidencyYear={userResidencyYear}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRegister={onRegister}
              onOpenActions={onOpenChildActions}
            />
          ))
        ) : (
          <View style={styles.emptyCategoryState}>
            <Ionicons name="sparkles-outline" size={18} color="#64748B" />
            <Text style={styles.emptyCategoryText}>
              Esta categoría todavía no tiene procedimientos.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default function ResidenceLibraryScreen({
  userProfile,
  navigation,
  residentHasReview = true,
}) {
  const userId = userProfile?.id;
  const section = "clinical_practice";
  const userResidencyYear = userProfile?.resident_year || null;

  const { hasReview } = useResidentReviewCheck(userId, userProfile);

  const shouldShowReviewPrompt =
    userProfile?.is_resident &&
    !userProfile?.is_super_admin &&
    !residentHasReview;

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
    statistics,
  } = useLibroSection(userId, section);

  const [showNodeModal, setShowNodeModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedParentForChild, setSelectedParentForChild] = useState(null);

  useEffect(() => {
    posthogLogger.logScreen("ResidenceLibraryScreen");
  }, []);

  const overview = useMemo(() => {
    const categories = nodeTree.length;
    const procedures = nodeTree.reduce(
      (sum, parent) => sum + (parent.children?.length || 0),
      0
    );
    const target = nodeTree.reduce(
      (sum, parent) =>
        sum +
        (parent.children || []).reduce(
          (childSum, child) => childSum + (child.goal || 0),
          0
        ),
      0
    );
    const completed = nodeTree.reduce(
      (sum, parent) =>
        sum +
        (parent.children || []).filter(
          (child) => child.goal && child.total_count >= child.goal
        ).length,
      0
    );
    const progress = target > 0 ? (statistics.totalCount / target) * 100 : 0;

    return {
      categories,
      procedures,
      target,
      completed,
      progress,
    };
  }, [nodeTree, statistics.totalCount]);

  const closeNodeModal = () => {
    setShowNodeModal(false);
    setIsAddingNode(false);
    setEditingNode(null);
    setSelectedParentForChild(null);
  };

  const closeEntryModal = () => {
    setShowEntryModal(false);
    setIsAddingEntry(false);
    setSelectedNode(null);
  };

  const handleCreateTemplate = async () => {
    const success = await createTemplate();
    if (!success) {
      Alert.alert("Error", "No se pudo cargar la plantilla inicial.");
    }
  };

  const handleAddRootNode = () => {
    if (shouldShowReviewPrompt || (userProfile?.is_resident && !userProfile?.is_super_admin && !hasReview)) {
      Alert.alert(
        "Reseña requerida",
        "Comparte primero tu experiencia para desbloquear el libro de residente.",
        [
          {
            text: "Ir a mi reseña",
            onPress: () => navigation?.navigate?.("myReview"),
          },
          { text: "Cancelar", style: "cancel" },
        ]
      );
      return;
    }

    setSelectedParentForChild(null);
    setEditingNode(null);
    setIsAddingNode(true);
    setShowNodeModal(true);
  };

  const handleAddChild = (parentNode) => {
    setSelectedParentForChild(parentNode);
    setEditingNode(null);
    setIsAddingNode(true);
    setShowNodeModal(true);
  };

  const handleAddNode = async (formData) => {
    const success = await addNode(formData);
    if (!success) {
      Alert.alert("Error", "No se pudo guardar la categoría o el procedimiento.");
      return;
    }
    closeNodeModal();
  };

  const handleEditNode = async (formData) => {
    if (!editingNode) return;

    const success = await updateNode({
      ...editingNode,
      name: formData.name,
      goal: formData.goal !== undefined ? formData.goal : editingNode.goal,
    });

    if (!success) {
      Alert.alert("Error", "No se pudieron actualizar los cambios.");
      return;
    }

    closeNodeModal();
  };

  const handleDeleteNode = async (nodeId) => {
    const success = await deleteNode(nodeId);
    if (!success) {
      Alert.alert("Error", "No se pudo eliminar el elemento.");
      return;
    }
    setShowDeleteConfirm(null);
  };

  const handleIncrement = async (node) => {
    const success = await addEntry(node.id, {
      count: 1,
      residency_year: userResidencyYear || 1,
      notes: "",
    });

    if (!success) {
      Alert.alert("Error", "No se pudo registrar la actividad.");
    }
  };

  const handleDecrement = async (node) => {
    if ((node.total_count || 0) <= 0) return;

    const success = await addEntry(node.id, {
      count: -1,
      residency_year: userResidencyYear || 1,
      notes: "",
    });

    if (!success) {
      Alert.alert("Error", "No se pudo ajustar el contador.");
    }
  };

  const handleOpenEntryModal = (node) => {
    setSelectedNode(node);
    setIsAddingEntry(true);
    setShowEntryModal(true);
  };

  const handleAddEntry = async (formData) => {
    if (!selectedNode) return;

    const success = await addEntry(selectedNode.id, formData);
    if (!success) {
      Alert.alert("Error", "No se pudo guardar el registro.");
      return;
    }

    closeEntryModal();
  };

  const openChildActions = (node) => {
    Alert.alert(node.name, "Gestiona este procedimiento", [
      {
        text: "Registrar actividad",
        onPress: () => handleOpenEntryModal(node),
      },
      {
        text: "Editar nombre u objetivo",
        onPress: () => {
          setEditingNode(node);
          setShowNodeModal(true);
        },
      },
      {
        text: "Eliminar procedimiento",
        style: "destructive",
        onPress: () => setShowDeleteConfirm(node),
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const openParentDelete = (node) => {
    setShowDeleteConfirm(node);
  };

  if (loading && nodeTree.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.headerShell}>
          <View style={styles.header}>
            <Text style={styles.title}>Libro de residente</Text>
            <View style={styles.headerIcon}>
              <Ionicons name="library-outline" size={18} color="#670CF5" />
            </View>
          </View>
        </View>
        <View style={styles.contentSurface}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#670CF5" />
            <Text style={styles.loadingText}>Cargando tu progreso...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.headerShell}>
        <View style={styles.header}>
          <Text style={styles.title}>Libro de residente</Text>
          <View style={styles.headerIcon}>
            <Ionicons name="library-outline" size={18} color="#670CF5" />
          </View>
        </View>
      </View>

      <View style={styles.contentSurface}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentInner}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>Tu actividad asistencial</Text>
              <Text style={styles.heroTitle}>Registra lo que haces sin pensar en la base de datos</Text>
              <Text style={styles.heroText}>
                El libro guarda actividades por procedimiento. Las categorías solo
                organizan el contenido para que entiendas mejor tu progreso.
              </Text>

              <View style={styles.overviewRow}>
                <OverviewStat value={overview.categories} label="categorías" />
                <OverviewStat value={overview.procedures} label="procedimientos" />
                <OverviewStat value={statistics.totalCount} label="registros" />
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.heroProgressWrap}>
                  <Text style={styles.heroProgressLabel}>
                    Avance global {Math.round(overview.progress)}%
                  </Text>
                  <ProgressBar progress={overview.progress} />
                </View>
                <Text style={styles.heroSupportText}>
                  {overview.completed} objetivo{overview.completed === 1 ? "" : "s"} completado
                  {overview.completed === 1 ? "" : "s"}
                  {userResidencyYear ? ` · Año R${userResidencyYear}` : ""}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Cómo funciona</Text>
              <Text style={styles.sectionText}>
                Hemos simplificado la pantalla para que veas primero tus
                procedimientos y su avance. Si necesitas detalle, pulsa
                “Registrar”.
              </Text>
              <View style={styles.infoPillsWrap}>
                {INFO_PILLS.map((item) => (
                  <InfoPill key={item.label} icon={item.icon} label={item.label} />
                ))}
              </View>
            </View>

            {nodeTree.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="sparkles-outline" size={24} color="#670CF5" />
                </View>
                <Text style={styles.emptyStateTitle}>Empieza con una estructura clara</Text>
                <Text style={styles.emptyStateText}>
                  Puedes cargar una plantilla con categorías y procedimientos
                  habituales, o crear tu propia estructura desde cero.
                </Text>

                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={handleCreateTemplate}
                  activeOpacity={0.85}
                >
                  <Ionicons name="flash-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>Cargar plantilla recomendada</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryOutlineAction}
                  onPress={handleAddRootNode}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#670CF5" />
                  <Text style={styles.secondaryOutlineActionText}>Crear primera categoría</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Tus categorías</Text>
                    <Text style={styles.sectionText}>
                      Cada tarjeta agrupa procedimientos. Dentro puedes sumar,
                      corregir o registrar con más detalle.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addCategoryChip}
                    onPress={handleAddRootNode}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={16} color="#670CF5" />
                    <Text style={styles.addCategoryChipText}>Categoría</Text>
                  </TouchableOpacity>
                </View>

                {nodeTree.map((parentNode) => (
                  <CategoryCard
                    key={parentNode.id}
                    node={parentNode}
                    userResidencyYear={userResidencyYear}
                    onAddChild={handleAddChild}
                    onEditParent={(node) => {
                      setEditingNode(node);
                      setShowNodeModal(true);
                    }}
                    onDeleteParent={openParentDelete}
                    onIncrement={handleIncrement}
                    onDecrement={handleDecrement}
                    onRegister={handleOpenEntryModal}
                    onOpenChildActions={openChildActions}
                  />
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </View>

      {shouldShowReviewPrompt && (
        <View style={styles.reviewPromptOverlay}>
          <View style={styles.reviewPromptCard}>
            <View style={styles.reviewPromptIcon}>
              <Ionicons name="document-text-outline" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.reviewPromptTitle}>Desbloquea tu libro</Text>
            <Text style={styles.reviewPromptText}>
              Antes de registrar actividad, comparte tu experiencia con una
              reseña. Así mantenemos la comunidad activa y útil.
            </Text>
            <TouchableOpacity
              style={styles.reviewPromptButton}
              onPress={() => navigation?.navigate?.("myReview")}
              activeOpacity={0.85}
            >
              <Text style={styles.reviewPromptButtonText}>Ir a mi reseña</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <LibroNodeModal
        visible={showNodeModal}
        onClose={closeNodeModal}
        onSubmit={editingNode ? handleEditNode : handleAddNode}
        existingNode={editingNode}
        selectedParent={selectedParentForChild}
        loading={loading}
      />

      <LibroEntryModal
        visible={showEntryModal}
        onClose={closeEntryModal}
        onSubmit={handleAddEntry}
        node={selectedNode}
        loading={loading}
      />

      <ConfirmationModal
        visible={!!showDeleteConfirm}
        title="Eliminar elemento"
        message={`Vas a eliminar "${showDeleteConfirm?.name}". Si es una categoría, también se eliminarán sus procedimientos y registros asociados.`}
        onConfirm={() => handleDeleteNode(showDeleteConfirm?.id)}
        onCancel={() => setShowDeleteConfirm(null)}
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmColor={COLORS.ERROR}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerShell: {
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1B0977",
    letterSpacing: -0.2,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(103,12,245,0.07)",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.12)",
  },
  contentSurface: {
    flex: 1,
    backgroundColor: "#F8F9FE",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#670CF5",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  overviewRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  overviewStat: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  overviewStatpurple: {
    backgroundColor: "#F3E8FF",
  },
  overviewStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B0977",
  },
  overviewStatLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#670CF5",
  },
  heroFooter: {
    marginTop: 16,
  },
  heroProgressWrap: {
    marginBottom: 10,
  },
  heroProgressLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  heroSupportText: {
    fontSize: 13,
    color: "#64748B",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#670CF5",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  infoPillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3E8FF",
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#670CF5",
  },
  emptyStateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    alignItems: "center",
  },
  emptyStateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3E8FF",
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B0977",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    marginBottom: 10,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryOutlineAction: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8C7FF",
    backgroundColor: "#F8F5FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  secondaryOutlineActionText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#670CF5",
  },
  addCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3E8FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addCategoryChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#670CF5",
  },
  categoryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryHeaderText: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 20,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  categoryStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  categoryMetric: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  categoryMetricValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B0977",
  },
  categoryMetricLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
  },
  categoryActions: {
    marginTop: 14,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F8F5FF",
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#670CF5",
  },
  proceduresList: {
    gap: 12,
    marginTop: 16,
  },
  emptyCategoryState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
  },
  emptyCategoryText: {
    flex: 1,
    fontSize: 14,
    color: "#64748B",
  },
  procedureCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
  },
  procedureHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  procedureTitleWrap: {
    flex: 1,
  },
  procedureTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 4,
  },
  procedureMeta: {
    fontSize: 13,
    color: "#64748B",
  },
  procedureFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  progressText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  counterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  counterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  counterButtonDisabled: {
    backgroundColor: "#F8FAFC",
  },
  registerButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#670CF5",
    alignItems: "center",
    justifyContent: "center",
  },
  registerButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  reviewPromptOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(248, 249, 254, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  reviewPromptCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    alignItems: "center",
  },
  reviewPromptIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#670CF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  reviewPromptTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B0977",
    textAlign: "center",
    marginBottom: 8,
  },
  reviewPromptText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  reviewPromptButton: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPromptButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
