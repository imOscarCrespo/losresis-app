// Catálogo cerrado de bloques del libro de residente.
//
// Espejo de losresis-panel/src/lib/libroTemplateOptions.ts: el tutor monta el
// libro escogiendo bloques de ese catálogo, así que el residente tiene que ver
// la misma etiqueta y el mismo icono que eligió su tutor. Si cambia allí, cambia
// aquí.
//
// La fuente de verdad de los códigos es el enum libro_section_code de la base de
// datos. Los icon_name son nombres de Ionicons porque los pinta <Icon />.
//
// Cada apartado declara su ARQUETIPO, que es lo que decide cómo se pinta (espejo de
// LibroBlockArchetype en el panel, ver su ADR 0025):
//
//   itinerary  el tutor define una lista y el residente completa una ficha por
//              elemento (libro_node_progress). Los elementos son nodos raíz planos:
//              NO hay nivel de agrupación.
//   tree       el tutor agrupa en Áreas de actividad y el residente cuenta
//              registros. Es el ÚNICO apartado con nivel intermedio.
//   form       el tutor solo activa campos (libro_template_block.config) y el
//              residente crea las filas. No hay nodos: los registros cuelgan del
//              libro (libro_entry.book_id).
//   automatic  no lo escribe nadie: sale de la Agenda (agenda_events).
//
// Cualquier código que asuma "categoría → registro" para todos los apartados está
// mal: ese nivel solo existe en tree.

export const LIBRO_SECTIONS = [
  {
    code: "rotations",
    archetype: "itinerary",
    label: "Rotaciones",
    description: "Rotaciones externas e internas",
    icon_name: "repeat-outline",
    color_token: "slate",
    childLabel: "rotación",
  },
  {
    code: "clinical_practice",
    archetype: "tree",
    label: "Actividad asistencial",
    description: "Procedimientos, técnicas y actuaciones",
    icon_name: "medkit-outline",
    color_token: "blue",
    childLabel: "procedimiento",
  },
  {
    code: "on_call_shifts",
    archetype: "automatic",
    label: "Guardias",
    description: "Registro de guardias realizadas",
    icon_name: "moon-outline",
    color_token: "orange",
    childLabel: "registro",
  },
  {
    code: "workshop_attendance",
    archetype: "form",
    label: "Cursos",
    description: "Formación realizada por el residente",
    icon_name: "school-outline",
    color_token: "rose",
    childLabel: "curso",
  },
  {
    code: "congress_attendance",
    archetype: "form",
    label: "Congresos",
    description: "Asistencia y participación en congresos",
    icon_name: "megaphone-outline",
    color_token: "orange",
    childLabel: "aportación",
  },
  {
    code: "clinical_sessions",
    archetype: "form",
    label: "Sesiones clínicas",
    description: "Asistencia y presentación de sesiones",
    icon_name: "easel-outline",
    color_token: "blue",
    childLabel: "sesión",
  },
  {
    code: "research_work",
    archetype: "form",
    label: "Investigación",
    description: "Proyectos, publicaciones y otras actividades",
    icon_name: "flask-outline",
    color_token: "violet",
    childLabel: "trabajo",
  },
  {
    code: "competencies",
    archetype: "itinerary",
    label: "Competencias",
    description: "Evaluación de competencias del residente",
    icon_name: "ribbon-outline",
    color_token: "emerald",
    childLabel: "competencia",
  },
  {
    code: "tutoring_sessions",
    archetype: "tree",
    retired: true,
    label: "Tutorías",
    description: "Tutorías con tu tutor",
    icon_name: "people-outline",
    color_token: "orange",
    childLabel: "tutoría",
  },
  {
    code: "evaluations",
    archetype: "tree",
    retired: true,
    label: "Evaluaciones",
    description: "Evaluaciones de tu tutor",
    icon_name: "clipboard-outline",
    color_token: "violet",
    childLabel: "evaluación",
  },
  {
    code: "annual_reflection",
    archetype: "tree",
    retired: true,
    label: "Reflexión anual",
    description: "Reflexión sobre el año",
    icon_name: "journal-outline",
    color_token: "violet",
    childLabel: "apartado",
  },
];

// Niveles del registro por participación, en orden de implicación creciente.
// Espejo de LIBRO_PARTICIPATION_LEVELS en
// losresis-panel/src/lib/libroTemplateOptions.ts: el tutor activa el desglose
// desde el panel y el residente elige aquí, así que las etiquetas tienen que ser
// las mismas. Se guardan en libro_entry.payload.participation_level.
export const LIBRO_PARTICIPATION_LEVELS = ["Observó", "Ayudó", "Realizó"];

export const LIBRO_SECTION_BY_CODE = LIBRO_SECTIONS.reduce((acc, section) => {
  acc[section.code] = section;
  return acc;
}, {});

