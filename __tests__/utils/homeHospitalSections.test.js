import {
  compareByRankingMetadata,
  getHomeHospitalSections,
} from "../../utils/homeHospitalSections";

const hospital = (id, overrides = {}) => ({
  id,
  name: `Hospital ${id}`,
  catalog_order: Number(id.replace(/\D/g, "")) || 0,
  final_score: null,
  organic_score: null,
  blended_rank: null,
  ...overrides,
});

const catalog = (n) =>
  Array.from({ length: n }, (_, i) => hospital(`h${i + 1}`));

const ids = (list) => list.map((h) => h.id);

describe("getHomeHospitalSections", () => {
  it("sin hospitales (catálogo vacío o error al cargar) devuelve las dos secciones vacías", () => {
    expect(getHomeHospitalSections([], {})).toEqual({
      bestMatch: [],
      alsoInterested: [],
    });
    expect(getHomeHospitalSections(undefined, undefined)).toEqual({
      bestMatch: [],
      alsoInterested: [],
    });
  });

  it("con 2 hospitales llena Mejor match y deja vacía También te puede interesar", () => {
    const { bestMatch, alsoInterested } = getHomeHospitalSections(catalog(2));
    expect(ids(bestMatch)).toEqual(["h1", "h2"]);
    expect(alsoInterested).toEqual([]);
  });

  it("con 3 hospitales También te puede interesar queda vacía", () => {
    const { bestMatch, alsoInterested } = getHomeHospitalSections(catalog(3));
    expect(bestMatch).toHaveLength(3);
    expect(alsoInterested).toEqual([]);
  });

  it("con el catálogo completo También te puede interesar enseña 4 tarjetas (puestos 4 a 7 del ranking)", () => {
    const { bestMatch, alsoInterested } = getHomeHospitalSections(catalog(8));
    expect(ids(bestMatch)).toEqual(["h1", "h2", "h3"]);
    expect(ids(alsoInterested)).toEqual(["h4", "h5", "h6", "h7"]);
  });

  it("ordena por ranking aunque el catálogo llegue desordenado", () => {
    const list = [
      hospital("h1"),
      hospital("h2", { final_score: 10 }),
      hospital("h3", { final_score: 90 }),
      hospital("h4"),
      hospital("h5", { final_score: 50 }),
    ];
    const { bestMatch, alsoInterested } = getHomeHospitalSections(list);
    expect(ids(bestMatch)).toEqual(["h3", "h5", "h2"]);
    expect(ids(alsoInterested)).toEqual(["h1", "h4"]);
  });

  it("Mejor match ordena por nota media de las reseñas", () => {
    const ratings = { h5: { avgRating: 4.9 }, h2: { avgRating: 4.1 } };
    const { bestMatch } = getHomeHospitalSections(catalog(8), ratings);
    expect(ids(bestMatch)).toEqual(["h5", "h2", "h1"]);
  });

  it("no modifica el array recibido", () => {
    const list = [hospital("h2"), hospital("h1")];
    getHomeHospitalSections(list);
    expect(ids(list)).toEqual(["h2", "h1"]);
  });
});

describe("compareByRankingMetadata", () => {
  it("pone los hospitales con ranking antes que los que no lo tienen", () => {
    const ranked = hospital("h9", { organic_score: 1 });
    const unranked = hospital("h1");
    expect(compareByRankingMetadata(ranked, unranked)).toBeLessThan(0);
  });

  it("desempata por reseñas aprobadas y después por catalog_order", () => {
    const a = hospital("h1", { final_score: 5, approved_review_count: 2 });
    const b = hospital("h2", { final_score: 5, approved_review_count: 7 });
    expect(compareByRankingMetadata(a, b)).toBeGreaterThan(0);
    expect(compareByRankingMetadata(hospital("h1"), hospital("h2"))).toBeLessThan(0);
  });

  it("usa el ranking por especialidad cuando se le pasa", () => {
    const a = hospital("h1");
    const b = hospital("h2");
    const scoped = { h2: { final_score: 3 } };
    expect(compareByRankingMetadata(a, b, scoped)).toBeGreaterThan(0);
  });
});
