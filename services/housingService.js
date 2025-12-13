/**
 * Servicio para gestionar los anuncios de vivienda
 */

import { supabase } from "../config/supabase";

const ITEMS_PER_PAGE = 20;

/**
 * Obtener anuncios de vivienda con paginación y filtros
 * @param {number} page - Página actual (0-indexed)
 * @param {number} limit - Límite de anuncios por página
 * @param {object} filters - Filtros para los anuncios
 * @param {string} filters.city - Ciudad (búsqueda parcial)
 * @param {string} filters.kind - Tipo de anuncio ("offer" o "seek")
 * @param {string} filters.hospital_id - ID del hospital
 * @param {string} filters.user_id - ID del usuario (para filtrar "mis anuncios")
 * @returns {Promise<{success: boolean, ads: array|null, total: number, hasMore: boolean, error: string|null}>}
 */
export const getHousingAds = async (page = 0, limit = ITEMS_PER_PAGE, filters = {}) => {
  try {
    const from = page * limit;
    const to = from + limit - 1;

    // Primero obtener el total
    let countQuery = supabase
      .from("housing_ad")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    // Aplicar filtros al conteo
    if (filters.city && filters.city.trim()) {
      countQuery = countQuery.ilike("city", `%${filters.city.trim()}%`);
    }
    if (filters.kind) {
      countQuery = countQuery.eq("kind", filters.kind);
    }
    if (filters.hospital_id) {
      countQuery = countQuery.eq("hospital_id", filters.hospital_id);
    }
    if (filters.user_id) {
      countQuery = countQuery.eq("user_id", filters.user_id);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Error counting housing ads:", countError);
    }

    // Obtener los anuncios
    let query = supabase
      .from("housing_ad")
      .select(
        `
        *,
        user:users!housing_ad_user_id_fkey(id, name, surname),
        images:housing_ad_image(*)
      `
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    // Aplicar filtros
    if (filters.city && filters.city.trim()) {
      query = query.ilike("city", `%${filters.city.trim()}%`);
    }
    if (filters.kind) {
      query = query.eq("kind", filters.kind);
    }
    if (filters.hospital_id) {
      query = query.eq("hospital_id", filters.hospital_id);
    }
    if (filters.user_id) {
      query = query.eq("user_id", filters.user_id);
    }

    // Aplicar paginación
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching housing ads:", error);
      return {
        success: false,
        ads: null,
        total: 0,
        hasMore: false,
        error: error.message,
      };
    }

    // Procesar los datos
    const processedAds = (data || []).map((ad) => ({
      ...ad,
      user: ad.user || undefined,
      images: (ad.images || []).sort((a, b) => a.position - b.position),
    }));

    const total = count || 0;
    const hasMore = to < total - 1;

    return {
      success: true,
      ads: processedAds,
      total,
      hasMore,
      error: null,
    };
  } catch (error) {
    console.error("Exception fetching housing ads:", error);
    return {
      success: false,
      ads: null,
      total: 0,
      hasMore: false,
      error: error.message,
    };
  }
};

/**
 * Obtener un anuncio por ID
 * @param {string} adId - ID del anuncio
 * @returns {Promise<{success: boolean, ad: object|null, error: string|null}>}
 */
export const getHousingAdById = async (adId) => {
  try {
    if (!adId) {
      return {
        success: false,
        ad: null,
        error: "Housing ad ID is required",
      };
    }

    const { data, error } = await supabase
      .from("housing_ad")
      .select(
        `
        *,
        user:users!housing_ad_user_id_fkey(id, name, surname),
        images:housing_ad_image(*),
        hospital:hospitals!housing_ad_hospital_id_fkey(id, name, city)
      `
      )
      .eq("id", adId)
      .single();

    if (error) {
      console.error("Error fetching housing ad:", error);
      return {
        success: false,
        ad: null,
        error: error.message,
      };
    }

    // Procesar los datos
    const processedAd = {
      ...data,
      user: data.user || undefined,
      hospital: data.hospital || undefined,
      images: (data.images || []).sort((a, b) => a.position - b.position),
    };

    return {
      success: true,
      ad: processedAd,
      error: null,
    };
  } catch (error) {
    console.error("Exception fetching housing ad:", error);
    return {
      success: false,
      ad: null,
      error: error.message,
    };
  }
};

