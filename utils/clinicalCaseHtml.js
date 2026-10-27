import { escapeHtml } from "./html";
import {
  CLINICAL_CASE_BLOCKS,
  CLINICAL_CASE_REVIEW_FIELDS,
  CLINICAL_CASE_STATUS,
  REVIEW_OUTCOME_LABELS,
  displayStatusOf,
  formatCaseDate,
  reviewsOf,
} from "./clinicalCases";

/**
 * Los casos clínicos en el HTML de los PDF de la app (ClickUp 124b4z9vc4y,
 * fase 3): la ficha de un caso («Exportar PDF») y el apartado de cada año en el
 * PDF del Libro (services/libroPdfService.js). Funciones puras; el PDF lo
 * imprime services/clinicalCasePdfService.js.
 *
 * Solo van los campos de la ficha, que no tienen datos del paciente, y ningún
 * id. Los textos conservan sus saltos de línea (white-space: pre-wrap).
 */

const hasText = (value) => value !== null && value !== undefined && String(value).trim() !== "";

const IDENTIFICATION_KEYS = ["title", "case_date", "service", "rotation"];

/** De dónde sale el caso. */
export const caseOriginLabel = (clinicalCase, requirement) => {
  if (!clinicalCase?.requirement_id) return "Registro libre";
  if (!requirement || requirement.archived) return "Retirado por el hospital";
  return requirement.is_required ? "Caso pedido por el hospital" : "Caso opcional del hospital";
};

/**
 * Los bloques de la ficha con contenido, en el orden del formulario: la
 * descripción clínica y la reflexión. Sin campos vacíos.
 *
 * @returns {{ title: string, fields: { label: string, value: string }[] }[]}
 */
export const clinicalCaseContentBlocks = (clinicalCase) =>
  CLINICAL_CASE_BLOCKS.filter((block) => block.key !== "identification")
    .map((block) => ({
      title: block.key === "reflection" ? "Reflexión personal" : block.title,
      fields: block.fields
        .filter((field) => hasText(clinicalCase?.[field.key]))
        .map((field) => ({
          label: block.key === "reflection" ? "¿Qué he aprendido de este caso?" : field.label,
          value: String(clinicalCase[field.key]).trim(),
        })),
    }))
    .filter((block) => block.fields.length > 0);

/** «Información del caso»: título, fecha, servicio y rotación si los hay, origen y estado. */
export const clinicalCaseInfoRows = (clinicalCase, requirement) => {
  const labels = Object.fromEntries(
    CLINICAL_CASE_BLOCKS[0].fields.map((field) => [field.key, field.label])
  );
  const rows = IDENTIFICATION_KEYS.filter((key) => hasText(clinicalCase?.[key])).map((key) => ({
    label: key === "title" ? "Título" : labels[key],
    value:
      key === "case_date"
        ? formatCaseDate(clinicalCase.case_date) || "—"
        : String(clinicalCase[key]).trim(),
  }));
  return [
    ...rows,
    { label: "Origen", value: caseOriginLabel(clinicalCase, requirement) },
    { label: "Estado", value: CLINICAL_CASE_STATUS[displayStatusOf(clinicalCase)].label },
  ];
};

const infoTable = (rows) => `
  <table class="cc-info">
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr><td class="cc-label">${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>
`;

const paragraphs = (fields) =>
  fields
    .map(
      (field) => `
        <div class="cc-field">
          <div class="cc-field-label">${escapeHtml(field.label)}</div>
          <div class="cc-text">${escapeHtml(field.value)}</div>
        </div>
      `
    )
    .join("");

/** La ficha de un caso completado: información del caso, descripción y reflexión. */
export const renderClinicalCaseSheet = (clinicalCase, requirement) => `
  <h4 class="cc-block-title">Información del caso</h4>
  ${infoTable(clinicalCaseInfoRows(clinicalCase, requirement))}
  ${clinicalCaseContentBlocks(clinicalCase)
    .map(
      (block) => `
        <h4 class="cc-block-title">${escapeHtml(block.title)}</h4>
        ${paragraphs(block.fields)}
      `
    )
    .join("")}
`;

/** La última revisión del tutor; "" si no hay. */
export const renderLatestReview = (clinicalCase) => {
  const review = reviewsOf(clinicalCase)[0];
  if (!review) return "";
  const texts = CLINICAL_CASE_REVIEW_FIELDS.filter((field) => hasText(review[field.key])).map(
    (field) => ({ label: field.label, value: String(review[field.key]).trim() })
  );
  return `
    <section class="cc-review">
      <h4 class="cc-block-title">Revisión del tutor</h4>
      ${infoTable([
        { label: "Resultado", value: REVIEW_OUTCOME_LABELS[review.outcome] || review.outcome },
        { label: "Revisado por", value: review.reviewer_name || "Tutor" },
        { label: "Fecha", value: formatCaseDate(review.created_at) || "—" },
      ])}
      ${paragraphs(texts)}
    </section>
  `;
};

