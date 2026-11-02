import { escapeHtml } from "./html";
import { formatDateOnly } from "./dateUtils";

/**
 * HTML del certificado de asistencia a un curso (ClickUp 124b4z9vjxf). Función
 * pura; el PDF lo imprime services/courseCertificatePdfService.js.
 *
 * Las sesiones y el título salen de la copia que guardó la base al emitirlo
 * (`certificate`), así el certificado no cambia aunque luego cambie el curso.
 * El resto (organización, horas, fechas) es la ficha actual del curso.
 */

const hasText = (value) => value !== null && value !== undefined && String(value).trim() !== "";

/** «del 12 de enero de 2026 al 16 de enero de 2026» o «el 12 de enero de 2026». */
export const courseDatesPhrase = (eventDates) => {
  const dates = (Array.isArray(eventDates) ? eventDates : []).filter(Boolean).sort();
  if (dates.length === 0) return null;
  const first = formatDateOnly(dates[0]);
  const last = formatDateOnly(dates[dates.length - 1]);
  return first === last ? `el ${first}` : `del ${first} al ${last}`;
};

/** «4 de 5 sesiones (80 %)». */
export const certificateAttendancePhrase = (certificate) => {
  const attended = Number(certificate?.attended_count) || 0;
  const total = Number(certificate?.session_count) || 0;
  if (total <= 0) return null;
  const percent = Math.floor((attended * 100) / total);
  return `${attended} de ${total} ${total === 1 ? "sesión" : "sesiones"} (${percent} %)`;
};

export const buildCourseCertificateHtml = ({ certificate, course, residentName }) => {
  const title = hasText(certificate?.course_title) ? certificate.course_title : course?.title || "";
  const organizer = hasText(course?.organization)
    ? course.organization
    : course?.hospital?.name || null;
  const dates = courseDatesPhrase(course?.event_dates);
  const attendance = certificateAttendancePhrase(certificate);
  const hours = hasText(course?.teaching_hours) ? String(course.teaching_hours).trim() : null;

  const details = [
    organizer ? `organizado por <strong>${escapeHtml(organizer)}</strong>` : null,
    dates ? `celebrado ${escapeHtml(dates)}` : null,
  ].filter(Boolean);

  const rows = [
    hours ? ["Horas lectivas", hours] : null,
    attendance ? ["Asistencia", attendance] : null,
    hasText(course?.course_directors) ? ["Dirección del curso", course.course_directors] : null,
    hasText(course?.course_code) ? ["Código del curso", course.course_code] : null,
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Certificado de asistencia</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1e1b4b;
  }
  .page {
    width: 297mm;
    height: 209mm;
    padding: 14mm;
  }
  .frame {
    height: 100%;
    border: 2px solid #670cf5;
    border-radius: 10px;
    padding: 16mm 20mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #670cf5;
    font-weight: 700;
  }
  h1 { font-size: 34px; margin: 8px 0 22px; color: #1b0977; }
  .lead { font-size: 15px; line-height: 1.6; color: #334155; }
  .name { font-size: 26px; font-weight: 700; margin: 10px 0; color: #1e1b4b; }
  .course { font-size: 20px; font-weight: 700; margin: 10px 0 6px; color: #1b0977; }
  table { border-collapse: collapse; margin-top: 18px; }
  td { padding: 4px 18px 4px 0; font-size: 13px; vertical-align: top; }
  td.label { color: #64748b; }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 11px;
    color: #64748b;
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
  }
  .code { font-family: Menlo, Courier, monospace; color: #1e1b4b; font-size: 12px; }
</style>
</head>
<body>
<div class="page"><div class="frame">
  <div>
    <div class="eyebrow">LosResis</div>
    <h1>Certificado de asistencia</h1>
    <p class="lead">Se certifica que</p>
    <p class="name">${escapeHtml(residentName || "")}</p>
    <p class="lead">ha asistido al curso</p>
    <p class="course">${escapeHtml(title)}</p>
    ${details.length ? `<p class="lead">${details.join(", ")}.</p>` : ""}
    ${
      rows.length
        ? `<table>${rows
            .map(
              ([label, value]) =>
                `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
            )
            .join("")}</table>`
        : ""
    }
  </div>
  <div class="footer">
    <div>Emitido el ${escapeHtml(formatDateOnly(certificate?.issued_at))} tras completar la encuesta de satisfacción del curso.</div>
    <div>Código de verificación: <span class="code">${escapeHtml(certificate?.code || "")}</span></div>
  </div>
</div></div>
</body>
</html>`;
};
