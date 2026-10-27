jest.mock("expo-print", () => ({ printToFileAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock("../../config/supabase", () => ({ supabase: {} }));

import { buildLibroArchiveHtml } from "../../services/libroPdfService";
import { clinicalCasesForArchiveYear } from "../../services/libroArchiveService";

const requirements = [
  { id: "epoc", title: "EPOC", is_required: true, position: 0, residency_year: 1, archived: false },
  { id: "fra", title: "Fracaso renal agudo", is_required: true, position: 1, residency_year: 1, archived: false },
  { id: "old", title: "Retirado", is_required: true, position: 2, residency_year: 1, archived: true },
];

const cases = [
  {
    id: "c1",
    requirement_id: "epoc",
    residency_year: 1,
    title: "EPOC",
    status: "completed",
    case_date: "2026-09-12",
    reflection: "Lo que aprendí del EPOC.",
  },
  { id: "c2", requirement_id: null, residency_year: 1, title: "Neumonía", status: "draft" },
  { id: "c3", requirement_id: "old", residency_year: 1, title: "Retirado", status: "draft" },
];

describe("casos clínicos en el PDF del Libro", () => {
  it("cada año lleva su portafolio y los demás casos, con su requisito si lo tenían", () => {
    const year = clinicalCasesForArchiveYear({ requirements, cases }, 1);
    expect(year.rows.map((row) => [row.requirement.id, row.status])).toEqual([
      ["epoc", "completed"],
      ["fra", "pending"],
    ]);
    expect(year.freeCases.map(({ clinicalCase, requirement }) => [clinicalCase.id, requirement?.id])).toEqual([
      ["c2", undefined],
      ["c3", "old"],
    ]);
  });

  it("el apartado sale al final del año y cuenta en el resumen", () => {
    const html = buildLibroArchiveHtml({
      archive: {
        booksByYear: [
          {
            residencyYear: 1,
            books: [],
            shifts: [],
            clinicalCases: clinicalCasesForArchiveYear({ requirements, cases }, 1),
          },
        ],
        unassignedShifts: [],
        totalBooks: 0,
        totalEntries: 0,
        totalShifts: 0,
        totalClinicalCases: 3,
      },
      specialtyName: "Medicina Intensiva",
      residentName: "Laia",
      currentResidencyYear: 1,
      generatedAt: "2026-10-27T10:00:00Z",
    });
    expect(html).toContain("<h3>Casos clínicos</h3>");
    expect(html).toContain('<span class="stat-label">Casos clínicos</span>');
    expect(html).toContain("Lo que aprendí del EPOC.");
    expect(html).toContain("Fracaso renal agudo");
    expect(html).toContain("Retirado por el hospital");
    expect(html).not.toContain("Este año no tiene apartados.");
  });

  it("sin casos clínicos el Libro no cambia", () => {
    const html = buildLibroArchiveHtml({
      archive: {
        booksByYear: [
          { residencyYear: 1, books: [], shifts: [], clinicalCases: { rows: [], freeCases: [] } },
        ],
        totalBooks: 0,
      },
      specialtyName: null,
      residentName: "",
      currentResidencyYear: 1,
      generatedAt: "2026-10-27T10:00:00Z",
    });
    expect(html).not.toContain("Casos clínicos");
    expect(html).toContain("Este año no tiene apartados.");
  });
});