/** El estilo de la ficha, para meterlo en el <style> de cada PDF. */
export const CLINICAL_CASE_CSS = `
  .cc-block-title {
    font-size: 13px;
    color: #6d28d9;
    margin: 16px 0 6px;
    page-break-after: avoid;
  }
  table.cc-info { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
  table.cc-info td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.cc-label { width: 32%; color: #64748b; }
  .cc-field { margin: 0 0 10px; }
  .cc-field-label {
    font-size: 10px;
    font-weight: bold;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .cc-text { white-space: pre-wrap; word-wrap: break-word; }
  /* Los textos son largos: el apartado y la revisión se parten entre páginas. */
  .cc-review, .book.cc-book { page-break-inside: auto; }
  .cc-case { margin: 0 0 18px; }
  .cc-case-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #ddd6fe;
    padding-bottom: 4px;
  }
  .cc-case-header h4 { font-size: 13px; color: #1e1b4b; }
  .cc-status { font-weight: 600; color: #334155; }
  .cc-pending { color: #64748b; }
`;

/**
 * El HTML entero de «Exportar PDF» de un caso.
 */
export const buildClinicalCaseHtml = ({
  clinicalCase,
  requirement = null,
  hospitalName = null,
  residentName = "",
  specialtyName = null,
  includeReview = false,
  generatedAt = new Date().toISOString(),
}) => `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: Helvetica, Arial, sans-serif;
          color: #0f172a;
          padding: 28px;
          font-size: 12px;
          line-height: 1.5;
        }
        h1, h2, h3, h4, p { margin: 0; }
        .header {
          margin-bottom: 18px;
          padding: 20px;
          border: 1px solid #ddd6fe;
          border-radius: 16px;
          background: #f5f3ff;
        }
        .eyebrow {
          color: #6d28d9;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 6px;
        }
        .title { font-size: 22px; font-weight: bold; color: #1e1b4b; margin-bottom: 4px; }
        .meta { color: #475569; margin-top: 8px; }
        ${CLINICAL_CASE_CSS}
      </style>
    </head>
    <body>
      <section class="header">
        <div class="eyebrow">LosResis${hospitalName ? ` · ${escapeHtml(hospitalName)}` : ""}</div>
        <h1 class="title">Ficha de caso clínico</h1>
        <p>${escapeHtml(clinicalCase?.title || "")}</p>
        <p class="meta">Exportado el ${escapeHtml(formatCaseDate(generatedAt) || "")}</p>
      </section>

      <h4 class="cc-block-title">Datos identificativos</h4>
      ${infoTable([
        { label: "Hospital", value: hospitalName || "—" },
        { label: "Residente", value: residentName || "—" },
        { label: "Especialidad", value: specialtyName || "—" },
        { label: "Año de residencia", value: `R${clinicalCase?.residency_year || "—"}` },
      ])}

      ${renderClinicalCaseSheet(clinicalCase, requirement)}
      ${includeReview ? renderLatestReview(clinicalCase) : ""}
    </body>
  </html>
`;

const renderYearCase = (title, clinicalCase, requirement) => {
  const status = requirement?.archived
    ? "Retirado por el hospital"
    : CLINICAL_CASE_STATUS[displayStatusOf(clinicalCase)].label;
  // Solo un caso completado lleva su ficha; de un pendiente o un borrador no se
  // enseña nada (ni se inventa).
  const body =
    clinicalCase?.status === "completed" ? renderClinicalCaseSheet(clinicalCase, requirement) : "";
  return `
    <div class="cc-case">
      <div class="cc-case-header">
        <h4>${escapeHtml(title)}</h4>
        <span class="cc-status${clinicalCase ? "" : " cc-pending"}">${escapeHtml(status)}</span>
      </div>
      ${body}
    </div>
  `;
};

/**
 * El apartado «Casos clínicos» de un año del PDF del Libro: los pedidos en el
 * orden de la plantilla (los pendientes, marcados y sin contenido) y después
 * los demás. "" si el año no tiene ninguno.
 *
 * @param {{ rows: Array, freeCases: { clinicalCase: object, requirement: object|null }[] }} clinicalCases
 */
export const renderClinicalCasesForYear = (clinicalCases) => {
  const rows = clinicalCases?.rows || [];
  const freeCases = clinicalCases?.freeCases || [];
  if (!rows.length && !freeCases.length) return "";
  return `
    <section class="book cc-book">
      <div class="book-header">
        <h3>Casos clínicos</h3>
      </div>
      ${rows
        .map((row) => renderYearCase(row.requirement.title, row.clinicalCase, row.requirement))
        .join("")}
      ${freeCases.length && rows.length ? '<h4 class="detail-title">Otros casos clínicos</h4>' : ""}
      ${freeCases
        .map(({ clinicalCase, requirement }) =>
          renderYearCase(clinicalCase.title, clinicalCase, requirement)
        )
        .join("")}
    </section>
  `;
};