/**
 * Crear un nuevo anuncio de vivienda
 * @param {object} adData - Datos del anuncio
 * @param {string} adData.user_id - ID del usuario
 * @param {string} adData.kind - Tipo ("offer" o "seek")
 * @param {string} adData.city - Ciudad
 * @param {string} adData.title - Título
 * @param {string} adData.description - Descripción
 * @param {number} adData.price_eur - Precio en euros
 * @param {string} adData.available_from - Fecha disponible desde
 * @param {string} adData.available_to - Fecha disponible hasta
 * @param {string} adData.hospital_id - ID del hospital
 * @param {string} adData.contact_email - Email de contacto
 * @param {string} adData.contact_phone - Teléfono de contacto
 * @param {string} adData.preferred_contact - Contacto preferido ("email" o "phone")
 * @param {array} adData.images - Array de objetos de imagen de expo-image-picker
 * @returns {Promise<{success: boolean, ad: object|null, error: string|null}>}
 */
export const createHousingAd = async (adData) => {
  try {
    const {
      user_id,
      kind,
      city,
      title,
      description,
      price_eur,
      available_from,
      available_to,
      hospital_id,
      contact_email,
      contact_phone,
      preferred_contact,
      images = [],
    } = adData;

    if (!user_id || !kind || !city || !title || !description) {
      return {
        success: false,
        ad: null,
        error: "User ID, kind, city, title and description are required",
      };
    }

    // 1. Crear el anuncio primero
    const insertData = {
      user_id,
      kind,
      city,
      title,
      description,
      price_eur: price_eur || null,
      available_from: available_from || null,
      available_to: available_to || null,
      hospital_id: hospital_id || null,
      contact_email: contact_email || null,
      contact_phone: contact_phone || null,
      preferred_contact: preferred_contact || null,
      is_active: true,
    };

    const { data: createdAd, error: adError } = await supabase
      .from("housing_ad")
      .insert([insertData])
      .select("*")
      .single();

    if (adError) {
      console.error("Error creating housing ad:", adError);
      return {
        success: false,
        ad: null,
        error: adError.message,
      };
    }

    const adId = createdAd.id;
    console.log("✅ Housing ad created:", adId);

    // 2. Subir imágenes si existen
    const uploadedImages = [];
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        try {
          // Crear nombre de archivo único
          const fileExt = image.uri.split(".").pop() || "jpg";
          const fileName = `${Date.now()}_${i}.${fileExt}`;
          const filePath = `${user_id}/${adId}/${fileName}`;

          // Convertir URI a blob
          const response = await fetch(image.uri);
          const blob = await response.blob();

          // Subir a Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("housing_ad")
            .upload(filePath, blob, {
              contentType: image.type || "image/jpeg",
              upsert: false,
            });

          if (uploadError) {
            console.error(`Error uploading image ${i}:`, uploadError);
            continue; // Continuar con las siguientes imágenes
          }

          console.log(`✅ Image ${i} uploaded:`, uploadData.path);

          // 3. Crear registro en housing_ad_image
          const { data: imageData, error: imageError } = await supabase
            .from("housing_ad_image")
            .insert([
              {
                housing_ad_id: adId,
                object_path: uploadData.path,
                position: i,
              },
            ])
            .select("*")
            .single();

          if (imageError) {
            console.error(`Error creating image record ${i}:`, imageError);
          } else {
            uploadedImages.push(imageData);
          }
        } catch (imgError) {
          console.error(`Exception uploading image ${i}:`, imgError);
        }
      }
    }

    // 4. Obtener el anuncio completo con imágenes y usuario
    const { data: finalAd, error: fetchError } = await supabase
      .from("housing_ad")
      .select(
        `
        *,
        user:users!housing_ad_user_id_fkey(id, name, surname),
        hospital:hospitals!housing_ad_hospital_id_fkey(id, name, city),
        images:housing_ad_image(*)
      `
      )
      .eq("id", adId)
      .single();

    if (fetchError) {
      console.error("Error fetching final ad:", fetchError);
      // Aún así retornamos éxito porque el anuncio se creó
      return {
        success: true,
        ad: {
          ...createdAd,
          images: uploadedImages,
        },
        error: null,
      };
    }

    // Procesar los datos
    const processedAd = {
      ...finalAd,
      user: finalAd.user || undefined,
      hospital: finalAd.hospital || undefined,
      images: (finalAd.images || []).sort((a, b) => a.position - b.position),
    };

    console.log("✅ Housing ad created successfully with", uploadedImages.length, "images");

    return {
      success: true,
      ad: processedAd,
      error: null,
    };
  } catch (error) {
    console.error("Exception creating housing ad:", error);
    return {
      success: false,
      ad: null,
      error: error.message,
    };
  }
};

