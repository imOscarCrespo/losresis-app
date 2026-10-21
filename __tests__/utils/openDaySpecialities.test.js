import {
  buildOfferedSpecialityOptions,
  buildOpenDaySpecialityOptions,
  getAvailableSelectionIds,
  getRetiredSelectionIds,
  canConfirmOpenDaySpecialities,
  canEditOpenDaySpecialities,
  getSelectedSpecialityNames,
} from "../../utils/openDaySpecialities";

const SPECIALITIES = [
  { id: "card", name: "Cardiología" },
  { id: "mi", name: "Medicina Interna" },
  { id: "ped", name: "Pediatría" },
  { id: "anes", name: "Anestesiología" },
];

const HOSPITAL_SPECIALITIES = [
  { hospital_id: "h1", speciality_id: "ped" },
  { hospital_id: "h1", speciality_id: "card" },
  { hospital_id: "h1", speciality_id: "card" },
  { hospital_id: "h1", speciality_id: "mi" },
  { hospital_id: "h2", speciality_id: "anes" },
];

describe("buildOpenDaySpecialityOptions", () => {
  it("solo ofrece las especialidades vinculadas al hospital, sin repetir y por nombre", () => {
    expect(buildOpenDaySpecialityOptions("h1", HOSPITAL_SPECIALITIES, SPECIALITIES)).toEqual([
      { id: "card", name: "Cardiología" },
      { id: "mi", name: "Medicina Interna" },
      { id: "ped", name: "Pediatría" },
    ]);
  });

  it("un hospital sin especialidades vinculadas no tiene opciones", () => {
    expect(buildOpenDaySpecialityOptions("h3", HOSPITAL_SPECIALITIES, SPECIALITIES)).toEqual([]);
    expect(buildOpenDaySpecialityOptions(null, HOSPITAL_SPECIALITIES, SPECIALITIES)).toEqual([]);
  });

  it("descarta relaciones a especialidades que no están en el catálogo", () => {
    const rows = [...HOSPITAL_SPECIALITIES, { hospital_id: "h2", speciality_id: "gone" }];
    expect(buildOpenDaySpecialityOptions("h2", rows, SPECIALITIES)).toEqual([
      { id: "anes", name: "Anestesiología" },
    ]);
  });
});

describe("canEditOpenDaySpecialities", () => {
  it("se puede modificar hasta el día anterior a la jornada", () => {
    expect(canEditOpenDaySpecialities("2026-11-05", "2026-11-04")).toBe(true);
  });

  it("el día de la jornada y después la selección es de solo lectura", () => {
    expect(canEditOpenDaySpecialities("2026-11-05", "2026-11-05")).toBe(false);
    expect(canEditOpenDaySpecialities("2026-11-05", "2026-11-06")).toBe(false);
  });

  it("sin fecha no deja modificar", () => {
    expect(canEditOpenDaySpecialities(null, "2026-11-05")).toBe(false);
  });
});

describe("canConfirmOpenDaySpecialities", () => {
  const options = [{ id: "card" }, { id: "mi" }, { id: "ped" }];

  it("pide al menos una especialidad si el hospital tiene", () => {
    expect(canConfirmOpenDaySpecialities([], options)).toBe(false);
    expect(canConfirmOpenDaySpecialities(["otra"], options)).toBe(false);
  });

  it("acepta varias sin límite", () => {
    expect(canConfirmOpenDaySpecialities(["card", "mi", "ped"], options)).toBe(true);
  });

  it("sin especialidades en el hospital no bloquea la inscripción", () => {
    expect(canConfirmOpenDaySpecialities([], [])).toBe(true);
  });
});

describe("getSelectedSpecialityNames", () => {
  it("devuelve los nombres en el orden de las opciones e ignora ids desconocidos", () => {
    const options = buildOpenDaySpecialityOptions("h1", HOSPITAL_SPECIALITIES, SPECIALITIES);
    expect(getSelectedSpecialityNames(["ped", "x", "card"], options)).toEqual([
      "Cardiología",
      "Pediatría",
    ]);
  });
});

describe("especialidades participantes de la jornada", () => {
  const HOSPITAL = SPECIALITIES.slice(0, 3);

  it("el hospital tiene 7 y ofrece 3: el estudiante ve solo esas 3, por nombre", () => {
    const offered = [
      { id: "ped", name: "Pediatría" },
      { id: "anes", name: "Anestesiología" },
      { id: "mi", name: "Medicina Interna" },
      { id: "mi", name: "Medicina Interna" },
    ];
    expect(buildOfferedSpecialityOptions(offered, HOSPITAL).map((o) => o.name)).toEqual([
      "Anestesiología",
      "Medicina Interna",
      "Pediatría",
    ]);
  });

  it("sin elegir (jornadas antiguas) mantiene todas las del hospital", () => {
    expect(buildOfferedSpecialityOptions([], HOSPITAL)).toBe(HOSPITAL);
    expect(buildOfferedSpecialityOptions(undefined, HOSPITAL)).toBe(HOSPITAL);
    expect(buildOfferedSpecialityOptions(undefined, undefined)).toEqual([]);
  });

  it("detecta lo marcado que la jornada ya no ofrece, sin borrarlo", () => {
    const options = [{ id: "mi", name: "Medicina Interna" }];
    expect(getRetiredSelectionIds(["card", "mi"], options)).toEqual(["card"]);
    expect(getRetiredSelectionIds(["mi"], options)).toEqual([]);
    // Inscripción general: no hay nada retirado.
    expect(getRetiredSelectionIds(["card"], [])).toEqual([]);
  });

  it("al modificar solo se premarca lo que sigue disponible", () => {
    const options = [{ id: "mi", name: "Medicina Interna" }];
    expect(getAvailableSelectionIds(["card", "mi"], options)).toEqual(["mi"]);
    expect(canConfirmOpenDaySpecialities(getAvailableSelectionIds(["card"], options), options)).toBe(
      false
    );
  });
});
