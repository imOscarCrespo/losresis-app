import React, { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLibroSection } from "../hooks/useLibroSection";
import { useResidentReviewCheck } from "../hooks/useResidentReviewCheck";
import {
  ConfirmationModal,
  LibroNodeModal,
  LibroQuickRegisterModal,
} from "../components";
import {
  CATEGORY_ICON_OPTIONS,
  COLOR_TOKEN_MAP,
  TRACKING_MODE_OPTIONS,
  getColorTokenOptions,
  getLibroCategorySuggestions,
} from "../data/libroOnboardingTemplates";
import { getSpecialtyById } from "../services/hospitalService";
import posthogLogger from "../services/posthogService";

const SECTION = "clinical_practice";
const ONBOARDING_STEPS = ["intro", "categories", "activities", "preview"];
const TODAY = new Date().toISOString().slice(0, 10);
const COLLAPSED_CATEGORIES_STORAGE_KEY = "@losresis:libro_collapsed_categories";

const TRACKING_MODE_LABEL = {
  counter: "Contador",
  note: "Nota",
  checklist: "Checklist",
};

const TRACKING_MODE_ACTION = {
  counter: "Registrar",
  note: "Añadir nota",
  checklist: "Completar",
};

const buildDraftCategory = (category) => ({
  id: `${category.name}-${Date.now()}-${Math.random()}`,
  name: category.name,
  icon_name: category.icon_name || "folder-outline",
  color_token: category.color_token || "violet",
  activities: (category.activities || []).map((activity) => ({
    id: `${activity.name}-${Date.now()}-${Math.random()}`,
    name: activity.name,
    goal: activity.goal || "",
    tracking_mode: activity.tracking_mode || "counter",
  })),
});

const getProgress = (count, goal) => {
  if (!goal) return 0;
  return Math.min((count / goal) * 100, 100);
};

