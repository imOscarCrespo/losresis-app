const COLOR_TOKENS = {
  violet: "#670CF5",
  blue: "#2563EB",
  emerald: "#059669",
  orange: "#EA580C",
  rose: "#E11D48",
  slate: "#475569",
};

const CATEGORY_LIBRARY = {
  consults: {
    name: "Consultas",
    icon_name: "medkit-outline",
    color_token: "blue",
    activities: [
      { name: "Primera consulta", goal: 50, tracking_mode: "counter" },
      { name: "Consulta de seguimiento", goal: 100, tracking_mode: "counter" },
      { name: "Caso comentado", goal: 12, tracking_mode: "note" },
    ],
  },
  ward: {
    name: "Hospitalización",
    icon_name: "business-outline",
    color_token: "emerald",
    activities: [
      { name: "Paciente valorado", goal: 120, tracking_mode: "counter" },
      { name: "Alta elaborada", goal: 40, tracking_mode: "counter" },
      { name: "Incidencia relevante", goal: 20, tracking_mode: "note" },
    ],
  },
  emergencies: {
    name: "Urgencias",
    icon_name: "pulse-outline",
    color_token: "rose",
    activities: [
      { name: "Urgencia atendida", goal: 80, tracking_mode: "counter" },
      { name: "Procedimiento urgente", goal: 25, tracking_mode: "counter" },
      { name: "Checklist de guardia", goal: 12, tracking_mode: "checklist" },
    ],
  },
  surgery: {
    name: "Quirófano",
    icon_name: "medical-outline",
    color_token: "orange",
    activities: [
      { name: "Cirugía asistida", goal: 40, tracking_mode: "counter" },
      { name: "Procedimiento principal", goal: 20, tracking_mode: "counter" },
      { name: "Caso quirúrgico destacado", goal: 10, tracking_mode: "note" },
    ],
  },
  training: {
    name: "Formación",
    icon_name: "school-outline",
    color_token: "violet",
    activities: [
      { name: "Sesión clínica", goal: 24, tracking_mode: "counter" },
      { name: "Curso o taller", goal: 10, tracking_mode: "counter" },
      { name: "Apunte de aprendizaje", goal: 20, tracking_mode: "note" },
    ],
  },
  research: {
    name: "Investigación",
    icon_name: "flask-outline",
    color_token: "slate",
    activities: [
      { name: "Trabajo científico", goal: 6, tracking_mode: "counter" },
      { name: "Congreso o póster", goal: 4, tracking_mode: "counter" },
      { name: "Pendientes del proyecto", goal: 12, tracking_mode: "checklist" },
    ],
  },
  obstetrics: {
    name: "Sala de partos",
    icon_name: "heart-outline",
    color_token: "rose",
    activities: [
      { name: "Parto eutócico", goal: 80, tracking_mode: "counter" },
      { name: "Cesárea", goal: 30, tracking_mode: "counter" },
      { name: "Episiotomía", goal: 20, tracking_mode: "counter" },
    ],
  },
  procedures: {
    name: "Técnicas",
    icon_name: "build-outline",
    color_token: "orange",
    activities: [
      { name: "Procedimiento realizado", goal: 30, tracking_mode: "counter" },
      { name: "Técnica supervisada", goal: 20, tracking_mode: "counter" },
      { name: "Checklist de técnica", goal: 12, tracking_mode: "checklist" },
    ],
  },
};

const DEFAULT_CATEGORY_KEYS = ["consults", "ward", "emergencies", "training"];

const SPECIALTY_CATEGORY_KEYS = {
  ginecologia: ["obstetrics", "surgery", "consults", "emergencies", "training"],
  obstetricia: ["obstetrics", "surgery", "consults", "emergencies", "training"],
  cardiologia: ["consults", "ward", "procedures", "emergencies", "research"],
  cirugia: ["surgery", "ward", "consults", "procedures", "training"],
  medicina: ["consults", "ward", "emergencies", "training", "research"],
  pediatria: ["consults", "ward", "emergencies", "training", "research"],
};

const normalizeText = (value = "") =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const buildCategory = (key) => {
  const category = CATEGORY_LIBRARY[key];
  if (!category) return null;

  return {
    name: category.name,
    icon_name: category.icon_name,
    color_token: category.color_token,
    activities: category.activities.map((activity) => ({
      ...activity,
      color_token: category.color_token,
      icon_name: category.icon_name,
    })),
  };
};

export const getLibroCategorySuggestions = (specialtyName = "") => {
  const normalized = normalizeText(specialtyName);
  const matchedKey = Object.keys(SPECIALTY_CATEGORY_KEYS).find((key) =>
    normalized.includes(key)
  );

  const categoryKeys = matchedKey
    ? SPECIALTY_CATEGORY_KEYS[matchedKey]
    : DEFAULT_CATEGORY_KEYS;

  return categoryKeys.map(buildCategory).filter(Boolean);
};

export const getColorTokenOptions = () =>
  Object.entries(COLOR_TOKENS).map(([id, hex]) => ({ id, hex }));

export const CATEGORY_ICON_OPTIONS = [
  { id: "folder-outline", label: "Carpeta" },
  { id: "medkit-outline", label: "Consulta" },
  { id: "business-outline", label: "Planta" },
  { id: "pulse-outline", label: "Urgencias" },
  { id: "medical-outline", label: "Quirófano" },
  { id: "school-outline", label: "Formación" },
  { id: "flask-outline", label: "Investigación" },
  { id: "build-outline", label: "Técnicas" },
  { id: "heart-outline", label: "Partos" },
];

export const TRACKING_MODE_OPTIONS = [
  { id: "counter", name: "Contador" },
  { id: "note", name: "Nota" },
  { id: "checklist", name: "Checklist" },
];

export const COLOR_TOKEN_MAP = COLOR_TOKENS;
