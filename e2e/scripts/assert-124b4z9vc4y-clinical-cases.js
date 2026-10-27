// ClickUp 124b4z9vc4y: comprueba lo que el flujo ha dejado y lo que ve Docencia.
//   - Residente: EPOC completado (con completed_at), y su caso libre «Ictus E2E»
//     vinculado a «Ictus isquémico» en borrador. Un solo caso por requisito.
//   - Owner del panel (get_clinical_cases_for_panel): ve el contenido de EPOC y
//     NO el del borrador.
// Después deja la plantilla publicada o no, como estaba (output.wasPublished).
var TEMPLATE_ID = "df9bf83a-b7b2-406b-b24b-603a59a8d4a5";
var EPOC = "c4a5e000-0000-4000-8000-0000000000e1";
var ICTUS = "c4a5e000-0000-4000-8000-0000000000e2";

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
    SUPABASE_URL + "/rest/v1/libro_clinical_case?select=id,title,requirement_id,status,completed_at,reflection&user_id=eq." + resident.user.id,
    { headers: headers(resident.access_token) }
  ).body
);
var epoc = cases.filter(function (c) { return c.requirement_id === EPOC; });
var ictus = cases.filter(function (c) { return c.requirement_id === ICTUS; });
if (epoc.length !== 1 || epoc[0].status !== "completed" || !epoc[0].completed_at) {
  throw new Error("EPOC no está completado: " + JSON.stringify(epoc));
}
if (ictus.length !== 1 || ictus[0].title !== "Ictus E2E" || ictus[0].status !== "draft") {
  throw new Error("Ictus no está vinculado en borrador: " + JSON.stringify(ictus));
}
if (epoc[0].reflection.indexOf("\n") < 0) throw new Error("La reflexión perdió los saltos de línea");

var panel = http.post(SUPABASE_URL + "/rest/v1/rpc/get_clinical_cases_for_panel", {
  headers: headers(owner),
  body: JSON.stringify({ p_user_id: resident.user.id }),
});
if (panel.status !== 200) throw new Error("RPC del panel falló: " + panel.status);
var data = json(panel.body);
if (data.requirements.length !== 3) throw new Error("El panel ve " + data.requirements.length + " requisitos");
data.cases.forEach(function (c) {
  if (c.status === "draft" && (c.reflection !== undefined || c.chief_complaint !== undefined)) {
    throw new Error("El panel ve el contenido de un borrador");
  }
  if (c.status === "completed" && !c.reflection) throw new Error("El panel no ve la reflexión completada");
});

if (output.wasPublished === "false") {
  var restored = http.request(SUPABASE_URL + "/rest/v1/libro_template?id=eq." + TEMPLATE_ID, {
    method: "PATCH",
    headers: headers(owner),
    body: JSON.stringify({ is_published: false }),
  });
  if (restored.status !== 204) throw new Error("No se pudo despublicar: " + restored.status);
}
