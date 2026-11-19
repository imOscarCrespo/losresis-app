// Parte un texto libre en trozos de texto y enlaces, para que las URLs que
// escribe un organizador (p. ej. en «Más información» de un curso) se puedan
// pulsar. Reconoce `http(s)://...` y `www....`; la puntuación final («.», «,»,
// «)» sin abrir...) se queda fuera del enlace.

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'"»”’]+$/;

const trimUrl = (raw) => {
  let url = raw.replace(TRAILING_PUNCTUATION, "");
  // Un «)» final solo es de la URL si la URL abre paréntesis (Wikipedia...).
  while (url.endsWith(")") && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) {
    url = url.slice(0, -1).replace(TRAILING_PUNCTUATION, "");
  }
  return url;
};

export const splitTextLinks = (text) => {
  if (typeof text !== "string" || !text) return [];
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const value = trimUrl(match[0]);
    if (!value || /^www\.?$/i.test(value)) continue;
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    parts.push({ type: "link", value, href });
    last = match.index + value.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
};
