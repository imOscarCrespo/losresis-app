// ClickUp 124b4z9vc4y (fases 3 y 4): deja la plantilla MFyC del Hospital E2E
// como la encontraron los seeds: R1 en casos específicos (EPOC, ictus y FRA),
// la revisión de EPOC apagada y publicada o no según output.wasPublished. Las
// categorías del flujo de modos (fase 4) se archivan si tienen casos.
// Variables: PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD, SUPABASE_URL,
// SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
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

var owner = login(PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD).access_token;

var restoredBlock = http.post(SUPABASE_URL + "/rest/v1/rpc/save_libro_clinical_case_block", {
  headers: headers(owner),
  body: JSON.stringify({
    p_template_id: TEMPLATE_ID,
    p_residency_year: 1,
    p_block: {
      id: "c4a5e000-0000-4000-8000-000000000001",
      position: 99,
      requirement_mode: "specific",
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
