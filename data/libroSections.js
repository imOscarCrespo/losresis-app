// Catálogo cerrado de bloques del libro de residente.
//
// Espejo de losresis-panel/src/lib/libroTemplateOptions.ts: el tutor monta el
// libro escogiendo bloques de ese catálogo, así que el residente tiene que ver
// la misma etiqueta y el mismo icono que eligió su tutor. Si cambia allí, cambia
// aquí.
//
// La fuente de verdad de los códigos es el enum libro_section_code de la base de
// datos. Los icon_name son nombres de Ionicons porque los pinta <Icon />.

export const LIBRO_SECTIONS = [
  {
    code: "rotations",
    label: "Rotaciones",
    icon_name: "repeat-outline",
    color_token: "slate",
    childLabel: "rotación",
  },
  {
    code: "clinical_practice",
    label: "Actividad asistencial",
    icon_name: "medkit-outline",
    color_token: "blue",
    childLabel: "procedimiento",
  },
  {
    code: "on_call_shifts",
    label: "Guardias",
    icon_name: "moon-outline",
    color_token: "orange",
    childLabel: "registro",
  },
  {
    code: "workshop_attendance",
    label: "Cursos",
    icon_name: "school-outline",
    color_token: "rose",
    childLabel: "curso",
  },
  {
    code: "congress_attendance",
    label: "Congresos",
    icon_name: "megaphone-outline",
    color_token: "orange",
    childLabel: "aportación",
  },
  {
    code: "clinical_sessions",
    label: "Sesiones clínicas",
    icon_name: "easel-outline",
    color_token: "blue",
    childLabel: "sesión",
  },
  {
    code: "research_work",
    label: "Investigación",
    icon_name: "flask-outline",
    color_token: "violet",
    childLabel: "trabajo",
  },
  {
    code: "competencies",
    label: "Competencias",
    icon_name: "ribbon-outline",
    color_token: "emerald",
    childLabel: "competencia",
  },
  {
    code: "tutoring_sessions",
    label: "Tutorías",
    icon_name: "people-outline",
    color_token: "orange",
    childLabel: "tutoría",
  },
  {
    code: "evaluations",
    label: "Evaluaciones",
    icon_name: "clipboard-outline",
    color_token: "violet",
    childLabel: "evaluación",
  },
  {
    code: "annual_reflection",
    label: "Reflexión anual",
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

export const getLibroSectionChildLabel = (code) =>
  LIBRO_SECTION_BY_CODE[code]?.childLabel || "registro";

// Ordena códigos de sección por el orden del catálogo. Los desconocidos (un
// bloque nuevo en base de datos que la app todavía no conoce) van al final en vez
// de desaparecer.
export const sortLibroSectionCodes = (codes) =>
  [...codes].sort(
    (a, b) =>
      (LIBRO_SECTION_ORDER[a] ?? LIBRO_SECTIONS.length) -
      (LIBRO_SECTION_ORDER[b] ?? LIBRO_SECTIONS.length)
  );
