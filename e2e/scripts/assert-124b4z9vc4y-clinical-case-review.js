// ClickUp 124b4z9vc4y (fase 2): comprueba lo que deja la revisión del tutor.
//   - EPOC revisado y completado, con DOS revisiones en el historial
//     (modificaciones solicitadas y revisado), visibles para el residente.
//   - El residente no puede editarlo (el guard lo rechaza).
//   - Le han llegado los dos avisos, que abren el caso.
// Después deja la plantilla publicada o no, como estaba (output.wasPublished), y
// la revisión de EPOC apagada, como la deja el flujo de la fase 1.
var TEMPLATE_ID = "df9bf83a-b7b2-406b-b24b-603a59a8d4a5";
var EPOC = "c4a5e000-0000-4000-8000-0000000000e1";

var login = function (email, password) {
  var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  });
  if (res.status !== 200) throw new Error("Login falló: " + res.status);
  return json(res.body);
};
var headers = function (token) {
  return { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" };
};

var resident = login(E2E_EMAIL, E2E_PASSWORD);
var owner = login(PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD).access_token;

var cases = json(
  http.get(
    SUPABASE_URL +
      "/rest/v1/libro_clinical_case?select=id,status,review_status,reflection,reviews:libro_clinical_case_review(outcome,created_at)" +
      "&requirement_id=eq." + EPOC + "&user_id=eq." + resident.user.id,
    { headers: headers(resident.access_token) }
  ).body
);
if (cases.length !== 1) throw new Error("EPOC: " + JSON.stringify(cases));
var epoc = cases[0];
if (epoc.status !== "completed" || epoc.review_status !== "reviewed") {
  throw new Error("EPOC no está revisado: " + JSON.stringify(epoc));
}
var outcomes = epoc.reviews
  .sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; })
  .map(function (r) { return r.outcome; })
  .join(",");
if (outcomes !== "changes_requested,reviewed") throw new Error("Historial: " + outcomes);
if (epoc.reflection.indexOf("retirarla a tiempo") < 0) throw new Error("No se guardó la corrección: " + epoc.reflection);

var edit = http.request(SUPABASE_URL + "/rest/v1/libro_clinical_case?id=eq." + epoc.id, {
  method: "PATCH",
  headers: headers(resident.access_token),
  body: JSON.stringify({ reflection: "Edición tras revisar" }),
});
if (edit.status < 400 || edit.body.indexOf("ya ha revisado") < 0) {
  throw new Error("Se ha podido editar un caso revisado: " + edit.status + " " + edit.body);
}

var notifications = json(
  http.get(
    SUPABASE_URL + "/rest/v1/notifications?select=type,data&entity_id=eq." + epoc.id + "&user_id=eq." + resident.user.id,
    { headers: headers(resident.access_token) }
  ).body
);
var types = notifications.map(function (n) { return n.type; }).sort().join(",");
if (types !== "libro_clinical_case_changes_requested,libro_clinical_case_reviewed") {
  throw new Error("Avisos: " + types);
}
notifications.forEach(function (n) {
  if (n.data.destination_section !== "residenceLibrary" || n.data.clinical_case_id !== epoc.id) {
    throw new Error("El aviso no abre el caso: " + JSON.stringify(n.data));
  }
});

var restoredBlock = http.post(SUPABASE_URL + "/rest/v1/rpc/save_libro_clinical_case_block", {
  headers: headers(owner),
  body: JSON.stringify({
    p_template_id: TEMPLATE_ID,
    p_residency_year: 1,
    p_block: {
      id: "c4a5e000-0000-4000-8000-000000000001",
      position: 99,
      requirements: [
        { id: EPOC, title: "EPOC", description: "Caso de reagudización de EPOC en paciente ingresado.", is_required: true, tutor_review_enabled: false, position: 0 },
        { id: "c4a5e000-0000-4000-8000-0000000000e2", title: "Ictus isquémico", description: "Caso de ictus isquémico en fase aguda.", is_required: true, position: 1 },
        { id: "c4a5e000-0000-4000-8000-0000000000e3", title: "Fracaso renal agudo", description: "Caso de fracaso renal agudo de etiología médica.", is_required: true, position: 2 },
      ],
    },
  }),
});
if (restoredBlock.status !== 200) throw new Error("No se pudo restaurar la plantilla: " + restoredBlock.status);

if (output.wasPublished === "false") {
  var restored = http.request(SUPABASE_URL + "/rest/v1/libro_template?id=eq." + TEMPLATE_ID, {
    method: "PATCH",
    headers: headers(owner),
    body: JSON.stringify({ is_published: false }),
  });
  if (restored.status !== 204) throw new Error("No se pudo despublicar: " + restored.status);
}
