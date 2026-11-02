// ClickUp 124b4z9w0qg (ResiNotes): prepara la biblioteca del residente de pruebas (solo la suya).
// MODE=reset  → borra todas sus carpetas, elementos y ficheros de ResiNotes y deja la carpeta
//               «Urgencias» 🚨 (verde menta) con un PDF «Guía de sepsis».
//               Pasada B: el PDF tiene 3 páginas (para recordar la última) y hay una nota
//               «Apunte antiguo» en la papelera desde hace 10 días (le quedan 20).
// MODE=assert → comprueba en la BD lo que ha hecho el flujo: «Paritorio» heredó el rosa de
//               «Obstetricia», la nota guardó su texto y es favorita, y el enlace se normalizó.
// MODE=assert_b → pasada B: el lote se movió a «Obstetricia», se ordenó a mano y se marcó
//               favorito, el enlace está en la papelera, la nota tiene un bloque 💡 y una tabla
//               con una fila añadida, el PDF recuerda la página 3 y las carpetas tienen orden.
// Variables: E2E_EMAIL, E2E_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY (scripts/e2e.sh).

var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
if (res.status !== 200) throw new Error("Login falló: " + res.status);
var session = json(res.body);
var userId = session.user.id;
var auth = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + session.access_token,
};
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