/**
 * Actualizar un anuncio de vivienda
 * @param {string} adId - ID del anuncio
 * @param {object} adData - Datos actualizados
 * @returns {Promise<{success: boolean, ad: object|null, error: string|null}>}
 */
export const updateHousingAd = async (adId, adData) => {
  try {
    if (!adId) {
      return {
        success: false,
        ad: null,
        error: "Housing ad ID is required",
      };
    }

    const updateData = {};
    if (adData.kind !== undefined) updateData.kind = adData.kind;
    if (adData.city !== undefined) updateData.city = adData.city;
    if (adData.title !== undefined) updateData.title = adData.title;
    if (adData.description !== undefined) updateData.description = adData.description;
    if (adData.price_eur !== undefined) updateData.price_eur = adData.price_eur || null;
    if (adData.available_from !== undefined) updateData.available_from = adData.available_from || null;
    if (adData.available_to !== undefined) updateData.available_to = adData.available_to || null;
    if (adData.hospital_id !== undefined) updateData.hospital_id = adData.hospital_id || null;
    if (adData.contact_email !== undefined) updateData.contact_email = adData.contact_email || null;
    if (adData.contact_phone !== undefined) updateData.contact_phone = adData.contact_phone || null;
    if (adData.preferred_contact !== undefined) updateData.preferred_contact = adData.preferred_contact || null;
    if (adData.is_active !== undefined) updateData.is_active = adData.is_active;

    const { data, error } = await supabase
      .from("housing_ad")
      .update(updateData)
      .eq("id", adId)
      .select(
        `
        *,
        user:users!housing_ad_user_id_fkey(id, name, surname),
        images:housing_ad_image(*)
      `
      )
      .single();

    if (error) {
      console.error("Error updating housing ad:", error);
      return {
        success: false,
        ad: null,
        error: error.message,
      };
    }

    // Procesar los datos
    const processedAd = {
      ...data,
      user: data.user || undefined,
      images: (data.images || []).sort((a, b) => a.position - b.position),
    };

    return {
      success: true,
      ad: processedAd,
      error: null,
    };
  } catch (error) {
    console.error("Exception updating housing ad:", error);
    return {
      success: false,
      ad: null,
      error: error.message,
    };
  }
};

/**
 * Eliminar un anuncio de vivienda
 * @param {string} adId - ID del anuncio
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteHousingAd = async (adId) => {
  try {
    if (!adId) {
      return {
        success: false,
        error: "Housing ad ID is required",
      };
    }

    const { error } = await supabase.from("housing_ad").delete().eq("id", adId);

    if (error) {
      console.error("Error deleting housing ad:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Exception deleting housing ad:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Toggle estado activo/inactivo de un anuncio
 * @param {string} adId - ID del anuncio
 * @param {boolean} isActive - Estado activo
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const toggleHousingAdStatus = async (adId, isActive) => {
  try {
    if (!adId) {
      return {
        success: false,
        error: "Housing ad ID is required",
      };
    }

    const { error } = await supabase
      .from("housing_ad")
      .update({ is_active: isActive })
      .eq("id", adId);

    if (error) {
      console.error("Error toggling housing ad status:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Exception toggling housing ad status:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

