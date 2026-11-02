// ClickUp 124b4z9w0qg (ResiNotes): prepara la biblioteca del residente de pruebas (solo la suya).
// MODE=reset  → borra todas sus carpetas, elementos y ficheros de ResiNotes y deja la carpeta
//               «Urgencias» 🚨 (verde menta) con un PDF «Guía de sepsis».
// MODE=assert → comprueba en la BD lo que ha hecho el flujo: «Paritorio» heredó el rosa de
//               «Obstetricia», la nota guardó su texto y es favorita, y el enlace se normalizó.
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

  // Un PDF mínimo es texto ASCII: se puede subir sin binarios.
  var pdf =
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
    "4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 30 70 Td (Guia de sepsis) Tj ET\nendstream endobj\n" +
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
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
} else {
  throw new Error("MODE desconocido: " + MODE);
}