if (MODE === "reset") {
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
  var delItems = http.delete(rest + "resinotes_items" + own, { headers: headers });
  if (delItems.status !== 200 && delItems.status !== 204) throw new Error("Borrado de elementos falló: " + delItems.status);
  var delFolders = http.delete(rest + "resinotes_folders" + own, { headers: headers });
  if (delFolders.status !== 200 && delFolders.status !== 204) throw new Error("Borrado de carpetas falló: " + delFolders.status);

  var folder = post("resinotes_folders", { user_id: userId, name: "Urgencias", emoji: "🚨", color: "mint" });
  var item = post("resinotes_items", { user_id: userId, folder_id: folder.id, type: "pdf", title: "Guía de sepsis" });

  // Un PDF mínimo es texto ASCII: se puede subir sin binarios. Tres páginas altas, para
  // que el visor tenga que desplazarse (pdf.js reconstruye la tabla xref que falta).
  var page = function (n, contents) {
    return n + " 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 520]/Contents " + contents +
      " 0 R/Resources<</Font<</F1 9 0 R>>>>>>endobj\n";
  };
  var stream = function (n, text) {
    var body = "BT /F1 18 Tf 30 460 Td (" + text + ") Tj ET";
    return n + " 0 obj<</Length " + body.length + ">>stream\n" + body + "\nendstream endobj\n";
  };
  var pdf =
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R 5 0 R]/Count 3>>endobj\n" +
    page(3, 6) + page(4, 7) + page(5, 8) +
    stream(6, "Guia de sepsis - pagina 1") + stream(7, "Pagina 2: antibioterapia") + stream(8, "Pagina 3: shock septico") +
    "9 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
  var key = userId + "/" + item.id + "/e2e-sepsis.pdf";
  var up = http.post(SUPABASE_URL + "/storage/v1/object/resinotes/" + key, {
    headers: { apikey: auth.apikey, Authorization: auth.Authorization, "Content-Type": "application/pdf", "x-upsert": "true" },
    body: pdf,
  });
  if (up.status !== 200) throw new Error("Subida del PDF falló: " + up.status + " " + up.body);
  post("resinotes_attachments", {
    user_id: userId,
    item_id: item.id,
    storage_key: key,
    filename: "Guía de sepsis.pdf",
    mime_type: "application/pdf",
    size_bytes: pdf.length,
  });

  // Pasada B: algo que lleva 10 días en la papelera.
  var old = post("resinotes_items", {
    user_id: userId,
    type: "note",
    title: "Apunte antiguo",
    content: "<p>Viejo</p>",
    content_text: "Viejo",
  });
  var tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
  var trashed = http.request(rest + "resinotes_items?id=eq." + old.id, {
    method: "PATCH",
    headers: headers,
    body: JSON.stringify({ deleted_at: tenDaysAgo }),
  });
  if (trashed.status !== 200) throw new Error("Papelera del apunte antiguo falló: " + trashed.status + " " + trashed.body);
} else if (MODE === "assert") {
  var folders = get("resinotes_folders" + own + "&deleted_at=is.null&select=id,name,color,parent_id");
  var obs = folders.filter(function (f) {
    return f.name === "Obstetricia";
  })[0];
  var par = folders.filter(function (f) {
    return f.name === "Paritorio";
  })[0];
  if (!obs || obs.color !== "pink") throw new Error("Obstetricia no es rosa: " + JSON.stringify(obs));
  if (!par || par.parent_id !== obs.id || par.color !== "pink") {
    throw new Error("Paritorio no heredó el color o no cuelga de Obstetricia: " + JSON.stringify(par));
  }
  var notes = get("resinotes_items" + own + "&type=eq.note&deleted_at=is.null&select=title,content_text,is_favorite,folder_id");
  var note = notes.filter(function (n) {
    return n.title === "Monitorización fetal";
  })[0];
  if (!note || note.folder_id !== par.id) throw new Error("La nota no está en Paritorio: " + JSON.stringify(notes));
  if (String(note.content_text).indexOf("Deceleraciones tardías") < 0) {
    throw new Error("La nota no guardó su texto: " + JSON.stringify(note));
  }
  if (!note.is_favorite) throw new Error("La nota no es favorita");
  var links = get("resinotes_items" + own + "&type=eq.link&select=url,title");
  if (!links.length || links[0].url !== "https://sego.es" || links[0].title !== "sego.es") {
    throw new Error("El enlace no se normalizó: " + JSON.stringify(links));
  }
} else if (MODE === "assert_b") {
  var fs = get("resinotes_folders" + own + "&deleted_at=is.null&select=id,name,parent_id,sort_order");
  var obsB = fs.filter(function (f) {
    return f.name === "Obstetricia";
  })[0];
  var roots = fs.filter(function (f) {
    return !f.parent_id;
  });
  if (roots.some(function (f) { return !f.sort_order; })) throw new Error("Las carpetas no se ordenaron: " + JSON.stringify(roots));

  var inObs = get("resinotes_items" + own + "&folder_id=eq." + obsB.id + "&select=id,type,title,sort_order,is_favorite,deleted_at,content");
  var noteB = inObs.filter(function (i) {
    return i.type === "note";
  })[0];
  var linkB = inObs.filter(function (i) {
    return i.type === "link";
  })[0];
  if (!noteB || !linkB) throw new Error("El lote no se movió a Obstetricia: " + JSON.stringify(inObs));
  if (!noteB.sort_order || !linkB.sort_order || noteB.sort_order === linkB.sort_order) {
    throw new Error("No hay orden manual: " + noteB.sort_order + " / " + linkB.sort_order);
  }
  if (!linkB.is_favorite) throw new Error("El favorito en lote no marcó el enlace");
  if (!linkB.deleted_at) throw new Error("El enlace no se fue a la papelera");
  var html = String(noteB.content || "");
  if (html.indexOf('data-callout="pearl"') < 0) throw new Error("La nota no tiene el bloque 💡: " + html);
  if (html.indexOf("<table") < 0) throw new Error("La nota no tiene tabla: " + html);
  var rows = html.split("<tr").length - 1;
  if (rows !== 4) throw new Error("La tabla debería tener 4 filas y tiene " + rows);

  var pdfs = get("resinotes_items" + own + "&type=eq.pdf&select=title,last_page");
  if (!pdfs.length || pdfs[0].last_page !== 3) throw new Error("El PDF no recuerda la página 3: " + JSON.stringify(pdfs));
} else {
  throw new Error("MODE desconocido: " + MODE);
}
