import { printToFileAsync } from "expo-print";
import * as Sharing from "expo-sharing";

import { buildCourseCertificateHtml } from "../utils/courseCertificateHtml";

/**
 * «Descargar certificado» de un curso (ClickUp 124b4z9vjxf): genera el PDF con
 * expo-print y abre la hoja de compartir, como el PDF de un caso clínico.
 *
 * Devuelve el fichero aunque no haya hoja de compartir, para distinguir «no se
 * pudo generar» de «no se pudo compartir».
 */
export const exportCourseCertificateToPdf = async ({ certificate, course, residentName }) => {
  const html = buildCourseCertificateHtml({ certificate, course, residentName });

  // A4 apaisado en puntos.
  const file = await printToFileAsync({ html, base64: false, width: 842, height: 595 });

  if (!(await Sharing.isAvailableAsync())) {
    return file;
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Certificado de asistencia",
    UTI: "com.adobe.pdf",
  });

  return file;
};

export default {
  exportCourseCertificateToPdf,
};
