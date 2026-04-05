import AsyncStorage from "@react-native-async-storage/async-storage";

const GATE_STORAGE_KEY_PREFIX = "@losresis:residentReviewGate:";
const GATE_VERSION = 1;
const HARD_GATE_ACTION_LIMIT = 8;
const HARD_GATE_SESSION_LIMIT = 2;
const PROMPT_ACTION_THRESHOLD = 5;
const ACTION_DEBOUNCE_MS = 15000;

const QUALIFIED_SECTIONS = new Set([
  "agenda",
  "grupos",
  "roomies",
  "vivienda",
  "rotaciones-externas",
  "residenceLibrary",
  "libro-residente",
  "cursos",
  "residentPayouts",
  "residentPayoutEntry",
  "reseñas",
]);

const QUALIFIED_ACTION_TYPES = new Set([
  "section_visit",
  "create_content",
  "detail_open",
  "message_send",
  "export",
  "save",
]);

const DEFAULT_GATE_STATE = {
  version: GATE_VERSION,
  status: "soft",
  qualifiedActionsCount: 0,
  sessionsCount: 0,
  promptVisible: false,
  dismissedPromptAt: null,
  lastQualifiedActionAt: null,
  lastQualifiedActionKey: null,
};

const getStorageKey = (userId) => `${GATE_STORAGE_KEY_PREFIX}${userId}`;

const withDerivedState = (rawState = {}) => {
  const qualifiedActionsCount = Number(rawState.qualifiedActionsCount || 0);
  const sessionsCount = Number(rawState.sessionsCount || 0);
  const hardLocked =
    qualifiedActionsCount >= HARD_GATE_ACTION_LIMIT ||
    sessionsCount >= HARD_GATE_SESSION_LIMIT;
  const promptVisible =
    !hardLocked && qualifiedActionsCount >= PROMPT_ACTION_THRESHOLD;

  return {
    ...DEFAULT_GATE_STATE,
    ...rawState,
    version: GATE_VERSION,
    qualifiedActionsCount,
    sessionsCount,
    status: hardLocked ? "hard" : "soft",
    promptVisible,
  };
};

export const getResidentReviewGateState = async (userId) => {
  try {
    if (!userId) return withDerivedState();

    const rawValue = await AsyncStorage.getItem(getStorageKey(userId));
    if (!rawValue) return withDerivedState();

    const parsed = JSON.parse(rawValue);
    return withDerivedState(parsed);
  } catch (error) {
    console.error("Error loading resident review gate state:", error);
    return withDerivedState();
  }
};

export const persistResidentReviewGateState = async (userId, state) => {
  try {
    if (!userId) return withDerivedState(state);

    const nextState = withDerivedState(state);
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(nextState));
    return nextState;
  } catch (error) {
    console.error("Error saving resident review gate state:", error);
    return withDerivedState(state);
  }
};

export const resetResidentReviewGate = async (userId) => {
  try {
    if (!userId) return;
    await AsyncStorage.removeItem(getStorageKey(userId));
  } catch (error) {
    console.error("Error resetting resident review gate state:", error);
  }
};

export const initializeResidentReviewGate = async (
  userId,
  { hasReview, isResident, isSuperAdmin }
) => {
  if (!userId || hasReview || !isResident || isSuperAdmin) {
    await resetResidentReviewGate(userId);
    return withDerivedState();
  }

  const existingState = await getResidentReviewGateState(userId);
  return persistResidentReviewGateState(userId, existingState);
};

export const incrementResidentReviewGateSession = async (userId) => {
  const currentState = await getResidentReviewGateState(userId);
  const nextState = {
    ...currentState,
    sessionsCount: currentState.sessionsCount + 1,
  };

  return persistResidentReviewGateState(userId, nextState);
};

export const registerQualifiedResidentAction = async (
  userId,
  { sectionId, actionType = "section_visit", actionKey, timestamp = Date.now() }
) => {
  const currentState = await getResidentReviewGateState(userId);

  if (!QUALIFIED_ACTION_TYPES.has(actionType)) {
    return { state: currentState, counted: false, hardLockedChanged: false };
  }

  const normalizedActionKey =
    actionKey || `${actionType}:${sectionId || "unknown"}`;
  const timeSinceLastAction = currentState.lastQualifiedActionAt
    ? timestamp - currentState.lastQualifiedActionAt
    : Number.POSITIVE_INFINITY;

  if (
    currentState.lastQualifiedActionKey === normalizedActionKey &&
    timeSinceLastAction < ACTION_DEBOUNCE_MS
  ) {
    return { state: currentState, counted: false, hardLockedChanged: false };
  }

  const nextState = {
    ...currentState,
    qualifiedActionsCount: currentState.qualifiedActionsCount + 1,
    lastQualifiedActionAt: timestamp,
    lastQualifiedActionKey: normalizedActionKey,
  };

  const persistedState = await persistResidentReviewGateState(userId, nextState);

  return {
    state: persistedState,
    counted: true,
    hardLockedChanged:
      currentState.status !== "hard" && persistedState.status === "hard",
  };
};

export const isQualifiedResidentSection = (sectionId) =>
  QUALIFIED_SECTIONS.has(sectionId);

export const getResidentReviewGateConfig = () => ({
  hardGateActionLimit: HARD_GATE_ACTION_LIMIT,
  hardGateSessionLimit: HARD_GATE_SESSION_LIMIT,
  promptActionThreshold: PROMPT_ACTION_THRESHOLD,
});
