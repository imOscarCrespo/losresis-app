export const ROOMMATE_THEME = {
  PRIMARY: "#670CF5",
  SECONDARY: "#00BD7C",
  ACCENT: "#1B0977",
  BACKGROUND: "#F7F5FB",
  CARD: "#FFFFFF",
  TEXT: "#111827",
  MUTED: "#64748B",
  BORDER: "#E9DFFB",
  SURFACE: "#F3EEFF",
  SUCCESS_SOFT: "#DDF8EE",
  DANGER: "#F43F5E",
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

export const ROOMMATE_FORM_DEFAULTS = {
  profile: {
    headline: "",
    bio: "",
    about_home: "",
    ideal_roommate: "",
    dealbreakers: "",
    occupation_label: "",
    age: "",
    city: "",
    hospital_id: "",
    speciality_id: "",
    residency_year: "",
    home_plan: null,
    looking_for: null,
    budget_min_eur: "",
    budget_max_eur: "",
    move_in_date: "",
    stay_length_months: "",
    max_roommates: "",
    preferred_neighborhoods: [],
    languages: [],
    is_active: false,
    is_visible: true,
  },
  lifestyle: {
    cleanliness_level: null,
    sociability_level: null,
    sleep_schedule: null,
    work_from_home: null,
    guests_frequency: null,
    smoking_habit: null,
    pets: null,
    cooking_habit: null,
    noise_level: null,
    party_frequency: null,
  },
  search: {
    preferred_gender: "any",
    min_age: "",
    max_age: "",
    budget_min_eur: "",
    budget_max_eur: "",
    preferred_city: "",
    preferred_neighborhoods: [],
    move_in_from: "",
    move_in_to: "",
    preferred_sleep_schedule: "any",
    min_cleanliness_level: "",
    min_sociability_level: "",
    accepts_smoking: null,
    accepts_pets: null,
    notes: "",
  },
  filters: {
    preferred_city: "",
    hospital_id: "",
    speciality_id: "",
    budget_max_eur: "",
    move_in_from: "",
    move_in_to: "",
    min_cleanliness_level: "",
    preferred_sleep_schedule: "any",
    accepts_pets: null,
    accepts_smoking: null,
    only_verified: false,
  },
  answers: {},
};

export const ROOMMATE_OPTION_SETS = {
  homePlan: [
    { value: "already_have_flat", label: "Ya tengo piso" },
    { value: "open_to_team_up", label: "Quiero montar piso" },
  ],
  lookingFor: [
    { value: "room", label: "Habitación" },
    { value: "shared_flat", label: "Piso compartido" },
    { value: "studio", label: "Estudio o algo pequeño" },
    { value: "any", label: "Me adapto" },
  ],
  sleepSchedule: [
    { value: "early_bird", label: "Madrugador/a" },
    { value: "balanced", label: "Equilibrado/a" },
    { value: "night_owl", label: "Nocturno/a" },
  ],
  frequency: [
    { value: "never", label: "Nunca" },
    { value: "rarely", label: "Casi nunca" },
    { value: "sometimes", label: "A veces" },
    { value: "often", label: "A menudo" },
  ],
  guests: [
    { value: "rarely", label: "Pocas veces" },
    { value: "sometimes", label: "Alguna vez" },
    { value: "often", label: "Con frecuencia" },
  ],
  smoking: [
    { value: "no", label: "No fumo" },
    { value: "outside_only", label: "Solo fuera" },
    { value: "yes", label: "Sí" },
  ],
  pets: [
    { value: "none", label: "Sin mascotas" },
    { value: "has_pet", label: "Tengo mascota" },
    { value: "pet_friendly", label: "Pet friendly" },
  ],
  cooking: [
    { value: "rarely", label: "Poco" },
    { value: "weekly", label: "Varias veces por semana" },
    { value: "daily", label: "Casi cada día" },
  ],
  noise: [
    { value: "quiet", label: "Muy tranquilo" },
    { value: "balanced", label: "Normal" },
    { value: "lively", label: "Con bastante vida" },
  ],
  gender: [
    { value: "any", label: "Me da igual" },
    { value: "women", label: "Prefiero chicas" },
    { value: "men", label: "Prefiero chicos" },
    { value: "mixed", label: "Mixto" },
  ],
  nullableBoolean: [
    { value: null, label: "Me da igual" },
    { value: true, label: "Sí" },
    { value: false, label: "No" },
  ],
};

const SCORE_FIELDS = [
  "cleanliness_level",
  "sociability_level",
];

const EXACT_FIELDS = [
  "sleep_schedule",
  "work_from_home",
  "guests_frequency",
  "smoking_habit",
  "pets",
  "cooking_habit",
  "noise_level",
  "party_frequency",
];

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? null : numericValue;
};

