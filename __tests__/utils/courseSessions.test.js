import {
  checkinSuccessMessage,
  describeCourseSessions,
  formatSessionTime,
  sessionLabel,
  todaySessions,
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

describe("describeCourseSessions (base anterior: una sesión por día)", () => {
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

  it("sin `id` en las sesiones da una fila por día, en orden, con nombre, horario, lugar y estado", () => {
    const row = (date, label, status, extra = {}) => ({
      id: null,
      date,
      label,
      time: "",
      location: null,
      status,
      checkinOpen: false,
      ...extra,
    });
    expect(describeCourseSessions(summary)).toEqual([
      row("2026-11-08", "Sesión 1", "missed"),
      row("2026-11-09", "Teoría", "attended", { time: "09:00 – 14:00", location: "Aula 1" }),
      row("2026-11-10", "Sesión 3", "pending"),
      row("2026-11-11", "Sesión 4", "pending"),
    ]);
  });

  it("marca abierto el fichaje de hoy con checkin_open_now", () => {
    const rows = describeCourseSessions({ ...summary, checkin_open_now: true });
    expect(rows.filter((r) => r.checkinOpen).map((r) => r.date)).toEqual(["2026-11-10"]);
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
    expect(todaySessions(summary).map((s) => s.label)).toEqual(["Sesión 3"]);
    expect(todaySessions({ ...summary, today: "2026-12-01" })).toEqual([]);
    expect(todaySessions(null)).toEqual([]);
  });
});

describe("describeCourseSessions (varias sesiones el mismo día)", () => {
  const summary = {
    today: "2026-11-10",
    session_dates: ["2026-11-09", "2026-11-10"],
    attended_dates: ["2026-11-09", "2026-11-10"],
    attended_session_ids: ["s-0909", "s-1009"],
    open_session_ids: ["s-1016"],
    sessions: [
      // Desordenadas a propósito: la app ordena por día y hora de inicio.
      {
        id: "s-1016",
        session_date: "2026-11-10",
        title: null,
        starts_at: "16:00",
        ends_at: "18:00",
        location: "Aula 2",
      },
      {
        id: "s-0909",
        session_date: "2026-11-09",
        title: "Teoría",
        starts_at: "09:00",
        ends_at: "14:00",
        location: null,
      },
      {
        id: "s-0916",
        session_date: "2026-11-09",
        title: null,
        starts_at: "16:00",
        ends_at: "18:00",
        location: null,
      },
      {
        id: "s-1009",
        session_date: "2026-11-10",
        title: "Taller",
        starts_at: "09:00",
        ends_at: "11:00",
        location: null,
      },
    ],
  };

  it("da una fila por sesión, aunque compartan día, con su id y horario", () => {
    const rows = describeCourseSessions(summary);
    expect(rows.map((r) => [r.id, r.date, r.label, r.time])).toEqual([
      ["s-0909", "2026-11-09", "Teoría", "09:00 – 14:00"],
      ["s-0916", "2026-11-09", "Sesión 2", "16:00 – 18:00"],
      ["s-1009", "2026-11-10", "Taller", "09:00 – 11:00"],
      ["s-1016", "2026-11-10", "Sesión 4", "16:00 – 18:00"],
    ]);
  });

  it("marca la asistencia por id, no por día", () => {
    // attended_dates trae el 9 entero, pero solo fue a la sesión de la mañana.
    expect(describeCourseSessions(summary).map((r) => r.status)).toEqual([
      "attended",
      "missed",
      "attended",
      "pending",
    ]);
  });

  it("devuelve las dos sesiones de hoy y cuál tiene el fichaje abierto", () => {
    const today = todaySessions(summary);
    expect(today.map((s) => [s.id, s.status, s.checkinOpen])).toEqual([
      ["s-1009", "attended", false],
      ["s-1016", "pending", true],
    ]);
  });

  it("sin attended_session_ids no da nada por asistido", () => {
    const rows = describeCourseSessions({ ...summary, attended_session_ids: undefined });
    expect(rows.some((r) => r.status === "attended")).toBe(false);
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

  it("sin nombre de sesión usa su horario", () => {
    expect(
      checkinSuccessMessage({
        status: "checked_in",
        course_title: "Curso de ecografía",
        session_title: null,
        session_starts_at: "16:00",
        session_ends_at: "18:00",
      })
    ).toBe("Asistencia registrada: Curso de ecografía · 16:00 – 18:00.");
    expect(
      checkinSuccessMessage({
        status: "already_checked_in",
        course_title: "Curso de ecografía",
        session_title: "Taller",
        session_starts_at: "09:00",
        session_ends_at: "11:00",
      })
    ).toBe("Ya tenías registrada tu asistencia: Curso de ecografía · Taller.");
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
