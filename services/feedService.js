import { supabase } from "../config/supabase";

const FEED_IMAGES_BUCKET = "feed-images";

const firstRow = (data) => (Array.isArray(data) ? data[0] : data) || null;

// Resuelve la URL pública de una imagen de post a partir de su path en storage.
export const getFeedImageUrl = (imagePath) => {
  if (!imagePath) return null;
  return (
    supabase.storage.from(FEED_IMAGES_BUCKET).getPublicUrl(imagePath).data
      ?.publicUrl || null
  );
};

// Sube una imagen de post al bucket feed-images y devuelve su path (no la URL:
// el path es lo que persiste create_feed_post; la URL se deriva al pintar).
export const uploadFeedPostImage = async (userId, imageUri) => {
  try {
    const fileExt = (imageUri.split(".").pop() || "jpg").toLowerCase();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      name: fileName,
      type: `image/${fileExt}`,
    });

    const { error } = await supabase.storage
      .from(FEED_IMAGES_BUCKET)
      .upload(filePath, formData, { cacheControl: "3600", upsert: false });

    if (error) {
      return { success: false, path: null, error: error.message };
    }
    return { success: true, path: filePath, error: null };
  } catch (error) {
    return { success: false, path: null, error: error.message };
  }
};

// Crea un Post. Si se pasa imageUri, la sube primero y guarda su path.
export const createFeedPost = async ({ userId, body, imageUri } = {}) => {
  try {
    let imagePath = null;
    if (imageUri) {
      const upload = await uploadFeedPostImage(userId, imageUri);
      if (!upload.success) {
        return { success: false, error: upload.error };
      }
      imagePath = upload.path;
    }

    const { data, error } = await supabase.rpc("create_feed_post", {
      p_body: body,
      p_image_path: imagePath,
    });

    if (error) {
      // Si la imagen se subió pero el insert falló, limpiamos el huérfano.
      if (imagePath) {
        await supabase.storage.from(FEED_IMAGES_BUCKET).remove([imagePath]);
      }
      return { success: false, error: error.message };
    }

    const row = firstRow(data);
    return { success: true, postId: row?.id, createdAt: row?.created_at };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Borra un Post propio (los Chapós caen en cascada en la BD).
export const deleteFeedPost = async (postId) => {
  try {
    const { error } = await supabase.rpc("delete_feed_post", {
      p_post_id: postId,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Da o quita un Chapó (toggle) sobre un Post ('post') o una Actividad de guardia
// ('shift'). Devuelve el nuevo recuento y si el usuario lo tiene tras la operación.
export const toggleChapo = async (targetType, targetId) => {
  try {
    const { data, error } = await supabase.rpc("toggle_feed_chapo", {
      p_target_type: targetType,
      p_target_id: targetId,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const row = firstRow(data);
    return {
      success: true,
      chapoCount: row?.chapo_count ?? 0,
      viewerHasChapo: Boolean(row?.viewer_has_chapo),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Lee el feed unificado (Posts + Actividades de guardia) paginado por cursor.
// `before` es el activity_at del último ítem cargado (null en la primera página).
export const getFeed = async ({ limit = 20, before = null } = {}) => {
  try {
    const { data, error } = await supabase.rpc("get_feed", {
      p_limit: limit,
      p_before: before,
    });
    if (error) {
      return { success: false, items: [], error: error.message };
    }
    const items = (data || []).map((row) => ({
      type: row.item_type, // 'post' | 'shift'
      id: row.item_id,
      authorId: row.author_id,
      authorName: [row.author_name, row.author_surname]
        .filter(Boolean)
        .join(" ")
        .trim(),
      authorAvatarUrl: row.author_avatar_url || null,
      authorResidentYear: row.author_resident_year || null,
      activityAt: row.activity_at,
      body: row.body || null,
      imageUrl: getFeedImageUrl(row.image_path),
      shiftTitle: row.shift_title || null,
      shiftDate: row.shift_date || null,
      chapoCount: row.chapo_count ?? 0,
      viewerHasChapo: Boolean(row.viewer_has_chapo),
    }));
    return { success: true, items };
  } catch (error) {
    return { success: false, items: [], error: error.message };
  }
};

export default {
  getFeedImageUrl,
  uploadFeedPostImage,
  createFeedPost,
  deleteFeedPost,
  toggleChapo,
  getFeed,
};
