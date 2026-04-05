import { printToFileAsync } from "expo-print";
import * as Sharing from "expo-sharing";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDate = (value) => {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const getEntryLabel = (entry, nodeNameMap) => {
  const nodeName = nodeNameMap.get(entry.node_id) || "Procedimiento";
  const count = entry.count || 0;
  const isNote = entry.kind === "note";
  const isChecklist = entry.kind === "checklist";

  if (isNote) {
    return `${nodeName} · nota`;
  }

  if (isChecklist) {
    return `${nodeName} · checklist`;
  }

  if (count > 0) {
    return `${nodeName} · +${count}`;
  }

  return `${nodeName} · ${count}`;
};

const buildHtml = ({
  specialtyName,
  userResidencyYear,
  nodeTree,
  entries,
  events,
  generatedAt,
}) => {
  const nodeNameMap = new Map();
  const totalActivities = nodeTree.reduce(
    (sum, category) => sum + (category.children || []).length,
    0
  );
  const totalCount = nodeTree.reduce(
    (sum, category) =>
      sum +
      (category.children || []).reduce(
        (childSum, child) => childSum + (child.total_count || 0),
        0
      ),
    0
  );

  nodeTree.forEach((category) => {
    nodeNameMap.set(category.id, category.name);
    (category.children || []).forEach((child) => {
      nodeNameMap.set(child.id, child.name);
    });
  });

  const sortedEntries = [...entries].sort((a, b) => {
    const first = new Date(b.performed_at || b.created_at || 0).getTime();
    const second = new Date(a.performed_at || a.created_at || 0).getTime();
    return first - second;
  });

  const recentEntries = sortedEntries.slice(0, 25);

  const sortedEvents = [...events].sort((a, b) => {
    const first = new Date(b.event_date || b.created_at || 0).getTime();
    const second = new Date(a.event_date || a.created_at || 0).getTime();
    return first - second;
  });

  const categorySections = nodeTree
    .map((category) => {
      const children = (category.children || [])
        .map((child) => {
          const goal = child.goal ? `/ ${child.goal}` : "";
          return `
            <tr>
              <td class="name-cell">${escapeHtml(child.name)}</td>
              <td>${escapeHtml(child.tracking_mode || "counter")}</td>
              <td>${child.total_count || 0} ${goal}</td>
            </tr>
          `;
        })
        .join("");

      const categoryCount = (category.children || []).reduce(
        (sum, child) => sum + (child.total_count || 0),
        0
      );

      return `
        <section class="category">
          <div class="category-header">
            <div>
              <h3>${escapeHtml(category.name)}</h3>
              <p>${(category.children || []).length} procedimientos</p>
            </div>
            <div class="category-total">${categoryCount} registros</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Procedimiento</th>
                <th>Tipo</th>
                <th>Progreso</th>
              </tr>
            </thead>
            <tbody>
              ${children || '<tr><td colspan="3">Sin procedimientos</td></tr>'}
            </tbody>
          </table>
        </section>
      `;
    })
    .join("");

  const entryRows = recentEntries
    .map(
      (entry) => `
        <tr>
          <td>${formatDate(entry.performed_at || entry.created_at)}</td>
          <td>${escapeHtml(getEntryLabel(entry, nodeNameMap))}</td>
          <td>${escapeHtml(entry.notes || "")}</td>
        </tr>
      `
    )
    .join("");

  const eventRows = sortedEvents
    .slice(0, 25)
    .map(
      (event) => `
        <tr>
          <td>${formatDate(event.event_date)}</td>
          <td>${escapeHtml(event.title || "Evento")}</td>
          <td>${escapeHtml(event.location || "")}</td>
          <td>${event.hours || ""}</td>
        </tr>
      `
    )
    .join("");

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
          h1, h2, h3, p {
            margin: 0;
          }
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
          .meta {
            color: #475569;
            margin-top: 8px;
          }
          .stats {
            width: 100%;
            margin: 18px 0 24px;
          }
          .stats td {
            width: 33.33%;
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
          .category {
            margin-bottom: 18px;
            page-break-inside: avoid;
          }
          .category-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 8px;
          }
          .category-header h3 {
            font-size: 16px;
            color: #1e1b4b;
          }
          .category-header p,
          .category-total {
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            margin-bottom: 18px;
          }
          th,
          td {
            text-align: left;
            padding: 10px 8px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
          }
          th {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.6px;
          }
          .name-cell {
            font-weight: 600;
          }
          .section-title {
            margin: 24px 0 10px;
            font-size: 16px;
            color: #1e1b4b;
          }
          .muted {
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <section class="header">
          <div class="eyebrow">Los Resis</div>
          <h1 class="title">Libro de residente</h1>
          <p>${escapeHtml(specialtyName || "Sin especialidad")}${
            userResidencyYear ? ` · R${userResidencyYear}` : ""
          }</p>
          <p class="meta">Exportado el ${formatDate(generatedAt)}</p>
        </section>

        <table class="stats" cellspacing="12">
          <tr>
            <td>
              <span class="stat-label">Rotaciones</span>
              <span class="stat-value">${nodeTree.length}</span>
            </td>
            <td>
              <span class="stat-label">Procedimientos</span>
              <span class="stat-value">${totalActivities}</span>
            </td>
            <td>
              <span class="stat-label">Registros</span>
              <span class="stat-value">${totalCount}</span>
            </td>
          </tr>
        </table>

        <h2 class="section-title">Resumen por rotación</h2>
        ${categorySections || '<p class="muted">No hay rotaciones para exportar.</p>'}

        <h2 class="section-title">Últimos registros</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Procedimiento</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            ${entryRows || '<tr><td colspan="3">Sin registros</td></tr>'}
          </tbody>
        </table>

        <h2 class="section-title">Eventos</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Título</th>
              <th>Ubicación</th>
              <th>Horas</th>
            </tr>
          </thead>
          <tbody>
            ${eventRows || '<tr><td colspan="4">Sin eventos</td></tr>'}
          </tbody>
        </table>
      </body>
    </html>
  `;
};

export const exportLibroToPdf = async ({
  specialtyName,
  userResidencyYear,
  nodeTree = [],
  entries = [],
  events = [],
}) => {
  const generatedAt = new Date().toISOString();
  const html = buildHtml({
    specialtyName,
    userResidencyYear,
    nodeTree,
    entries,
    events,
    generatedAt,
  });

  const file = await printToFileAsync({
    html,
    base64: false,
  });

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    return file;
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Compartir libro de residente",
    UTI: "com.adobe.pdf",
  });

  return file;
};

export default {
  exportLibroToPdf,
};
