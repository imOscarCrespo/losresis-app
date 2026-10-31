/**
 * Hospitales que el Inicio del estudiante enseña en "Mejor match para ti" y
 * "También te puede interesar".
 *
 * Parte siempre del catálogo completo: los filtros que el usuario dejó en el
 * buscador de Hospitales no deben vaciar las secciones de Inicio.
 */

const hasRanking = (hospital) =>
  Boolean(hospital) &&
  (hospital.final_score !== null ||
    hospital.organic_score !== null ||
    hospital.blended_rank !== null);

/**
 * Orden por ranking del catálogo: primero los hospitales con ranking (por
 * final_score, organic_score y reseñas aprobadas) y luego por catalog_order.
 */
export const compareByRankingMetadata = (a, b, rankingByHospitalId = {}) => {
  const aRanking = rankingByHospitalId[a.id] || a;
  const bRanking = rankingByHospitalId[b.id] || b;
  const aRanked = hasRanking(aRanking);
  const bRanked = hasRanking(bRanking);

  if (aRanked && bRanked) {
    if ((bRanking.final_score ?? -1) !== (aRanking.final_score ?? -1)) {
      return (bRanking.final_score ?? -1) - (aRanking.final_score ?? -1);
    }
    if ((bRanking.organic_score ?? -1) !== (aRanking.organic_score ?? -1)) {
      return (bRanking.organic_score ?? -1) - (aRanking.organic_score ?? -1);
    }
    if (
      (bRanking.approved_review_count ?? 0) !==
      (aRanking.approved_review_count ?? 0)
    ) {
      return (
        (bRanking.approved_review_count ?? 0) -
        (aRanking.approved_review_count ?? 0)
      );
    }
  } else if (aRanked !== bRanked) {
    return aRanked ? -1 : 1;
  }

  return (a.catalog_order ?? 0) - (b.catalog_order ?? 0);
};

const BEST_MATCH_COUNT = 3;
const ALSO_INTERESTED_COUNT = 4;

/**
 * @param {Array} hospitals catálogo sin filtrar
 * @param {Object} ratings { [hospitalId]: { avgRating, reviewCount } }
 * @returns {{ bestMatch: Array, alsoInterested: Array }}
 */
export const getHomeHospitalSections = (hospitals, ratings = {}) => {
  const ranked = [...(Array.isArray(hospitals) ? hospitals : [])].sort((a, b) =>
    compareByRankingMetadata(a, b)
  );
  const safeRatings = ratings || {};

  const bestMatch = [...ranked]
    .sort(
      (a, b) =>
        (safeRatings[b.id]?.avgRating ?? 0) - (safeRatings[a.id]?.avgRating ?? 0)
    )
    .slice(0, BEST_MATCH_COUNT);

  const alsoInterested = ranked.slice(
    BEST_MATCH_COUNT,
    BEST_MATCH_COUNT + ALSO_INTERESTED_COUNT
  );

  return { bestMatch, alsoInterested };
};
