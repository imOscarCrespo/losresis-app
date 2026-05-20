const loaders = {
  hospitals: () => require("../data/staticCatalog/hospitals.json"),
  hospitalSpeciality: () =>
    require("../data/staticCatalog/hospital_speciality.json"),
  hospitalDiscoveryRankings: () =>
    require("../data/staticCatalog/hospital_discovery_rankings.json"),
  hospitalSpecialityGrades: () =>
    require("../data/staticCatalog/hospital_speciality_grades.json"),
  specialities: () => require("../data/staticCatalog/specialities.json"),
  reviewQuestions: () => require("../data/staticCatalog/review_questions.json"),
  roommateQuestions: () =>
    require("../data/staticCatalog/roommate_questions.json"),
  externalRotationQuestions: () =>
    require("../data/staticCatalog/external_rotation_questions.json"),
  specialityQuizQuestionsV2: () =>
    require("../data/staticCatalog/speciality_quiz_questions_v2.json"),
  specialityQuizQuestionsV3: () =>
    require("../data/staticCatalog/speciality_quiz_questions_v3.json"),
  residentTransitionConfig: () =>
    require("../data/staticCatalog/resident_transition_config.json"),
  manifest: () => require("../data/staticCatalog/manifest.json"),
};

const cache = {};
const indexCache = {};

const load = (key) => {
  if (!cache[key]) {
    cache[key] = loaders[key]();
  }
  return cache[key];
};

const getByIdIndex = (key) => {
  if (!indexCache[key]) {
    indexCache[key] = (load(key) || []).reduce((acc, item) => {
      if (item?.id) acc[item.id] = item;
      return acc;
    }, {});
  }
  return indexCache[key];
};

export const getStaticCatalogManifest = () => load("manifest") || {};

export const getHospitalsCatalog = () => load("hospitals") || [];

export const getHospitalByIdFromCatalog = (hospitalId) =>
  hospitalId ? getByIdIndex("hospitals")[hospitalId] || null : null;

export const getSpecialitiesCatalog = () => load("specialities") || [];

export const getSpecialityByIdFromCatalog = (specialityId) =>
  specialityId ? getByIdIndex("specialities")[specialityId] || null : null;

export const getHospitalSpecialityCatalog = () =>
  load("hospitalSpeciality") || [];

export const getHospitalSpecialityGradesCatalog = () =>
  load("hospitalSpecialityGrades") || [];

export const getHospitalDiscoveryRankingsCatalog = () =>
  load("hospitalDiscoveryRankings") || {};

export const getReviewQuestionsCatalog = () => load("reviewQuestions") || [];

export const getRoommateQuestionsCatalog = () =>
  load("roommateQuestions") || [];

export const getExternalRotationQuestionsCatalog = () =>
  load("externalRotationQuestions") || [];

export const getSpecialityQuizQuestionsCatalog = (quizVersion = null) => {
  if (quizVersion === "v2_profiles_abcd") {
    return load("specialityQuizQuestionsV2") || [];
  }
  if (quizVersion === "v3_profiles_abcd_18") {
    return load("specialityQuizQuestionsV3") || [];
  }
  return [
    ...(load("specialityQuizQuestionsV2") || []),
    ...(load("specialityQuizQuestionsV3") || []),
  ].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
};

export const getResidentTransitionConfigCatalog = () =>
  load("residentTransitionConfig") || [];
