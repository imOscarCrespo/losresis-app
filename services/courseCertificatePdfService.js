import { printToFileAsync } from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

import { buildCourseCertificateHtml, certificateFileName } from "../utils/courseCertificateHtml";

// expo-print deja el PDF con un nombre aleatorio; se le pone uno legible para
// que al guardarlo o enviarlo se sepa qué es. Si no se puede, se comparte tal cual.
const renameForSharing = async (uri, fileName) => {
  try {
    const destination = new File(Paths.cache, fileName);
    await new File(uri).move(destination, { overwrite: true });
    return destination.uri;
  } catch (error) {
    console.error("Error renaming course certificate PDF:", error);
    return uri;
  }
};

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
  const printed = await printToFileAsync({ html, base64: false, width: 842, height: 595 });
  const title = certificate?.course_title || course?.title;
  const file = { ...printed, uri: await renameForSharing(printed.uri, certificateFileName(title)) };

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
