// ClickUp 124b4z9vc4y (fase 4): comprueba por API lo que ve Docencia tras el
// flujo de modos (como el tutor, por get_clinical_cases_for_panel, igual que el
// panel) y deja la plantilla como estaba (restore-…).
//   - R1 está en «Número mínimo de casos» con N = 4.
//   - El residente tiene tres casos completados: dos en Respiratorio (uno creado
//     en la app y «Asma E2E» vinculado) y «Migraña E2E» en Neurología.
//   - Pasar a casos específicos con las dos fichas de Respiratorio se rechaza.
var TEMPLATE_ID = "df9bf83a-b7b2-406b-b24b-603a59a8d4a5";
var RESPIRATORIO = "c4a5e000-0000-4000-8000-0000000000f1";
var NEUROLOGIA = "c4a5e000-0000-4000-8000-0000000000f2";

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
var tutor = login(PANEL_TUTOR_EMAIL, PANEL_TUTOR_PASSWORD).access_token;
var owner = login(PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD).access_token;

var panel = json(
  http.post(SUPABASE_URL + "/rest/v1/rpc/get_clinical_cases_for_panel", {
    headers: headers(tutor),
    body: JSON.stringify({ p_user_id: resident.user.id }),
  }).body
);
if (!panel) throw new Error("El tutor no ve los casos del residente");
var r1 = (panel.blocks || []).filter(function (block) { return block.residency_year === 1; })[0];
if (!r1 || r1.requirement_mode !== "minimum" || r1.minimum_cases !== 4) {
  throw new Error("R1 no está en número mínimo 4: " + JSON.stringify(panel.blocks));
}
var completed = panel.cases.filter(function (item) { return item.status === "completed"; });
if (completed.length !== 3) throw new Error("Esperaba 3 casos completados y hay " + completed.length);
var enRespiratorio = completed.filter(function (item) { return item.requirement_id === RESPIRATORIO; });
var enNeurologia = completed.filter(function (item) { return item.requirement_id === NEUROLOGIA; });
if (enRespiratorio.length !== 2 || enNeurologia.length !== 1) {
  throw new Error("Las categorías no tienen los casos esperados: " + JSON.stringify(completed));
}
if (enNeurologia[0].title !== "Migraña E2E") throw new Error("Neurología no tiene «Migraña E2E»");

var crowded = http.post(SUPABASE_URL + "/rest/v1/rpc/save_libro_clinical_case_block", {
  headers: headers(owner),
  body: JSON.stringify({
    p_template_id: TEMPLATE_ID,
    p_residency_year: 1,
    p_block: {
      id: "c4a5e000-0000-4000-8000-000000000001",
      position: 99,
      requirement_mode: "specific",
      requirements: [{ id: RESPIRATORIO, title: "Respiratorio", is_required: true, position: 0 }],
    },
  }),
});
if (crowded.status === 200 || crowded.body.indexOf("más de un caso") < 0) {
  throw new Error("Pasar a específicos con dos fichas en una categoría no se rechazó: " + crowded.status + " " + crowded.body);
}