// Posición en el catálogo, para ordenar las secciones de un residente igual que
// se ofrecen en el panel.
const LIBRO_SECTION_ORDER = LIBRO_SECTIONS.reduce((acc, section, index) => {
  acc[section.code] = index;
  return acc;
}, {});

// La sección que el residente monta por su cuenta en el onboarding, y la que se
// abre por defecto cuando su libro la incluye.
export const DEFAULT_LIBRO_SECTION = "clinical_practice";

export const getLibroSectionLabel = (code) =>
  LIBRO_SECTION_BY_CODE[code]?.label || "Libro de residente";

export const getLibroSectionIcon = (code) =>
  LIBRO_SECTION_BY_CODE[code]?.icon_name || "book-outline";

export const getLibroSectionDescription = (code) =>
  LIBRO_SECTION_BY_CODE[code]?.description || "";

export const getLibroSectionChildLabel = (code) =>
  LIBRO_SECTION_BY_CODE[code]?.childLabel || "registro";

// Ordena códigos de sección por el orden del catálogo. Los desconocidos (un
// bloque nuevo en base de datos que la app todavía no conoce) van al final en vez
// de desaparecer.
//
// DEDUPLICA: un residente puede tener dos libros del mismo apartado y año (uno
// archivado y otro activo), y quien llama suele mapear estos códigos a tarjetas. Sin
// deduplicar salían dos con la misma `key` de React, que además de avisar mezcla el
// contenido de las dos.
export const sortLibroSectionCodes = (codes) =>
  [...new Set(codes)].sort(
    (a, b) =>
      (LIBRO_SECTION_ORDER[a] ?? LIBRO_SECTIONS.length) -
      (LIBRO_SECTION_ORDER[b] ?? LIBRO_SECTIONS.length)
  );

export const getLibroSectionArchetype = (code) =>
  LIBRO_SECTION_BY_CODE[code]?.archetype || "tree";

// Los ocho apartados que el tutor puede configurar hoy. Tutorías, Evaluaciones y
// Reflexión anual salieron de la plantilla y son módulos propios de Docencia, con
// su propio acceso desde la pantalla principal.
export const LIBRO_ACTIVE_SECTIONS = LIBRO_SECTIONS.filter(
  (section) => !section.retired
);

export const isRetiredLibroSection = (code) =>
  !!LIBRO_SECTION_BY_CODE[code]?.retired;

// El estado de la ficha del arquetipo itinerary (libro_node_progress.status). El
// vocabulario cambia por apartado, y el de competencias lo escribe el TUTOR al
// cerrar una evaluación (set_evaluation_competency): el residente lo lee.
export const LIBRO_PROGRESS_LABELS = {
  rotations: {
    pending: "Pendiente",
    in_progress: "En curso",
    completed: "Completada",
  },
  competencies: {
    pending: "Pendiente",
    acquiring: "En adquisición",
    acquired: "Adquirida",
    autonomous: "Adquirida con autonomía",
  },
};

// Los estados que cuentan como objetivo cubierto para el Progreso del año
// (docs/adr/0008).
export const LIBRO_PROGRESS_DONE = {
  rotations: ["completed"],
  competencies: ["acquired", "autonomous"],
};

export const getLibroProgressLabel = (section, status) =>
  LIBRO_PROGRESS_LABELS[section]?.[status] || "Pendiente";

export const isLibroProgressDone = (section, status) =>
  (LIBRO_PROGRESS_DONE[section] || []).includes(status);

// Etiqueta de cada campo del arquetipo form, para poder pintar un libro_entry.payload
// sin repetir el copy en cada pantalla. Espejo de LIBRO_FORM_SPECS en el panel.
export const LIBRO_FORM_FIELD_LABELS = {
  title: "Título",
  date: "Fecha",
  hours: "Horas / Duración",
  organizer: "Entidad organizadora",
  place: "Lugar",
  participation: "Tipo de participación",
  work_title: "Trabajo presentado",
  session_type: "Tipo de sesión",
  unit: "Servicio / Unidad",
  role: "Participación",
  research_type: "Tipo de actividad",
  status: "Estado",
  link: "Enlace / DOI",
  attachment: "Documento adjunto",
  notes: "Observaciones",
  participation_level: "Nivel de participación",
};

export const getLibroFormFieldLabel = (key) =>
  LIBRO_FORM_FIELD_LABELS[key] ||
  String(key || "")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());

// ---------------------------------------------------------------------------
// Arquetipo `form`: el tutor no define contenido, solo qué campos pide.
//
// Espejo de LIBRO_FORM_SPECS en losresis-panel/src/lib/libroTemplateOptions.ts.
// Los `key` son las claves de libro_template_block.config.fields (lo que el tutor
// activa) Y las de libro_entry.payload (lo que el residente rellena): son la misma
// palabra a los dos lados para que no haya que traducir nada.
//
// La configuración se lee EN VIVO de la plantilla por libro_book.template_id, no
// clonada: si el tutor activa un campo, aparece sin resembrar nada.
//
// `fixed` son los campos que siempre están y el tutor no puede quitar.
// ---------------------------------------------------------------------------

