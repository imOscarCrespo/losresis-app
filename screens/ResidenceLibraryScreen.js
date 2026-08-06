import React, { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { useLibroSection } from "../hooks/useLibroSection";
import { exportLibroToPdf } from "../services/libroPdfService";
import {
  ConfirmationModal,
  LibroNodeModal,
  LibroQuickRegisterModal,
} from "../components";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import {
  CATEGORY_ICON_OPTIONS,
  COLOR_TOKEN_MAP,
  getColorTokenOptions,
  getLibroCategorySuggestions,
} from "../data/libroOnboardingTemplates";
import { getSpecialtyById } from "../services/hospitalService";
import { getLibroBooksForUser } from "../services/libroService";
import {
  getLibroTemplateOutline,
  getLibroTemplateTree,
  getPublishedLibroTemplateForUser,
  switchLibroYearToTemplate,
} from "../services/libroTemplateService";
import {
  DEFAULT_LIBRO_SECTION,
  getLibroSectionIcon,
  getLibroSectionLabel,
  sortLibroSectionCodes,
} from "../data/libroSections";
import posthogLogger from "../services/posthogService";
import {
  isResidentLockedMissingCorporateEmail,
  shouldBypassResidentReviewGate,
} from "../utils/residentAccess";

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
    <Icon name={icon} size={14} color={active ? "#670CF5" : "#64748B"} />
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
      <Icon name={category.icon_name || "folder-outline"} size={16} color={color} />
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
      <Icon name="trash-outline" size={18} color="#EF4444" />
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
          <Icon name="ellipsis-horizontal" size={18} color="#64748B" />
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
                <Icon name="remove" size={16} color={count <= 0 ? "#94A3B8" : "#1B0977"} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.counterButton} onPress={() => onIncrement(node)}>
                <Icon name="add" size={16} color="#1B0977" />
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
  // La estructura la define el tutor: se registra dentro, pero no se añaden,
  // editan ni borran rotaciones ni procedimientos.
  structureLocked = false,
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
            <Icon name={node.icon_name || "folder-outline"} size={18} color={color} />
          </View>
          <View style={styles.categoryHeaderCopy}>
            <Text style={styles.categoryTitle}>{node.name}</Text>
            <Text style={styles.categorySubtitle}>
              {children.length} procedimientos · {totalCount} registros
            </Text>
          </View>
        </View>
        <View style={styles.categoryHeaderActions}>
          <TouchableOpacity
            style={styles.iconActionButton}
            onPress={() => onToggleCollapse?.(node.id)}
            activeOpacity={0.85}
          >
            <Icon
              name={collapsed ? "chevron-down" : "chevron-up"}
              size={18}
              color="#64748B"
            />
          </TouchableOpacity>
          {!structureLocked ? (
            <TouchableOpacity
              style={styles.iconActionButton}
              onPress={() =>
                Alert.alert(node.name, "Gestiona esta rotación", [
                  { text: "Añadir procedimiento", onPress: () => onAddChild(node) },
                  { text: "Editar rotación", onPress: () => onEditParent(node) },
                  {
                    text: "Eliminar rotación",
                    style: "destructive",
                    onPress: () => onDeleteParent(node),
                  },
                  { text: "Cancelar", style: "cancel" },
                ])
              }
            >
              <Icon name="ellipsis-horizontal" size={18} color="#64748B" />
            </TouchableOpacity>
          ) : null}
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

          {!structureLocked ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => onAddChild(node)}>
              <Icon name="add-circle-outline" size={16} color="#670CF5" />
              <Text style={styles.secondaryButtonText}>Añadir procedimiento</Text>
            </TouchableOpacity>
          ) : null}

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
                <Icon name="sparkles-outline" size={18} color="#64748B" />
                <Text style={styles.emptyCategoryText}>
                  {structureLocked
                    ? "Tu tutor todavía no ha puesto contenido en este apartado."
                    : "Añade el primer procedimiento dentro de esta rotación."}
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
  onBack,
  residentHasReview = true,
  residentReviewGateStatus = "soft",
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
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [collapsedCategoriesLoaded, setCollapsedCategoriesLoaded] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const onboardingScrollRef = useRef(null);
  const rotationsInputRef = useRef(null);

  const shouldShowReviewPrompt =
    userProfile?.is_resident &&
    !userProfile?.is_super_admin &&
    !shouldBypassResidentReviewGate(userProfile) &&
    !residentHasReview &&
    residentReviewGateStatus === "hard";
  const shouldShowCorporateEmailLock =
    isResidentLockedMissingCorporateEmail(userProfile);

  // Qué bloques tiene el libro de este residente.
  //
  // La pantalla asumía que solo existía la práctica clínica, así que cualquier
  // otro bloque que el tutor escogiera en el panel (cursos, guardias,
  // competencias…) quedaba invisible: se consultaba una sección que el residente
  // no tenía y la respuesta venía vacía.
  const [allBooks, setAllBooks] = useState([]);
  const [templateOutline, setTemplateOutline] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [section, setSection] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [sectionsResolved, setSectionsResolved] = useState(false);
  const [templateTree, setTemplateTree] = useState([]);
  const [libroReloadKey, setLibroReloadKey] = useState(0);
  const [switchingToTemplate, setSwitchingToTemplate] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveLibro = async () => {
      if (!userId) {
        if (isMounted) {
          setAllBooks([]);
          setTemplateOutline([]);
          setTemplateId(null);
          setSection(DEFAULT_LIBRO_SECTION);
          setSectionsResolved(true);
        }
        return;
      }

      try {
        // Sus libros (año en curso e histórico) y el plan de su tutor: el rail de
        // años es la unión de los dos.
        const [booksData, template] = await Promise.all([
          getLibroBooksForUser(userId),
          getPublishedLibroTemplateForUser(userId),
        ]);
        if (!isMounted) return;

        const outline = template?.id
          ? await getLibroTemplateOutline(template.id)
          : [];
        if (!isMounted) return;

        setAllBooks(booksData || []);
        setTemplateId(template?.id || null);
        setTemplateOutline(outline);
      } catch (error) {
        console.error("Error resolving libro:", error);
        if (isMounted) {
          setAllBooks([]);
          setTemplateOutline([]);
          setTemplateId(null);
        }
      } finally {
        if (isMounted) {
          setSectionsResolved(true);
        }
      }
    };

    setSectionsResolved(false);
    resolveLibro();

    return () => {
      isMounted = false;
    };
  }, [userId, libroReloadKey]);

  // Los años que el residente puede consultar: los de sus libros más los que su
  // tutor ha definido en la plantilla.
  const availableYears = useMemo(() => {
    const years = new Set([
      ...allBooks.map((book) => book.residency_year),
      ...templateOutline.map((block) => block.residency_year),
    ]);
    return [...years].filter(Boolean).sort((a, b) => a - b);
  }, [allBooks, templateOutline]);

  // Se abre el año en curso del residente. Si su año no está cubierto, el último
  // que sí lo esté.
  useEffect(() => {
    if (selectedYear !== null || !availableYears.length) return;

    setSelectedYear(
      userResidencyYear && availableYears.includes(userResidencyYear)
        ? userResidencyYear
        : availableYears[availableYears.length - 1]
    );
  }, [availableYears, selectedYear, userResidencyYear]);

  // Los bloques disponibles en el año elegido: los de sus libros de ese año y los
  // que la plantilla define para ese año.
  const availableSections = useMemo(() => {
    if (!selectedYear) return [];

    return sortLibroSectionCodes([
      ...new Set([
        ...allBooks
          .filter((book) => book.residency_year === selectedYear)
          .map((book) => book.section),
        ...templateOutline
          .filter((block) => block.residency_year === selectedYear)
          .map((block) => block.section),
      ]),
    ]);
  }, [allBooks, templateOutline, selectedYear]);

  // La sección abierta tiene que existir en el año elegido: al cambiar de año se
  // conserva el mismo bloque si lo hay, y si no se cae al primero disponible.
  useEffect(() => {
    if (!sectionsResolved) return;

    if (!availableSections.length) {
      setSection(DEFAULT_LIBRO_SECTION);
      return;
    }

    if (!section || !availableSections.includes(section)) {
      setSection(
        availableSections.includes(DEFAULT_LIBRO_SECTION)
          ? DEFAULT_LIBRO_SECTION
          : availableSections[0]
      );
    }
  }, [availableSections, section, sectionsResolved]);

  const {
    books,
    selectedBook,
    selectBook,
    isSelectedBookArchived,
    nodeTree,
    entries,
    events,
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
  } = useLibroSection(userId, section);

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

  const quickActivityIds = settings?.quick_activity_ids || [];
  const currentBookResidencyYear =
    selectedBook?.residency_year || userResidencyYear || 1;

  // El libro del residente para el año y el bloque abiertos, si lo tiene.
  const bookForSelection = useMemo(
    () =>
      allBooks.find(
        (book) => book.section === section && book.residency_year === selectedYear
      ) || null,
    [allBooks, section, selectedYear]
  );

  // Sin libro propio para esa combinación, lo que se muestra es el plan del tutor:
  // la estructura de la plantilla, que no es un libro y por tanto no se toca.
  const isTemplateMode = !!selectedYear && !bookForSelection;

  // El residente solo escribe en el libro de su año en curso. Los años que ya
  // cerró y los que su tutor tiene definidos por delante se consultan.
  //
  // Sin año resuelto o sin año en el perfil no se bloquea nada: es el residente
  // que todavía tiene que montar su libro en el onboarding.
  const isOwnYear =
    !selectedYear || !userResidencyYear || selectedYear === userResidencyYear;
  const isSelectedBookReadOnly =
    isTemplateMode || isSelectedBookArchived || !isOwnYear;

  // Un libro sembrado de la plantilla lo define el tutor: el residente registra
  // actividad dentro, pero no añade, edita ni borra su estructura. Es distinto de
  // isSelectedBookReadOnly, que sí impide registrar.
  const isStructureLocked =
    isSelectedBookReadOnly || !!bookForSelection?.template_id;

  // useLibroSection elige por su cuenta el libro activo del bloque; aquí se le
  // dice cuál toca según el año elegido en el rail.
  useEffect(() => {
    if (!bookForSelection || bookForSelection.id === selectedBook?.id) return;
    selectBook(bookForSelection.id);
  }, [bookForSelection, selectedBook?.id, selectBook]);

  // La estructura del plan del tutor para el año y bloque abiertos.
  useEffect(() => {
    let isMounted = true;

    if (!isTemplateMode || !templateId || !section || !selectedYear) {
      setTemplateTree((prev) => (prev.length ? [] : prev));
      return () => {
        isMounted = false;
      };
    }

    getLibroTemplateTree(templateId, section, selectedYear)
      .then((tree) => {
        if (isMounted) setTemplateTree(tree);
      })
      .catch(() => {
        if (isMounted) setTemplateTree([]);
      });

    return () => {
      isMounted = false;
    };
  }, [isTemplateMode, templateId, section, selectedYear]);

  // Lo que se pinta: su libro, o el plan del tutor si ese año todavía no es suyo.
  const displayTree = isTemplateMode ? templateTree : nodeTree;

  // Bloques que su tutor ha definido para SU año y que su libro no tiene. Pasa
  // cuando el residente montó el libro por su cuenta en el onboarding, o cuando
  // se le sembró antes de que el tutor terminara la plantilla.
  const missingOwnYearSections = useMemo(() => {
    if (!isOwnYear || !selectedYear || !templateId) return [];

    const mine = new Set(
      allBooks
        .filter((book) => book.residency_year === selectedYear)
        .map((book) => book.section)
    );

    return sortLibroSectionCodes(
      templateOutline
        .filter(
          (block) =>
            block.residency_year === selectedYear && !mine.has(block.section)
        )
        .map((block) => block.section)
    );
  }, [allBooks, templateOutline, templateId, selectedYear, isOwnYear]);

  const canSwitchToTemplate = missingOwnYearSections.length > 0;

  // Cambio de año de residencia: en cuanto el perfil dice R2, el libro de R2 se
  // crea solo desde la plantilla y los años anteriores quedan archivados. No hay
  // botón de "archivar y empezar nuevo año": lo dispara el año del perfil.
  //
  // Solo cuando no hay nada que perder: si el residente ya tiene libro de ese año
  // se le pregunta antes (canSwitchToTemplate), porque sustituirlo borra lo
  // registrado.
  const autoSeededYearRef = useRef(null);

  useEffect(() => {
    if (!sectionsResolved || !userId || !templateId || !selectedYear) return;
    if (!isOwnYear || switchingToTemplate) return;
    if (allBooks.some((book) => book.residency_year === selectedYear)) return;
    if (!templateOutline.some((block) => block.residency_year === selectedYear)) return;

    // Un solo intento por año: si falla, no se reintenta en bucle.
    const attempt = `${userId}:${selectedYear}`;
    if (autoSeededYearRef.current === attempt) return;
    autoSeededYearRef.current = attempt;

    setSwitchingToTemplate(true);
    switchLibroYearToTemplate({ userId, templateId, residencyYear: selectedYear })
      .then(() => {
        posthogLogger.capture("resident_book_year_seeded_from_template", {
          residency_year: selectedYear,
        });
        setLibroReloadKey((prev) => prev + 1);
      })
      .catch((error) => {
        console.error("Error seeding libro year from template:", error);
      })
      .finally(() => setSwitchingToTemplate(false));
  }, [
    sectionsResolved,
    userId,
    templateId,
    selectedYear,
    isOwnYear,
    switchingToTemplate,
    allBooks,
    templateOutline,
  ]);

  // Cambiar el año en curso al libro que ha definido el tutor. Se lleva por
  // delante lo registrado, así que se confirma dos veces: una para entrar y otra
  // para asumir la pérdida.
  const handleSwitchToTemplate = () => {
    const recorded = allBooks.filter(
      (book) => book.residency_year === selectedYear
    ).length;

    Alert.alert(
      `Cambiar al libro de tu tutor`,
      recorded > 0
        ? `Tu tutor ha definido el libro oficial de R${selectedYear}. Si cambias, tu libro actual de R${selectedYear} se sustituye por el suyo y PERDERÁS todo lo que has registrado en él. No se puede deshacer.`
        : `Tu tutor ha definido el libro oficial de R${selectedYear}. Se creará con su estructura para que puedas empezar a registrar.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: recorded > 0 ? "Cambiar y perder lo registrado" : "Cambiar",
          style: recorded > 0 ? "destructive" : "default",
          onPress: async () => {
            setSwitchingToTemplate(true);
            try {
              await switchLibroYearToTemplate({
                userId,
                templateId,
                residencyYear: selectedYear,
              });
              posthogLogger.capture("resident_book_switched_to_template", {
                residency_year: selectedYear,
                sections_added: missingOwnYearSections.length,
              });
              setLibroReloadKey((prev) => prev + 1);
            } catch (error) {
              console.error("Error switching libro to template:", error);
              Alert.alert(
                "No se pudo cambiar",
                "Inténtalo de nuevo en un momento."
              );
            } finally {
              setSwitchingToTemplate(false);
            }
          },
        },
      ]
    );
  };

  const hasCompletedOnboarding =
    !!settings?.onboarding_completed_at || books.length > 0 || nodeTree.length > 0;

  useEffect(() => {
    posthogLogger.logScreen("ResidenceLibraryScreen");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCollapsedCategories = async () => {
      if (!userId || !section) {
        if (isMounted) {
          setCollapsedCategories({});
          setCollapsedCategoriesLoaded(true);
        }
        return;
      }

      try {
        const storedValue = await AsyncStorage.getItem(
          `${COLLAPSED_CATEGORIES_STORAGE_KEY}:${userId}:${section}`
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
    // Cada sección recuerda sus propias categorías plegadas.
  }, [userId, section]);

  useEffect(() => {
    if (!userId || !section || !collapsedCategoriesLoaded) return;

    AsyncStorage.setItem(
      `${COLLAPSED_CATEGORIES_STORAGE_KEY}:${userId}:${section}`,
      JSON.stringify(collapsedCategories)
    ).catch(() => {});
  }, [collapsedCategories, collapsedCategoriesLoaded, userId, section]);

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
    const existingCategory = draftCategories.find(
      (item) => item.name.toLowerCase() === category.name.toLowerCase()
    );
    if (existingCategory) {
      setSelectedDraftCategoryId(existingCategory.id);
      return;
    }

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

    const normalizedGoal = activityGoal.trim();

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
                  goal: normalizedGoal,
                  tracking_mode: "counter",
                },
              ],
            }
          : category
      )
    );

    setActivityName("");
    setActivityGoal("");
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
      }));

    if (!normalizedCategories.length) {
      Alert.alert("Falta estructura", "Añade al menos una rotación para continuar.");
      return;
    }

    const success = await createStructure({
      specialityId,
      categories: normalizedCategories,
      residencyYear: userResidencyYear || 1,
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
      residency_year: currentBookResidencyYear,
      performed_at: TODAY,
      notes: "",
    });

    if (!success) {
      Alert.alert("Error", "No se pudo registrar el procedimiento.");
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
      residency_year: currentBookResidencyYear,
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
      residency_year: currentBookResidencyYear,
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

  const handleProtectedAction = (callback, { requiresEditable = false } = {}) => {
    if (shouldShowCorporateEmailLock) {
      Alert.alert(
        "Correo corporativo requerido",
        "La ventana temporal MIR ya ha terminado. Añade tu correo corporativo en el perfil para seguir usando el libro de residente.",
        [
          {
            text: "Ir a mi perfil",
            onPress: () => navigation?.navigate?.("usuario"),
          },
          { text: "Cancelar", style: "cancel" },
        ]
      );
      return;
    }

    if (shouldShowReviewPrompt) {
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

    if (requiresEditable && isSelectedBookReadOnly) {
      if (isSelectedBookArchived) {
        Alert.alert(
          "Libro archivado",
          "Este libro es de solo lectura. Vuelve al libro de tu año para hacer cambios."
        );
      } else if (canSwitchToTemplate) {
        // Es su año: lo que le falta no es permiso, es cambiarse al libro que ha
        // definido su tutor. Se le ofrece ahí mismo.
        handleSwitchToTemplate();
      } else {
        Alert.alert(
          `Estás viendo R${selectedYear}`,
          `Es el plan que ha definido tu tutor. Solo puedes registrar en el libro de tu año en curso${userResidencyYear ? ` (R${userResidencyYear})` : ""}.`
        );
      }
      return;
    }

    callback();
  };

  const openChildActions = (node) => {
    // Registrar siempre; editar y borrar solo si la estructura es suya.
    const actions = [
      {
        text: TRACKING_MODE_ACTION[node.tracking_mode] || "Registrar",
        onPress: () =>
          handleProtectedAction(() => openQuickRegister(node), {
            requiresEditable: true,
          }),
      },
    ];

    if (!isStructureLocked) {
      actions.push(
        {
          text: "Editar procedimiento, objetivo y tipo",
          onPress: () =>
            handleProtectedAction(() => {
              setEditingNode(node);
              setShowNodeModal(true);
            }, { requiresEditable: true }),
        },
        {
          text: "Eliminar procedimiento",
          style: "destructive",
          onPress: () =>
            handleProtectedAction(() => setShowDeleteConfirm(node), {
              requiresEditable: true,
            }),
        }
      );
    }

    actions.push({ text: "Cancelar", style: "cancel" });

    Alert.alert(node.name, "Gestiona este procedimiento", actions);
  };

  const toggleCategoryCollapse = (categoryId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleExportPdf = async () => {
    if (!nodeTree.length) {
      Alert.alert("Sin contenido", "Todavía no hay contenido suficiente para exportar.");
      return;
    }

    setExportingPdf(true);

    try {
      await exportLibroToPdf({
        specialtyName,
        userResidencyYear: selectedBook?.residency_year || userResidencyYear,
        nodeTree,
        entries,
        events,
      });

      posthogLogger.capture("resident_book_pdf_exported", {
        section,
        categories_count: nodeTree.length,
        entries_count: entries.length,
        events_count: events.length,
      });
    } catch (error) {
      console.error("Error exporting libro PDF:", error);
      Alert.alert("Error", "No se pudo generar el PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const scrollToRotationsInput = () => {
    requestAnimationFrame(() => {
      onboardingScrollRef.current?.scrollTo({ y: 720, animated: true });
    });
  };

  // Sin saber qué bloques tiene el residente no se puede decidir si ve su libro o
  // el onboarding, y acertar después sería un parpadeo.
  if (!sectionsResolved) {
    return (
      <View style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#670CF5" />
          <Text style={styles.loadingText}>Preparando tu libro de residente...</Text>
        </View>
      </View>
    );
  }

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
      <HeroScreenLayout title="Libro" onBack={onBack}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            ref={onboardingScrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentInner}>
              <View style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>
                  {specialtyName ? `${specialtyName} · configuración inicial` : "Configuración inicial"}
                </Text>
                <Text style={styles.heroTitle}>
                  Crea tu libro de residencia en menos de 3 minutos
                </Text>
                <Text style={styles.heroText}>
                  Define qué quieres registrar y empieza a construir tu libro desde hoy
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
                  label="Rotaciones"
                  active={onboardingStep === "categories"}
                  onPress={() => setOnboardingStep("categories")}
                />
                <SectionBadge
                  icon="list-outline"
                  label="Procedimientos"
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
                      <Icon name="checkmark-circle-outline" size={18} color="#670CF5" />
                      <Text style={styles.featureText}>
                        Registro claro de todos tus procedimientos
                      </Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Icon name="checkmark-circle-outline" size={18} color="#670CF5" />
                      <Text style={styles.featureText}>
                        Crea tus propios objetivos de cada procedimiento
                      </Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Icon name="checkmark-circle-outline" size={18} color="#670CF5" />
                      <Text style={styles.featureText}>
                        Exporta tu progreso en PDF cuando quieras
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={() => setOnboardingStep("categories")}
                  >
                    <Text style={styles.primaryActionText}>Crear mi libro de residencia</Text>
                  </TouchableOpacity>
                  <Text style={styles.microcopyText}>Puedes modificarlo después</Text>
                </View>
              ) : null}

              {onboardingStep === "categories" ? (
                <>
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Añadir rotaciones</Text>
                    <Text style={styles.sectionText}>
                      Primero añade rotaciones desde sugerencias o creando las tuyas. Después revisa el resultado final.
                    </Text>
                    <View style={styles.flowStep}>
                      <View style={styles.flowStepHeader}>
                        <View style={styles.flowStepBadge}>
                          <Text style={styles.flowStepBadgeText}>1</Text>
                        </View>
                        <View style={styles.flowStepCopy}>
                          <Text style={styles.flowStepTitle}>
                            Selecciona sugerencias para tu residencia
                          </Text>
                          <Text style={styles.flowStepText}>
                            Tócalas para añadirlas directamente a “Tus rotaciones”.
                          </Text>
                        </View>
                      </View>
                    <View style={styles.chipWrap}>
                        {suggestedCategories.map((category) => {
                          const isSelected = draftCategories.some(
                            (item) => item.name.toLowerCase() === category.name.toLowerCase()
                          );

                          return (
                            <TouchableOpacity
                              key={category.name}
                              style={[
                                styles.suggestionChip,
                                isSelected && styles.suggestionChipSelected,
                              ]}
                              onPress={() => handleAddSuggestedCategory(category)}
                            >
                              <Icon
                                name={
                                  isSelected
                                    ? "checkmark-circle"
                                    : category.icon_name || "folder-outline"
                                }
                                size={14}
                                color={isSelected ? "#FFFFFF" : "#670CF5"}
                              />
                              <Text
                                style={[
                                  styles.suggestionChipText,
                                  isSelected && styles.suggestionChipTextSelected,
                                ]}
                              >
                                {category.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.flowStep}>
                      <View style={styles.flowStepHeader}>
                        <View style={styles.flowStepBadge}>
                          <Text style={styles.flowStepBadgeText}>2</Text>
                        </View>
                        <View style={styles.flowStepCopy}>
                          <Text style={styles.flowStepTitle}>Añade tus propias rotaciones</Text>
                        </View>
                      </View>

                      <TextInput
                        ref={rotationsInputRef}
                        style={styles.formInput}
                        value={newCategoryName}
                        onChangeText={setNewCategoryName}
                        placeholder="Ej: rotación de mama, endoscopia…"
                        onFocus={scrollToRotationsInput}
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
                              <Icon
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
                        <Text style={styles.primaryActionText}>Añadir rotación</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Tus rotaciones</Text>
                    <Text style={styles.sectionText}>
                      Añade al menos una rotación para continuar
                    </Text>
                    <View style={styles.categoryDraftList}>
                      {draftCategories.length ? (
                        draftCategories.map((category) => (
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
                              <Icon name="close" size={16} color="#64748B" />
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.secondaryOutlineAction,
                        !draftCategories.length && styles.secondaryOutlineActionDisabled,
                      ]}
                      onPress={() => setOnboardingStep("activities")}
                      disabled={!draftCategories.length}
                    >
                      <Text style={styles.secondaryOutlineActionText}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {onboardingStep === "activities" ? (
                <>
                  <View style={styles.card}>
                    <View style={styles.flowStepHeader}>
                      <View style={styles.flowStepBadge}>
                        <Text style={styles.flowStepBadgeText}>1</Text>
                      </View>
                      <View style={styles.flowStepCopy}>
                        <Text style={styles.sectionTitle}>Selecciona una rotación</Text>
                      </View>
                    </View>
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
                    <View style={styles.flowStepHeader}>
                      <View style={styles.flowStepBadge}>
                        <Text style={styles.flowStepBadgeText}>2</Text>
                      </View>
                      <View style={styles.flowStepCopy}>
                        <Text style={styles.sectionTitle}>Registra tus procedimientos</Text>
                        <Text style={styles.sectionText}>
                          Añade lo que quieras registrar dentro de esta rotación
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.sectionText}>
                      {selectedDraftCategory?.name
                        ? `Rotación seleccionada: ${selectedDraftCategory.name}`
                        : "Selecciona una rotación en el paso 1"}
                    </Text>

                    <TextInput
                      style={styles.formInput}
                      value={activityName}
                      onChangeText={setActivityName}
                      placeholder="Ej: Apendicectomía, cesárea, colonoscopia…"
                    />

                    <TextInput
                      style={styles.formInput}
                      value={activityGoal}
                      onChangeText={(value) => setActivityGoal(value.replace(/[^0-9]/g, ""))}
                      placeholder="Meta opcional. Ej: 20"
                      keyboardType="number-pad"
                    />

                    <Text style={styles.helperText}>
                      Tipo por defecto: contador. Puedes dejar la meta vacía si no la necesitas.
                    </Text>

                    <TouchableOpacity style={styles.primaryAction} onPress={handleAddActivityDraft}>
                      <Text style={styles.primaryActionText}>Añadir procedimiento</Text>
                    </TouchableOpacity>

                    <View style={styles.categoryDraftList}>
                      <Text style={styles.fieldLabel}>Procedimientos añadidos</Text>
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
                          Esta rotación todavía no tiene procedimientos.
                        </Text>
                      )}
                      {draftCategories.length > 1 ? (
                        <Text style={styles.helperText}>
                          Puedes volver arriba y tocar otra rotación en cualquier momento.
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.card}>
                    <View style={styles.flowStepHeader}>
                      <View style={styles.flowStepBadge}>
                        <Text style={styles.flowStepBadgeText}>3</Text>
                      </View>
                      <View style={styles.flowStepCopy}>
                        <Text style={styles.sectionTitle}>
                          Cambia de rotación para añadir más procedimientos
                        </Text>
                        <Text style={styles.sectionText}>
                          Selecciona otra rotación del paso 1 para añadir sus procedimientos correspondientes
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Siguiente paso</Text>
                    <Text style={styles.sectionText}>
                      Cuando termines de añadir procedimientos, revisa el resultado completo antes de crear tu libro.
                    </Text>
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
                          {category.activities.length} procedimientos
                        </Text>
                      </View>
                      {(category.activities || []).length ? (
                        category.activities.map((activity) => (
                          <View key={activity.id} style={styles.previewActivityRow}>
                            <View>
                              <Text style={styles.previewActivityTitle}>{activity.name}</Text>
                              <Text style={styles.previewActivitySubtitle}>
                                {TRACKING_MODE_LABEL[activity.tracking_mode] || "Contador"}
                                {activity.goal ? ` · Meta ${activity.goal}` : ""}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.sectionText}>
                          Esta rotación se guardará sin procedimientos hasta que añadas alguno.
                        </Text>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity style={styles.primaryAction} onPress={handleCompleteOnboarding}>
                    <Text style={styles.primaryActionText}>Crear mi libro de residencia</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </HeroScreenLayout>
    );
  };

  const renderDashboard = () => (
    <HeroScreenLayout
      title="Libro"
      onBack={onBack}
      rightSlot={
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerIcon, exportingPdf && styles.headerIconDisabled]}
            onPress={() => handleProtectedAction(handleExportPdf)}
            disabled={exportingPdf}
          >
            <Icon
              name={exportingPdf ? "hourglass-outline" : "document-text-outline"}
              size={18}
              color="#670CF5"
            />
          </TouchableOpacity>
          {/* Añadir rotación solo tiene sentido en un libro cuya estructura es
              del residente: si la define el tutor, el botón no aparece. */}
          {!isStructureLocked ? (
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() =>
                handleProtectedAction(() => {
                  setSelectedParentForChild(null);
                  setShowNodeFormScreen(true);
                }, { requiresEditable: true })
              }
            >
              <Icon name="add" size={18} color="#670CF5" />
            </TouchableOpacity>
          ) : null}
        </View>
      }
    >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentInner}>
            {/* Los años del libro, justo debajo de la cabecera. Se abre el del año
                en curso del residente; los demás se consultan en solo lectura. */}
            {availableYears.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.yearRail}
              >
                {availableYears.map((year) => {
                  const isSelected = year === selectedYear;
                  return (
                    <TouchableOpacity
                      key={year}
                      style={[styles.yearTab, isSelected && styles.yearTabActive]}
                      onPress={() => setSelectedYear(year)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.yearTabText,
                          isSelected && styles.yearTabTextActive,
                        ]}
                      >
                        {`R${year}`}
                      </Text>
                      {year !== userResidencyYear ? (
                        <Icon name="lock-closed-outline" size={12} color="#94A3B8" />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* Los bloques que el tutor puso en el libro. Con uno solo no hay nada
                que elegir, así que el rail no aparece. */}
            {availableSections.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sectionRail}
              >
                {availableSections.map((code) => (
                  <SectionBadge
                    key={code}
                    icon={getLibroSectionIcon(code)}
                    label={getLibroSectionLabel(code)}
                    active={code === section}
                    onPress={() => setSection(code)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {/* Su tutor ha definido el libro oficial de su año y el suyo no lo
                refleja: se le ofrece cambiar, avisando de lo que pierde. */}
            {canSwitchToTemplate ? (
              <View style={styles.switchTemplateCard}>
                <View style={styles.switchTemplateCopy}>
                  <Icon name="sparkles-outline" size={18} color="#1B0977" />
                  <View style={styles.switchTemplateTextBlock}>
                    <Text style={styles.switchTemplateTitle}>
                      {`Tu tutor ha definido el libro de R${selectedYear}`}
                    </Text>
                    <Text style={styles.switchTemplateText}>
                      {`Incluye ${missingOwnYearSections
                        .map((code) => getLibroSectionLabel(code))
                        .join(", ")}. Cámbiate para registrar sobre su estructura.`}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.switchTemplateButton,
                    switchingToTemplate && styles.switchTemplateButtonDisabled,
                  ]}
                  onPress={handleSwitchToTemplate}
                  disabled={switchingToTemplate}
                  activeOpacity={0.85}
                >
                  <Text style={styles.switchTemplateButtonText}>
                    {switchingToTemplate ? "Cambiando..." : "Cambiar al libro de mi tutor"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {isSelectedBookReadOnly && !canSwitchToTemplate ? (
              <View style={styles.readOnlyNotice}>
                <Icon name="lock-closed-outline" size={16} color="#92400E" />
                <Text style={styles.readOnlyNoticeText}>
                  {isSelectedBookArchived
                    ? "Este libro está archivado. Puedes consultarlo y exportarlo, pero no editarlo."
                    : `Estás viendo R${selectedYear}: es el plan de tu tutor. Solo registras en el libro de tu año en curso.`}
                </Text>
              </View>
            ) : null}

            {!displayTree.length ? (
              <View style={styles.emptyBookCard}>
                <Icon name="book-outline" size={22} color="#670CF5" />
                <Text style={styles.emptyBookTitle}>
                  {isTemplateMode ? `R${selectedYear} sin contenido` : "Este libro está vacío"}
                </Text>
                <Text style={styles.emptyBookText}>
                  {isSelectedBookArchived
                    ? "No hay rotaciones guardadas en este libro archivado."
                    : isStructureLocked
                      ? `Tu tutor todavía no ha definido contenido para R${selectedYear}.`
                      : "Añade tu primera rotación para empezar el libro de este año."}
                </Text>
                {!isStructureLocked ? (
                  <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={() =>
                      handleProtectedAction(() => {
                        setSelectedParentForChild(null);
                        setEditingNode(null);
                        setShowNodeFormScreen(true);
                      }, { requiresEditable: true })
                    }
                  >
                    <Text style={styles.primaryActionText}>Añadir primera rotación</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              displayTree.map((parentNode) => (
                <CategoryCard
                  key={parentNode.id}
                  structureLocked={isStructureLocked}
                  node={parentNode}
                  collapsed={
                    collapsedCategories[parentNode.id] == null
                      ? true
                      : !!collapsedCategories[parentNode.id]
                  }
                  onToggleCollapse={toggleCategoryCollapse}
                  onAddChild={(parent) =>
                    handleProtectedAction(() => {
                      setSelectedParentForChild(parent);
                      setEditingNode(null);
                      setShowNodeFormScreen(true);
                    }, { requiresEditable: true })
                  }
                  onEditParent={(node) =>
                    handleProtectedAction(() => {
                      setEditingNode(node);
                      setShowNodeModal(true);
                    }, { requiresEditable: true })
                  }
                  onDeleteParent={(node) =>
                    handleProtectedAction(() => setShowDeleteConfirm(node), {
                      requiresEditable: true,
                    })
                  }
                  onIncrement={(node) =>
                    handleProtectedAction(() => handleIncrement(node), {
                      requiresEditable: true,
                    })
                  }
                  onDecrement={(node) =>
                    handleProtectedAction(() => handleDecrement(node), {
                      requiresEditable: true,
                    })
                  }
                  onOpenChildActions={openChildActions}
                />
              ))
            )}
          </View>
        </ScrollView>

      {shouldShowCorporateEmailLock ? (
        <View style={styles.reviewPromptOverlay}>
          <View style={styles.reviewPromptCard}>
            <View style={styles.reviewPromptIcon}>
              <Icon name="mail-outline" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.reviewPromptTitle}>Activa tu perfil de residente</Text>
            <Text style={styles.reviewPromptText}>
              La ventana temporal MIR ha terminado. Añade y valida tu correo
              corporativo desde tu perfil para seguir registrando actividad.
            </Text>
            <TouchableOpacity
              style={styles.reviewPromptButton}
              onPress={() => navigation?.navigate?.("usuario")}
            >
              <Text style={styles.reviewPromptButtonText}>Ir a mi perfil</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : shouldShowReviewPrompt ? (
        <View style={styles.reviewPromptOverlay}>
          <View style={styles.reviewPromptCard}>
            <View style={styles.reviewPromptIcon}>
              <Icon name="document-text-outline" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.reviewPromptTitle}>Desbloquea tu libro</Text>
            <Text style={styles.reviewPromptText}>
              Antes de registrar procedimientos, comparte tu experiencia con una reseña.
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
        message={`Vas a eliminar "${showDeleteConfirm?.name}". Si es una rotación, también se eliminarán sus procedimientos y registros asociados.`}
        onConfirm={() => handleDeleteNode(showDeleteConfirm?.id)}
        onCancel={() => setShowDeleteConfirm(null)}
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmColor="#EF4444"
      />
    </HeroScreenLayout>
  );

  return hasCompletedOnboarding ? renderDashboard() : renderOnboarding();
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  microcopyText: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 13,
    color: "#64748B",
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(103,12,245,0.10)",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.20)",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconDisabled: {
    opacity: 0.6,
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
  switchTemplateCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#D8B4FE",
    gap: 12,
  },
  switchTemplateCopy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  switchTemplateTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  switchTemplateTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1B0977",
  },
  switchTemplateText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#5B21B6",
  },
  switchTemplateButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#670CF5",
  },
  switchTemplateButtonDisabled: {
    opacity: 0.6,
  },
  switchTemplateButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  readOnlyNotice: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  readOnlyNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#92400E",
  },
  emptyBookCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    alignItems: "center",
  },
  emptyBookTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
  },
  emptyBookText: {
    marginTop: 8,
    marginBottom: 16,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
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
  yearRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 12,
  },
  yearTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  yearTabActive: {
    backgroundColor: "#F5F3FF",
    borderColor: "#D8B4FE",
  },
  yearTabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  yearTabTextActive: {
    color: "#670CF5",
  },
  sectionRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 12,
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
  secondaryOutlineActionDisabled: {
    opacity: 0.45,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  flowStep: {
    marginTop: 18,
  },
  flowStepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  flowStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  flowStepBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#670CF5",
  },
  flowStepCopy: {
    flex: 1,
  },
  flowStepTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  flowStepText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  suggestionChipSelected: {
    backgroundColor: "#670CF5",
    borderColor: "#670CF5",
  },
  suggestionChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#670CF5",
  },
  suggestionChipTextSelected: {
    color: "#FFFFFF",
  },
  categoryDraftList: {
    marginTop: 14,
    gap: 12,
  },
  helperText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
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
