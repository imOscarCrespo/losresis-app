// ClickUp 124b4z9w5nh (ResiNotes definitivo): datos del residente de pruebas (solo los suyos).
// MODE=reset    → borra sus tarjetas, preferencias de repaso, notas, carpetas y ficheros de ResiNotes
//                 y crea la carpeta «Ginecología» con:
//                   * «HIDRATANTES, LUBRICANTES …» (título largo) con una lista de dos tareas
//                     pendientes (la segunda de varias líneas) y un párrafo de Gixoderm;
//                   * «Tratamiento de la hemorragia posparto» con negrita, lista y tabla, y una
//                     tarjeta ANTIGUA generada por el sistema anterior (debe seguir funcionando).
// MODE=assert_a → la primera tarea quedó hecha (y la segunda no) sin perder el texto, y el título
//                 sigue entero.
// MODE=assert_b → la tarjeta antigua sigue igual y con su programación; hay dos preguntas a mano
//                 vinculadas a la hemorragia (una con la respuesta seleccionada), una sola tarjeta
//                 de apunte completo, y las valoraciones se guardaron con el algoritmo de siempre.
// Variables: E2E_EMAIL, E2E_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY (scripts/e2e.sh).

var LONG_TITLE =
  "HIDRATANTES, LUBRICANTES Y OTROS PRODUCTOS PARA EL CUIDADO DE LA MUCOSA VULVOVAGINAL EN LA POSMENOPAUSIA";
var PPH_TITLE = "Tratamiento de la hemorragia posparto";

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
  if (done.status !== 200 && done.status !== 204) throw new Error("Borrado de " + path + " falló: " + done.status);
}

function note(title) {
  return get(
    "resinotes_items" + own + "&type=eq.note&deleted_at=is.null&title=eq." + encodeURIComponent(title) + "&select=id,title,content,content_text"
  )[0];
}

var task = function (text) {
  return (
    '<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>' +
    text +
    "</p></div></li>"
  );
};

