import { supabase } from "../config/supabase";
import { FALLBACK_ROOMMATE_QUESTIONS } from "../constants/roommateQuestions";
import {
  buildAnswerMap,
  calculateRoommateCompatibility,
  normalizeBundle,
  serializeAnswerPayload,
} from "../utils/roommateUtils";

const PROFILE_SELECT = `
  *,
  user:users!roommate_profile_user_id_fkey(id, name, surname, city, hospital_id, speciality_id, resident_year),
  hospital:hospitals!roommate_profile_hospital_id_fkey(id, name, city),
  speciality:specialities!roommate_profile_speciality_id_fkey(id, name)
`;

const getQuestionMapByCode = (questions = []) =>
  questions.reduce((acc, question) => {
    acc[question.code] = question;
    return acc;
  }, {});

const groupByUserId = (items = []) =>
  items.reduce((acc, item) => {
    if (!acc[item.user_id]) {
      acc[item.user_id] = [];
    }
    acc[item.user_id].push(item);
    return acc;
  }, {});

const ROOMMATE_AVATAR_BUCKET = "roommate-avatar";

const buildAvatarPath = (userId, asset) => {
  const fileExt = asset?.fileName?.split(".").pop() || asset?.uri?.split(".").pop() || "jpg";
  return `${userId}/avatar_${Date.now()}.${String(fileExt).toLowerCase()}`;
};

const uploadRoommateAvatar = async (userId, asset, previousPath = null) => {
  const filePath = buildAvatarPath(userId, asset);
  const fileName = filePath.split("/").pop() || `avatar_${Date.now()}.jpg`;
  const fileExt = fileName.split(".").pop() || "jpg";
  const formData = new FormData();

  formData.append("file", {
    uri: asset.uri,
    name: fileName,
    type: asset?.mimeType || `image/${String(fileExt).toLowerCase()}`,
  });

  const { error: uploadError } = await supabase.storage
    .from(ROOMMATE_AVATAR_BUCKET)
    .upload(filePath, formData, {
      contentType: asset?.mimeType || `image/${String(fileExt).toLowerCase()}`,
      upsert: true,
    });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  if (previousPath && previousPath !== filePath) {
    await supabase.storage.from(ROOMMATE_AVATAR_BUCKET).remove([previousPath]);
  }

  return { success: true, path: filePath };
};

const normalizeText = (value, { allowEmpty = false } = {}) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed && !allowEmpty) return null;
  return trimmed;
};

const parseBundleForSave = (bundle) => {
  const normalized = normalizeBundle(bundle);
  const {
    user,
    hospital,
    speciality,
    created_at,
    updated_at,
    is_verified,
    avatar_asset,
    ...profileFields
  } = normalized.profile;

  const profile = {
    ...profileFields,
    headline: normalizeText(profileFields.headline),
    bio: normalizeText(profileFields.bio),
    about_home: normalizeText(profileFields.about_home),
    ideal_roommate: normalizeText(profileFields.ideal_roommate),
    dealbreakers: normalizeText(profileFields.dealbreakers),
    occupation_label: normalizeText(profileFields.occupation_label),
    age: profileFields.age ? Number(profileFields.age) : null,
    city: normalizeText(profileFields.city, { allowEmpty: true }),
    residency_year: profileFields.residency_year
      ? Number(profileFields.residency_year)
      : null,
    budget_min_eur: profileFields.budget_min_eur
      ? Number(profileFields.budget_min_eur)
      : null,
    budget_max_eur: profileFields.budget_max_eur
      ? Number(profileFields.budget_max_eur)
      : null,
    stay_length_months: profileFields.stay_length_months
      ? Number(profileFields.stay_length_months)
      : null,
    max_roommates: profileFields.max_roommates
      ? Number(profileFields.max_roommates)
      : null,
    move_in_date: normalizeText(profileFields.move_in_date),
    hospital_id: profileFields.hospital_id || null,
    speciality_id: profileFields.speciality_id || null,
    avatar_url: normalizeText(profileFields.avatar_url),
  };

  const search = {
    ...normalized.search,
    preferred_gender: normalized.search.preferred_gender || "any",
    preferred_city: normalizeText(normalized.search.preferred_city),
    min_age: normalized.search.min_age ? Number(normalized.search.min_age) : null,
    max_age: normalized.search.max_age ? Number(normalized.search.max_age) : null,
    budget_min_eur: normalized.search.budget_min_eur
      ? Number(normalized.search.budget_min_eur)
      : null,
    budget_max_eur: normalized.search.budget_max_eur
      ? Number(normalized.search.budget_max_eur)
      : null,
    min_cleanliness_level: normalized.search.min_cleanliness_level
      ? Number(normalized.search.min_cleanliness_level)
      : null,
    min_sociability_level: normalized.search.min_sociability_level
      ? Number(normalized.search.min_sociability_level)
      : null,
    move_in_from: normalizeText(normalized.search.move_in_from),
    move_in_to: normalizeText(normalized.search.move_in_to),
    preferred_sleep_schedule:
      normalized.search.preferred_sleep_schedule || "any",
    notes: normalizeText(normalized.search.notes),
  };

  return {
    profile,
    lifestyle: { ...normalized.lifestyle },
    search,
    answers: normalized.answers || {},
  };
};

