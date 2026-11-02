// ClickUp 124b4z9w0z0 (tarjetas de repaso de ResiNotes): datos del residente de pruebas (solo los suyos).
// MODE=reset  → borra todas sus tarjetas (y con ellas sus repasos), y deja en la carpeta
//               «Obstetricia» dos apuntes nuevos: «Eclampsia» (títulos, lista, tabla, bloque
//               especial y una línea «Término: definición») y «Caso sin estructura» (prosa).
// MODE=modify → edita «Eclampsia» quitando «Sulfato de magnesio.» de «Manejo inicial», como si
//               el residente hubiera editado el apunte: la tarjeta de ese apartado pasa a
//               «Fuente modificada».
// MODE=assert → comprueba en la BD lo que ha hecho el flujo (orígenes, repasos, intervalos,
//               fuente mantenida, tarjeta suspendida y la manual).
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

function patch(path, body) {
  var done = http.request(rest + path, { method: "PATCH", headers: headers, body: JSON.stringify(body) });
  if (done.status !== 200) throw new Error("Cambio falló: " + done.status + " " + done.body);
  return json(done.body);
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
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function eclampsia(withMagnesium) {
  return [
    "<h2>Definición</h2>",
    "<p>Convulsiones tónico-clónicas en el contexto de preeclampsia, sin otra causa que lo explique.</p>",
    "<h2>Manejo inicial</h2>",
    "<ul><li><p>Estabilización materna (ABC).</p></li>",
    withMagnesium ? "<li><p>Sulfato de magnesio.</p></li>" : "",
    "<li><p>Control de la presión arterial.</p></li><li><p>Valoración de finalización de la gestación.</p></li></ul>",
    "<h2>Fármacos</h2>",
    "<table><tbody><tr><th><p>Fármaco</p></th><th><p>Dosis</p></th><th><p>Vía</p></th></tr>",
    "<tr><td><p>Sulfato de magnesio</p></td><td><p>4 g en 20 min</p></td><td><p>IV</p></td></tr>",
    "<tr><td><p>Labetalol</p></td><td><p>20 mg</p></td><td><p>IV</p></td></tr></tbody></table>",
    '<div data-callout="pearl"><p>Criterios de gravedad:</p><ul><li><p>TAS ≥ 160 mmHg</p></li><li><p>Plaquetas &lt; 100.000</p></li></ul></div>',
    "<p>Magnesemia objetivo: 4-7 mEq/L</p>",
  ].join("");
}

function noteByTitle(title) {
  return get("resinotes_items" + own + "&type=eq.note&deleted_at=is.null&title=eq." + encodeURIComponent(title) + "&select=id,updated_at")[0];
}

if (MODE === "reset") {
  var delCards = http.delete(rest + "resinotes_flashcards" + own, { headers: headers });
  if (delCards.status !== 200 && delCards.status !== 204) throw new Error("Borrado de tarjetas falló: " + delCards.status);

  ["Eclampsia", "Caso sin estructura"].forEach(function (title) {
    var del = http.delete(rest + "resinotes_items" + own + "&title=eq." + encodeURIComponent(title), { headers: headers });
    if (del.status !== 200 && del.status !== 204) throw new Error("Borrado de «" + title + "» falló: " + del.status);
  });

  var folder = get("resinotes_folders" + own + "&deleted_at=is.null&name=eq.Obstetricia&select=id")[0];
  if (!folder) folder = post("resinotes_folders", { user_id: userId, name: "Obstetricia", emoji: "🤰", color: "pink" });

  var html = eclampsia(true);
  post("resinotes_items", {
    user_id: userId,
    folder_id: folder.id,
    type: "note",
    title: "Eclampsia",
    content: html,
    content_text: plain(html),
  });
  var prose = "<p>La paciente tuvo una evolución favorable y se decidió el alta al tercer día.</p>";
  post("resinotes_items", {
    user_id: userId,
    folder_id: folder.id,
    type: "note",
    title: "Caso sin estructura",
    content: prose,
    content_text: plain(prose),
  });
} else if (MODE === "modify") {
  var note = noteByTitle("Eclampsia");
  if (!note) throw new Error("No está el apunte Eclampsia");
  var edited = eclampsia(false);
  patch("resinotes_items?id=eq." + note.id, { content: edited, content_text: plain(edited) });
  var modified = get("resinotes_flashcards" + own + "&source_item_id=eq." + note.id + "&source_state=eq.modified&select=id,question");
  if (modified.length !== 1 || modified[0].question.indexOf("Manejo inicial") < 0) {
    throw new Error("Esperaba solo la tarjeta de «Manejo inicial» modificada: " + JSON.stringify(modified));
  }
} else if (MODE === "assert") {
  var cards = get(
    "resinotes_flashcards" + own +
      "&deleted_at=is.null&select=id,question,origin,status,source_state,source_version_at,due_on,interval_days,review_count,lapse_count,source:resinotes_items(title)"
  );
  var reviews = get("resinotes_flashcard_reviews" + own + "&select=flashcard_id,rating,local_date,next_due_on,next_interval&order=reviewed_at.asc");

  var generated = cards.filter(function (c) {
    return c.origin === "generated";
  });
  var manual = cards.filter(function (c) {
    return c.origin === "manual";
  });
  if (generated.length !== 6) throw new Error("Esperaba 6 tarjetas generadas: " + generated.length);
  if (manual.length !== 1 || manual[0].question !== "¿Qué escala valora el riesgo de úlceras por presión?") {
    throw new Error("Falta la tarjeta manual: " + JSON.stringify(manual));
  }
  generated.forEach(function (c) {
    if (!c.source || c.source.title !== "Eclampsia") throw new Error("Tarjeta sin su apunte: " + JSON.stringify(c));
  });

  // 5 tarjetas repasadas; la que no sabía, dos veces (reaparece al final).
  if (reviews.length !== 6) throw new Error("Esperaba 6 repasos: " + reviews.length);
  var byCard = {};
  reviews.forEach(function (r) {
    (byCard[r.flashcard_id] = byCard[r.flashcard_id] || []).push(r);
  });
  if (Object.keys(byCard).length !== 5) throw new Error("Esperaba 5 tarjetas repasadas");
  var ratings = reviews.map(function (r) {
    return r.rating;
  });
  if (ratings.join(",") !== "good,again,hard,good,good,good") throw new Error("Valoraciones: " + ratings.join(","));
  var intervals = reviews.map(function (r) {
    return r.next_interval;
  });
  // good 4 · again 1 · hard 2 · good 4 · good 4 · y la fallada, al saberla: max(1+1, 4, 2.5) = 4.
  if (intervals.join(",") !== "4,1,2,4,4,4") throw new Error("Intervalos: " + intervals.join(","));
  reviews.forEach(function (r) {
    var due = Date.parse(r.next_due_on + "T00:00:00Z");
    var day = Date.parse(r.local_date + "T00:00:00Z");
    if ((due - day) / 86400000 !== r.next_interval) throw new Error("Fecha mal calculada: " + JSON.stringify(r));
  });
  var lapsed = cards.filter(function (c) {
    return c.lapse_count === 1;
  });
  if (lapsed.length !== 1 || lapsed[0].review_count !== 2) throw new Error("La fallada: " + JSON.stringify(lapsed));

  // Una suspendida desde el detalle; la de «Manejo inicial», mantenida tras editar el apunte.
  var suspended = cards.filter(function (c) {
    return c.status === "suspended";
  });
  if (suspended.length !== 1) throw new Error("Esperaba 1 suspendida: " + suspended.length);
  var manejo = cards.filter(function (c) {
    return c.question.indexOf("Manejo inicial") >= 0;
  })[0];
  var note = noteByTitle("Eclampsia");
  if (!manejo || manejo.source_state !== "ok" || manejo.source_version_at !== note.updated_at) {
    throw new Error("«Mantener tarjeta» no se guardó: " + JSON.stringify(manejo) + " " + JSON.stringify(note));
  }
  var notOk = cards.filter(function (c) {
    return c.source_state !== "ok";
  });
  if (notOk.length) throw new Error("Tarjetas con la fuente sin resolver: " + JSON.stringify(notOk));
} else {
  throw new Error("MODE desconocido: " + MODE);
}
