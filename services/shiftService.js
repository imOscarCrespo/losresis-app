import { supabase } from "../config/supabase";

/**
 * Shift Service
 * Gestión de guardias médicas
 */

/**
 * Obtiene todas las guardias de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Array>} Array de guardias
 */
export const getUserShifts = async (userId) => {
  try {
    if (!userId) {
      console.warn("⚠️ getUserShifts: No userId provided");
      return [];
    }

    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (error) {
      console.error("❌ Error fetching user shifts:", error);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} shifts for user ${userId}`);
    return data || [];
  } catch (error) {
    console.error("❌ Exception in getUserShifts:", error);
    throw error;
  }
};

/**
 * Crea una nueva guardia
 * @param {Object} shiftData - Datos de la guardia
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Guardia creada
 */
export const createShift = async (shiftData, userId) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Construir la fecha en formato YYYY-MM-DD
    const date = new Date(
      shiftData.year,
      shiftData.month,
      parseInt(shiftData.day)
    );
    const dateString = date.toISOString().split("T")[0];

    // Determinar el tipo de guardia basado en el día de la semana
    const dayOfWeek = date.getDay();
    let type = "regular";
    if (dayOfWeek === 0) {
      type = "sunday";
    } else if (dayOfWeek === 6) {
      type = "saturday";
    }

    const newShift = {
      user_id: userId,
      date: dateString,
      type,
      notes: shiftData.notes || null,
      price_eur: shiftData.price_eur || null,
    };

    const { data, error } = await supabase
      .from("shifts")
      .insert([newShift])
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating shift:", error);
      throw error;
    }

    console.log("✅ Shift created successfully:", data);
    return data;
  } catch (error) {
    console.error("❌ Exception in createShift:", error);
    throw error;
  }
};

/**
 * Actualiza una guardia existente
 * @param {string} shiftId - ID de la guardia
 * @param {Object} updates - Datos a actualizar
 * @returns {Promise<Object>} Guardia actualizada
 */
export const updateShift = async (shiftId, updates) => {
  try {
    if (!shiftId) {
      throw new Error("Shift ID is required");
    }

    const updatedData = { ...updates };

    // Si se actualiza la fecha, recalcular el tipo
    if (updates.date) {
      const date = new Date(updates.date);
      const dayOfWeek = date.getDay();
      let type = "regular";
      if (dayOfWeek === 0) {
        type = "sunday";
      } else if (dayOfWeek === 6) {
        type = "saturday";
      }
      updatedData.type = type;
    }

    const { data, error } = await supabase
      .from("shifts")
      .update(updatedData)
      .eq("id", shiftId)
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating shift:", error);
      throw error;
    }

    console.log("✅ Shift updated successfully:", data);
    return data;
  } catch (error) {
    console.error("❌ Exception in updateShift:", error);
    throw error;
  }
};

/**
 * Elimina una guardia
 * @param {string} shiftId - ID de la guardia
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
export const deleteShift = async (shiftId) => {
  try {
    if (!shiftId) {
      throw new Error("Shift ID is required");
    }

    const { error } = await supabase.from("shifts").delete().eq("id", shiftId);

    if (error) {
      console.error("❌ Error deleting shift:", error);
      throw error;
    }

    console.log("✅ Shift deleted successfully:", shiftId);
    return true;
  } catch (error) {
    console.error("❌ Exception in deleteShift:", error);
    throw error;
  }
};

/**
 * Obtiene guardias del equipo (mismo hospital y especialidad)
 * @param {string} userId - ID del usuario actual
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialityId - ID de la especialidad
 * @param {number} month - Mes (0-11)
 * @param {number} year - Año
 * @param {Array<string>} specialityFilters - Filtros de especialidades
 * @returns {Promise<Array>} Array de guardias del equipo
 */
export const getTeamShifts = async (
  userId,
  hospitalId,
  specialityId,
  month,
  year,
  specialityFilters = []
) => {
  try {
    if (!hospitalId || !specialityId) {
      console.warn("⚠️ getTeamShifts: Missing hospital or speciality ID");
      return [];
    }

    // Calcular el rango de fechas para el mes
    const startDate = new Date(year, month, 1).toISOString().split("T")[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

    let query = supabase
      .from("shifts")
      .select(
        `
        *,
        users!user_id (
          id,
          name,
          surname,
          speciality_id,
          hospital_id
        )
      `
      )
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    const { data: allShifts, error: shiftsError } = await query;

    if (shiftsError) {
      console.error("❌ Error fetching team shifts:", shiftsError);
      throw shiftsError;
    }

    // Filtrar por hospital y especialidad en el cliente
    let filteredShifts = (allShifts || []).filter((shift) => {
      if (!shift.users || shift.users.hospital_id !== hospitalId) {
        return false;
      }

      // Aplicar filtros de especialidad si existen
      if (specialityFilters && specialityFilters.length > 0) {
        return specialityFilters.includes(shift.users.speciality_id);
      } else {
        return shift.users.speciality_id === specialityId;
      }
    });

    // Filtrar guardias del usuario actual y mapear datos del usuario
    const teamShifts = filteredShifts
      .filter((shift) => shift.user_id !== userId)
      .map((shift) => ({
        ...shift,
        user_name: shift.users?.name || '',
        user_surname: shift.users?.surname || '',
      }));

    console.log(`✅ Fetched ${teamShifts.length} team shifts`);
    return teamShifts;
  } catch (error) {
    console.error("❌ Exception in getTeamShifts:", error);
    throw error;
  }
};

/**
 * Crea una solicitud de intercambio de guardia
 * @param {string} requesterShiftId - ID de la guardia del solicitante
 * @param {string} targetShiftId - ID de la guardia objetivo
 * @returns {Promise<Object>} Solicitud creada
 */
export const createSwapRequest = async (requesterShiftId, targetShiftId) => {
  try {
    if (!requesterShiftId || !targetShiftId) {
      throw new Error("Both shift IDs are required");
    }

    const newRequest = {
      requester_shift_id: requesterShiftId,
      target_shift_id: targetShiftId,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("shift_swap_requests")
      .insert([newRequest])
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating swap request:", error);
      throw error;
    }

    console.log("✅ Swap request created successfully:", data);
    return data;
  } catch (error) {
    console.error("❌ Exception in createSwapRequest:", error);
    throw error;
  }
};

/**
 * Crea una solicitud de compra de guardia
 * @param {string} shiftId - ID de la guardia
 * @param {string} buyerId - ID del comprador
 * @param {string} ownerId - ID del dueño
 * @param {number} offeredPrice - Precio ofrecido
 * @returns {Promise<Object>} Solicitud creada
 */
export const createPurchaseRequest = async (
  shiftId,
  buyerId,
  ownerId,
  offeredPrice
) => {
  try {
    if (!shiftId || !buyerId || !ownerId) {
      throw new Error("Shift ID, buyer ID and owner ID are required");
    }

    const newRequest = {
      shift_id: shiftId,
      buyer_id: buyerId,
      owner_id: ownerId,
      offered_price_eur: offeredPrice || null,
      status: "PENDING",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("shift_purchase_requests")
      .insert([newRequest])
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating purchase request:", error);
      throw error;
    }

    console.log("✅ Purchase request created successfully:", data);
    return data;
  } catch (error) {
    console.error("❌ Exception in createPurchaseRequest:", error);
    throw error;
  }
};

export default {
  getUserShifts,
  createShift,
  updateShift,
  deleteShift,
  getTeamShifts,
  createSwapRequest,
  createPurchaseRequest,
};
