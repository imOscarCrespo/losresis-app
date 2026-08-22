import { printToFileAsync } from "expo-print";
import * as Sharing from "expo-sharing";

import {
  getLibroFormFieldLabel,
  getLibroProgressLabel,
  getLibroSectionChildLabel,
  isLibroProgressDone,
} from "../data/libroSections";
import { getResidencyYearWindow } from "../utils/residencyYear";

/**
 * El archivo completo del Libro del Residente en PDF.
 *
 * Es UN solo generador y cubre TODO el libro: todos los años, todos los apartados.
 * Sustituye al export por apartado que había antes, que exportaba solo el que
 * estuviera abierto — un recibo de una parte de lo que el residente pierde al
 * Migrar a la plantilla, que borra el año entero.
 *
 * Pinta por arquetipo, porque el nivel "área → registro" solo existe en tree:
 * aplicarlo a itinerary o form daría tablas vacías (ADR 0025 del panel).
 */

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

/** "R2 · 2026/2027" cuando se puede anclar la ventana; "R2" cuando no. */
const yearHeading = (residencyYear, currentResidencyYear) => {
  const window = getResidencyYearWindow(residencyYear, currentResidencyYear);
  if (!window) return `R${residencyYear}`;

  return `R${residencyYear} · ${window.start.getFullYear()}/${window.end.getFullYear()}`;
};

/**
 * Los campos de un payload, ya etiquetados, sin los vacíos.
 *
 * Un adjunto se guarda como objeto ({path, name, mime, size}), así que hay que
 * sacarle el nombre: String() daría "[object Object]". El fichero en sí no puede
 * incrustarse —el bucket es privado y esto es un HTML que se imprime—, así que en el
 * PDF el adjunto aparece listado por su nombre.
 */
const payloadValue = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") {
    return value.name || value.path || "";
  }
  return String(value);
};

const payloadPairs = (payload = {}) =>
  Object.entries(payload || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ({
      label: getLibroFormFieldLabel(key),
      value: payloadValue(value),
    }))
    .filter((pair) => pair.value !== "");

const payloadInline = (payload) => {
  const pairs = payloadPairs(payload);
  if (!pairs.length) return "";

  return pairs
    .map((pair) => `${escapeHtml(pair.label)}: ${escapeHtml(pair.value)}`)
    .join(" · ");
};

const emptyRow = (columns, text) =>
  `<tr><td colspan="${columns}" class="muted">${escapeHtml(text)}</td></tr>`;

// ---------------------------------------------------------------------------
// Un renderizador por arquetipo.
// ---------------------------------------------------------------------------

