// ClickUp 124b4z9w0z0 (tarjetas de repaso de ResiNotes), pasada B: datos del residente de
// pruebas (solo los suyos).
// MODE=reset  → borra sus tarjetas (y sus repasos) y su configuración de repaso, y deja:
//                 Obstetricia/Eclampsia (mismo apunte que la pasada A),
//                 Obstetricia/Hipertensión/Preeclampsia (subcarpeta, una línea «Umbral: …»),
//                 Urgencias sin notas,
//               y una tarjeta a mano casi igual a la de «Manejo inicial» de Eclampsia (para
//               «Ya tienes una tarjeta parecida»).
// MODE=assert → comprueba en la BD lo que ha hecho el flujo: configuración guardada, tarjetas
//               de la carpeta guardadas nota a nota, «Mantener ambas», y que «Restablecer
//               programación» deja todas como nuevas sin borrar tarjetas ni repasos.
// Variables: E2E_EMAIL, E2E_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY (scripts/e2e.sh).

var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
if (res.status !== 200) throw new Error("Login falló: " + res.status);
var session = json(res.body);
var userId = session.user.id;
var headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + session.access_token,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
var rest = SUPABASE_URL + "/rest/v1/";
var own = "?user_id=eq." + userId;

function get(path) {
  var got = http.get(rest + path, { headers: headers });
  if (got.status !== 200) throw new Error("Lectura falló: " + got.status + " " + got.body);
  return json(got.body);
}

function post(table, body) {
  var created = http.post(rest + table, { headers: headers, body: JSON.stringify(body) });
  if (created.status !== 201) throw new Error("Alta en " + table + " falló: " + created.status + " " + created.body);
  return json(created.body)[0];
}

function del(path) {
  var done = http.delete(rest + path, { headers: headers });
  if (done.status !== 200 && done.status !== 204) throw new Error("Borrado falló: " + path + " " + done.status);
}

// Igual que htmlToPlainText de utils/resinotes.js (lo que guarda la app en content_text).
var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
function plain(html) {
  return String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|div|blockquote|tr|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, function (match, code) {
      var key = code.toLowerCase();
      if (ENTITIES[key] !== undefined) return ENTITIES[key];
      if (key.indexOf("#x") === 0) return String.fromCharCode(parseInt(key.slice(2), 16));
      if (key.indexOf("#") === 0) return String.fromCharCode(parseInt(key.slice(1), 10));
      return match;
    })
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

var ECLAMPSIA = [
  "<h2>Definición</h2>",
  "<p>Convulsiones tónico-clónicas en el contexto de preeclampsia, sin otra causa que lo explique.</p>",
  "<h2>Manejo inicial</h2>",
  "<ul><li><p>Estabilización materna (ABC).</p></li><li><p>Sulfato de magnesio.</p></li>",
  "<li><p>Control de la presión arterial.</p></li><li><p>Valoración de finalización de la gestación.</p></li></ul>",
  "<h2>Fármacos</h2>",
  "<table><tbody><tr><th><p>Fármaco</p></th><th><p>Dosis</p></th><th><p>Vía</p></th></tr>",
  "<tr><td><p>Sulfato de magnesio</p></td><td><p>4 g en 20 min</p></td><td><p>IV</p></td></tr>",
  "<tr><td><p>Labetalol</p></td><td><p>20 mg</p></td><td><p>IV</p></td></tr></tbody></table>",
  '<div data-callout="pearl"><p>Criterios de gravedad:</p><ul><li><p>TAS ≥ 160 mmHg</p></li><li><p>Plaquetas &lt; 100.000</p></li></ul></div>',
  "<p>Magnesemia objetivo: 4-7 mEq/L</p>",
].join("");

var PREECLAMPSIA = "<p>Umbral: TA ≥ 140/90 mmHg después de la semana 20.</p><p>Lo vimos en la sesión del martes con la adjunta.</p>";

var MANUAL_QUESTION = "¿Cuál es el manejo inicial de la eclampsia?";

function folder(name, parentId) {
  var q = "resinotes_folders" + own + "&deleted_at=is.null&name=eq." + encodeURIComponent(name) + "&select=id,parent_id";
  q += parentId ? "&parent_id=eq." + parentId : "&parent_id=is.null";
  var found = get(q)[0];
  return found || post("resinotes_folders", { user_id: userId, parent_id: parentId || null, name: name });
}

function noteByTitle(title) {
  return get("resinotes_items" + own + "&type=eq.note&deleted_at=is.null&title=eq." + encodeURIComponent(title) + "&select=id,folder_id")[0];
}

