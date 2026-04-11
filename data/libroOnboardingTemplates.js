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
    activities: [],
  },
  ward: {
    name: "Hospitalización",
    icon_name: "business-outline",
    color_token: "emerald",
    activities: [],
  },
  emergencies: {
    name: "Urgencias",
    icon_name: "pulse-outline",
    color_token: "rose",
    activities: [],
  },
  surgery: {
    name: "Quirófano",
    icon_name: "cut-outline",
    color_token: "orange",
    activities: [],
  },
  research: {
    name: "Investigación",
    icon_name: "flask-outline",
    color_token: "slate",
    activities: [],
  },
  obstetrics: {
    name: "Sala de partos",
    icon_name: "heart-outline",
    color_token: "rose",
    activities: [],
  },
  procedures: {
    name: "Técnicas",
    icon_name: "build-outline",
    color_token: "orange",
    activities: [],
  },
};

const DEFAULT_CATEGORY_KEYS = ["consults", "ward", "emergencies", "surgery"];

const SPECIALTY_CATEGORY_KEYS = {
  ginecologia: ["obstetrics", "surgery", "consults", "emergencies"],
  obstetricia: ["obstetrics", "surgery", "consults", "emergencies"],
  cardiologia: ["consults", "ward", "procedures", "emergencies", "research"],
  cirugia: ["surgery", "ward", "consults", "procedures"],
  medicina: ["consults", "ward", "emergencies", "research"],
  pediatria: ["consults", "ward", "emergencies", "research"],
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
  { id: "cut-outline", label: "Quirófano" },
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
