/**
 * PDFs del curso que sube el organizador desde el panel: tres huecos opcionales,
 * un PDF en cada uno. Los valores de `kind` son los del CHECK de `course_document`
 * en losresis-db (20261102120000_course_documents.sql).
 */
export const COURSE_DOCUMENT_SLOTS = [
  { kind: "info", label: "Información del curso" },
  { kind: "program", label: "Programa" },
  { kind: "review_material", label: "Material para revisar" },
];

/**
 * Los documentos en el orden de los huecos y con su nombre visible. Los huecos
 * sin PDF no aparecen, y un `kind` desconocido (de una versión futura) tampoco.
 */
export const orderCourseDocuments = (rows) =>
  COURSE_DOCUMENT_SLOTS.flatMap((slot) => {
    const row = (rows || []).find((r) => r?.kind === slot.kind && r?.storage_path);
    return row ? [{ ...row, label: slot.label }] : [];
  });