if (MODE === "reset") {
  del("resinotes_flashcards" + own);
  del("resinotes_review_preferences" + own);
  var keys = get("resinotes_attachments" + own + "&select=storage_key").map(function (a) {
    return a.storage_key;
  });
  if (keys.length) {
    var removed = http.request(SUPABASE_URL + "/storage/v1/object/resinotes", {
      method: "DELETE",
      headers: headers,
      body: JSON.stringify({ prefixes: keys }),
    });
    if (removed.status !== 200) throw new Error("Borrado de ficheros falló: " + removed.status + " " + removed.body);
  }
  del("resinotes_items" + own);
  del("resinotes_folders" + own);

  var folder = post("resinotes_folders", { user_id: userId, name: "Ginecología", emoji: "🌸", color: "pink" });
  post("resinotes_items", {
    user_id: userId,
    folder_id: folder.id,
    type: "note",
    title: LONG_TITLE,
    content:
      '<ul data-type="taskList">' +
      task("Comprar Gixoderm en la farmacia") +
      task(
        "Revisar con la tutora las pautas de lubricantes de base acuosa y de silicona para pacientes con atrofia vulvovaginal y dispareunia"
      ) +
      "</ul><p>Gixoderm: Vitamina E, ácido hialurónico, tomillo, hamamelis y caléndula.</p>",
    content_text:
      "Comprar Gixoderm en la farmacia\nRevisar con la tutora las pautas de lubricantes de base acuosa y de silicona para pacientes con atrofia vulvovaginal y dispareunia\nGixoderm: Vitamina E, ácido hialurónico, tomillo, hamamelis y caléndula.",
  });
  var pph = post("resinotes_items", {
    user_id: userId,
    folder_id: folder.id,
    type: "note",
    title: PPH_TITLE,
    content:
      "<h2>Primera línea</h2><ul><li><p><strong>Oxitocina</strong> 10 UI IM</p></li><li><p>Masaje uterino bimanual</p></li></ul>" +
      "<p>Si persiste: carbetocina o metilergometrina.</p>" +
      "<table><tbody><tr><th><p>Fármaco</p></th><th><p>Dosis</p></th></tr><tr><td><p>Ácido tranexámico</p></td><td><p>1 g IV</p></td></tr></tbody></table>",
    content_text:
      "Primera línea\nOxitocina 10 UI IM\nMasaje uterino bimanual\nSi persiste: carbetocina o metilergometrina.\nFármaco\nDosis\nÁcido tranexámico\n1 g IV",
  });
  // Tarjeta del generador anterior: se conserva y se sigue repasando.
  post("resinotes_flashcards", {
    user_id: userId,
    source_item_id: pph.id,
    source_excerpt: "Oxitocina 10 UI IM Masaje uterino bimanual",
    question: "¿Qué incluye Primera línea en tu apunte?",
    answer: "Oxitocina 10 UI IM",
    origin: "generated",
  });
} else if (MODE === "assert_a") {
  var n = note(LONG_TITLE);
  if (!n) throw new Error("No está la nota con el título largo entero");
  var items = n.content.match(/<li[^>]*data-type="taskItem"[^>]*>/g) || [];
  if (items.length !== 2) throw new Error("La lista no tiene sus dos tareas: " + n.content);
  if (!/data-checked="true"/.test(items[0])) throw new Error("La primera tarea no quedó hecha: " + items[0]);
  if (/data-checked="true"/.test(items[1])) throw new Error("La segunda tarea cambió: " + items[1]);
  if (n.content.indexOf("Comprar Gixoderm en la farmacia") < 0 || n.content.indexOf("dispareunia") < 0) {
    throw new Error("Se perdió texto de las tareas: " + n.content);
  }
  output.noteA = "ok";
} else if (MODE === "assert_a2") {
  var n2 = note(LONG_TITLE);
  if (!/<strong>\s*Fin<\/strong>/.test(n2.content)) throw new Error("La negrita no se guardó: " + n2.content);
  if (!/<img[^>]+src="resinotes:\/\//.test(n2.content)) throw new Error("La imagen no se guardó en la nota: " + n2.content);
  if (!/data-checked="true"/.test(n2.content)) throw new Error("Se perdió la tarea hecha: " + n2.content);
  output.noteA2 = "ok";
} else if (MODE === "assert_b") {
  var pphNote = note(PPH_TITLE);
  var cards = get(
    "resinotes_flashcards" + own + "&deleted_at=is.null&select=id,card_type,origin,question,answer,source_item_id,review_count,source_state"
  );
  var old = cards.filter(function (c) {
    return c.origin === "generated";
  });
  if (old.length !== 1 || old[0].answer !== "Oxitocina 10 UI IM" || old[0].source_state !== "ok") {
    throw new Error("La tarjeta antigua cambió o desapareció: " + JSON.stringify(old));
  }
  var manual = cards.filter(function (c) {
    return c.card_type === "qa" && c.origin === "manual" && c.source_item_id === pphNote.id;
  });
  if (manual.length !== 2) throw new Error("Faltan las dos preguntas a mano vinculadas: " + JSON.stringify(cards));
  // Un toque largo selecciona una palabra: la respuesta es esa palabra, tal cual está en la nota.
  var fromSelection = manual.filter(function (c) {
    return c.question === "¿Qué se da si persiste?" && c.answer.length > 2 && pphNote.content_text.indexOf(c.answer) >= 0;
  });
  if (fromSelection.length !== 1) throw new Error("La pregunta desde la selección no guardó su respuesta: " + JSON.stringify(manual));
  var noteCards = cards.filter(function (c) {
    return c.card_type === "note";
  });
  if (noteCards.length !== 1 || noteCards[0].source_item_id !== pphNote.id || noteCards[0].answer !== "") {
    throw new Error("Debe haber una sola tarjeta de apunte completo: " + JSON.stringify(noteCards));
  }
  var reviews = get("resinotes_flashcard_reviews" + own + "&select=rating,next_interval");
  // 2 antes de salir a mitad + 2 al retomarlo; la práctica de «Repasar otras tarjetas» no guarda nada.
  if (reviews.length !== 4) throw new Error("Se esperaban 4 valoraciones: " + JSON.stringify(reviews));
  var reviewed = cards.filter(function (c) {
    return c.review_count > 0;
  });
  if (reviewed.length !== reviews.length) throw new Error("Valoraciones y tarjetas no cuadran: " + JSON.stringify(reviews));
  output.cards = cards.length;
  output.reviews = reviews.length;
} else {
  throw new Error("MODE desconocido: " + MODE);
}