const SectionBadge = ({ icon, label, active = false, onPress }) => (
  <TouchableOpacity
    style={[styles.stepBadge, active && styles.stepBadgeActive]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <Ionicons name={icon} size={14} color={active ? "#670CF5" : "#64748B"} />
    <Text style={[styles.stepBadgeText, active && styles.stepBadgeTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const CategoryPill = ({ category, active = false, onPress }) => {
  const color = COLOR_TOKEN_MAP[category.color_token] || COLOR_TOKEN_MAP.violet;

  return (
    <TouchableOpacity
      style={[
        styles.categoryPill,
        active && { borderColor: color, backgroundColor: `${color}12` },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={category.icon_name || "folder-outline"} size={16} color={color} />
      <Text style={[styles.categoryPillText, active && { color }]}>{category.name}</Text>
    </TouchableOpacity>
  );
};

const ActivityDraftRow = ({ activity, onDelete }) => (
  <View style={styles.activityDraftRow}>
    <View style={styles.activityDraftMeta}>
      <Text style={styles.activityDraftTitle}>{activity.name}</Text>
      <Text style={styles.activityDraftSubtitle}>
        {TRACKING_MODE_LABEL[activity.tracking_mode] || "Contador"}
        {activity.goal ? ` · Meta ${activity.goal}` : ""}
      </Text>
    </View>
    <TouchableOpacity onPress={onDelete} style={styles.iconActionButton}>
      <Ionicons name="trash-outline" size={18} color="#EF4444" />
    </TouchableOpacity>
  </View>
);

const ProcedureRow = ({ node, onIncrement, onDecrement, onOpenActions }) => {
  const count = node.total_count || 0;
  const goal = node.goal || 0;
  const progress = getProgress(count, goal);
  const isCounter = (node.tracking_mode || "counter") === "counter";
  const color = COLOR_TOKEN_MAP[node.color_token] || COLOR_TOKEN_MAP.violet;

  return (
    <View style={styles.procedureCard}>
      <View style={styles.procedureTopRow}>
        <View style={styles.procedureMetaBlock}>
          <View style={styles.procedureTitleRow}>
            <Text style={styles.procedureTitle}>{node.name}</Text>
            <View style={[styles.modeTag, { backgroundColor: `${color}12` }]}>
              <Text style={[styles.modeTagText, { color }]}>
                {TRACKING_MODE_LABEL[node.tracking_mode] || "Contador"}
              </Text>
            </View>
          </View>
          <Text style={styles.procedureSubtitle}>
            {count} registradas{goal ? ` · Meta ${goal}` : ""}
          </Text>
        </View>
        <TouchableOpacity onPress={() => onOpenActions(node)} style={styles.iconActionButton}>
          <Ionicons name="ellipsis-horizontal" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: color }]} />
      </View>

      <View style={styles.procedureActionsRow}>
        <Text style={styles.progressSupportText}>
          {goal ? `${Math.round(progress)}% del objetivo` : "Sin objetivo definido"}
        </Text>

        <View style={styles.procedureActions}>
          {isCounter ? (
            <>
              <TouchableOpacity
                style={[styles.counterButton, count <= 0 && styles.counterButtonDisabled]}
                onPress={() => onDecrement(node)}
                disabled={count <= 0}
              >
                <Ionicons name="remove" size={16} color={count <= 0 ? "#94A3B8" : "#1B0977"} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.counterButton} onPress={() => onIncrement(node)}>
                <Ionicons name="add" size={16} color="#1B0977" />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const CategoryCard = ({
  node,
  collapsed = false,
  onToggleCollapse,
  onAddChild,
  onEditParent,
  onDeleteParent,
  onIncrement,
  onDecrement,
  onOpenChildActions,
}) => {
  const color = COLOR_TOKEN_MAP[node.color_token] || COLOR_TOKEN_MAP.violet;
  const children = node.children || [];
  const totalCount = children.reduce((sum, child) => sum + (child.total_count || 0), 0);
  const totalGoal = children.reduce((sum, child) => sum + (child.goal || 0), 0);
  const progress = getProgress(totalCount, totalGoal);

  return (
    <View style={styles.categoryCard}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryHeaderLeft}>
          <View style={[styles.categoryIconWrap, { backgroundColor: `${color}12` }]}>
            <Ionicons name={node.icon_name || "folder-outline"} size={18} color={color} />
          </View>
          <View style={styles.categoryHeaderCopy}>
            <Text style={styles.categoryTitle}>{node.name}</Text>
            <Text style={styles.categorySubtitle}>
              {children.length} actividades · {totalCount} registros
            </Text>
          </View>
        </View>
        <View style={styles.categoryHeaderActions}>
          <TouchableOpacity
            style={styles.iconActionButton}
            onPress={() => onToggleCollapse?.(node.id)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={collapsed ? "chevron-down" : "chevron-up"}
              size={18}
              color="#64748B"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconActionButton}
            onPress={() =>
              Alert.alert(node.name, "Gestiona esta categoría", [
                { text: "Añadir actividad", onPress: () => onAddChild(node) },
                { text: "Editar categoría", onPress: () => onEditParent(node) },
                {
                  text: "Eliminar categoría",
                  style: "destructive",
                  onPress: () => onDeleteParent(node),
                },
                { text: "Cancelar", style: "cancel" },
              ])
            }
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      {!collapsed ? (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{totalCount}</Text>
              <Text style={styles.summaryStatLabel}>registradas</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{totalGoal || "-"}</Text>
              <Text style={styles.summaryStatLabel}>meta</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{Math.round(progress)}%</Text>
              <Text style={styles.summaryStatLabel}>avance</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: color }]} />
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => onAddChild(node)}>
            <Ionicons name="add-circle-outline" size={16} color="#670CF5" />
            <Text style={styles.secondaryButtonText}>Añadir actividad</Text>
          </TouchableOpacity>

          <View style={styles.procedureList}>
            {children.length ? (
              children.map((child) => (
                <ProcedureRow
                  key={child.id}
                  node={child}
                  onIncrement={onIncrement}
                  onDecrement={onDecrement}
                  onOpenActions={onOpenChildActions}
                />
              ))
            ) : (
              <View style={styles.emptyCategoryState}>
                <Ionicons name="sparkles-outline" size={18} color="#64748B" />
                <Text style={styles.emptyCategoryText}>
                  Añade la primera actividad dentro de esta categoría.
                </Text>
              </View>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
};

export default function ResidenceLibraryScreen({
  userProfile,
  navigation,
  residentHasReview = true,
}) {
  const userId = userProfile?.id;
  const userResidencyYear = userProfile?.resident_year || null;
  const specialityId = userProfile?.speciality_id || null;

  const [specialtyName, setSpecialtyName] = useState("");
  const [specialtyResolved, setSpecialtyResolved] = useState(!specialityId);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [showNodeFormScreen, setShowNodeFormScreen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [selectedParentForChild, setSelectedParentForChild] = useState(null);
  const [quickRegisterNode, setQuickRegisterNode] = useState(null);
  const [draftCategories, setDraftCategories] = useState([]);
  const [onboardingStep, setOnboardingStep] = useState("intro");
  const [selectedDraftCategoryId, setSelectedDraftCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("folder-outline");
  const [newCategoryColor, setNewCategoryColor] = useState("violet");
  const [activityName, setActivityName] = useState("");
  const [activityGoal, setActivityGoal] = useState("");
  const [activityTrackingMode, setActivityTrackingMode] = useState("counter");
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [collapsedCategoriesLoaded, setCollapsedCategoriesLoaded] = useState(false);

  const { hasReview } = useResidentReviewCheck(userId, userProfile);
  const shouldShowReviewPrompt =
    userProfile?.is_resident && !userProfile?.is_super_admin && !residentHasReview;

  const {
    nodeTree,
    loading,
    settings,
    settingsLoading,
    editingNode,
    setEditingNode,
    addNode,
    updateNode,
    deleteNode,
    addEntry,
    updateLibroSettings,
    createStructure,
  } = useLibroSection(userId, SECTION);

  const suggestedCategories = useMemo(
    () => getLibroCategorySuggestions(specialtyName),
    [specialtyName]
  );

  const selectedDraftCategory = useMemo(
    () =>
      draftCategories.find((category) => category.id === selectedDraftCategoryId) ||
      draftCategories[0] ||
      null,
    [draftCategories, selectedDraftCategoryId]
  );

  const procedureNodes = useMemo(
    () => nodeTree.flatMap((category) => category.children || []),
    [nodeTree]
  );

  const quickActivityIds = settings?.quick_activity_ids || [];

  const overview = useMemo(() => {
    const totalGoal = procedureNodes.reduce((sum, node) => sum + (node.goal || 0), 0);
    const totalCount = procedureNodes.reduce(
      (sum, node) => sum + (node.total_count || 0),
      0
    );

    return {
      progress: totalGoal ? Math.min(Math.round((totalCount / totalGoal) * 100), 100) : 0,
    };
  }, [procedureNodes]);

  const hasCompletedOnboarding =
    !!settings?.onboarding_completed_at || nodeTree.length > 0;

  useEffect(() => {
    posthogLogger.logScreen("ResidenceLibraryScreen");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCollapsedCategories = async () => {
      if (!userId) {
        if (isMounted) {
          setCollapsedCategories({});
          setCollapsedCategoriesLoaded(true);
        }
        return;
      }

      try {
        const storedValue = await AsyncStorage.getItem(
          `${COLLAPSED_CATEGORIES_STORAGE_KEY}:${userId}:${SECTION}`
        );
        if (!isMounted) return;

        setCollapsedCategories(storedValue ? JSON.parse(storedValue) : {});
      } catch (error) {
        if (isMounted) {
          setCollapsedCategories({});
        }
      } finally {
        if (isMounted) {
          setCollapsedCategoriesLoaded(true);
        }
      }
    };

    setCollapsedCategoriesLoaded(false);
    loadCollapsedCategories();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !collapsedCategoriesLoaded) return;

    AsyncStorage.setItem(
      `${COLLAPSED_CATEGORIES_STORAGE_KEY}:${userId}:${SECTION}`,
      JSON.stringify(collapsedCategories)
    ).catch(() => {});
  }, [collapsedCategories, collapsedCategoriesLoaded, userId]);

  useEffect(() => {
    let isMounted = true;

    const loadSpecialty = async () => {
      if (!specialityId) {
        setSpecialtyName("");
        setSpecialtyResolved(true);
        return;
      }

      try {
        const { success, specialty } = await getSpecialtyById(specialityId);
        if (isMounted && success) {
          setSpecialtyName(specialty?.name || "");
        }
      } catch (error) {
        if (isMounted) {
          setSpecialtyName("");
        }
      } finally {
        if (isMounted) {
          setSpecialtyResolved(true);
        }
      }
    };

    loadSpecialty();

    return () => {
      isMounted = false;
    };
  }, [specialityId]);

  useEffect(() => {
    if (
      specialtyResolved &&
      !hasCompletedOnboarding &&
      !draftCategories.length &&
      suggestedCategories.length
    ) {
      const initialDraft = suggestedCategories.slice(0, 3).map(buildDraftCategory);
      setDraftCategories(initialDraft);
      setSelectedDraftCategoryId(initialDraft[0]?.id || "");
    }
  }, [draftCategories.length, hasCompletedOnboarding, specialtyResolved, suggestedCategories]);

  const closeNodeModal = () => {
    setShowNodeModal(false);
    setShowNodeFormScreen(false);
    setEditingNode(null);
    setSelectedParentForChild(null);
  };

  const openQuickRegister = (node = null) => {
    setQuickRegisterNode(node);
    setShowQuickRegister(true);
  };

  const closeQuickRegister = () => {
    setQuickRegisterNode(null);
    setShowQuickRegister(false);
  };

  const handleAddSuggestedCategory = (category) => {
    const exists = draftCategories.some(
      (item) => item.name.toLowerCase() === category.name.toLowerCase()
    );
    if (exists) return;

    const nextCategory = buildDraftCategory(category);
    setDraftCategories((prev) => [...prev, nextCategory]);
    setSelectedDraftCategoryId(nextCategory.id);
  };

  const handleCreateCategoryDraft = () => {
    if (!newCategoryName.trim()) return;

    const nextCategory = buildDraftCategory({
      name: newCategoryName.trim(),
      icon_name: newCategoryIcon,
      color_token: newCategoryColor,
      activities: [],
    });

    setDraftCategories((prev) => [...prev, nextCategory]);
    setSelectedDraftCategoryId(nextCategory.id);
    setNewCategoryName("");
  };

  const handleDeleteCategoryDraft = (categoryId) => {
    setDraftCategories((prev) => prev.filter((category) => category.id !== categoryId));
    if (selectedDraftCategoryId === categoryId) {
      const nextCategory = draftCategories.find((category) => category.id !== categoryId);
      setSelectedDraftCategoryId(nextCategory?.id || "");
    }
  };

  const handleAddActivityDraft = () => {
    if (!selectedDraftCategory || !activityName.trim()) return;

    setDraftCategories((prev) =>
      prev.map((category) =>
        category.id === selectedDraftCategory.id
          ? {
              ...category,
              activities: [
                ...category.activities,
                {
                  id: `${activityName}-${Date.now()}-${Math.random()}`,
                  name: activityName.trim(),
                  goal: activityGoal.trim() || "",
                  tracking_mode: activityTrackingMode,
                },
              ],
            }
          : category
      )
    );

    setActivityName("");
    setActivityGoal("");
    setActivityTrackingMode("counter");
  };

  const handleDeleteActivityDraft = (activityId) => {
    if (!selectedDraftCategory) return;

    setDraftCategories((prev) =>
      prev.map((category) =>
        category.id === selectedDraftCategory.id
          ? {
              ...category,
              activities: category.activities.filter((activity) => activity.id !== activityId),
            }
          : category
      )
    );
  };

  const handleCompleteOnboarding = async () => {
    const normalizedCategories = draftCategories
      .filter((category) => category.name.trim())
      .map((category) => ({
        name: category.name.trim(),
        icon_name: category.icon_name,
        color_token: category.color_token,
        activities: category.activities
          .filter((activity) => activity.name.trim())
          .map((activity) => ({
            name: activity.name.trim(),
            goal: activity.goal ? parseInt(activity.goal, 10) : null,
            tracking_mode: activity.tracking_mode || "counter",
          })),
      }))
      .filter((category) => category.activities.length > 0);

    if (!normalizedCategories.length) {
      Alert.alert("Falta estructura", "Añade al menos una categoría con una actividad.");
      return;
    }

    const success = await createStructure({
      specialityId,
      categories: normalizedCategories,
    });

    if (!success) {
      Alert.alert("Error", "No se pudo crear tu libro de residente.");
      return;
    }

    setOnboardingStep("intro");
  };

  const handleAddNode = async (formData) => {
    const success = await addNode({
      ...formData,
      tracking_mode: selectedParentForChild
        ? formData.tracking_mode || "counter"
        : undefined,
    });

    if (!success) {
      Alert.alert("Error", "No se pudo guardar el elemento.");
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
      icon_name: formData.icon_name !== undefined ? formData.icon_name : editingNode.icon_name,
      color_token:
        formData.color_token !== undefined ? formData.color_token : editingNode.color_token,
      tracking_mode:
        formData.tracking_mode !== undefined ? formData.tracking_mode : editingNode.tracking_mode,
    });

    if (!success) {
      Alert.alert("Error", "No se pudieron guardar los cambios.");
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
      performed_at: TODAY,
      notes: "",
    });

    if (!success) {
      Alert.alert("Error", "No se pudo registrar la actividad.");
      return;
    }

    await updateLibroSettings({
      last_used_node_id: node.id,
      quick_activity_ids: [node.id, ...quickActivityIds.filter((id) => id !== node.id)].slice(0, 6),
    });
  };

  const handleDecrement = async (node) => {
    if ((node.total_count || 0) <= 0) return;

    const success = await addEntry(node.id, {
      count: -1,
      residency_year: userResidencyYear || 1,
      performed_at: TODAY,
      notes: "",
    });

    if (!success) {
      Alert.alert("Error", "No se pudo ajustar el contador.");
    }
  };

  const handleQuickRegisterSubmit = async (formData) => {
    const success = await addEntry(formData.nodeId, {
      count: formData.count,
      residency_year: userResidencyYear || 1,
      performed_at: formData.performed_at,
      notes: formData.notes || "",
      kind: formData.kind,
      payload: formData.payload,
    });

    if (!success) {
      Alert.alert("Error", "No se pudo guardar el registro.");
      return;
    }

    await updateLibroSettings({
      last_used_node_id: formData.nodeId,
      quick_activity_ids: [
        formData.nodeId,
        ...quickActivityIds.filter((id) => id !== formData.nodeId),
      ].slice(0, 6),
    });

    closeQuickRegister();
  };

  const handleProtectedAction = (callback) => {
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

    callback();
  };

  const openChildActions = (node) => {
    Alert.alert(node.name, "Gestiona esta actividad", [
      {
        text: TRACKING_MODE_ACTION[node.tracking_mode] || "Registrar",
        onPress: () => openQuickRegister(node),
      },
      {
        text: "Editar actividad, objetivo y tipo",
        onPress: () =>
          handleProtectedAction(() => {
            setEditingNode(node);
            setShowNodeModal(true);
          }),
      },
      {
        text: "Eliminar actividad",
        style: "destructive",
        onPress: () => setShowDeleteConfirm(node),
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const toggleCategoryCollapse = (categoryId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  if (
    (loading || settingsLoading || !specialtyResolved) &&
    !hasCompletedOnboarding &&
    !draftCategories.length
  ) {
    return (
      <View style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#670CF5" />
          <Text style={styles.loadingText}>Preparando tu libro de residente...</Text>
        </View>
      </View>
    );
  }

  if (showNodeFormScreen) {
    return (
      <LibroNodeModal
        visible
        onClose={closeNodeModal}
        onSubmit={editingNode ? handleEditNode : handleAddNode}
        existingNode={editingNode}
        selectedParent={selectedParentForChild}
        loading={loading}
        asScreen
      />
    );
  }

  const renderOnboarding = () => {
    const stepIndex = ONBOARDING_STEPS.indexOf(onboardingStep);
    const progress = stepIndex <= 0 ? 0 : Math.round((stepIndex / (ONBOARDING_STEPS.length - 1)) * 100);
    const colorOptions = getColorTokenOptions();

    return (
      <View style={styles.safeArea}>
        <View style={styles.headerShell}>
          <View style={styles.header}>
            <Text style={styles.title}>Libro de residente</Text>
            <View style={styles.headerIcon}>
              <Ionicons name="book-outline" size={18} color="#670CF5" />
            </View>
          </View>
        </View>

        <View style={styles.contentSurface}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.contentInner}>
              <View style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>
                  {specialtyName ? `${specialtyName} · configuración inicial` : "Configuración inicial"}
                </Text>
                <Text style={styles.heroTitle}>Crea un libro útil desde el primer día</Text>
                <Text style={styles.heroText}>
                  Vas a definir las categorías y actividades que quieres seguir durante tu residencia.
                  Después tendrás un dashboard y un registro rápido alineados con esa estructura.
                </Text>

                <View style={styles.progressHeader}>
                  <Text style={styles.progressHeaderLabel}>Progreso</Text>
                  <Text style={styles.progressHeaderValue}>{progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>

              <View style={styles.stepBadgeRow}>
                <SectionBadge
                  icon="sparkles-outline"
                  label="Intro"
                  active={onboardingStep === "intro"}
                  onPress={() => setOnboardingStep("intro")}
                />
                <SectionBadge
                  icon="folder-open-outline"
                  label="Categorías"
                  active={onboardingStep === "categories"}
                  onPress={() => setOnboardingStep("categories")}
                />
                <SectionBadge
                  icon="list-outline"
                  label="Actividades"
                  active={onboardingStep === "activities"}
                  onPress={() => setOnboardingStep("activities")}
                />
                <SectionBadge
                  icon="eye-outline"
                  label="Vista previa"
                  active={onboardingStep === "preview"}
                  onPress={() => setOnboardingStep("preview")}
                />
              </View>

              {onboardingStep === "intro" ? (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Qué vas a tener al final</Text>
                  <View style={styles.featureList}>
                    <View style={styles.featureRow}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#670CF5" />
                      <Text style={styles.featureText}>
                        Categorías adaptadas a tu especialidad.
                      </Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#670CF5" />
                      <Text style={styles.featureText}>
                        Registro rápido de actividad con accesos frecuentes.
                      </Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#670CF5" />
                      <Text style={styles.featureText}>
                        Seguimiento visual del avance por actividad.
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={() => setOnboardingStep("categories")}
                  >
                    <Text style={styles.primaryActionText}>Empezar onboarding</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {onboardingStep === "categories" ? (
                <>
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Sugerencias para {specialtyName || "tu residencia"}</Text>
                    <View style={styles.chipWrap}>
                      {suggestedCategories.map((category) => (
                        <TouchableOpacity
                          key={category.name}
                          style={styles.suggestionChip}
                          onPress={() => handleAddSuggestedCategory(category)}
                        >
                          <Ionicons
                            name={category.icon_name || "folder-outline"}
                            size={14}
                            color="#670CF5"
                          />
                          <Text style={styles.suggestionChipText}>{category.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Tus categorías</Text>
                    <View style={styles.categoryDraftList}>
                      {draftCategories.map((category) => (
                        <View key={category.id} style={styles.categoryDraftRow}>
                          <CategoryPill
                            category={category}
                            active={selectedDraftCategoryId === category.id}
                            onPress={() => setSelectedDraftCategoryId(category.id)}
                          />
                          <TouchableOpacity
                            onPress={() => handleDeleteCategoryDraft(category.id)}
                            style={styles.iconActionButton}
                          >
                            <Ionicons name="close" size={16} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Añadir categoría</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      placeholder="Ej. Quirófano, Técnicas, Guardias"
                    />

                    <Text style={styles.fieldLabel}>Icono</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconSelectorRow}>
                      {CATEGORY_ICON_OPTIONS.map((option) => {
                        const isActive = newCategoryIcon === option.id;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={[styles.iconOption, isActive && styles.iconOptionActive]}
                            onPress={() => setNewCategoryIcon(option.id)}
                          >
                            <Ionicons
                              name={option.id}
                              size={18}
                              color={isActive ? "#670CF5" : "#64748B"}
                            />
                            <Text style={[styles.iconOptionText, isActive && styles.iconOptionTextActive]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <Text style={styles.fieldLabel}>Color</Text>
                    <View style={styles.colorRow}>
                      {colorOptions.map((option) => {
                        const isActive = newCategoryColor === option.id;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={[
                              styles.colorSwatchWrap,
                              isActive && styles.colorSwatchWrapActive,
                            ]}
                            onPress={() => setNewCategoryColor(option.id)}
                          >
                            <View style={[styles.colorSwatch, { backgroundColor: option.hex }]} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity style={styles.primaryAction} onPress={handleCreateCategoryDraft}>
                      <Text style={styles.primaryActionText}>Añadir categoría</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryOutlineAction}
                      onPress={() => setOnboardingStep("activities")}
                    >
                      <Text style={styles.secondaryOutlineActionText}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {onboardingStep === "activities" ? (
                <>
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Selecciona una categoría</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollContent}>
                      {draftCategories.map((category) => (
                        <CategoryPill
                          key={category.id}
                          category={category}
                          active={selectedDraftCategory?.id === category.id}
                          onPress={() => setSelectedDraftCategoryId(category.id)}
                        />
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                      Actividades de {selectedDraftCategory?.name || "la categoría"}
                    </Text>

                    <TextInput
                      style={styles.formInput}
                      value={activityName}
                      onChangeText={setActivityName}
                      placeholder="Ej. Parto eutócico, sesión clínica, técnica..."
                    />
                    <TextInput
                      style={styles.formInput}
                      value={activityGoal}
                      onChangeText={(value) => setActivityGoal(value.replace(/[^0-9]/g, ""))}
                      placeholder="Meta opcional"
                      keyboardType="number-pad"
                    />

                    <View style={styles.modeSelectorRow}>
                      {TRACKING_MODE_OPTIONS.map((option) => {
                        const active = activityTrackingMode === option.id;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={[styles.modeSelectorButton, active && styles.modeSelectorButtonActive]}
                            onPress={() => setActivityTrackingMode(option.id)}
                          >
                            <Text
                              style={[
                                styles.modeSelectorText,
                                active && styles.modeSelectorTextActive,
                              ]}
                            >
                              {option.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity style={styles.primaryAction} onPress={handleAddActivityDraft}>
                      <Text style={styles.primaryActionText}>Añadir actividad</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Vista de la categoría</Text>
                    {(selectedDraftCategory?.activities || []).length ? (
                      selectedDraftCategory.activities.map((activity) => (
                        <ActivityDraftRow
                          key={activity.id}
                          activity={activity}
                          onDelete={() => handleDeleteActivityDraft(activity.id)}
                        />
                      ))
                    ) : (
                      <Text style={styles.sectionText}>
                        Esta categoría todavía no tiene actividades.
                      </Text>
                    )}

                    <TouchableOpacity
                      style={styles.secondaryOutlineAction}
                      onPress={() => setOnboardingStep("preview")}
                    >
                      <Text style={styles.secondaryOutlineActionText}>Ir a vista previa</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {onboardingStep === "preview" ? (
                <>
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Vista previa del libro</Text>
                    <Text style={styles.sectionText}>
                      Revisa la estructura final antes de crearla.
                    </Text>
                  </View>

                  {draftCategories.map((category) => (
                    <View key={category.id} style={styles.categoryPreviewCard}>
                      <View style={styles.categoryPreviewHeader}>
                        <CategoryPill category={category} active />
                        <Text style={styles.categoryPreviewCount}>
                          {category.activities.length} actividades
                        </Text>
                      </View>
                      {(category.activities || []).map((activity) => (
                        <View key={activity.id} style={styles.previewActivityRow}>
                          <View>
                            <Text style={styles.previewActivityTitle}>{activity.name}</Text>
                            <Text style={styles.previewActivitySubtitle}>
                              {TRACKING_MODE_LABEL[activity.tracking_mode] || "Contador"}
                              {activity.goal ? ` · Meta ${activity.goal}` : ""}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}

                  <TouchableOpacity style={styles.primaryAction} onPress={handleCompleteOnboarding}>
                    <Text style={styles.primaryActionText}>Crear mi libro</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderDashboard = () => (
    <View style={styles.safeArea}>
      <View style={styles.headerShell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Libro de residente</Text>
            <Text style={styles.headerMeta}>
              {[specialtyName, userResidencyYear ? `R${userResidencyYear}` : null]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() =>
              handleProtectedAction(() => {
                setSelectedParentForChild(null);
                setShowNodeFormScreen(true);
              })
            }
          >
            <Ionicons name="add" size={18} color="#670CF5" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contentSurface}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentInner}>
            <View style={styles.heroCard}>
              <View style={styles.dashboardProgressTopRow}>
                <View style={styles.dashboardProgressCopy}>
                  <Text style={styles.dashboardProgressTitle}>Tu progreso</Text>
                  <Text style={styles.dashboardProgressText}>
                    Sigue completando actividades para avanzar en tu libro.
                  </Text>
                </View>
                <Text style={styles.dashboardProgressValue}>{overview.progress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${overview.progress}%` }]} />
              </View>
            </View>

            {nodeTree.map((parentNode) => (
              <CategoryCard
                key={parentNode.id}
                node={parentNode}
                collapsed={!!collapsedCategories[parentNode.id]}
                onToggleCollapse={toggleCategoryCollapse}
                onAddChild={(parent) =>
                  handleProtectedAction(() => {
                    setSelectedParentForChild(parent);
                    setEditingNode(null);
                    setShowNodeFormScreen(true);
                  })
                }
                onEditParent={(node) =>
                  handleProtectedAction(() => {
                    setEditingNode(node);
                    setShowNodeModal(true);
                  })
                }
                onDeleteParent={(node) => setShowDeleteConfirm(node)}
                onIncrement={(node) => handleProtectedAction(() => handleIncrement(node))}
                onDecrement={handleDecrement}
                onOpenChildActions={openChildActions}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {shouldShowReviewPrompt ? (
        <View style={styles.reviewPromptOverlay}>
          <View style={styles.reviewPromptCard}>
            <View style={styles.reviewPromptIcon}>
              <Ionicons name="document-text-outline" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.reviewPromptTitle}>Desbloquea tu libro</Text>
            <Text style={styles.reviewPromptText}>
              Antes de registrar actividad, comparte tu experiencia con una reseña.
            </Text>
            <TouchableOpacity
              style={styles.reviewPromptButton}
              onPress={() => navigation?.navigate?.("myReview")}
            >
              <Text style={styles.reviewPromptButtonText}>Ir a mi reseña</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <LibroNodeModal
        visible={showNodeModal}
        onClose={closeNodeModal}
        onSubmit={editingNode ? handleEditNode : handleAddNode}
        existingNode={editingNode}
        selectedParent={selectedParentForChild}
        loading={loading}
      />

      <LibroQuickRegisterModal
        visible={showQuickRegister}
        onClose={closeQuickRegister}
        onSubmit={handleQuickRegisterSubmit}
        categories={nodeTree}
        initialNode={quickRegisterNode}
        loading={loading}
      />

      <ConfirmationModal
        visible={!!showDeleteConfirm}
        title="Eliminar elemento"
        message={`Vas a eliminar "${showDeleteConfirm?.name}". Si es una categoría, también se eliminarán sus actividades y registros asociados.`}
        onConfirm={() => handleDeleteNode(showDeleteConfirm?.id)}
        onCancel={() => setShowDeleteConfirm(null)}
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmColor="#EF4444"
      />
    </View>
  );

  return hasCompletedOnboarding ? renderDashboard() : renderOnboarding();
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
  headerMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
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
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  dashboardProgressHeader: {
    marginTop: 0,
  },
  dashboardProgressTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 12,
  },
  dashboardProgressCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  dashboardProgressTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
  },
  dashboardProgressText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
  },
  dashboardProgressValue: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#670CF5",
    textAlign: "right",
  },
  progressHeaderLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  progressHeaderValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#670CF5",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E9D5FF",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#670CF5",
  },
  heroFooter: {
    marginTop: 6,
  },
  heroSupportText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  stepBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stepBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  stepBadgeActive: {
    borderColor: "#D8B4FE",
    backgroundColor: "#F5F3FF",
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  stepBadgeTextActive: {
    color: "#670CF5",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
  },
  sectionText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  featureList: {
    marginTop: 14,
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  primaryAction: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryOutlineAction: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8B4FE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryOutlineActionText: {
    color: "#670CF5",
    fontSize: 15,
    fontWeight: "800",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F5F3FF",
  },
  suggestionChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#670CF5",
  },
  categoryDraftList: {
    marginTop: 14,
    gap: 12,
  },
  categoryDraftRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  formInput: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0F172A",
    marginTop: 14,
  },
  fieldLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#1B0977",
  },
  iconSelectorRow: {
    gap: 10,
  },
  iconOption: {
    minWidth: 90,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    gap: 8,
  },
  iconOptionActive: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#D8B4FE",
  },
  iconOptionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  iconOptionTextActive: {
    color: "#670CF5",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorSwatchWrap: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
  },
  colorSwatchWrapActive: {
    borderColor: "#1B0977",
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  chipScrollContent: {
    gap: 10,
    paddingTop: 14,
  },
  modeSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  modeSelectorButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  modeSelectorButtonActive: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#D8B4FE",
  },
  modeSelectorText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  modeSelectorTextActive: {
    color: "#670CF5",
  },
  activityDraftRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  activityDraftMeta: {
    flex: 1,
  },
  activityDraftTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  activityDraftSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },
  iconActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  categoryPreviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  categoryPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryPreviewCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  previewActivityRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
  },
  previewActivityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  previewActivitySubtitle: {
    marginTop: 4,
    fontSize: 13,
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
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  secondaryButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#F5F3FF",
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#670CF5",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  quickCard: {
    width: "48%",
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 14,
  },
  quickCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  quickCardMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#670CF5",
  },
  addCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    flexShrink: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F5F3FF",
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
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  categoryHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryHeaderCopy: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B0977",
  },
  categorySubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  summaryStat: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  summaryStatLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  procedureList: {
    marginTop: 14,
    gap: 12,
  },
  emptyCategoryState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  emptyCategoryText: {
    flex: 1,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  procedureCard: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 14,
  },
  procedureTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  procedureMetaBlock: {
    flex: 1,
  },
  procedureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  procedureTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  procedureSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  modeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  modeTagText: {
    fontSize: 11,
    fontWeight: "800",
  },
  procedureActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  progressSupportText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  procedureActions: {
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
    backgroundColor: "#F1F5F9",
  },
  reviewPromptOverlay: {
    position: "absolute",
    right: 16,
    left: 16,
    bottom: 24,
  },
  reviewPromptCard: {
    borderRadius: 24,
    backgroundColor: "#1B0977",
    padding: 18,
  },
  reviewPromptIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  reviewPromptTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  reviewPromptText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.82)",
  },
  reviewPromptButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPromptButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1B0977",
  },
});