export const getRoommateQuestions = async () => {
  try {
    const { data, error } = await supabase
      .from("roommate_question")
      .select("*")
      .eq("is_active", true)
      .order("step_number", { ascending: true })
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching roommate questions:", error);
      return {
        success: true,
        questions: FALLBACK_ROOMMATE_QUESTIONS,
        fallback: true,
      };
    }

    return {
      success: true,
      questions:
        data && data.length ? data : FALLBACK_ROOMMATE_QUESTIONS,
      fallback: !data?.length,
    };
  } catch (error) {
    console.error("Exception fetching roommate questions:", error);
    return {
      success: true,
      questions: FALLBACK_ROOMMATE_QUESTIONS,
      fallback: true,
    };
  }
};

export const getMyRoommateBundle = async (userId) => {
  try {
    const { data: profile, error: profileError } = await supabase
      .from("roommate_profile")
      .select(PROFILE_SELECT)
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching roommate profile:", profileError);
      return { success: false, error: profileError.message };
    }

    if (!profile) {
      return {
        success: true,
        bundle: null,
      };
    }

    const [
      { data: lifestyle, error: lifestyleError },
      { data: search, error: searchError },
      { questions },
      { data: answers, error: answersError },
    ] =
      await Promise.all([
        supabase
          .from("roommate_lifestyle_preference")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("roommate_search_preference")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        getRoommateQuestions(),
        supabase
          .from("roommate_question_answer")
          .select("*")
          .eq("user_id", userId),
      ]);

    if (lifestyleError || searchError || answersError) {
      const firstError = lifestyleError || searchError || answersError;
      console.error("Error fetching roommate related data:", firstError);
      return { success: false, error: firstError.message };
    }

    return {
      success: true,
      bundle: normalizeBundle({
        profile,
        lifestyle: lifestyle || {},
        search: search || {},
        answers: buildAnswerMap(answers || [], questions || []),
      }),
    };
  } catch (error) {
    console.error("Exception fetching roommate bundle:", error);
    return { success: false, error: error.message };
  }
};

export const saveRoommateBundle = async (userId, rawBundle) => {
  try {
    const { questions } = await getRoommateQuestions();
    const questionMapByCode = getQuestionMapByCode(questions);
    const bundle = parseBundleForSave(rawBundle);
    const avatarAsset = rawBundle?.profile?.avatar_asset;

    if (!bundle.profile.city?.trim()) {
      return {
        success: false,
        error: "La ciudad es obligatoria para activar tu perfil roomie.",
      };
    }

    if (avatarAsset?.uri) {
      const uploadResult = await uploadRoommateAvatar(
        userId,
        avatarAsset,
        bundle.profile.avatar_url
      );

      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }

      bundle.profile.avatar_url = uploadResult.path;
    }

    const { error: profileError } = await supabase
      .from("roommate_profile")
      .upsert(
        [{ user_id: userId, ...bundle.profile }],
        { onConflict: "user_id" }
      );

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    const { error: lifestyleError } = await supabase
      .from("roommate_lifestyle_preference")
      .upsert(
        [{ user_id: userId, ...bundle.lifestyle }],
        { onConflict: "user_id" }
      );

    if (lifestyleError) {
      return { success: false, error: lifestyleError.message };
    }

    const { error: searchError } = await supabase
      .from("roommate_search_preference")
      .upsert(
        [{ user_id: userId, ...bundle.search }],
        { onConflict: "user_id" }
      );

    if (searchError) {
      return { success: false, error: searchError.message };
    }

    const { error: deleteAnswersError } = await supabase
      .from("roommate_question_answer")
      .delete()
      .eq("user_id", userId);

    if (deleteAnswersError) {
      return { success: false, error: deleteAnswersError.message };
    }

    const answerRows = Object.entries(bundle.answers)
      .map(([questionCode, rawValue]) => {
        const question = questionMapByCode[questionCode];
        if (!question) return null;

        return {
          user_id: userId,
          question_id: question.id,
          ...serializeAnswerPayload(question, rawValue),
        };
      })
      .filter(Boolean)
      .filter((row) => {
        return (
          row.answer_text ||
          row.answer_number !== null ||
          row.answer_options?.length
        );
      });

    if (answerRows.length) {
      const { error: insertAnswersError } = await supabase
        .from("roommate_question_answer")
        .insert(answerRows);

      if (insertAnswersError) {
        return { success: false, error: insertAnswersError.message };
      }
    }

    return getMyRoommateBundle(userId);
  } catch (error) {
    console.error("Exception saving roommate bundle:", error);
    return { success: false, error: error.message };
  }
};

