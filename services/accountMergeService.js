import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { signInWithHospitalAccess } from "./authService";

// Fusión de una cuenta propia (Google/Apple) con el acceso que le creó su
// hospital (Althaia, 2026-11-23). La hace el servidor
// (`merge_into_hospital_access`): sobrevive el acceso del hospital con todos
// los datos de la cuenta propia y su Google/Apple, y la cuenta propia se borra.
// La prueba de que el acceso es suyo es su contraseña.

export const MERGE_ERRORS = {
  invalid_password: "Esa no es la contraseña del acceso de tu hospital.",
  too_many_attempts:
    "Has probado demasiadas veces. Espera una hora o pide a tu hospital que te genere una contraseña nueva.",
  not_found: "Ya no encontramos ese acceso de tu hospital.",
  caller_not_allowed: "Esta cuenta no se puede unir automáticamente. Escríbenos y te ayudamos.",
  conflict:
    "No hemos podido unir tus cuentas automáticamente. Escríbenos a contacto@losresis.com y lo hacemos por ti sin perder nada.",
  generic: "No se han podido unir tus cuentas. Inténtalo de nuevo.",
};

/** ¿Este email corporativo es de un acceso creado por un hospital? */
export const checkHospitalAccess = async (email) => {
  const value = String(email || "").trim();
  if (!value) return { exists: false, orgName: null };
  try {
    const { data, error } = await supabase.rpc("hospital_access_for_email", {
      p_email: value,
    });
    if (error) {
      console.warn("⚠️ No se pudo comprobar el acceso del hospital:", error.message);
      return { exists: false, orgName: null };
    }
    return { exists: Boolean(data?.exists), orgName: data?.org_name || null };
  } catch (error) {
    console.warn("⚠️ No se pudo comprobar el acceso del hospital:", error);
    return { exists: false, orgName: null };
  }
};

/**
 * Une la cuenta actual con el acceso del hospital y entra en él. Tras la
 * fusión la cuenta actual ya no existe, así que se entra con el email y la
 * contraseña del hospital (App.js recibe SIGNED_IN y recarga todo).
 */
export const mergeIntoHospitalAccess = async (email, password) => {
  const cleanEmail = String(email || "").trim().toLowerCase();
  try {
    const { data, error } = await supabase.rpc("merge_into_hospital_access", {
      p_email: cleanEmail,
      p_password: password || "",
    });
    if (error) {
      console.warn("⚠️ Fusión de cuentas fallida:", error.message);
      return { success: false, status: "error", error: MERGE_ERRORS.generic };
    }
    const status = data?.status || "error";
    if (status !== "merged") {
      return { success: false, status, error: MERGE_ERRORS[status] || MERGE_ERRORS.generic };
    }
    const signIn = await signInWithHospitalAccess(cleanEmail, password);
    if (!signIn.success) {
      // La fusión ya está hecha: si el login falla, que entre a mano.
      return {
        success: false,
        status: "merged_sign_in_failed",
        error:
          "Tus cuentas ya están unidas. Entra con «Tengo un acceso de mi hospital» o con Google.",
      };
    }
    return { success: true, status, error: null };
  } catch (error) {
    console.warn("⚠️ Fusión de cuentas fallida:", error);
    return { success: false, status: "error", error: MERGE_ERRORS.generic };
  }
};

// Caso inverso: entra con el acceso del hospital y su Google ya tiene otra
// cuenta. Se apunta el email del hospital, se cierra sesión, entra con Google y
// la app le pide la contraseña para unirlas.
const PENDING_MERGE_KEY = "@losresis:pendingHospitalMerge";

export const setPendingHospitalMerge = async (email) => {
  try {
    await AsyncStorage.setItem(
      PENDING_MERGE_KEY,
      JSON.stringify({ email: String(email || "").trim().toLowerCase(), at: Date.now() })
    );
  } catch {}
};

export const getPendingHospitalMerge = async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_MERGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    // Caduca en un día: si no entró con Google enseguida, no le sorprendemos después.
    if (!value?.email || Date.now() - (value.at || 0) > 24 * 60 * 60 * 1000) {
      await AsyncStorage.removeItem(PENDING_MERGE_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
};

export const clearPendingHospitalMerge = async () => {
  try {
    await AsyncStorage.removeItem(PENDING_MERGE_KEY);
  } catch {}
};
