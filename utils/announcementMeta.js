/**
 * La línea gris bajo el título de un comunicado: quién lo manda, quién lo escribió
 * y cuándo. "UDM AFyC de Valencia. La Fe · Marta Ruiz · 12 nov".
 *
 * `sender_name` es el nombre de la organización que lo envía (hospital o unidad
 * docente). Llega null en los comunicados antiguos y no existe si la vista aún no
 * lo trae: en los dos casos la línea queda como antes, sin remitente.
 */
export const buildAnnouncementMeta = (item, sentAtLabel) =>
  [item?.sender_name, item?.created_by_name, sentAtLabel]
    .map((part) => (typeof part === "string" ? part.trim() : part))
    .filter(Boolean)
    .join(" · ");