export const getRoommateSavedFilter = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("roommate_saved_filter")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, filters: data || null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const saveRoommateSavedFilter = async (userId, filters) => {
  try {
    const payload = {
      user_id: userId,
      preferred_city: filters.preferred_city || null,
      hospital_id: null,
      speciality_id: null,
      budget_max_eur: filters.budget_max_eur ? Number(filters.budget_max_eur) : null,
      move_in_from: null,
      move_in_to: null,
      min_cleanliness_level: filters.min_cleanliness_level
        ? Number(filters.min_cleanliness_level)
        : null,
      preferred_sleep_schedule: filters.preferred_sleep_schedule || "any",
      accepts_pets:
        typeof filters.accepts_pets === "boolean" ? filters.accepts_pets : null,
      accepts_smoking:
        typeof filters.accepts_smoking === "boolean"
          ? filters.accepts_smoking
          : null,
      only_verified: false,
    };

    const { error } = await supabase
      .from("roommate_saved_filter")
      .upsert([payload], { onConflict: "user_id" });

    if (error) {
      return { success: false, error: error.message };
    }

    return getRoommateSavedFilter(userId);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const applyCandidateFilters = (query, filters = {}, configuredCity = null) => {
  let nextQuery = query;
  const effectiveCity =
    normalizeText(configuredCity) || normalizeText(filters.preferred_city);

  if (effectiveCity) {
    nextQuery = nextQuery.ilike("city", effectiveCity);
  }
  if (filters.budget_max_eur) {
    nextQuery = nextQuery.lte("budget_max_eur", Number(filters.budget_max_eur));
  }

  return nextQuery;
};

export const getRoommateCandidates = async (userId, filters = {}) => {
  try {
    const [{ bundle: myBundle }, { questions }, swipesResponse] = await Promise.all([
      getMyRoommateBundle(userId),
      getRoommateQuestions(),
      supabase
        .from("roommate_swipe")
        .select("target_user_id")
        .eq("actor_user_id", userId),
    ]);

    const swipedIds = (swipesResponse.data || []).map((item) => item.target_user_id);

    let query = supabase
      .from("roommate_profile")
      .select(PROFILE_SELECT)
      .eq("is_active", true)
      .eq("is_visible", true)
      .neq("user_id", userId)
      .order("updated_at", { ascending: false });

    query = applyCandidateFilters(query, filters, myBundle?.profile?.city);

    if (swipedIds.length) {
      const idsClause = `(${swipedIds.map((id) => `"${id}"`).join(",")})`;
      query = query.not("user_id", "in", idsClause);
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      return { success: false, error: profilesError.message };
    }

    if (!profiles?.length) {
      return { success: true, candidates: [], myBundle };
    }

    const candidateIds = profiles.map((profile) => profile.user_id);
    const [{ data: lifestyles }, { data: answers }] = await Promise.all([
      supabase
        .from("roommate_lifestyle_preference")
        .select("*")
        .in("user_id", candidateIds),
      supabase
        .from("roommate_question_answer")
        .select("*")
        .in("user_id", candidateIds),
    ]);

    const lifestylesByUser = (lifestyles || []).reduce((acc, item) => {
      acc[item.user_id] = item;
      return acc;
    }, {});
    const answersByUser = groupByUserId(answers || []);

    const candidates = profiles
      .map((profile) => {
        const bundle = normalizeBundle({
          profile,
          lifestyle: lifestylesByUser[profile.user_id] || {},
          answers: buildAnswerMap(answersByUser[profile.user_id] || [], questions),
        });

        return {
          ...bundle,
          compatibility: calculateRoommateCompatibility(myBundle, bundle),
        };
      })
      .filter((candidate) => {
        const filtersCleanliness = filters.min_cleanliness_level
          ? Number(filters.min_cleanliness_level)
          : null;

        if (
          filtersCleanliness &&
          Number(candidate.lifestyle.cleanliness_level || 0) < filtersCleanliness
        ) {
          return false;
        }

        if (
          filters.preferred_sleep_schedule &&
          filters.preferred_sleep_schedule !== "any" &&
          candidate.lifestyle.sleep_schedule !== filters.preferred_sleep_schedule
        ) {
          return false;
        }

        if (
          typeof filters.accepts_pets === "boolean" &&
          filters.accepts_pets === false &&
          candidate.lifestyle.pets === "has_pet"
        ) {
          return false;
        }

        if (
          typeof filters.accepts_smoking === "boolean" &&
          filters.accepts_smoking === false &&
          candidate.lifestyle.smoking_habit !== "no"
        ) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.compatibility - left.compatibility);

    return {
      success: true,
      candidates,
      myBundle,
    };
  } catch (error) {
    console.error("Exception fetching roommate candidates:", error);
    return { success: false, error: error.message };
  }
};

export const saveRoommateSwipe = async (userId, targetUserId, decision) => {
  try {
    const { error: swipeError } = await supabase
      .from("roommate_swipe")
      .upsert(
        [
          {
            actor_user_id: userId,
            target_user_id: targetUserId,
            decision,
          },
        ],
        { onConflict: "actor_user_id,target_user_id" }
      );

    if (swipeError) {
      return { success: false, error: swipeError.message };
    }

    let isMatch = false;

    if (decision === "like") {
      const { data: reciprocalSwipe, error: reciprocalError } = await supabase
        .from("roommate_swipe")
        .select("id")
        .eq("actor_user_id", targetUserId)
        .eq("target_user_id", userId)
        .eq("decision", "like")
        .maybeSingle();

      if (reciprocalError) {
        return { success: false, error: reciprocalError.message };
      }

      if (reciprocalSwipe) {
        const sortedPair = [userId, targetUserId].sort();
        const { error: matchError } = await supabase
          .from("roommate_match")
          .upsert(
            [
              {
                user_low_id: sortedPair[0],
                user_high_id: sortedPair[1],
                initiator_user_id: userId,
                status: "active",
              },
            ],
            { onConflict: "user_low_id,user_high_id" }
          );

        if (matchError) {
          return { success: false, error: matchError.message };
        }

        isMatch = true;
      }
    }

    return { success: true, isMatch };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getRoommateMatches = async (userId) => {
  try {
    const [{ bundle: myBundle }, { questions }] = await Promise.all([
      getMyRoommateBundle(userId),
      getRoommateQuestions(),
    ]);

    const { data: matches, error: matchesError } = await supabase
      .from("roommate_match")
      .select("*")
      .eq("status", "active")
      .or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`)
      .order("matched_at", { ascending: false });

    if (matchesError) {
      return { success: false, error: matchesError.message };
    }

    if (!matches?.length) {
      return { success: true, matches: [] };
    }

    const otherIds = matches.map((match) =>
      match.user_low_id === userId ? match.user_high_id : match.user_low_id
    );

    const [{ data: profiles }, { data: lifestyles }, { data: answers }] =
      await Promise.all([
        supabase
          .from("roommate_profile")
          .select(PROFILE_SELECT)
          .in("user_id", otherIds),
        supabase
          .from("roommate_lifestyle_preference")
          .select("*")
          .in("user_id", otherIds),
        supabase
          .from("roommate_question_answer")
          .select("*")
          .in("user_id", otherIds),
      ]);

    const profilesByUser = (profiles || []).reduce((acc, profile) => {
      acc[profile.user_id] = profile;
      return acc;
    }, {});
    const lifestylesByUser = (lifestyles || []).reduce((acc, item) => {
      acc[item.user_id] = item;
      return acc;
    }, {});
    const answersByUser = groupByUserId(answers || []);

    const enrichedMatches = matches
      .map((match) => {
        const otherUserId =
          match.user_low_id === userId ? match.user_high_id : match.user_low_id;
        const bundle = normalizeBundle({
          profile: profilesByUser[otherUserId],
          lifestyle: lifestylesByUser[otherUserId] || {},
          answers: buildAnswerMap(answersByUser[otherUserId] || [], questions),
        });

        return {
          ...match,
          otherUserId,
          bundle,
          compatibility: calculateRoommateCompatibility(myBundle, bundle),
        };
      })
      .filter((match) => match.bundle?.profile?.user_id);

    return {
      success: true,
      matches: enrichedMatches,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
