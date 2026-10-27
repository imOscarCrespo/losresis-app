// ClickUp 124b4z9vc4y (fase 4): el owner pasa R1 de la plantilla MFyC del
// Hospital E2E a «Número mínimo de casos» con N = 4. Las categorías con casos se
// archivan (sus casos quedan en el Libro del residente y siguen contando).
var TEMPLATE_ID = "df9bf83a-b7b2-406b-b24b-603a59a8d4a5";

var login = function (email, password) {
  var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  });
  if (res.status !== 200) throw new Error("Login falló: " + res.status);
  return json(res.body);
};
var owner = login(PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD).access_token;

var saved = http.post(SUPABASE_URL + "/rest/v1/rpc/save_libro_clinical_case_block", {
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + owner, "Content-Type": "application/json" },
  body: JSON.stringify({
    p_template_id: TEMPLATE_ID,
    p_residency_year: 1,
    p_block: { id: "c4a5e000-0000-4000-8000-000000000001", position: 99, requirement_mode: "minimum", minimum_cases: 4, requirements: [] },
  }),
});
if (saved.status !== 200) throw new Error("No se pudo pasar a número mínimo: " + saved.status + " " + saved.body);
