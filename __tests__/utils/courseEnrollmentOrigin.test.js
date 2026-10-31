import { describeCourseEnrollmentOrigin } from "../../utils/courseEnrollmentOrigin";

describe("describeCourseEnrollmentOrigin", () => {
  it("se inscribió el propio residente", () => {
    expect(describeCourseEnrollmentOrigin({ enrolled_by: "self" })).toBe(
      "Te inscribiste en este curso desde LosResis"
    );
  });

  it("le inscribió Docencia (uno a uno o en bloque): nombra el hospital", () => {
    expect(
      describeCourseEnrollmentOrigin({
        enrolled_by: "hospital",
        enrolled_by_name: "Hospital Universitario Ramón y Cajal",
      })
    ).toBe("Te ha inscrito Hospital Universitario Ramón y Cajal");
  });

  it("hospital sin nombre disponible: Docencia", () => {
    expect(describeCourseEnrollmentOrigin({ enrolled_by: "hospital" })).toBe(
      "Te ha inscrito Docencia"
    );
    expect(
      describeCourseEnrollmentOrigin({ enrolled_by: "hospital", enrolled_by_name: "  " })
    ).toBe("Te ha inscrito Docencia");
  });

  it("inscripción antigua sin origen: texto neutro", () => {
    expect(describeCourseEnrollmentOrigin({ course_enrollment_id: "x" })).toBe(
      "Estás inscrito en este curso"
    );
    expect(describeCourseEnrollmentOrigin(undefined)).toBe("Estás inscrito en este curso");
    expect(describeCourseEnrollmentOrigin({ enrolled_by: "otro" })).toBe(
      "Estás inscrito en este curso"
    );
  });
});
