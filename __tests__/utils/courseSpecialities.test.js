import {
  ALL_SPECIALITIES_LABEL,
  courseSpecialityOrFilter,
  formatCourseSpecialities,
  formatCourseSpecialityBadge,
  getCourseSpecialityNames,
} from "../../utils/courseSpecialities";

const CARDIO = "c1";
const MI = "m1";
const names = { [CARDIO]: "Cardiología", [MI]: "Medicina Interna" };
const lookup = (id) => (names[id] ? { id, name: names[id] } : null);

describe("courseSpecialityOrFilter", () => {
  it("matches courses that include the speciality or are for all", () => {
    expect(courseSpecialityOrFilter(CARDIO)).toBe(
      "all_specialities.eq.true,speciality_ids.cs.{c1}"
    );
  });
});

describe("getCourseSpecialityNames", () => {
  it("Todas wins over any id", () => {
    expect(
      getCourseSpecialityNames({ all_specialities: true, speciality_ids: [CARDIO] }, lookup)
    ).toEqual({ all: true, names: [] });
  });

  it("returns every selected speciality in order", () => {
    expect(
      getCourseSpecialityNames({ speciality_ids: [MI, CARDIO] }, lookup).names
    ).toEqual(["Medicina Interna", "Cardiología"]);
  });

  it("Ninguna: empty array means no speciality", () => {
    expect(getCourseSpecialityNames({ speciality_ids: [] }, lookup)).toEqual({
      all: false,
      names: [],
    });
  });

  it("course created before the change keeps its single speciality", () => {
    expect(
      getCourseSpecialityNames(
        { speciality_id: CARDIO, speciality: { id: CARDIO, name: "Cardiología" } },
        () => null
      ).names
    ).toEqual(["Cardiología"]);
  });

  it("ignores ids of deleted specialities", () => {
    expect(
      getCourseSpecialityNames({ speciality_ids: ["gone", CARDIO] }, lookup).names
    ).toEqual(["Cardiología"]);
  });

  it("uses the embedded speciality when the catalog misses it", () => {
    expect(
      getCourseSpecialityNames(
        { speciality_ids: ["new"], speciality: { id: "new", name: "Nueva" } },
        () => null
      ).names
    ).toEqual(["Nueva"]);
  });
});

describe("formatters", () => {
  const multi = { speciality_ids: [CARDIO, MI] };

  it("detail lists all specialities", () => {
    expect(formatCourseSpecialities(multi, lookup)).toBe(
      "Cardiología, Medicina Interna"
    );
    expect(formatCourseSpecialities({ all_specialities: true }, lookup)).toBe(
      ALL_SPECIALITIES_LABEL
    );
    expect(formatCourseSpecialities({ speciality_ids: [] }, lookup)).toBeNull();
  });

  it("badge shows the first one and how many more", () => {
    expect(formatCourseSpecialityBadge(multi, lookup)).toBe("Cardiología +1");
    expect(formatCourseSpecialityBadge({ speciality_ids: [MI] }, lookup)).toBe(
      "Medicina Interna"
    );
    expect(formatCourseSpecialityBadge({ all_specialities: true }, lookup)).toBe(
      ALL_SPECIALITIES_LABEL
    );
    expect(formatCourseSpecialityBadge({ speciality_ids: [] }, lookup)).toBeNull();
  });
});
