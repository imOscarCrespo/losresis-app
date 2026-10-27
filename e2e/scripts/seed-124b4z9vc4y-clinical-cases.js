// ClickUp 124b4z9vc4y: prepara el portafolio de casos clínicos del residente de
// pruebas (R1 MFyC del Hospital E2E, un hospital is_test).
//   - Como owner del panel: pide en R1 de la plantilla MFyC los tres casos de
//     Sant Pau (ids fijos, así repetir no duplica) y la deja publicada. Guarda en
//     output.wasPublished cómo estaba, para que restore-… la deje igual.
//   - Como residente: borra SUS casos clínicos, así el flujo empieza siempre en
//     «0 de 3». Solo toca datos suyos.
// Variables: E2E_EMAIL, E2E_PASSWORD, PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD,
// SUPABASE_URL, SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var TEMPLATE_ID = "df9bf83a-b7b2-406b-b24b-603a59a8d4a5";

if (!PANEL_OWNER_EMAIL) throw new Error("Falta ~/.config/losresis/e2e-panel.env con PANEL_OWNER_EMAIL");

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

var template = json(
  http.get(SUPABASE_URL + "/rest/v1/libro_template?select=is_published&id=eq." + TEMPLATE_ID, {
    headers: headers(owner),
  }).body
);
if (!template.length) throw new Error("No se encuentra la plantilla MFyC del Hospital E2E");
output.wasPublished = template[0].is_published ? "true" : "false";

var saved = http.post(SUPABASE_URL + "/rest/v1/rpc/save_libro_clinical_case_block", {
  headers: headers(owner),
  body: JSON.stringify({
    p_template_id: TEMPLATE_ID,
    p_residency_year: 1,
    p_block: {
      id: "c4a5e000-0000-4000-8000-000000000001",
      position: 99,
      requirement_mode: "specific",
      requirements: [
        { id: "c4a5e000-0000-4000-8000-0000000000e1", title: "EPOC", description: "Caso de reagudización de EPOC en paciente ingresado.", is_required: true, position: 0 },
        { id: "c4a5e000-0000-4000-8000-0000000000e2", title: "Ictus isquémico", description: "Caso de ictus isquémico en fase aguda.", is_required: true, position: 1 },
        { id: "c4a5e000-0000-4000-8000-0000000000e3", title: "Fracaso renal agudo", description: "Caso de fracaso renal agudo de etiología médica.", is_required: true, position: 2 },
      ],
    },
  }),
});
if (saved.status !== 200) throw new Error("No se pudieron guardar los casos: " + saved.status + " " + saved.body);

if (!template[0].is_published) {
  var published = http.request(SUPABASE_URL + "/rest/v1/libro_template?id=eq." + TEMPLATE_ID, {
    method: "PATCH",
    headers: headers(owner),
    body: JSON.stringify({ is_published: true }),
  });
  if (published.status !== 204) throw new Error("No se pudo publicar: " + published.status + " " + published.body);
}

var cleared = http.request(
  SUPABASE_URL + "/rest/v1/libro_clinical_case?user_id=eq." + resident.user.id,
  { method: "DELETE", headers: headers(resident.access_token) }
);
if (cleared.status !== 204) throw new Error("No se pudieron borrar sus casos: " + cleared.status);
