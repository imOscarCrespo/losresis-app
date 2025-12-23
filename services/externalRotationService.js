import { supabase } from '../config/supabase';

/**
 * Servicio para gestionar rotaciones externas
 */

/**
 * Obtiene todas las rotaciones externas con información del usuario
 * @param {string} specialtyId - ID de especialidad para filtrar (opcional)
 * @param {string} monthYear - Mes/año en formato YYYY-MM (opcional)
 * @returns {Promise<Array>} Lista de rotaciones
 */
export const getAllRotations = async (specialtyId = null, monthYear = null) => {
  try {
    const { data, error } = await supabase
      .from('external_rotation')
      .select(`
        *,
        users!external_rotation_user_id_fkey (
          id,
          name,
          surname,
          work_email,
          phone,
          speciality_id
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching rotations:', error);
      throw error;
    }

    let filteredData = data || [];

    // Filtrar por especialidad
    if (specialtyId) {
      filteredData = filteredData.filter(
        (rotation) => rotation.users?.speciality_id === specialtyId
      );
    }

    // Filtrar por mes/año
    if (monthYear) {
      const [year, month] = monthYear.split('-').map(Number);
      const filterStart = new Date(year, month - 1, 1);
      const filterEnd = new Date(year, month, 0);

      filteredData = filteredData.filter((rotation) => {
        const rotationStart = new Date(rotation.start_date);
        const rotationEnd = rotation.end_date
          ? new Date(rotation.end_date)
          : new Date();

        return rotationStart <= filterEnd && rotationEnd >= filterStart;
      });
    }

    // Mapear datos del usuario
    const rotationsWithUser = filteredData.map((rotation) => ({
      ...rotation,
      user_name: rotation.users?.name || '',
      user_surname: rotation.users?.surname || '',
      user_email: rotation.users?.work_email || '',
      user_phone: rotation.users?.phone || '',
      user_speciality_id: rotation.users?.speciality_id || '',
    }));

    console.log(`✅ Fetched ${rotationsWithUser.length} rotations`);
    return rotationsWithUser;
  } catch (error) {
    console.error('❌ Exception in getAllRotations:', error);
    throw error;
  }
};

/**
 * Obtiene las rotaciones del usuario actual
 * @param {string} userId - ID del usuario
 * @returns {Promise<Array>} Lista de rotaciones del usuario
 */
export const getUserRotations = async (userId) => {
  try {
    if (!userId) {
      console.warn('⚠️ getUserRotations: Missing user ID');
      return [];
    }

    const { data, error } = await supabase
      .from('external_rotation')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching user rotations:', error);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} user rotations`);
    return data || [];
  } catch (error) {
    console.error('❌ Exception in getUserRotations:', error);
    throw error;
  }
};

/**
 * Crea una nueva rotación externa
 * @param {Object} rotationData - Datos de la rotación
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Rotación creada
 */
export const createRotation = async (rotationData, userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const newRotation = {
      user_id: userId,
      latitude: rotationData.latitude,
      longitude: rotationData.longitude,
      start_date: rotationData.start_date,
      end_date: rotationData.end_date || null,
    };

    const { data, error } = await supabase
      .from('external_rotation')
      .insert([newRotation])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating rotation:', error);
      throw error;
    }

    console.log('✅ Rotation created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception in createRotation:', error);
    throw error;
  }
};

/**
 * Actualiza una rotación externa
 * @param {string} rotationId - ID de la rotación
 * @param {Object} updates - Datos a actualizar
 * @param {string} userId - ID del usuario (para verificar permisos)
 * @returns {Promise<Object>} Rotación actualizada
 */
export const updateRotation = async (rotationId, updates, userId) => {
  try {
    if (!rotationId || !userId) {
      throw new Error('Rotation ID and User ID are required');
    }

    const updatedData = {
      latitude: updates.latitude,
      longitude: updates.longitude,
      start_date: updates.start_date,
      end_date: updates.end_date || null,
    };

    const { data, error } = await supabase
      .from('external_rotation')
      .update(updatedData)
      .eq('id', rotationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating rotation:', error);
      throw error;
    }

    console.log('✅ Rotation updated successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception in updateRotation:', error);
    throw error;
  }
};

/**
 * Elimina una rotación externa
 * @param {string} rotationId - ID de la rotación
 * @param {string} userId - ID del usuario (para verificar permisos)
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
export const deleteRotation = async (rotationId, userId) => {
  try {
    if (!rotationId || !userId) {
      throw new Error('Rotation ID and User ID are required');
    }

    const { error } = await supabase
      .from('external_rotation')
      .delete()
      .eq('id', rotationId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error deleting rotation:', error);
      throw error;
    }

    console.log('✅ Rotation deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Exception in deleteRotation:', error);
    throw error;
  }
};

/**
 * Actualiza el teléfono del usuario
 * @param {string} userId - ID del usuario
 * @param {string} phone - Teléfono
 * @returns {Promise<boolean>} True si se actualizó correctamente
 */
export const updateUserPhone = async (userId, phone) => {
  try {
    if (!userId || !phone) {
      throw new Error('User ID and phone are required');
    }

    const { error } = await supabase
      .from('users')
      .update({ phone })
      .eq('id', userId);

    if (error) {
      console.error('❌ Error updating user phone:', error);
      throw error;
    }

    console.log('✅ User phone updated successfully');
    return true;
  } catch (error) {
    console.error('❌ Exception in updateUserPhone:', error);
    throw error;
  }
};

export default {
  getAllRotations,
  getUserRotations,
  createRotation,
  updateRotation,
  deleteRotation,
  updateUserPhone,
};