/** tree: áreas de actividad con sus actividades contadas. Solo Actividad asistencial. */
const renderTree = (book) => {
  const childLabel = getLibroSectionChildLabel(book.section);

  const areas = (book.nodes || [])
    .map((area) => {
      const children = area.children || [];

      const rows = children.length
        ? children
            .map((child) => {
              const count = child.total_count || 0;
              const goal = child.goal ? ` / ${child.goal}` : "";
              const comments = (child.entries || [])
                .map((entry) => entry.notes)
                .filter(Boolean).length;

              return `
                <tr>
                  <td class="name-cell">${escapeHtml(child.name)}</td>
                  <td>${count}${goal}</td>
                  <td>${comments ? `${comments} con comentario` : ""}</td>
                </tr>
              `;
            })
            .join("")
        : emptyRow(3, `Sin ${childLabel}s`);

      const areaCount = children.reduce(
        (sum, child) => sum + (child.total_count || 0),
        0
      );

      return `
        <section class="area">
          <div class="area-header">
            <h4>${escapeHtml(area.name)}</h4>
            <span class="muted">${areaCount} registros</span>
          </div>
          <table>
            <thead>
              <tr><th>${escapeHtml(childLabel)}</th><th>Registros</th><th></th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  // El detalle de cada registro, que es lo que de verdad se pierde al migrar.
  const allEntries = (book.nodes || []).flatMap((area) => [
    ...(area.entries || []).map((entry) => ({ entry, name: area.name })),
    ...(area.children || []).flatMap((child) =>
      (child.entries || []).map((entry) => ({ entry, name: child.name }))
    ),
  ]);

  const detail = allEntries
    .sort(
      (a, b) =>
        new Date(b.entry.performed_at || b.entry.created_at || 0) -
        new Date(a.entry.performed_at || a.entry.created_at || 0)
    )
    .map(
      ({ entry, name }) => `
        <tr>
          <td>${formatDate(entry.performed_at || entry.created_at)}</td>
          <td class="name-cell">${escapeHtml(name)}</td>
          <td>${entry.count || 0}</td>
          <td>${escapeHtml(payloadInline(entry.payload))}</td>
          <td>${escapeHtml(entry.notes || "")}</td>
        </tr>
      `
    )
    .join("");

  return `
    ${areas || '<p class="muted">Este apartado no tiene contenido.</p>'}
    <h4 class="detail-title">Registros</h4>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>${escapeHtml(childLabel)}</th>
          <th>Nº</th>
          <th>Datos</th>
          <th>Comentario</th>
        </tr>
      </thead>
      <tbody>${detail || emptyRow(5, "Sin registros")}</tbody>
    </table>
  `;
};

/** itinerary: una ficha por elemento. Rotaciones y Competencias. */
const renderItinerary = (book) => {
  const isRotations = book.section === "rotations";

  const rows = (book.nodes || [])
    .map((node) => {
      const status = node.progress?.status || "pending";
      const done = isLibroProgressDone(book.section, status);
      const duration =
        node.duration_amount && node.duration_unit
          ? `${node.duration_amount} ${node.duration_unit === "weeks" ? "semanas" : "meses"}`
          : "";

      const middle = isRotations
        ? `<td>${escapeHtml(node.center || "")}</td><td>${escapeHtml(duration)}</td>`
        : `<td colspan="2">${escapeHtml(node.description || "")}</td>`;

      return `
        <tr>
          <td class="name-cell">${escapeHtml(node.name)}</td>
          ${middle}
          <td class="${done ? "done" : ""}">${escapeHtml(
            getLibroProgressLabel(book.section, status)
          )}</td>
          <td>${escapeHtml(payloadInline(node.progress?.payload))}</td>
        </tr>
      `;
    })
    .join("");

  const total = (book.nodes || []).length;
  const completed = (book.nodes || []).filter((node) =>
    isLibroProgressDone(book.section, node.progress?.status || "pending")
  ).length;

  return `
    <p class="muted progress-line">${completed} de ${total} completadas</p>
    <table>
      <thead>
        <tr>
          <th>${isRotations ? "Rotación" : "Competencia"}</th>
          ${isRotations ? "<th>Centro</th><th>Duración</th>" : '<th colspan="2">Descripción</th>'}
          <th>Estado</th>
          <th>Lo que ha añadido el residente</th>
        </tr>
      </thead>
      <tbody>${rows || emptyRow(5, "Tu tutor todavía no ha definido contenido.")}</tbody>
    </table>
  `;
};

/**
 * form: las filas las crea el residente, así que las columnas salen de los campos
 * que traiga cada registro. Cursos, Congresos, Sesiones clínicas e Investigación.
 */
const renderForm = (book) => {
  const entries = [...(book.entries || [])].sort(
    (a, b) =>
      new Date(b.performed_at || b.created_at || 0) -
      new Date(a.performed_at || a.created_at || 0)
  );

  if (!entries.length) {
    return '<p class="muted">Sin registros en este apartado.</p>';
  }

  const rows = entries
    .map((entry) => {
      const pairs = payloadPairs(entry.payload);
      const detail = pairs.length
        ? `<ul class="pairs">${pairs
            .map(
              (pair) =>
                `<li><span class="pair-label">${escapeHtml(pair.label)}</span> ${escapeHtml(pair.value)}</li>`
            )
            .join("")}</ul>`
        : '<span class="muted">Sin datos</span>';

      return `
        <tr>
          <td>${formatDate(entry.performed_at || entry.created_at)}</td>
          <td>${detail}</td>
          <td>${escapeHtml(entry.notes || "")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table>
      <thead><tr><th>Fecha</th><th>Datos</th><th>Observaciones</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

/** automatic: Guardias. No las escribe nadie a mano, salen de la Agenda. */
const renderShifts = (shifts = []) => {
  if (!shifts.length) {
    return '<p class="muted">Sin guardias registradas en este año.</p>';
  }

  const rows = shifts
    .map(
      (shift) => `
        <tr>
          <td>${formatDate(shift.event_date)}</td>
          <td>${escapeHtml(shift.metadata?.shift_duration || "")}</td>
          <td>${escapeHtml(shift.notes || "")}</td>
        </tr>
      `
    )
    .join("");

  return `
    <p class="muted progress-line">${shifts.length} guardias</p>
    <table>
      <thead><tr><th>Fecha</th><th>Duración</th><th>Observaciones</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

const renderBook = (book, shifts) => {
  const ownership =
    book.template_id
      ? "Estructura definida por tu tutor"
      : "Libro montado por ti";

  let body;
  switch (book.archetype) {
    case "itinerary":
      body = renderItinerary(book);
      break;
    case "form":
      body = renderForm(book);
      break;
    case "automatic":
      body = renderShifts(shifts);
      break;
    default:
      body = renderTree(book);
  }

  return `
    <section class="book">
      <div class="book-header">
        <h3>${escapeHtml(book.label)}</h3>
        <span class="badge">${escapeHtml(ownership)}</span>
      </div>
      ${body}
    </section>
  `;
};

const buildHtml = ({
  archive,
  specialtyName,
  residentName,
  currentResidencyYear,
  generatedAt,
}) => {
  const years = archive?.booksByYear || [];

  const yearSections = years
    .map((year) => {
      // Las guardias del año se pintan dentro del apartado Guardias si lo tiene; si
      // no lo tiene, van sueltas al final del año: son suyas aunque su plantilla no
      // incluya el apartado.
      const hasShiftsBook = year.books.some(
        (book) => book.archetype === "automatic"
      );

      const books = year.books
        .map((book) => renderBook(book, year.shifts))
        .join("");

      const loose =
        !hasShiftsBook && year.shifts.length
          ? `
            <section class="book">
              <div class="book-header">
                <h3>Guardias</h3>
                <span class="badge">Desde tu Agenda</span>
              </div>
              ${renderShifts(year.shifts)}
            </section>
          `
          : "";

      return `
        <section class="year">
          <h2 class="year-title">${escapeHtml(
            yearHeading(year.residencyYear, currentResidencyYear)
          )}</h2>
          ${books || '<p class="muted">Este año no tiene apartados.</p>'}
          ${loose}
        </section>
      `;
    })
    .join("");

  const orphanShifts = archive?.unassignedShifts || [];
  const orphanSection = orphanShifts.length
    ? `
      <section class="year">
        <h2 class="year-title">Guardias sin año asignado</h2>
        <p class="muted">
          Guardias anteriores a tu primer libro, o de un año que no se ha podido
          situar. Se incluyen para no dejarlas fuera.
        </p>
        ${renderShifts(orphanShifts)}
      </section>
    `
    : "";

  return `
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
            margin-bottom: 24px;
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
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #1e1b4b;
            margin-bottom: 6px;
          }
          .meta { color: #475569; margin-top: 8px; }
          .stats { width: 100%; margin: 18px 0 24px; }
          .stats td {
            width: 25%;
            padding: 14px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            background: #ffffff;
          }
          .stat-label {
            color: #64748b;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
          }
          .stat-value {
            display: block;
            font-size: 20px;
            font-weight: bold;
            color: #1e1b4b;
            margin-top: 6px;
          }
          .year { margin-bottom: 8px; page-break-before: always; }
          .year:first-of-type { page-break-before: avoid; }
          .year-title {
            font-size: 18px;
            color: #1e1b4b;
            margin: 22px 0 12px;
            padding-bottom: 6px;
            border-bottom: 2px solid #ddd6fe;
          }
          .book { margin-bottom: 22px; page-break-inside: avoid; }
          .book-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 8px;
          }
          .book-header h3 { font-size: 15px; color: #1e1b4b; }
          .badge {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #6d28d9;
            background: #f5f3ff;
            border-radius: 999px;
            padding: 3px 8px;
          }
          .area { margin: 0 0 12px; }
          .area-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 4px;
          }
          .area-header h4 { font-size: 13px; color: #334155; }
          .detail-title { font-size: 13px; color: #334155; margin-top: 14px; }
          .progress-line { margin-bottom: 6px; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            margin-bottom: 12px;
          }
          th, td {
            text-align: left;
            padding: 8px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
          }
          th {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.6px;
          }
          .name-cell { font-weight: 600; }
          .done { color: #059669; font-weight: 600; }
          .muted { color: #64748b; }
          ul.pairs { margin: 0; padding-left: 14px; }
          .pair-label { color: #64748b; }
        </style>
      </head>
      <body>
        <section class="header">
          <div class="eyebrow">LosResis</div>
          <h1 class="title">Libro del Residente</h1>
          <p>${escapeHtml(residentName || "")}${residentName ? " · " : ""}${escapeHtml(
            specialtyName || "Sin especialidad"
          )}${currentResidencyYear ? ` · R${currentResidencyYear}` : ""}</p>
          <p class="meta">Archivo completo, exportado el ${formatDate(generatedAt)}</p>
        </section>

        <table class="stats" cellspacing="12">
          <tr>
            <td>
              <span class="stat-label">Años</span>
              <span class="stat-value">${years.length}</span>
            </td>
            <td>
              <span class="stat-label">Apartados</span>
              <span class="stat-value">${archive?.totalBooks || 0}</span>
            </td>
            <td>
              <span class="stat-label">Registros</span>
              <span class="stat-value">${archive?.totalEntries || 0}</span>
            </td>
            <td>
              <span class="stat-label">Guardias</span>
              <span class="stat-value">${archive?.totalShifts || 0}</span>
            </td>
          </tr>
        </table>

        ${yearSections || '<p class="muted">Todavía no tienes nada en tu libro.</p>'}
        ${orphanSection}
      </body>
    </html>
  `;
};

/**
 * Genera el PDF y abre el share sheet.
 *
 * Devuelve el fichero incluso si no hay share sheet disponible, para que quien
 * llama pueda distinguir "no se pudo generar" de "no se pudo compartir".
 */
export const exportLibroArchiveToPdf = async ({
  archive,
  specialtyName,
  residentName,
  currentResidencyYear,
}) => {
  const html = buildHtml({
    archive,
    specialtyName,
    residentName,
    currentResidencyYear,
    generatedAt: new Date().toISOString(),
  });

  const file = await printToFileAsync({ html, base64: false });

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    return file;
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Guardar mi Libro del Residente",
    UTI: "com.adobe.pdf",
  });

  return file;
};

export default {
  exportLibroArchiveToPdf,
};