export const normalizeBundle = (bundle = {}) => ({
  profile: { ...ROOMMATE_FORM_DEFAULTS.profile, ...(bundle.profile || {}) },
  lifestyle: {
    ...ROOMMATE_FORM_DEFAULTS.lifestyle,
    ...(bundle.lifestyle || {}),
  },
  search: { ...ROOMMATE_FORM_DEFAULTS.search, ...(bundle.search || {}) },
  filters: { ...ROOMMATE_FORM_DEFAULTS.filters, ...(bundle.filters || {}) },
  answers: { ...(bundle.answers || {}) },
});

export const getRoommateInitials = (profile) => {
  const source = [
    profile?.user?.name,
    profile?.user?.surname,
    profile?.headline,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!source) return "RM";

  return source
    .split(" ")
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");
};

export const getRoommateDisplayName = (profile) => {
  const firstName = profile?.user?.name || "";
  const surname = profile?.user?.surname || "";
  const composedName = [firstName, surname].filter(Boolean).join(" ").trim();

  if (composedName) {
    return profile?.age ? `${composedName}, ${profile.age}` : composedName;
  }

  return profile?.age ? `Roomie, ${profile.age}` : "Roomie";
};

export const getRoommateAvatarUrl = (avatarPath) => {
  if (!avatarPath || !SUPABASE_URL) return null;

  if (
    avatarPath.startsWith("http://") ||
    avatarPath.startsWith("https://") ||
    avatarPath.startsWith("file://")
  ) {
    return avatarPath;
  }

  return `${SUPABASE_URL}/storage/v1/object/public/roommate-avatar/${avatarPath}`;
};

export const formatCurrency = (value) => {
  const numericValue = toNumber(value);
  if (numericValue === null) return null;

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(numericValue);
};

export const getBudgetLabel = (profile) => {
  const min = formatCurrency(profile?.budget_min_eur);
  const max = formatCurrency(profile?.budget_max_eur);

  if (min && max) return `${min} - ${max}`;
  if (max) return `Hasta ${max}`;
  if (min) return `Desde ${min}`;
  return "Presupuesto flexible";
};

export const getOptionLabel = (setName, value) => {
  const options = ROOMMATE_OPTION_SETS[setName] || [];
  const selectedOption = options.find((option) => option.value === value);
  return selectedOption?.label || value || "";
};

export const getRoommateTags = (profile, lifestyle) => {
  const tags = [];

  if (profile?.looking_for) {
    tags.push(getOptionLabel("lookingFor", profile.looking_for));
  }
  if (lifestyle?.sleep_schedule) {
    tags.push(getOptionLabel("sleepSchedule", lifestyle.sleep_schedule));
  }
  if (lifestyle?.smoking_habit === "no") {
    tags.push("No fumador/a");
  }
  if (lifestyle?.pets === "has_pet") {
    tags.push("Con mascota");
  }
  if (lifestyle?.cleanliness_level >= 4) {
    tags.push("Muy ordenado/a");
  }
  if (profile?.preferred_neighborhoods?.length) {
    tags.push(profile.preferred_neighborhoods[0]);
  }

  return tags.slice(0, 4);
};

const compareQuestionAnswer = (myAnswer, candidateAnswer) => {
  if (!myAnswer || !candidateAnswer) return 0.4;

  if (
    myAnswer.answer_number !== null &&
    myAnswer.answer_number !== undefined &&
    candidateAnswer.answer_number !== null &&
    candidateAnswer.answer_number !== undefined
  ) {
    const difference = Math.abs(
      Number(myAnswer.answer_number) - Number(candidateAnswer.answer_number)
    );
    return Math.max(0, 1 - difference / 4);
  }

  if (
    Array.isArray(myAnswer.answer_options) &&
    Array.isArray(candidateAnswer.answer_options) &&
    myAnswer.answer_options.length &&
    candidateAnswer.answer_options.length
  ) {
    const sharedCount = myAnswer.answer_options.filter((option) =>
      candidateAnswer.answer_options.includes(option)
    ).length;
    const totalCount = Math.max(
      myAnswer.answer_options.length,
      candidateAnswer.answer_options.length
    );
    return sharedCount / totalCount;
  }

  if (myAnswer.answer_text && candidateAnswer.answer_text) {
    return myAnswer.answer_text === candidateAnswer.answer_text ? 1 : 0.45;
  }

  return 0.4;
};

