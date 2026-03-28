import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_CACHE_KEY_PREFIX = "@losresis:userProfile:";
const ACTIVE_PROFILE_USER_KEY = "@losresis:activeProfileUserId";

const getProfileCacheKey = (userId) => `${PROFILE_CACHE_KEY_PREFIX}${userId}`;

export const getCachedUserProfile = async (userId) => {
  try {
    if (!userId) return null;

    const rawProfile = await AsyncStorage.getItem(getProfileCacheKey(userId));
    if (!rawProfile) return null;

    const profile = JSON.parse(rawProfile);
    return profile?.id === userId ? profile : null;
  } catch (error) {
    console.error("Error al obtener perfil cacheado:", error);
    return null;
  }
};

export const cacheUserProfile = async (profile) => {
  try {
    if (!profile?.id) return;

    await AsyncStorage.setItem(
      getProfileCacheKey(profile.id),
      JSON.stringify(profile)
    );
  } catch (error) {
    console.error("Error al guardar perfil en caché:", error);
  }
};

export const clearCachedUserProfile = async (userId) => {
  try {
    if (!userId) return;
    await AsyncStorage.removeItem(getProfileCacheKey(userId));
  } catch (error) {
    console.error("Error al limpiar perfil cacheado:", error);
  }
};

export const syncActiveProfileCacheUser = async (userId) => {
  try {
    const previousUserId = await AsyncStorage.getItem(ACTIVE_PROFILE_USER_KEY);

    if (previousUserId && previousUserId !== userId) {
      await clearCachedUserProfile(previousUserId);
    }

    if (userId) {
      await AsyncStorage.setItem(ACTIVE_PROFILE_USER_KEY, userId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_PROFILE_USER_KEY);
    }
  } catch (error) {
    console.error("Error al sincronizar usuario activo del perfil:", error);
  }
};

export const clearActiveUserProfileCache = async () => {
  try {
    const activeUserId = await AsyncStorage.getItem(ACTIVE_PROFILE_USER_KEY);

    if (activeUserId) {
      await clearCachedUserProfile(activeUserId);
    }

    await AsyncStorage.removeItem(ACTIVE_PROFILE_USER_KEY);
  } catch (error) {
    console.error("Error al limpiar caché del perfil activo:", error);
  }
};
