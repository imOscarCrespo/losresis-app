import { describeCourseAttendance } from "../../utils/courseMinAttendance";

const FIVE = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
const summary = (over = {}) => ({
  enrollment_mode: "in_app",
  is_enrolled: true,
  is_finished: true,
  session_dates: FIVE,
  attendance_percent: 80,
  min_attendance_percent: 80,
  meets_min_attendance: true,
  ...over,
});

describe("describeCourseAttendance", () => {
  it("curso con mínimo 80 % y 4 de 5: cumple", () => {
    expect(describeCourseAttendance(summary())).toEqual({
      percent: 80,
      minPercent: 80,
      meets: true,
      tone: "success",
      message: "Cumples la asistencia mínima para obtener el certificado.",
    });
  });

  it("mismo curso con 3 de 5, ya terminado: dice cuánto ha asistido y cuánto necesita", () => {
    const view = describeCourseAttendance(
      summary({ attendance_percent: 60, meets_min_attendance: false })
    );
    expect(view.meets).toBe(false);
    expect(view.tone).toBe("danger");
    expect(view.message).toBe(
      "Has asistido al 60 % de las sesiones. Para obtener el certificado necesitas un 80 %."
    );
  });

  it("curso en marcha sin llegar todavía: recuerda el mínimo sin darlo por perdido", () => {
    const view = describeCourseAttendance(
      summary({ is_finished: false, attendance_percent: 20, meets_min_attendance: false })
    );
    expect(view.tone).toBe("neutral");
    expect(view.message).toBe(
      "Para obtener el certificado necesitas asistir al 80 % de las sesiones."
    );
  });

  it("curso sin mínimo: solo el %", () => {
    expect(
      describeCourseAttendance(summary({ min_attendance_percent: null, attendance_percent: 40 }))
    ).toEqual({ percent: 40, minPercent: null, meets: true, tone: "neutral", message: null });
  });

  it("sin las claves nuevas (base antigua) se comporta como sin mínimo y 0 %", () => {
    const view = describeCourseAttendance({
      enrollment_mode: "in_app",
      is_enrolled: true,
      session_dates: FIVE,
    });
    expect(view).toMatchObject({ percent: 0, minPercent: null, message: null });
  });

  it("no inscrito, curso externo o sin días: nada que enseñar", () => {
    expect(describeCourseAttendance(summary({ is_enrolled: false }))).toBeNull();
    expect(describeCourseAttendance(summary({ enrollment_mode: "external" }))).toBeNull();
    expect(describeCourseAttendance(summary({ session_dates: [] }))).toBeNull();
    expect(describeCourseAttendance(null)).toBeNull();
  });
});
