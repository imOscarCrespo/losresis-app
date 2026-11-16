import {
  catalogHospitalsForExplore,
  excludeTeachingUnits,
  isTeachingUnitName,
} from "../../utils/teachingUnits";

describe("teachingUnits", () => {
  it("reconoce los nombres de unidad docente del catálogo", () => {
    expect(isTeachingUnitName("Udm Afyc De Valencia. La Fe")).toBe(true);
    expect(isTeachingUnitName("UD Medicina Legal Y Forense. Granada")).toBe(true);
    expect(isTeachingUnitName("  ud mpysp de aragon")).toBe(true);
  });

  it("no confunde hospitales ni nombres vacíos", () => {
    expect(isTeachingUnitName("H. Universitario Miguel Servet")).toBe(false);
    expect(isTeachingUnitName("C.H. Universitario A Coruna")).toBe(false);
    expect(isTeachingUnitName("")).toBe(false);
    expect(isTeachingUnitName(null)).toBe(false);
  });

  it("quita las unidades docentes y deja los hospitales en su orden", () => {
    const hospitals = [
      { id: "1", name: "H. U. La Fe" },
      { id: "2", name: "Udm Afyc De Valencia. La Fe" },
      { id: "3", name: "H. Clinico Universitario De Valencia" },
      { id: "4" },
    ];

    expect(excludeTeachingUnits(hospitals).map((h) => h.id)).toEqual([
      "1",
      "3",
      "4",
    ]);
  });

  it("tolera una lista vacía o nula", () => {
    expect(excludeTeachingUnits(null)).toEqual([]);
    expect(excludeTeachingUnits([])).toEqual([]);
  });

  it("deja en el catálogo real solo hospitales", () => {
    const catalog = require("../../data/staticCatalog/hospitals.json");
    const visible = excludeTeachingUnits(catalog);

    expect(visible.length).toBeGreaterThan(150);
    expect(visible.length).toBeLessThan(catalog.length);
    expect(visible.some((h) => isTeachingUnitName(h.name))).toBe(false);
  });

  it("con especialidad elegida enseña las unidades docentes que la ofrecen (MFyC)", () => {
    const catalog = require("../../data/staticCatalog/hospitals.json");
    const links = require("../../data/staticCatalog/hospital_speciality.json");
    const mfyc = "a34a6d80-a608-48bc-93a2-415fcbb7148e";
    const offering = new Set(
      links.filter((l) => l.speciality_id === mfyc).map((l) => l.hospital_id)
    );
    const count = (list) => list.filter((h) => offering.has(h.id)).length;

    const withoutSpecialty = catalogHospitalsForExplore(catalog, {
      hideTeachingUnits: true,
    });
    const withSpecialty = catalogHospitalsForExplore(catalog, {
      hideTeachingUnits: true,
      selectedSpecialty: mfyc,
    });

    expect(withoutSpecialty.some((h) => isTeachingUnitName(h.name))).toBe(false);
    expect(count(withoutSpecialty)).toBeLessThan(10);
    expect(count(withSpecialty)).toBe(offering.size);
    expect(count(withSpecialty)).toBeGreaterThan(150);
  });

  it("sin hideTeachingUnits devuelve el catálogo entero", () => {
    const hospitals = [{ id: "1", name: "Ud X" }, { id: "2", name: "H. Y" }];
    expect(catalogHospitalsForExplore(hospitals)).toEqual(hospitals);
    expect(catalogHospitalsForExplore(null)).toEqual([]);
  });
});
