import {
  classifyCourseLoadError,
  getAgendaEventCourseId,
} from "../../utils/agendaCourseLink";

const USER = "user-1";
const courseDay = (overrides = {}) => ({
  id: "event-1",
  user_id: USER,
  event_type: "course",
  metadata: { course_id: "course-1", course_enrollment_id: "enr-1" },
  ...overrides,
});

describe("getAgendaEventCourseId", () => {
  it("devuelve el curso de un día de curso con inscripción", () => {
    expect(getAgendaEventCourseId(courseDay(), USER)).toBe("course-1");
  });

  it("no abre la ficha para un curso apuntado a mano", () => {
    expect(
      getAgendaEventCourseId(
        courseDay({ metadata: { course_id: "course-1" } }),
        USER,
      ),
    ).toBeNull();
  });

  it("no abre la ficha si el evento no guarda el curso", () => {
    expect(
      getAgendaEventCourseId(
        courseDay({ metadata: { course_enrollment_id: "enr-1" } }),
        USER,
      ),
    ).toBeNull();
  });

  it("deja igual los eventos que no son cursos", () => {
    expect(
      getAgendaEventCourseId(courseDay({ event_type: "tutoring" }), USER),
    ).toBeNull();
    expect(
      getAgendaEventCourseId(courseDay({ event_type: "shift" }), USER),
    ).toBeNull();
    expect(getAgendaEventCourseId(null, USER)).toBeNull();
  });

  it("no abre el curso de otra persona (evento compartido)", () => {
    expect(
      getAgendaEventCourseId(courseDay({ user_id: "other" }), USER),
    ).toBeNull();
  });
});

describe("classifyCourseLoadError", () => {
  it("un curso borrado u oculto ya no está disponible", () => {
    expect(classifyCourseLoadError({ code: "PGRST116" })).toBe("unavailable");
    expect(classifyCourseLoadError({ code: "22P02" })).toBe("unavailable");
  });

  it("sin conexión o error del servidor se puede reintentar", () => {
    expect(
      classifyCourseLoadError(new TypeError("Network request failed")),
    ).toBe("failed");
    expect(classifyCourseLoadError({ code: "500" })).toBe("failed");
    expect(classifyCourseLoadError(undefined)).toBe("failed");
  });
});
