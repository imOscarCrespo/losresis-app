import { printToFileAsync } from "expo-print";
import * as Sharing from "expo-sharing";

import { buildClinicalCaseHtml } from "../utils/clinicalCaseHtml";

/**
 * «Exportar PDF» de un caso clínico (ClickUp 124b4z9vc4y, fase 3): genera la
 * ficha con expo-print y abre la hoja de compartir, como el PDF del Libro.
 *
 * Devuelve el fichero aunque no haya hoja de compartir, para distinguir «no se
 * pudo generar» de «no se pudo compartir».
 */
export const exportClinicalCaseToPdf = async ({
  clinicalCase,
  requirement = null,
  hospitalName = null,
  residentName = "",
  specialtyName = null,
  includeReview = false,
}) => {
  const html = buildClinicalCaseHtml({
    clinicalCase,
    requirement,
    hospitalName,
    residentName,
    specialtyName,
    includeReview,
    generatedAt: new Date().toISOString(),
  });

  const file = await printToFileAsync({ html, base64: false });

  if (!(await Sharing.isAvailableAsync())) {
    return file;
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Exportar caso clínico",
    UTI: "com.adobe.pdf",
  });

  return file;
};

export default {
  exportClinicalCaseToPdf,
};