export const LIBRO_FORM_SPECS = {
  workshop_attendance: {
    fixed: [
      { key: "title", label: "Nombre del curso", type: "text", required: true },
      { key: "date", label: "Fecha", type: "date", required: true },
    ],
    optional: [
      { key: "hours", label: "Horas / Duración", type: "text", defaultOn: true },
      { key: "organizer", label: "Entidad organizadora", type: "text", defaultOn: true },
      { key: "notes", label: "Observaciones", type: "textarea", defaultOn: true },
    ],
  },
  congress_attendance: {
    fixed: [
      { key: "title", label: "Nombre del congreso", type: "text", required: true },
      { key: "date", label: "Fecha", type: "date", required: true },
    ],
    optional: [
      { key: "place", label: "Lugar", type: "text", defaultOn: true },
      {
        key: "participation",
        label: "Tipo de participación",
        type: "choice",
        choices: ["Asistente", "Póster", "Comunicación oral", "Ponencia", "Otro"],
        defaultOn: true,
      },
      {
        key: "work_title",
        label: "Trabajo presentado",
        type: "text",
        defaultOn: true,
        // Solo si participa presentando algo: al asistente no se le pide un título
        // de trabajo que no existe.
        showWhen: {
          key: "participation",
          in: ["Póster", "Comunicación oral", "Ponencia"],
        },
      },
      { key: "notes", label: "Observaciones", type: "textarea", defaultOn: true },
    ],
  },
  clinical_sessions: {
    fixed: [
      { key: "title", label: "Título de la sesión", type: "text", required: true },
      { key: "date", label: "Fecha", type: "date", required: true },
    ],
    optional: [
      {
        key: "session_type",
        label: "Tipo de sesión",
        type: "choice",
        choices: [
          "Sesión clínica",
          "Sesión bibliográfica",
          "Presentación de caso",
          "Sesión formativa",
          "Otro",
        ],
        defaultOn: true,
      },
      { key: "unit", label: "Servicio / Unidad", type: "text", defaultOn: false },
      {
        key: "role",
        label: "Participación",
        type: "choice",
        choices: ["Asistente", "Presentador"],
        defaultOn: true,
      },
      {
        key: "attachment",
        label: "Documento adjunto",
        type: "attachment",
        defaultOn: true,
        // Al presentador se le ofrece adjuntar su presentación; al asistente no.
        showWhen: { key: "role", in: ["Presentador"] },
      },
      { key: "notes", label: "Observaciones", type: "textarea", defaultOn: true },
    ],
  },
  research_work: {
    fixed: [
      { key: "title", label: "Título", type: "text", required: true },
      {
        key: "research_type",
        label: "Tipo de actividad",
        type: "choice",
        choices: [
          "Proyecto de investigación",
          "Artículo científico",
          "Comunicación o abstract",
          "Tesis doctoral",
          "Trabajo académico",
          "Otro",
        ],
        required: true,
      },
    ],
    optional: [
      { key: "role", label: "Rol / Autoría", type: "text", defaultOn: true },
      { key: "status", label: "Estado", type: "text", defaultOn: true },
      { key: "date", label: "Fecha", type: "date", defaultOn: true },
      { key: "link", label: "Enlace / DOI", type: "text", defaultOn: true },
      { key: "attachment", label: "Documento adjunto", type: "attachment", defaultOn: true },
      { key: "notes", label: "Observaciones", type: "textarea", defaultOn: true },
    ],
  },
};

/**
 * Los campos que el residente ve en un apartado `form`: los fijos más los
 * opcionales que el tutor tenga activados.
 *
 * Sin config guardada manda el defaultOn de cada campo, que es lo mismo que hace
 * resolveFormFields en el panel: un bloque recién creado ya pide algo.
 */
export const getLibroFormFields = (section, config) => {
  const spec = LIBRO_FORM_SPECS[section];
  if (!spec) return [];

  const saved = config?.fields || {};

  return [
    ...spec.fixed,
    ...spec.optional.filter((field) => saved[field.key] ?? field.defaultOn),
  ];
};

/**
 * Si un campo condicionado toca mostrarse, según lo que el residente ya ha puesto.
 * Un campo sin showWhen se muestra siempre.
 */
export const isLibroFormFieldVisible = (field, values = {}) => {
  if (!field?.showWhen) return true;

  const current = values[field.showWhen.key];
  return (field.showWhen.in || []).includes(current);
};

/**
 * El texto con el que se lista un registro de `form`, que cambia por apartado: en
 * Cursos el título es el nombre del curso, en Investigación el del trabajo.
 */
export const getLibroFormEntryTitle = (section, payload = {}) =>
  payload.title || getLibroSectionChildLabel(section);