const matchesSearch = (mySearch, candidateProfile, candidateLifestyle) => {
  if (!mySearch) return 1;

  let score = 1;

  const candidateAge = toNumber(candidateProfile?.age);
  if (toNumber(mySearch.min_age) && candidateAge) {
    score *= candidateAge >= toNumber(mySearch.min_age) ? 1 : 0.5;
  }
  if (toNumber(mySearch.max_age) && candidateAge) {
    score *= candidateAge <= toNumber(mySearch.max_age) ? 1 : 0.5;
  }

  const candidateBudgetMax = toNumber(candidateProfile?.budget_max_eur);
  if (toNumber(mySearch.budget_max_eur) && candidateBudgetMax) {
    score *= candidateBudgetMax <= toNumber(mySearch.budget_max_eur) ? 1 : 0.65;
  }

  if (
    mySearch.preferred_city &&
    candidateProfile?.city &&
    mySearch.preferred_city.toLowerCase() !== candidateProfile.city.toLowerCase()
  ) {
    score *= 0.8;
  }

  if (
    mySearch.preferred_sleep_schedule &&
    mySearch.preferred_sleep_schedule !== "any" &&
    candidateLifestyle?.sleep_schedule &&
    mySearch.preferred_sleep_schedule !== candidateLifestyle.sleep_schedule
  ) {
    score *= 0.75;
  }

  if (typeof mySearch.accepts_smoking === "boolean") {
    const candidateSmoking = candidateLifestyle?.smoking_habit || "no";
    if (mySearch.accepts_smoking === false && candidateSmoking !== "no") {
      score *= 0.55;
    }
  }

  if (typeof mySearch.accepts_pets === "boolean") {
    const candidatePets = candidateLifestyle?.pets || "none";
    if (mySearch.accepts_pets === false && candidatePets === "has_pet") {
      score *= 0.55;
    }
  }

  return score;
};

export const calculateRoommateCompatibility = (myBundle, candidateBundle) => {
  const myData = normalizeBundle(myBundle);
  const candidateData = normalizeBundle(candidateBundle);

  let totalWeight = 0;
  let score = 0;

  SCORE_FIELDS.forEach((field) => {
    const myValue = toNumber(myData.lifestyle[field]);
    const candidateValue = toNumber(candidateData.lifestyle[field]);
    if (myValue !== null && candidateValue !== null) {
      totalWeight += 2;
      score += Math.max(0, 1 - Math.abs(myValue - candidateValue) / 4) * 2;
    }
  });

  EXACT_FIELDS.forEach((field) => {
    const myValue = myData.lifestyle[field];
    const candidateValue = candidateData.lifestyle[field];
    if (myValue && candidateValue) {
      totalWeight += 1.5;
      score += (myValue === candidateValue ? 1 : 0.55) * 1.5;
    }
  });

  const questionCodes = Object.keys(myData.answers || {});
  if (questionCodes.length) {
    questionCodes.forEach((code) => {
      totalWeight += 1;
      score += compareQuestionAnswer(
        myData.answers[code],
        candidateData.answers[code]
      );
    });
  }

  totalWeight += 2.5;
  score +=
    matchesSearch(
      myData.search,
      candidateData.profile,
      candidateData.lifestyle
    ) * 2.5;

  const rawScore = totalWeight ? score / totalWeight : 0.72;
  return Math.round(Math.min(0.99, Math.max(0.45, rawScore)) * 100);
};

export const buildAnswerMap = (answers = [], questions = []) => {
  const answerByQuestionId = answers.reduce((acc, answer) => {
    acc[answer.question_id] = answer;
    return acc;
  }, {});

  return questions.reduce((acc, question) => {
    const answer = answerByQuestionId[question.id];
    if (answer) {
      acc[question.code] = answer;
    }
    return acc;
  }, {});
};

export const serializeAnswerPayload = (question, rawValue) => {
  if (question.input_type === "scale") {
    return {
      answer_number: toNumber(rawValue),
      answer_text: null,
      answer_options: [],
    };
  }

  if (question.input_type === "multi_choice") {
    return {
      answer_number: null,
      answer_text: null,
      answer_options: Array.isArray(rawValue) ? rawValue : [],
    };
  }

  if (question.input_type === "single_choice") {
    return {
      answer_number: null,
      answer_text: rawValue || null,
      answer_options: [],
    };
  }

  return {
    answer_number: null,
    answer_text: rawValue || null,
    answer_options: [],
  };
};
