import React, { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { useLibroSection } from "../hooks/useLibroSection";
import { exportLibroArchiveToPdf } from "../services/libroPdfService";
import {
  countLibroEntriesForYear,
  getLibroArchive,
} from "../services/libroArchiveService";
import {
  deleteLibroFormEntry,
  deleteLibroItineraryItem,
  getLibroFormConfig,
  getLibroFormEntries,
  getLibroItinerary,
  getLibroShifts,
  getLibroYearOverview,
  saveLibroFormEntry,
  saveLibroItineraryItem,
  saveLibroNodeProgress,
} from "../services/libroYearService";
import { LibroIndexView } from "../components/libro/LibroIndexView";
import { LibroItineraryView } from "../components/libro/LibroItineraryView";
import { LibroFormView } from "../components/libro/LibroFormView";
import { LibroShiftsView } from "../components/libro/LibroShiftsView";
// Todo lo que se rellena es una PANTALLA, no un modal: el residente sale con la
// flecha genérica de arriba a la izquierda, igual que de cualquier otra pantalla.
import { LibroNodeFormScreen } from "../components/libro/LibroNodeFormScreen";
import { LibroQuickRegisterScreen } from "../components/libro/LibroQuickRegisterScreen";
import { LibroFormEntryScreen } from "../components/libro/LibroFormEntryScreen";
import { LibroFichaScreen } from "../components/libro/LibroFichaScreen";
import { LibroItineraryItemScreen } from "../components/libro/LibroItineraryItemScreen";
import { LibroShiftNotesScreen } from "../components/libro/LibroShiftNotesScreen";
import { toIsoDate } from "../components/libro/LibroDateField";
import { ConfirmationModal, LibroMigrationModal } from "../components";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { COLOR_TOKEN_MAP } from "../data/libroOnboardingTemplates";
import { getSpecialtyById } from "../services/hospitalService";
import { updateAgendaEventNotes } from "../services/agendaService";
import {
  ensureLibroForResident,
  ensureOwnLibroSections,
  findEntryToUndo,
  getLibroBooksForUser,
} from "../services/libroService";
import {
  getLibroTemplateOutline,
  getLibroTemplateTree,
  getPublishedLibroTemplateForUser,
  switchLibroYearToTemplate,
  syncLibroTemplateForUser,
} from "../services/libroTemplateService";
import {
  DEFAULT_LIBRO_SECTION,
  getLibroFormFields,
  getLibroSectionArchetype,
  getLibroSectionLabel,
  isRetiredLibroSection,
  sortLibroSectionCodes,
} from "../data/libroSections";
import posthogLogger from "../services/posthogService";
import {
  isResidentLockedMissingCorporateEmail,
  shouldBypassResidentReviewGate,
} from "../utils/residentAccess";

// El día de hoy en HORA LOCAL y calculado al pulsar, no al importar el módulo:
// toISOString() da el día en UTC (una guardia registrada a la 01:00 en España
// quedaba fechada el día anterior) y una constante de módulo se queda en el día en
// que se abrió la app.
const today = () => toIsoDate(new Date());
const COLLAPSED_CATEGORIES_STORAGE_KEY = "@losresis:libro_collapsed_categories";
const MIGRATION_DISMISSED_STORAGE_KEY = "@losresis:libro_migration_dismissed";

// Espejo de LIBRO_TRACKING_MODES en losresis-panel/src/lib/libroTemplateOptions.ts.
//
// `participation` faltaba en los dos mapas desde que el rediseño de agosto 2026 lo
// añadió al enum, y eso hacía dos cosas a la vez: la tarjeta caía en el `|| "Contador"`
// y se ETIQUETABA como contador, y a la vez `isCounter` era false y no pintaba los
// botones. O sea, tarjetas que decían "Contador" y no tenían + ni −.
const TRACKING_MODE_LABEL = {
  counter: "Contador",
  participation: "Participación",
  note: "Nota",
  checklist: "Checklist",
};

const TRACKING_MODE_ACTION = {
  counter: "Registrar",
  participation: "Registrar",
  note: "Añadir nota",
  checklist: "Completar",
};

// El año que se abre en el rail: el del perfil si el libro lo cubre, y si no el
// último que sí lo cubra (el residente que todavía no tiene nada de su año nuevo).
const pickYearToOpen = (years, profileYear) =>
  profileYear && years.includes(profileYear)
    ? profileYear
    : years[years.length - 1];

const getProgress = (count, goal) => {
  if (!goal) return 0;
  return Math.min((count / goal) * 100, 100);
};

const ProcedureRow = ({
  node,
  onIncrement,
  onDecrement,
  onRegister,
  onOpenActions,
}) => {
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
          ) : (
            // Los modos que no son contador NO llevan + y −: el registro necesita que
            // el residente elija algo (el nivel de participación, la nota), y eso lo
            // pide el modal. Antes aquí no había nada y el único camino era el menú
            // de los tres puntos, que no se ve.
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => onRegister?.(node)}
              activeOpacity={0.85}
            >
              <Icon name="add" size={14} color="#670CF5" />
              <Text style={styles.registerButtonText}>
                {TRACKING_MODE_ACTION[node.tracking_mode] || "Registrar"}
              </Text>
            </TouchableOpacity>
          )}
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
  onRegister,
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
                  onRegister={onRegister}
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
  // Las pantallas de registro. Cada una se abre desde su listado y se cierra con la
  // flecha de la cabecera; mientras una está abierta, es lo único que se pinta.
  const [showNodeFormScreen, setShowNodeFormScreen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  // { entry } con la fila abierta del arquetipo `form`, o { entry: null } al crear.
  const [openFormEntry, setOpenFormEntry] = useState(null);
  const [openFichaNode, setOpenFichaNode] = useState(null);
  // { item } con el elemento de itinerario abierto para editarlo, o { item: null }
  // al crear uno. Solo en el Libro propio: la lista del oficial es del tutor.
  const [openItineraryItem, setOpenItineraryItem] = useState(null);
  const [openShift, setOpenShift] = useState(null);
  const [selectedParentForChild, setSelectedParentForChild] = useState(null);
  const [quickRegisterNode, setQuickRegisterNode] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [collapsedCategoriesLoaded, setCollapsedCategoriesLoaded] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

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
  // Si ya se ha decidido qué hacer con la siembra de la primera visita. Hasta que
  // no está resuelto no se pinta: los efectos corren DESPUÉS del primer pintado, así
  // que sin esto el residente nuevo ve un fotograma de "R1 sin apartados".
  const [libroSeedResolved, setLibroSeedResolved] = useState(false);
  const [templateTree, setTemplateTree] = useState([]);
  const [libroReloadKey, setLibroReloadKey] = useState(0);
  const [switchingToTemplate, setSwitchingToTemplate] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [templateUpdatedAt, setTemplateUpdatedAt] = useState(null);
  // El sello de plantilla que el residente descartó para el año abierto, si lo hay.
  const [dismissedStamp, setDismissedStamp] = useState(null);
  // El apartado abierto desde el índice. null = se está viendo el índice.
  const [openSection, setOpenSection] = useState(null);
  const [yearOverview, setYearOverview] = useState({ sections: [], progress: null });
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [itineraryNodes, setItineraryNodes] = useState([]);
  const [formConfig, setFormConfig] = useState(null);
  const [formEntries, setFormEntries] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [savingSection, setSavingSection] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Cuántos registros se lleva por delante migrar este año. Se cuenta al ofrecerlo,
  // no al confirmarlo, para poder decírselo antes de que decida.
  // null = todavía no se sabe (o la cuenta falló). Se distingue de 0 a propósito:
  // ver openMigrationModal.
  const [entriesAtRisk, setEntriesAtRisk] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const resolveLibro = async () => {
      if (!userId) {
        if (isMounted) {
          setAllBooks([]);
          setTemplateOutline([]);
          setTemplateId(null);
          setTemplateUpdatedAt(null);
          setSection(DEFAULT_LIBRO_SECTION);
          setSectionsResolved(true);
        }
        return;
      }

      try {
        // Lo que el tutor haya cambiado en la plantilla se reconcilia ANTES de leer
        // sus libros, para que lo que se pinte ya esté al día. Es idempotente y no
        // lanza: que falle no debe impedir abrir el libro.
        await syncLibroTemplateForUser(userId);

        // Y al Libro propio se le completan los apartados que le falten (ADR 0012):
        // el que se montó su libro cuando el onboarding solo daba Actividad
        // asistencial lo ve completo sin hacer nada. Es idempotente y no lanza,
        // igual que el sync, y va ANTES de leer sus libros para que los apartados
        // nuevos entren ya en esta misma lectura.
        await ensureOwnLibroSections(userId);

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
        setTemplateUpdatedAt(template?.updated_at || null);
        setTemplateOutline(outline);
      } catch (error) {
        console.error("Error resolving libro:", error);
        if (isMounted) {
          setAllBooks([]);
          setTemplateOutline([]);
          setTemplateId(null);
          setTemplateUpdatedAt(null);
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

  // La primera visita: el residente que no tiene ningún libro se encuentra el suyo
  // ya montado, sin pasar por ningún asistente.
  //
  // Espera a specialtyResolved porque las Áreas de actividad que se siembran salen de
  // su especialidad: sembrar antes le daría las genéricas y luego no habría manera de
  // saber que fue por llegar pronto.
  //
  // El ref evita sembrar dos veces si el efecto se reevalúa mientras la primera
  // siembra sigue en vuelo. No hace falta más: si falla, las dependencias no cambian
  // solas, así que no se reintenta en bucle — se reintenta al tirar para refrescar
  // (que baja sectionsResolved) o al volver a abrir el Libro.
  const seedingRef = useRef(false);

  useEffect(() => {
    // Sin usuario no hay libro que sembrar, pero tampoco hay nada que esperar.
    if (!userId) {
      setLibroSeedResolved(true);
      return;
    }

    if (!sectionsResolved || !specialtyResolved) return;

    if (allBooks.length) {
      setLibroSeedResolved(true);
      return;
    }

    if (seedingRef.current) return;

    let isMounted = true;
    seedingRef.current = true;

    ensureLibroForResident({
      userId,
      specialityId,
      specialtyName,
      residencyYear: userResidencyYear || 1,
    })
      .then((seeded) => {
        if (!isMounted || !seeded) return;
        // Releer es lo que hace aparecer los apartados recién sembrados.
        setLibroReloadKey((prev) => prev + 1);
      })
      .catch((error) => {
        console.error("Error seeding libro for resident:", error);
      })
      .finally(() => {
        seedingRef.current = false;
        // Resuelto pase lo que pase: si la siembra falla, el residente ve su libro
        // vacío y puede tirar para refrescar, que es mejor que un spinner eterno.
        if (isMounted) setLibroSeedResolved(true);
      });

    return () => {
      isMounted = false;
    };
  }, [
    userId,
    sectionsResolved,
    specialtyResolved,
    allBooks.length,
    specialityId,
    specialtyName,
    userResidencyYear,
  ]);

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

    setSelectedYear(pickYearToOpen(availableYears, userResidencyYear));
  }, [availableYears, selectedYear, userResidencyYear]);

  // El año del perfil puede cambiar con la pantalla montada: el dashboard revalida el
  // perfil cada vez que la app vuelve a primer plano, y el residente también lo
  // corrige él mismo desde su perfil.
  //
  // Sin esto, selectedYear se quedaba clavado en el año con el que se abrió el libro:
  // al pasar a R2 seguía enseñando R1, y como R1 ya no es su año en curso su libro
  // entero pasaba a solo lectura con el aviso de que estaba mirando el plan de su
  // tutor. Poniéndolo a null vuelve a decidirlo el efecto de arriba, que es el único
  // sitio donde se elige año.
  const profileYearRef = useRef(userResidencyYear);

  useEffect(() => {
    if (profileYearRef.current === userResidencyYear) return;
    profileYearRef.current = userResidencyYear;
    if (!userResidencyYear) return;
    // Todavía no se había elegido año: no hay nada que corregir y el efecto de arriba
    // ya va a elegir con el perfil nuevo. Releer aquí sería una recarga de más.
    if (selectedYear === null) return;

    setOpenSection(null);
    setSelectedYear(null);
    // Se relee todo: el año nuevo puede necesitar siembra desde la plantilla, y de eso
    // se encargan resolveLibro y el efecto de siembra automática.
    setLibroReloadKey((prev) => prev + 1);
  }, [userResidencyYear, selectedYear]);

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
    selectedBook,
    selectBook,
    isSelectedBookArchived,
    nodeTree,
    loading,
    settings,
    editingNode,
    setEditingNode,
    addNode,
    updateNode,
    deleteNode,
    addEntry,
    updateLibroSettings,
  } = useLibroSection(userId, section);

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

  // Los años en los que tiene Libro propio ACTIVO, que es el libro EN USO aunque su
  // año no sea ya el del perfil.
  //
  // El libro propio no rota de año solo: se creó con el año que el residente tenía en
  // el onboarding, y solo se archiva al Migrar a la plantilla. Sin plantilla publicada
  // nadie le siembra el año nuevo (ADR 0007: el camino propio no crece), así que al
  // pasar a R2 su libro de R1 no se convierte en histórico: es lo único que tiene, y
  // dejarlo en solo lectura le quitaba el libro entero.
  //
  // libro_book_one_active_per_user_section_idx solo admite un libro activo por
  // apartado, así que "libro propio activo" es exactamente "el libro en uso": esto no
  // reabre ningún año que ya se archivó.
  const ownActiveBookYears = useMemo(
    () =>
      new Set(
        allBooks
          .filter((book) => !book.template_id && book.status === "active")
          .map((book) => book.residency_year)
      ),
    [allBooks]
  );

  const isBookInUse =
    !!bookForSelection &&
    !bookForSelection.template_id &&
    bookForSelection.status === "active";

  const isSelectedBookReadOnly =
    isTemplateMode || isSelectedBookArchived || (!isOwnYear && !isBookInUse);

  // A nivel de AÑO (el índice, el rail): si en ese año se puede registrar algo.
  const isSelectedYearWritable =
    isOwnYear || ownActiveBookYears.has(selectedYear);

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

  // Los apartados que la plantilla define para el año abierto, para poder decirle
  // qué incluye el libro de su tutor.
  const templateSectionsForYear = useMemo(() => {
    if (!selectedYear || !templateId) return [];

    return sortLibroSectionCodes(
      templateOutline
        .filter((block) => block.residency_year === selectedYear)
        .map((block) => block.section)
    );
  }, [templateOutline, templateId, selectedYear]);

  // Si el libro del año abierto es del tutor. Es lo que decide si los objetivos del
  // progreso se le atribuyen a él ("N de M objetivos de tu tutor") o no.
  //
  // Sale de lo que se está PINTANDO y no de `section`, que en el índice no apunta a
  // nada en concreto: derivarlo de bookForSelection daba un fotograma diciendo "de
  // tu tutor" antes de que se resolviera el apartado por defecto.
  const isSelectedYearOfficial = useMemo(() => {
    if (yearOverview.sections.length) {
      return yearOverview.sections.some((item) => item.isOfficial);
    }

    // Un año sin libros solo puede estar enseñando el plan del tutor.
    return !!templateId && templateSectionsForYear.length > 0;
  }, [yearOverview.sections, templateId, templateSectionsForYear]);

  // Tiene Libro propio de este año: algún libro sin sellar con template_id, o sea
  // con estructura montada por él.
  const hasOwnBookThisYear = useMemo(
    () =>
      allBooks.some(
        (book) => book.residency_year === selectedYear && !book.template_id
      ),
    [allBooks, selectedYear]
  );

  // Se le ofrece Migrar a la plantilla cuando tiene Libro propio de su año y existe
  // una plantilla publicada que cubre ese año.
  //
  // Antes esto era missingOwnYearSections.length > 0, o sea "la plantilla trae
  // apartados que mi libro no tiene", y dejaba fuera el caso más común: el
  // residente que montó su libro en el onboarding tiene Actividad asistencial, y si
  // la plantilla de su hospital también la define, no le faltaba ningún apartado y
  // no se le ofrecía nada nunca. Se quedaba editando una estructura propia que su
  // tutor no ve, indefinidamente.
  const canMigrateToTemplate =
    isOwnYear &&
    !!templateId &&
    hasOwnBookThisYear &&
    templateSectionsForYear.length > 0;

  // El sello de la plantilla tal como está ahora. Lleva updated_at y no solo el id
  // porque libro_template es UNA fila por hospital+especialidad: republicar no
  // cambia el id, así que con el id solo, un descarte sería para siempre.
  const migrationStamp =
    templateId && templateUpdatedAt ? `${templateId}:${templateUpdatedAt}` : null;

  // Lo descartó y el tutor no ha vuelto a tocar la plantilla desde entonces.
  const isMigrationDismissed =
    !!migrationStamp && dismissedStamp === migrationStamp;

  // La tarjeta se puede quitar de en medio; la oferta no desaparece (queda el acceso
  // en la cabecera, y sigue apareciendo al intentar registrar en un apartado que
  // solo existe en la plantilla).
  const showMigrationCard = canMigrateToTemplate && !isMigrationDismissed;

  // Qué descartó para el año abierto. Se relee al cambiar de año porque el descarte
  // es por año: decir "no" en R1 no dice nada sobre R2.
  useEffect(() => {
    let isMounted = true;

    if (!userId || !selectedYear) {
      setDismissedStamp(null);
      return () => {
        isMounted = false;
      };
    }

    AsyncStorage.getItem(
      `${MIGRATION_DISMISSED_STORAGE_KEY}:${userId}:${selectedYear}`
    )
      .then((value) => {
        if (isMounted) setDismissedStamp(value || null);
      })
      .catch(() => {
        if (isMounted) setDismissedStamp(null);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, selectedYear]);

  // ---------------------------------------------------------------------------
  // El índice: qué apartados tiene el año abierto y cuánto lleva en cada uno.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    if (!userId || !selectedYear || !sectionsResolved) {
      setYearOverview({ sections: [], progress: null });
      return () => {
        isMounted = false;
      };
    }

    setOverviewLoading(true);

    getLibroYearOverview(userId, selectedYear, userResidencyYear)
      .then((overview) => {
        if (!isMounted) return;

        // Un año que su tutor tiene definido por delante todavía no es un libro
        // suyo: no hay contadores que enseñar, pero sí el plan. Se sintetiza desde
        // la plantilla para que pueda mirarlo antes de llegar a ese año.
        if (!overview.sections.length && templateId) {
          const planned = sortLibroSectionCodes([
            ...new Set(
              templateOutline
                .filter(
                  (block) =>
                    block.residency_year === selectedYear &&
                    !isRetiredLibroSection(block.section)
                )
                .map((block) => block.section)
            ),
          ]);

          setYearOverview({
            sections: planned.map((section) => ({
              section,
              label: getLibroSectionLabel(section),
              archetype: getLibroSectionArchetype(section),
              bookId: null,
              templateId,
              isOfficial: true,
              isArchived: false,
              count: 0,
              total: null,
              isPlanOnly: true,
            })),
            progress: null,
          });
          return;
        }

        setYearOverview(overview);
      })
      .catch((error) => {
        console.error("Error loading libro year overview:", error);
        if (isMounted) setYearOverview({ sections: [], progress: null });
      })
      .finally(() => {
        if (isMounted) setOverviewLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    userId,
    selectedYear,
    sectionsResolved,
    userResidencyYear,
    templateId,
    templateOutline,
    libroReloadKey,
  ]);

  // Al cambiar de año se vuelve al índice: el apartado abierto era del año anterior.
  useEffect(() => {
    setOpenSection(null);
  }, [selectedYear]);

  // ---------------------------------------------------------------------------
  // Los datos del apartado abierto, según su arquetipo. El de `tree` lo sigue
  // cargando useLibroSection, que ya sabe hacerlo.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    if (!openSection || openSection.archetype === "tree") {
      return () => {
        isMounted = false;
      };
    }

    setSectionLoading(true);

    const load = async () => {
      if (openSection.archetype === "itinerary") {
        const nodes = openSection.bookId
          ? await getLibroItinerary(openSection.bookId)
          : [];
        if (isMounted) setItineraryNodes(nodes);
        return;
      }

      if (openSection.archetype === "form") {
        // La config se lee EN VIVO de la plantilla, no clonada: si el tutor activa
        // un campo, aparece sin resembrar el libro.
        const [config, entries] = await Promise.all([
          openSection.templateId
            ? getLibroFormConfig(openSection.templateId, openSection.section, selectedYear)
            : null,
          openSection.bookId ? getLibroFormEntries(openSection.bookId) : [],
        ]);
        if (isMounted) {
          setFormConfig(config);
          setFormEntries(entries);
        }
        return;
      }

      if (openSection.archetype === "automatic") {
        const rows = await getLibroShifts(userId, selectedYear, userResidencyYear);
        if (isMounted) setShifts(rows);
      }
    };

    load()
      .catch((error) => {
        console.error("Error loading libro section:", error);
        if (isMounted) {
          setItineraryNodes([]);
          setFormEntries([]);
          setShifts([]);
        }
      })
      .finally(() => {
        if (isMounted) setSectionLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [openSection, selectedYear, userId, userResidencyYear, libroReloadKey]);

  // Abrir un apartado desde el índice.
  //
  // `section` se mueve SIEMPRE, no solo en los de árbol: de él dependen
  // bookForSelection y por tanto isSelectedBookReadOnly, así que dejarlo apuntando
  // al apartado anterior haría que la ficha de Rotaciones se creyera de solo lectura
  // (o editable) según el libro de Actividad asistencial.
  const handleOpenSection = (item) => {
    setSection(item.section);
    setOpenSection(item);
    posthogLogger.capture("resident_book_section_opened", {
      section: item.section,
      archetype: item.archetype,
    });
  };

  const refreshAfterWrite = () => setLibroReloadKey((prev) => prev + 1);

  // Tirar para refrescar. Es la otra mitad de cómo se sincroniza con la plantilla:
  // al abrir el Libro y aquí. Bumpear libroReloadKey vuelve a pasar por
  // syncLibroTemplateForUser, así que un cambio del tutor entra sin salir y volver.
  const handlePullToRefresh = () => {
    setRefreshing(true);
    // Se marca aquí y no solo en resolveLibro: si no, el efecto de abajo ve
    // sectionsResolved todavía en true en el mismo render y apaga el indicador antes
    // de que la recarga haya empezado.
    setSectionsResolved(false);
    setLibroReloadKey((prev) => prev + 1);
  };

  // El refresco termina cuando los datos ya están, no cuando se suelta el dedo.
  useEffect(() => {
    if (!refreshing) return;
    if (sectionsResolved && !overviewLoading && !sectionLoading) {
      setRefreshing(false);
    }
  }, [refreshing, sectionsResolved, overviewLoading, sectionLoading]);

  // Los campos del apartado `form` abierto. Salen de la plantilla EN VIVO, así que
  // se derivan de formConfig y no se guardan en ningún sitio.
  const formFields = useMemo(
    () =>
      openSection?.archetype === "form"
        ? getLibroFormFields(openSection.section, formConfig)
        : [],
    [openSection, formConfig]
  );

  const handleSaveFicha = async (node, { status, payload }) => {
    setSavingSection(true);
    try {
      await saveLibroNodeProgress({
        nodeId: node.id,
        userId,
        section: openSection.section,
        status,
        payload,
        // En el libro oficial el nivel de una competencia es del tutor y desde aquí
        // no se toca; en el propio no hay tutor que lo ponga, así que es del
        // residente (ADR 0012).
        isOfficial: !!openSection.templateId,
      });
      posthogLogger.capture("resident_book_itinerary_ficha_saved", {
        section: openSection.section,
        status,
      });
      refreshAfterWrite();
      return true;
    } catch (error) {
      console.error("Error saving itinerary ficha:", error);
      Alert.alert("No se pudo guardar", "Inténtalo de nuevo en un momento.");
      return false;
    } finally {
      setSavingSection(false);
    }
  };

  // Los elementos de un apartado `itinerary` del LIBRO PROPIO: la lista que en un
  // libro oficial monta el tutor desde el panel.
  const handleSaveItineraryItem = async (item, values) => {
    setSavingSection(true);
    try {
      await saveLibroItineraryItem({
        itemId: item?.id || null,
        bookId: openSection.bookId,
        userId,
        section: openSection.section,
        ...values,
      });
      posthogLogger.capture("resident_book_itinerary_item_saved", {
        section: openSection.section,
        is_new: !item,
      });
      refreshAfterWrite();
      return true;
    } catch (error) {
      console.error("Error saving itinerary item:", error);
      Alert.alert("No se pudo guardar", "Inténtalo de nuevo en un momento.");
      return false;
    } finally {
      setSavingSection(false);
    }
  };

  const handleDeleteItineraryItem = async (item) => {
    setSavingSection(true);
    try {
      await deleteLibroItineraryItem(item.id, userId);
      posthogLogger.capture("resident_book_itinerary_item_deleted", {
        section: openSection.section,
      });
      refreshAfterWrite();
      return true;
    } catch (error) {
      console.error("Error deleting itinerary item:", error);
      Alert.alert("No se pudo eliminar", "Inténtalo de nuevo en un momento.");
      return false;
    } finally {
      setSavingSection(false);
    }
  };

  const handleSaveFormEntry = async (entry, payload) => {
    setSavingSection(true);
    try {
      await saveLibroFormEntry({
        entryId: entry?.id || null,
        bookId: openSection.bookId,
        section: openSection.section,
        payload,
        residencyYear: selectedYear,
      });
      posthogLogger.capture("resident_book_form_entry_saved", {
        section: openSection.section,
        is_new: !entry,
      });
      refreshAfterWrite();
      return true;
    } catch (error) {
      console.error("Error saving form entry:", error);
      Alert.alert("No se pudo guardar", "Inténtalo de nuevo en un momento.");
      return false;
    } finally {
      setSavingSection(false);
    }
  };

  // La observación de una guardia vive en agenda_events.notes: es la MISMA que ve en
  // su Agenda, no una copia en el libro. Por eso se escribe ahí y no en libro_entry.
  const handleSaveShiftNotes = async (shift, notes) => {
    setSavingSection(true);
    try {
      await updateAgendaEventNotes(shift.id, notes);
      posthogLogger.capture("resident_book_shift_notes_saved", {});
      refreshAfterWrite();
      return true;
    } catch (error) {
      console.error("Error saving shift notes:", error);
      Alert.alert("No se pudo guardar", "Inténtalo de nuevo en un momento.");
      return false;
    } finally {
      setSavingSection(false);
    }
  };

  const handleDeleteFormEntry = async (entry) => {
    setSavingSection(true);
    try {
      await deleteLibroFormEntry(entry.id);
      refreshAfterWrite();
      return true;
    } catch (error) {
      console.error("Error deleting form entry:", error);
      Alert.alert("No se pudo eliminar", "Inténtalo de nuevo en un momento.");
      return false;
    } finally {
      setSavingSection(false);
    }
  };

  const dismissMigrationCard = () => {
    if (!migrationStamp) return;

    setDismissedStamp(migrationStamp);
    AsyncStorage.setItem(
      `${MIGRATION_DISMISSED_STORAGE_KEY}:${userId}:${selectedYear}`,
      migrationStamp
    ).catch(() => {});

    posthogLogger.capture("resident_book_migration_dismissed", {
      residency_year: selectedYear,
    });
  };

  // Cambio de año de residencia: en cuanto el perfil dice R2, el libro de R2 se
  // crea solo desde la plantilla y los años anteriores quedan archivados. No hay
  // botón de "archivar y empezar nuevo año": lo dispara el año del perfil.
  //
  // Solo cuando no hay nada que perder: si el residente ya tiene libro de ese año
  // se le pregunta antes (canMigrateToTemplate), porque sustituirlo borra lo
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
    switchLibroYearToTemplate({ userId, residencyYear: selectedYear })
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

  // Migrar a la plantilla: sustituir el Libro propio del año por el Libro oficial.
  //
  // Se abre en un modal propio y no en un Alert.alert porque el residente puede
  // descargarse su libro en PDF antes, y el PDF acaba en el share sheet del
  // sistema: un Alert no sobrevive a que se abra encima.
  const openMigrationModal = () => {
    setShowMigrationModal(true);

    // Se empieza sin cifra en cada apertura. Si no, el modal enseña la cuenta del
    // año anterior mientras llega la de este, y es la cifra con la que el residente
    // decide borrar su libro.
    setEntriesAtRisk(null);

    // Cuánto tiene dentro este año. Si la cuenta falla se queda en null y el modal
    // lo dice: no es motivo para no dejarle migrar, pero decirle "0" cuando no lo
    // sabemos es decirle "no pierdes nada" antes de un borrado irreversible.
    countLibroEntriesForYear(userId, selectedYear)
      .then((count) => setEntriesAtRisk(count))
      .catch((error) => {
        console.error("Error counting libro entries at risk:", error);
        setEntriesAtRisk(null);
      });

    posthogLogger.capture("resident_book_migration_offered", {
      residency_year: selectedYear,
      sections_incoming: templateSectionsForYear.length,
    });
  };

  // El archivo completo del libro: todos los años y todos los apartados. Devuelve
  // false si no se pudo generar, para que el modal no marque la descarga como hecha.
  const handleExportArchivePdf = async () => {
    try {
      const archive = await getLibroArchive(userId, userResidencyYear);

      if (!archive.totalBooks) {
        Alert.alert(
          "Sin contenido",
          "Todavía no hay nada en tu libro para exportar."
        );
        return false;
      }

      await exportLibroArchiveToPdf({
        archive,
        specialtyName,
        residentName: userProfile?.full_name || userProfile?.name || "",
        currentResidencyYear: userResidencyYear,
      });

      posthogLogger.capture("resident_book_pdf_exported", {
        books_count: archive.totalBooks,
        entries_count: archive.totalEntries,
        shifts_count: archive.totalShifts,
      });

      return true;
    } catch (error) {
      console.error("Error exporting libro archive PDF:", error);
      Alert.alert("Error", "No se pudo generar el PDF.");
      return false;
    }
  };

  const handleConfirmMigration = async () => {
    setSwitchingToTemplate(true);
    try {
      await switchLibroYearToTemplate({
        userId,
        residencyYear: selectedYear,
      });
      posthogLogger.capture("resident_book_switched_to_template", {
        residency_year: selectedYear,
        sections_added: missingOwnYearSections.length,
        entries_lost: entriesAtRisk ?? null,
      });
      setShowMigrationModal(false);
      setLibroReloadKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error switching libro to template:", error);
      Alert.alert("No se pudo cambiar", "Inténtalo de nuevo en un momento.");
    } finally {
      setSwitchingToTemplate(false);
    }
  };

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

  const closeNodeFormScreen = () => {
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

  // Android: cuando los formularios eran modales, el botón físico de atrás los
  // cerraba solo (onRequestClose). Ahora son pantallas, así que hay que cerrarlas a
  // mano o el atrás se lleva al residente fuera del libro con el registro a medias.
  // El orden es el mismo que el de los `return` del render: primero el formulario
  // abierto, y si no hay ninguno, la vuelta del apartado al índice.
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showNodeFormScreen) {
        closeNodeFormScreen();
        return true;
      }
      if (showQuickRegister) {
        closeQuickRegister();
        return true;
      }
      if (openFormEntry) {
        setOpenFormEntry(null);
        return true;
      }
      if (openFichaNode) {
        setOpenFichaNode(null);
        return true;
      }
      if (openShift) {
        setOpenShift(null);
        return true;
      }
      if (openSection) {
        setOpenSection(null);
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [
    showNodeFormScreen,
    showQuickRegister,
    openFormEntry,
    openFichaNode,
    openShift,
    openSection,
  ]);

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

    closeNodeFormScreen();
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

    closeNodeFormScreen();
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
      performed_at: today(),
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
    // Atajo barato para no consultar cuando el contador ya está a cero. La guarda
    // de verdad es findEntryToUndo, porque total_count es un denormalizado.
    if ((node.total_count || 0) <= 0) return;

    // El negativo hereda la fecha del registro que anula, no la del día en que se
    // pulsa: si no, cualquier suma por ventana de fechas sale mal (docs/adr/0010).
    let target = null;
    try {
      target = await findEntryToUndo(node.id);
    } catch {
      Alert.alert("Error", "No se pudo ajustar el contador.");
      return;
    }

    if (!target) return;

    const success = await addEntry(node.id, {
      count: -1,
      residency_year: currentBookResidencyYear,
      performed_at: target.performedAt,
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
      } else if (canMigrateToTemplate) {
        // Es su año: lo que le falta no es permiso, es cambiarse al libro que ha
        // definido su tutor. Se le ofrece ahí mismo.
        openMigrationModal();
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
              setShowNodeFormScreen(true);
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

  // Un solo generador de PDF, y exporta el libro COMPLETO: todos los años y todos
  // los apartados. Antes exportaba solo el apartado abierto, que como recibo de lo
  // que se pierde al migrar valía poco: migrar borra el año entero.
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await handleExportArchivePdf();
    } finally {
      setExportingPdf(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Las pantallas de registro.
  //
  // Van ANTES de los indicadores de carga a propósito: guardar recarga el libro
  // (libroReloadKey pasa por resolveLibro, que baja sectionsResolved), y en el orden
  // contrario el formulario se cambiaría por un spinner con el registro a medias.
  // ---------------------------------------------------------------------------

  if (showNodeFormScreen) {
    return (
      <LibroNodeFormScreen
        onClose={closeNodeFormScreen}
        onSubmit={editingNode ? handleEditNode : handleAddNode}
        existingNode={editingNode}
        selectedParent={selectedParentForChild}
        loading={loading}
      />
    );
  }

  if (showQuickRegister) {
    return (
      <LibroQuickRegisterScreen
        onClose={closeQuickRegister}
        onSubmit={handleQuickRegisterSubmit}
        categories={nodeTree}
        initialNode={quickRegisterNode}
        loading={loading}
      />
    );
  }

  if (openFormEntry) {
    return (
      <LibroFormEntryScreen
        // Lo que se está escribiendo vive en la pantalla, así que la key la remonta
        // al pasar de una fila a otra o de editar a crear.
        key={openFormEntry.entry?.id || "new"}
        section={openSection?.section}
        fields={formFields}
        entry={openFormEntry.entry}
        userId={userId}
        saving={savingSection}
        onClose={() => setOpenFormEntry(null)}
        onSave={async (payload) => {
          const ok = await handleSaveFormEntry(openFormEntry.entry, payload);
          if (ok !== false) setOpenFormEntry(null);
        }}
        onDelete={async (entry) => {
          const ok = await handleDeleteFormEntry(entry);
          if (ok !== false) setOpenFormEntry(null);
        }}
      />
    );
  }

  if (openFichaNode) {
    return (
      <LibroFichaScreen
        key={openFichaNode.id}
        node={openFichaNode}
        section={openSection?.section}
        isOfficial={!!openSection?.templateId}
        saving={savingSection}
        onClose={() => setOpenFichaNode(null)}
        onSave={async (ficha) => {
          const ok = await handleSaveFicha(openFichaNode, ficha);
          if (ok !== false) setOpenFichaNode(null);
        }}
      />
    );
  }

  if (openItineraryItem) {
    return (
      <LibroItineraryItemScreen
        // Lo que se está escribiendo vive en la pantalla, así que la key la remonta
        // al pasar de un elemento a otro o de editar a crear.
        key={openItineraryItem.item?.id || "new"}
        section={openSection?.section}
        item={openItineraryItem.item}
        saving={savingSection}
        onClose={() => setOpenItineraryItem(null)}
        onSave={async (values) => {
          const ok = await handleSaveItineraryItem(openItineraryItem.item, values);
          if (ok !== false) setOpenItineraryItem(null);
        }}
        onDelete={(item) =>
          // Borrar el elemento se lleva por delante su ficha (cae por el CASCADE de
          // node_id), así que se pregunta antes. El ConfirmationModal del índice no
          // sirve aquí: esta pantalla sustituye al índice entero.
          Alert.alert(
            "Eliminar elemento",
            `Vas a eliminar "${item.name}" y lo que hayas anotado en su ficha.`,
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Eliminar",
                style: "destructive",
                onPress: async () => {
                  const ok = await handleDeleteItineraryItem(item);
                  if (ok !== false) setOpenItineraryItem(null);
                },
              },
            ]
          )
        }
      />
    );
  }

  if (openShift) {
    return (
      <LibroShiftNotesScreen
        key={openShift.id}
        shift={openShift}
        saving={savingSection}
        onClose={() => setOpenShift(null)}
        onSave={async (notes) => {
          const ok = await handleSaveShiftNotes(openShift, notes);
          if (ok !== false) setOpenShift(null);
        }}
      />
    );
  }

  // Nada que pintar hasta saber qué apartados tiene: cuáles son (sectionsResolved) y,
  // si es su primera visita, hasta que se le hayan sembrado (libroSeedResolved).
  // Acertar después sería un parpadeo.
  if (!sectionsResolved || !libroSeedResolved) {
    return (
      <View style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#670CF5" />
          <Text style={styles.loadingText}>Preparando tu libro de residente...</Text>
        </View>
      </View>
    );
  }

  const renderDashboard = () => (
    <HeroScreenLayout
      // Dentro de un apartado, el título de la cabecera ES el apartado y la flecha
      // genérica de arriba a la izquierda vuelve al índice. Antes había además una
      // tarjeta debajo repitiendo el nombre del apartado y su descripción, con su
      // propia flecha: dos sitios distintos para volver y el nombre dos veces.
      title={openSection ? openSection.label : "Libro"}
      onBack={openSection ? () => setOpenSection(null) : onBack}
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
          {/* Descartó la tarjeta pero su hospital sigue teniendo plantilla: la
              oferta no desaparece, se queda aquí. */}
          {canMigrateToTemplate && isMigrationDismissed ? (
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={openMigrationModal}
            >
              <Icon name="sparkles-outline" size={18} color="#670CF5" />
            </TouchableOpacity>
          ) : null}
          {/* Añadir solo tiene sentido DENTRO de un apartado de árbol cuya
              estructura es del residente: en el índice no hay nada que añadir, y si
              la estructura la define el tutor, el botón no aparece. */}
          {openSection?.archetype === "tree" && !isStructureLocked ? (
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() =>
                handleProtectedAction(() => {
                  setSelectedParentForChild(null);
                  setEditingNode(null);
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullToRefresh}
              tintColor="#670CF5"
            />
          }
        >
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
                      {year !== userResidencyYear &&
                      !ownActiveBookYears.has(year) ? (
                        <Icon name="lock-closed-outline" size={12} color="#94A3B8" />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* Tiene Libro propio de su año y su hospital ya ha publicado el
                oficial: se le ofrece migrar, avisando de lo que pierde.

                El copy enumera lo que TRAE la plantilla, no lo que le falta: con el
                disparador actual puede no faltarle ningún apartado y aun así
                interesarle migrar, porque su estructura es suya y su tutor no la
                ve. */}
            {showMigrationCard ? (
              <View style={styles.switchTemplateCard}>
                <View style={styles.switchTemplateCopy}>
                  <Icon name="sparkles-outline" size={18} color="#1B0977" />
                  <View style={styles.switchTemplateTextBlock}>
                    <Text style={styles.switchTemplateTitle}>
                      {`Tu tutor ha publicado el libro de R${selectedYear}`}
                    </Text>
                    <Text style={styles.switchTemplateText}>
                      {`Incluye ${templateSectionsForYear
                        .map((code) => getLibroSectionLabel(code))
                        .join(", ")}. Cámbiate para registrar sobre su estructura.`}
                    </Text>
                  </View>
                  {/* Sin sello no hay nada que recordar, así que no se ofrece una
                      X que no haría nada. */}
                  {migrationStamp ? (
                    <TouchableOpacity
                      style={styles.switchTemplateDismiss}
                      onPress={dismissMigrationCard}
                      hitSlop={10}
                    >
                      <Icon name="close" size={16} color="#64748B" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[
                    styles.switchTemplateButton,
                    switchingToTemplate && styles.switchTemplateButtonDisabled,
                  ]}
                  onPress={openMigrationModal}
                  disabled={switchingToTemplate}
                  activeOpacity={0.85}
                >
                  <Text style={styles.switchTemplateButtonText}>
                    {switchingToTemplate ? "Cambiando..." : "Ver el libro de mi tutor"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* En el índice el aviso mira solo el AÑO: isSelectedBookReadOnly
                depende del apartado, y en el índice no hay ninguno abierto. */}
            {(openSection ? isSelectedBookReadOnly : !isSelectedYearWritable) &&
            !canMigrateToTemplate ? (
              <View style={styles.readOnlyNotice}>
                <Icon name="lock-closed-outline" size={16} color="#92400E" />
                <Text style={styles.readOnlyNoticeText}>
                  {isSelectedBookArchived
                    ? "Este libro está archivado. Puedes consultarlo y exportarlo, pero no editarlo."
                    : `Estás viendo R${selectedYear}: es el plan de tu tutor. Solo registras en el libro de tu año en curso.`}
                </Text>
              </View>
            ) : null}

            {/* Sin apartado abierto se ve el ÍNDICE: el Libro ya no es una lista
                fija de secciones, sino las que su hospital ha configurado para su
                especialidad y su año. */}
            {!openSection ? (
              overviewLoading ? (
                <View style={styles.sectionLoading}>
                  <ActivityIndicator size="small" color="#670CF5" />
                </View>
              ) : (
                <LibroIndexView
                  residencyYear={selectedYear || userResidencyYear || 1}
                  progress={yearOverview.progress}
                  sections={yearOverview.sections}
                  onOpenSection={handleOpenSection}
                  isArchived={isSelectedBookArchived}
                  isOfficial={isSelectedYearOfficial}
                />
              )
            ) : openSection.archetype === "itinerary" ? (
              <LibroItineraryView
                section={openSection.section}
                nodes={itineraryNodes}
                loading={sectionLoading}
                readOnly={isSelectedBookReadOnly || openSection.isPlanOnly}
                // La lista solo la monta el residente cuando el apartado es suyo:
                // isStructureLocked ya cubre el libro oficial, el archivado y el
                // año que no es el suyo.
                canEditStructure={!isStructureLocked && !openSection.isPlanOnly}
                onOpenNode={setOpenFichaNode}
                onCreateItem={() =>
                  handleProtectedAction(() => setOpenItineraryItem({ item: null }), {
                    requiresEditable: true,
                  })
                }
                onEditItem={(item) =>
                  handleProtectedAction(() => setOpenItineraryItem({ item }), {
                    requiresEditable: true,
                  })
                }
              />
            ) : openSection.archetype === "form" ? (
              <LibroFormView
                section={openSection.section}
                config={formConfig}
                entries={formEntries}
                loading={sectionLoading}
                readOnly={isSelectedBookReadOnly || openSection.isPlanOnly}
                onCreateEntry={() => setOpenFormEntry({ entry: null })}
                onOpenEntry={(entry) => setOpenFormEntry({ entry })}
              />
            ) : openSection.archetype === "automatic" ? (
              <LibroShiftsView
                shifts={shifts}
                loading={sectionLoading}
                residencyYear={selectedYear}
                readOnly={!isOwnYear}
                onOpenShift={setOpenShift}
              />
            ) : !displayTree.length ? (
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
                      setShowNodeFormScreen(true);
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
                  onRegister={(node) =>
                    handleProtectedAction(() => openQuickRegister(node), {
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

      <LibroMigrationModal
        visible={showMigrationModal}
        onClose={() => setShowMigrationModal(false)}
        onExportPdf={handleExportArchivePdf}
        onConfirm={handleConfirmMigration}
        residencyYear={selectedYear}
        incomingSections={templateSectionsForYear.map((code) =>
          getLibroSectionLabel(code)
        )}
        recordedEntries={entriesAtRisk}
        migrating={switchingToTemplate}
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

  return renderDashboard();
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
  sectionLoading: {
    paddingVertical: 32,
    alignItems: "center",
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
  switchTemplateDismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
  iconActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
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
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    backgroundColor: "#F5F3FF",
  },
  registerButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#670CF5",
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
