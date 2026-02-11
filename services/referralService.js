/**
 * Servicio de códigos de referido y sorteos (raffles).
 * Gestiona la obtención de raffle activo, comprobación de referral ya aplicado
 * y la aplicación de un código de referido.
 */

import { supabase } from "../config/supabase";

const REFERRAL_CODE_FORMAT = /^[A-Z]{5}$/;

/**
 * Obtiene el sorteo (raffle) activo actual.
 * Un raffle está activo cuando: starts_at <= now <= ends_at
 * @returns {Promise<{success: boolean, raffle: object|null, error: string|null}>}
 */
export const getActiveRaffle = async () => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("raffle")
      .select("*")
      .lte("starts_at", now)
      .gte("ends_at", now)
      .order("ends_at", { ascending: true })
      .limit(1);

    if (error) {
      console.error("Error fetching active raffle:", error);
      return { success: false, raffle: null, error: error.message };
    }

    const raffle = data?.[0] ?? null;
    return { success: true, raffle, error: null };
  } catch (err) {
    console.error("Exception in getActiveRaffle:", err);
    return {
      success: false,
      raffle: null,
      error: err.message || "Error al obtener la promoción",
    };
  }
};

/**
 * Comprueba si el usuario ya aplicó un código de referido para el raffle dado.
 * @param {string} raffleId - UUID del raffle
 * @param {string} referredUserId - UUID del usuario referido (el actual)
 * @returns {Promise<{success: boolean, alreadyApplied: boolean, error: string|null}>}
 */
export const checkReferralAlreadyApplied = async (
  raffleId,
  referredUserId
) => {
  try {
    if (!raffleId || !referredUserId) {
      return { success: true, alreadyApplied: false, error: null };
    }

    const { data, error } = await supabase
      .from("referral")
      .select("id")
      .eq("raffle_id", raffleId)
      .eq("referred_user_id", referredUserId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error checking referral:", error);
      return { success: false, alreadyApplied: false, error: error.message };
    }

    return {
      success: true,
      alreadyApplied: !!data?.id,
      error: null,
    };
  } catch (err) {
    console.error("Exception in checkReferralAlreadyApplied:", err);
    return {
      success: false,
      alreadyApplied: false,
      error: err.message || "Error al comprobar el código",
    };
  }
};

/**
 * Valida el formato del código de referido (5 letras mayúsculas).
 * @param {string} code - Código a validar
 * @returns {boolean}
 */
export const isValidReferralCodeFormat = (code) => {
  const normalized = (code || "").trim().toUpperCase();
  return REFERRAL_CODE_FORMAT.test(normalized);
};

/**
 * Aplica un código de referido para el usuario actual en el raffle activo.
 * - Valida formato del código
 * - Busca usuario con ese referral_code
 * - Comprueba que no sea el propio usuario
 * - Inserta en la tabla referral
 * @param {string} referredUserId - UUID del usuario actual (el que aplica el código)
 * @param {string} code - Código de 5 letras (se normaliza a mayúsculas)
 * @param {object} raffle - Objeto raffle activo (con id)
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const applyReferralCode = async (referredUserId, code, raffle) => {
  try {
    const normalized = (code || "").trim().toUpperCase();
    if (!REFERRAL_CODE_FORMAT.test(normalized)) {
      return {
        success: false,
        error: "El código debe tener exactamente 5 letras mayúsculas.",
      };
    }

    if (!raffle?.id) {
      return { success: false, error: "No hay ninguna promoción activa." };
    }

    if (!referredUserId) {
      return { success: false, error: "Usuario no identificado." };
    }

    const { data: referrer, error: findError } = await supabase
      .from("users")
      .select("id")
      .eq("referral_code", normalized)
      .maybeSingle();

    if (findError) {
      return {
        success: false,
        error: "Error al validar el código. Inténtalo de nuevo.",
      };
    }

    if (!referrer?.id) {
      return { success: false, error: "Código no válido." };
    }

    if (referrer.id === referredUserId) {
      return { success: false, error: "No puedes usar tu propio código." };
    }

    const { error: insertError } = await supabase.from("referral").insert({
      raffle_id: raffle.id,
      referrer_user_id: referrer.id,
      referred_user_id: referredUserId,
      referral_code_used: normalized,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return {
          success: false,
          error: "Ya has aplicado un código para esta promoción.",
        };
      }
      return {
        success: false,
        error: insertError.message || "Error al aplicar el código. Inténtalo de nuevo.",
      };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("Exception in applyReferralCode:", err);
    return {
      success: false,
      error: err.message || "Error inesperado. Inténtalo de nuevo.",
    };
  }
};
