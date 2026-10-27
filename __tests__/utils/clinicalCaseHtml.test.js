import {
  buildClinicalCaseHtml,
  caseOriginLabel,
  clinicalCaseContentBlocks,
  clinicalCaseInfoRows,
  renderClinicalCasesForYear,
} from "../../utils/clinicalCaseHtml";
import { portfolioRows } from "../../utils/clinicalCases";

const EPOC = {
  id: "req-epoc",
  title: "EPOC",
  is_required: true,
  tutor_review_enabled: true,
  position: 0,
  residency_year: 1,
  archived: false,
};

const completedCase = (overrides = {}) => ({
  id: "case-uuid-1234",
  user_id: "user-uuid-9999",
  requirement_id: "req-epoc",
  residency_year: 1,
  title: "EPOC",
  status: "completed",
  review_status: "reviewed",
  case_date: "2026-09-12",
  service: "Medicina Intensiva",
  rotation: "",
  chief_complaint: "Disnea de 48 h.\nAumento de secreciones.",
  relevant_history: "EPOC grave <GOLD 4> & exfumador.",
  physical_exam: "Tiraje.",
  complementary_tests: "Radiografía.",
  clinical_course: "Mejoría con VMNI.",
  final_diagnosis: "Reagudización de EPOC.",
  treatment_and_outcome: "Broncodilatadores.",
  reflection: "Aprendí la importancia de la valoración inicial.",
  completed_at: "2026-09-12T10:00:00Z",
  updated_at: "2026-09-15T10:00:00Z",
  reviews: [
    {
      id: "rev-1",
      reviewer_name: "Dra. Carme Merced",
      overall_assessment: "Falta la evolución.",
      outcome: "changes_requested",
      created_at: "2026-09-13T10:00:00Z",
    },
    {
      id: "rev-2",
      reviewer_name: "Dra. Carme Merced",
      overall_assessment: "Buen análisis del caso.",
      strengths: "Buen razonamiento clínico.",
      improvements: null,
      comments_for_resident: "Revisa los protocolos.",
      outcome: "reviewed",
      created_at: "2026-09-15T10:00:00Z",
    },
  ],
  ...overrides,
});

const html = (overrides = {}) =>
  buildClinicalCaseHtml({
    clinicalCase: completedCase(),
    requirement: EPOC,
    hospitalName: "Hospital de la Santa Creu i Sant Pau",
    residentName: "Laia García Huguet",
    specialtyName: "Medicina Intensiva",
    generatedAt: "2026-10-27T10:00:00Z",
    ...overrides,
  });

describe("ficha de un caso clínico en PDF", () => {
  it("lleva hospital, residente, especialidad, año, información del caso, descripción y reflexión", () => {
    const out = html();
    [
      "Hospital de la Santa Creu i Sant Pau",
      "Laia García Huguet",
      "Medicina Intensiva",
      "R1",
      "Información del caso",
      "12/09/2026",
      "Descripción clínica",
      "Motivo de consulta",
      "Tratamiento y evolución",
      "Reflexión personal",
      "Aprendí la importancia de la valoración inicial.",
    ].forEach((text) => expect(out).toContain(text));
  });

  it("escapa el texto del residente y conserva sus saltos de línea", () => {
    const out = html();
    expect(out).toContain("EPOC grave &lt;GOLD 4&gt; &amp; exfumador.");
    expect(out).not.toContain("<GOLD 4>");
    expect(out).toContain("Disnea de 48 h.\nAumento de secreciones.");
    expect(out).toContain("white-space: pre-wrap");
  });

  it("no inventa campos vacíos ni lleva ids", () => {
    const out = html();
    expect(out).not.toContain("Rotación asociada");
    expect(out).not.toContain("case-uuid-1234");
    expect(out).not.toContain("user-uuid-9999");
    expect(out).not.toContain("req-epoc");
    expect(clinicalCaseContentBlocks({ chief_complaint: "  " })).toEqual([]);
  });

  it("sin la revisión por defecto; con ella, solo la última", () => {
    expect(html()).not.toContain("Revisión del tutor");
    const out = html({ includeReview: true });
    expect(out).toContain("Revisión del tutor");
    expect(out).toContain("Buen análisis del caso.");
    expect(out).toContain("15/09/2026");
    expect(out).not.toContain("Falta la evolución.");
    expect(out).not.toContain("Aspectos a mejorar");
  });

  it("dice de dónde sale el caso", () => {
    expect(caseOriginLabel({ requirement_id: null }, null)).toBe("Registro libre");
    expect(caseOriginLabel({ requirement_id: "x" }, { archived: true })).toBe(
      "Retirado por el hospital"
    );
    expect(caseOriginLabel({ requirement_id: "x" }, EPOC)).toBe("Caso pedido por el hospital");
    expect(clinicalCaseInfoRows(completedCase(), EPOC).map((row) => row.label)).toEqual([
      "Título",
      "Fecha",
      "Servicio o unidad",
      "Origen",
      "Estado",
    ]);
  });
});

describe("casos clínicos de un año en el PDF del Libro", () => {
  const requirements = [
    EPOC,
    { ...EPOC, id: "req-ictus", title: "Ictus isquémico", position: 1 },
    { ...EPOC, id: "req-fra", title: "Fracaso renal agudo", position: 2 },
  ];
  const draft = {
    id: "draft",
    requirement_id: "req-ictus",
    residency_year: 1,
    title: "Ictus isquémico",
    status: "draft",
    chief_complaint: "Texto a medias que no debe salir",
  };

  it("en el orden de la plantilla, con los pendientes marcados y sin contenido", () => {
    const cases = [completedCase(), draft];
    const rows = portfolioRows(requirements, cases, 1);
    const out = renderClinicalCasesForYear({ rows, freeCases: [] });
    const epoc = out.indexOf("EPOC</h4>");
    const ictus = out.indexOf("Ictus isquémico</h4>");
    const fra = out.indexOf("Fracaso renal agudo</h4>");
    expect(epoc).toBeGreaterThan(-1);
    expect(ictus).toBeGreaterThan(epoc);
    expect(fra).toBeGreaterThan(ictus);
    expect(out).toContain("Revisado");
    expect(out).toContain("En progreso");
    expect(out.slice(fra)).toContain("Pendiente");
    expect(out).toContain("Aprendí la importancia de la valoración inicial.");
    expect(out).not.toContain("Texto a medias que no debe salir");
    expect(out).not.toContain("Revisión del tutor");
  });

  it("los demás casos van detrás; uno retirado lo dice", () => {
    const out = renderClinicalCasesForYear({
      rows: portfolioRows(requirements, [], 1),
      freeCases: [
        {
          clinicalCase: { ...completedCase({ id: "old", title: "Sepsis", requirement_id: "gone" }) },
          requirement: { id: "gone", archived: true },
        },
      ],
    });
    expect(out.indexOf("Otros casos clínicos")).toBeGreaterThan(out.indexOf("Fracaso renal agudo"));
    expect(out).toContain("Retirado por el hospital");
  });

  it("un año sin casos no pinta nada", () => {
    expect(renderClinicalCasesForYear({ rows: [], freeCases: [] })).toBe("");
    expect(renderClinicalCasesForYear(undefined)).toBe("");
  });
});
