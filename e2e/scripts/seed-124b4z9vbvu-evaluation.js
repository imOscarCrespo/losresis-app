// ClickUp 124b4z9vbvu: Docencia genera una evaluación individual para el residente
// de pruebas (R1 MFyC del Hospital E2E) en «Medicina Interna y Geriatría».
// Actúa como la cuenta owner del panel (su JWT; la RPC comprueba el alcance) y usa
// un periodo nuevo en cada pasada, así el flujo se repite sin chocar con el aviso
// de duplicado. Deja output.periodStart y output.evaluationId.
// Variables: E2E_EMAIL, E2E_PASSWORD, PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD,
// SUPABASE_URL, SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var ROTATION_ID = "8d1eea92-0c00-4faf-9860-fdb2107806c4";

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

var residentId = login(E2E_EMAIL, E2E_PASSWORD).user.id;
var owner = login(PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD).access_token;

// El periodo de ésta va después del último que Docencia le haya generado.
var previous = json(
  http.get(
    SUPABASE_URL + "/rest/v1/rotation_self_assessment?select=period_start&generated_by=not.is.null" +
      "&user_id=eq." + residentId + "&rotation_id=eq." + ROTATION_ID +
      "&period_start=not.is.null&order=period_start.desc&limit=1",
    { headers: headers(owner) }
  ).body
);
var last = previous.length ? new Date(previous[0].period_start + "T00:00:00Z") : new Date(Date.UTC(2026, 11, 29));
var start = new Date(last.getTime() + 3 * 24 * 3600 * 1000);
var end = new Date(start.getTime() + 59 * 24 * 3600 * 1000);
var day = function (date) { return date.toISOString().slice(0, 10); };

var res = http.post(SUPABASE_URL + "/rest/v1/rpc/generate_rotation_evaluation", {
  headers: headers(owner),
  body: JSON.stringify({
    p_rotation_id: ROTATION_ID,
    p_user_id: residentId,
    p_period_start: day(start),
    p_period_end: day(end),
  }),
});
if (res.status !== 200) throw new Error("No se pudo generar la evaluación: " + res.status + " " + res.body);
var result = json(res.body);
if (result.duplicate) throw new Error("La evaluación salió como duplicada");

output.periodStart = day(start);
output.evaluationId = result.assessment.id;
