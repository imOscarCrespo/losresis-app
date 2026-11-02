import {
  checkinSuccessMessage,
  describeCourseSessions,
  formatSessionTime,
  sessionLabel,
  todaySession,
} from "../../utils/courseSessions";

describe("formatSessionTime", () => {
  it("formatea el horario con lo que haya", () => {
    expect(formatSessionTime("09:00", "14:00")).toBe("09:00 – 14:00");
    expect(formatSessionTime("09:00:00", null)).toBe("Desde las 09:00");
    expect(formatSessionTime(null, "14:00")).toBe("Hasta las 14:00");
    expect(formatSessionTime(null, null)).toBe("");
  });
});

describe("sessionLabel", () => {
  it("usa el nombre o Sesión N", () => {
    expect(sessionLabel("Taller de suturas", 0)).toBe("Taller de suturas");
    expect(sessionLabel(null, 1)).toBe("Sesión 2");
    expect(sessionLabel("  ", 2)).toBe("Sesión 3");
  });
});

describe("describeCourseSessions", () => {
  const summary = {
    today: "2026-11-10",
    session_dates: ["2026-11-11", "2026-11-09", "2026-11-10", "2026-11-08"],
    attended_dates: ["2026-11-09"],
    sessions: [
      {
        session_date: "2026-11-09",
        title: "Teoría",
        starts_at: "09:00",
        ends_at: "14:00",
        location: "Aula 1",
      },
      { session_date: "2026-11-10", title: null, starts_at: null, ends_at: null, location: null },
    ],
  };

  it("da una fila por día, en orden, con nombre, horario, lugar y estado", () => {
    expect(describeCourseSessions(summary)).toEqual([
      { date: "2026-11-08", label: "Sesión 1", time: "", location: null, status: "missed" },
      {
        date: "2026-11-09",
        label: "Teoría",
        time: "09:00 – 14:00",
        location: "Aula 1",
        status: "attended",
      },
      { date: "2026-11-10", label: "Sesión 3", time: "", location: null, status: "pending" },
      { date: "2026-11-11", label: "Sesión 4", time: "", location: null, status: "pending" },
    ]);
  });

  it("con una base sin `sessions` enseña solo fechas y números de sesión", () => {
    const rows = describeCourseSessions({ ...summary, sessions: undefined });
    expect(rows.map((r) => r.label)).toEqual(["Sesión 1", "Sesión 2", "Sesión 3", "Sesión 4"]);
    expect(rows[1].status).toBe("attended");
  });

  it("sin resumen o sin días no hay filas", () => {
    expect(describeCourseSessions(null)).toEqual([]);
    expect(describeCourseSessions({ session_dates: [] })).toEqual([]);
  });

  it("encuentra la sesión de hoy", () => {
    expect(todaySession(summary)?.label).toBe("Sesión 3");
    expect(todaySession({ ...summary, today: "2026-12-01" })).toBeNull();
  });
});

describe("checkinSuccessMessage", () => {
  it("nombra el curso y la sesión", () => {
    expect(
      checkinSuccessMessage({
        status: "checked_in",
        course_title: "Curso de ecografía",
        session_title: "Sesión práctica",
      })
    ).toBe("Asistencia registrada: Curso de ecografía · Sesión práctica.");
  });

  it("dice que ya estaba registrada al escanear dos veces", () => {
    expect(
      checkinSuccessMessage({ status: "already_checked_in", course_title: "Curso de ecografía" })
    ).toBe("Ya tenías registrada tu asistencia: Curso de ecografía.");
  });

  it("sin títulos (base antigua) usa los mensajes de siempre", () => {
    expect(checkinSuccessMessage({ status: "checked_in" })).toBe(
      "Asistencia registrada. ¡Buen curso!"
    );
    expect(checkinSuccessMessage({ status: "already_checked_in" })).toBe(
      "Ya tenías la asistencia de hoy registrada."
    );
  });
});
