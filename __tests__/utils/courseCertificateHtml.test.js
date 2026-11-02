import {
  buildCourseCertificateHtml,
  certificateAttendancePhrase,
  courseDatesPhrase,
} from "../../utils/courseCertificateHtml";

const CERTIFICATE = {
  code: "AD2018BC73",
  issued_at: "2026-01-16T18:00:00+00:00",
  course_title: "Urgencias <básico>",
  attended_count: 4,
  session_count: 5,
};

const COURSE = {
  title: "Título renombrado después",
  event_dates: ["2026-01-14", "2026-01-12", "2026-01-16", "2026-01-13", "2026-01-15"],
  teaching_hours: "20 horas",
  organization: "Hospital E2E",
  course_directors: "Dra. Pérez",
};

describe("courseCertificateHtml", () => {
  it("asistencia: sesiones y % truncado", () => {
    expect(certificateAttendancePhrase(CERTIFICATE)).toBe("4 de 5 sesiones (80 %)");
    expect(certificateAttendancePhrase({ attended_count: 2, session_count: 3 })).toBe(
      "2 de 3 sesiones (66 %)"
    );
    expect(certificateAttendancePhrase({ attended_count: 1, session_count: 1 })).toBe(
      "1 de 1 sesión (100 %)"
    );
    expect(certificateAttendancePhrase({ attended_count: 0, session_count: 0 })).toBeNull();
  });

  it("fechas: del primer al último día, o un solo día", () => {
    expect(courseDatesPhrase(COURSE.event_dates)).toBe(
      "del 12 de enero de 2026 al 16 de enero de 2026"
    );
    expect(courseDatesPhrase(["2026-01-12"])).toBe("el 12 de enero de 2026");
    expect(courseDatesPhrase([])).toBeNull();
  });

  it("usa el título copiado al emitirlo, escapa el HTML y lleva nombre, código y datos", () => {
    const html = buildCourseCertificateHtml({
      certificate: CERTIFICATE,
      course: COURSE,
      residentName: "Ana <García>",
    });
    expect(html).toContain("Urgencias &lt;básico&gt;");
    expect(html).not.toContain("Título renombrado después");
    expect(html).toContain("Ana &lt;García&gt;");
    expect(html).toContain("AD2018BC73");
    expect(html).toContain("4 de 5 sesiones (80 %)");
    expect(html).toContain("20 horas");
    expect(html).toContain("Hospital E2E");
    expect(html).toContain("Dra. Pérez");
  });

  it("sin organización usa el hospital y omite lo que el curso no tiene", () => {
    const html = buildCourseCertificateHtml({
      certificate: { ...CERTIFICATE, course_title: null },
      course: { title: "Curso", event_dates: [], hospital: { name: "H. Ramón y Cajal" } },
      residentName: "Ana",
    });
    expect(html).toContain("H. Ramón y Cajal");
    expect(html).toContain(">Curso<");
    expect(html).not.toContain("Horas lectivas");
    expect(html).not.toContain("celebrado");
  });
});

describe("certificateFileName", () => {
  const { certificateFileName } = require("../../utils/courseCertificateHtml");
  it("nombre legible sin caracteres de ruta", () => {
    expect(certificateFileName("E2E · Curso con encuesta")).toBe(
      "Certificado - E2E · Curso con encuesta.pdf"
    );
    expect(certificateFileName("RCP: básico/avanzado?")).toBe(
      "Certificado - RCP básico avanzado.pdf"
    );
    expect(certificateFileName("")).toBe("Certificado de asistencia.pdf");
    expect(certificateFileName("x".repeat(200))).toHaveLength("Certificado - .pdf".length + 80);
  });
});