if (MODE === "reset") {
  del("resinotes_flashcards" + own);
  del("resinotes_review_preferences" + own);
  ["Eclampsia", "Caso sin estructura", "Preeclampsia"].forEach(function (title) {
    del("resinotes_items" + own + "&title=eq." + encodeURIComponent(title));
  });

  var obs = folder("Obstetricia", null);
  var hta = folder("Hipertensión", obs.id);
  folder("Urgencias", null);

  post("resinotes_items", { user_id: userId, folder_id: obs.id, type: "note", title: "Eclampsia", content: ECLAMPSIA, content_text: plain(ECLAMPSIA) });
  post("resinotes_items", {
    user_id: userId,
    folder_id: hta.id,
    type: "note",
    title: "Preeclampsia",
    content: PREECLAMPSIA,
    content_text: plain(PREECLAMPSIA),
  });
  post("resinotes_flashcards", {
    user_id: userId,
    question: MANUAL_QUESTION,
    answer: "Estabilización materna (ABC).\nSulfato de magnesio.\nControl de la presión arterial.\nValoración de finalización de la gestación.",
    origin: "manual",
  });
} else if (MODE === "assert") {
  var prefs = get("resinotes_review_preferences" + own + "&select=*")[0];
  if (!prefs) throw new Error("No se ha guardado la configuración");
  if (prefs.daily_card_limit !== 3) throw new Error("Tarjetas por día: " + prefs.daily_card_limit);
  if (prefs.review_enabled !== true) throw new Error("Repaso diario desactivado");
  if (prefs.reminders_enabled !== true) throw new Error("Recordatorios desactivados");
  if (String(prefs.reminder_time).indexOf("21:00") !== 0) throw new Error("Hora: " + prefs.reminder_time);
  if (JSON.stringify(prefs.active_weekdays) !== "[1,2,3,4,5,6]") throw new Error("Días: " + JSON.stringify(prefs.active_weekdays));
  if (prefs.included_folder_ids !== null) throw new Error("Carpetas: " + JSON.stringify(prefs.included_folder_ids));
  if (prefs.paused_until !== null) throw new Error("Sigue en pausa: " + prefs.paused_until);
  if (!/^[A-Za-z]+\/[A-Za-z_]+/.test(prefs.timezone)) throw new Error("Zona horaria: " + prefs.timezone);

  var cards = get(
    "resinotes_flashcards" + own +
      "&deleted_at=is.null&select=id,question,origin,source_item_id,due_on,interval_days,learning_state,review_count"
  );
  var ecl = noteByTitle("Eclampsia");
  var pre = noteByTitle("Preeclampsia");
  var fromEcl = cards.filter(function (c) {
    return c.source_item_id === ecl.id;
  });
  var fromPre = cards.filter(function (c) {
    return c.source_item_id === pre.id;
  });
  var manual = cards.filter(function (c) {
    return c.origin === "manual";
  });
  // Las 6 de Eclampsia (con la parecida, «Mantener ambas») y la de Preeclampsia; cada una con su nota.
  if (fromEcl.length !== 6) throw new Error("De Eclampsia: " + fromEcl.length);
  if (fromPre.length !== 1 || fromPre[0].question.indexOf("Umbral") < 0) throw new Error("De Preeclampsia: " + JSON.stringify(fromPre));
  if (manual.length !== 1 || manual[0].question !== MANUAL_QUESTION) throw new Error("La manual: " + JSON.stringify(manual));
  if (cards.length !== 8) throw new Error("Tarjetas: " + cards.length);
  var kept = fromEcl.filter(function (c) {
    return c.question.indexOf("Manejo inicial") >= 0;
  });
  if (kept.length !== 1) throw new Error("No se mantuvo la parecida");

  // Un repaso antes de restablecer; después, todas nuevas y el repaso sigue ahí.
  var reviews = get("resinotes_flashcard_reviews" + own + "&select=id");
  if (reviews.length !== 1) throw new Error("Repasos: " + reviews.length);
  var reviewed = cards.filter(function (c) {
    return c.review_count === 1;
  });
  if (reviewed.length !== 1) throw new Error("Contador de repasos tocado: " + JSON.stringify(reviewed));
  cards.forEach(function (c) {
    if (c.due_on !== null || c.interval_days !== 0 || c.learning_state !== "new") {
      throw new Error("No se restableció: " + JSON.stringify(c));
    }
  });
} else {
  throw new Error("MODE desconocido: " + MODE);
}
