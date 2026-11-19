// Código del QR de una sesión del curso de pruebas «E2E · Curso con sesiones»,
// tal como lo proyecta el panel en ese momento. Con OPEN=1 abre antes el
// fichaje de la sesión, como el botón «Abrir fichaje» (cierra las sesiones de
// otras franjas). El código dinámico vale 30–60 s: pídelo justo antes de usarlo.
// Variables: SESSION (título de la sesión), OUT (nombre de la salida),
// OPEN (opcional, "1"), PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD, SUPABASE_URL,
// SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var COURSE = "e2e0b92a-0000-4000-8000-000000000003";

var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: PANEL_OWNER_EMAIL, password: PANEL_OWNER_PASSWORD }),
});
if (res.status !== 200) throw new Error("Login del panel falló: " + res.status);
var headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + json(res.body).access_token,
  "Content-Type": "application/json",
};

var rows = json(
  http.get(
    SUPABASE_URL + "/rest/v1/course_session?course_id=eq." + COURSE + "&select=id,title",
    { headers: headers }
  ).body
);
var id = null;
for (var i = 0; i < rows.length; i++) {
  if (rows[i].title === SESSION) id = rows[i].id;
}
if (!id) throw new Error("No está la sesión " + SESSION);

var rpc = function (name, params) {
  var r = http.post(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    headers: headers,
    body: JSON.stringify(params),
  });
  if (r.status !== 200 && r.status !== 204) {
    throw new Error(name + " falló: " + r.status + " " + r.body);
  }
  return r.body ? json(r.body) : null;
};

if (typeof OPEN !== "undefined" && OPEN === "1") {
  rpc("open_course_session_checkin", { p_session_id: id });
}
var state = rpc("get_course_session_checkin", { p_session_id: id });
if (!state.is_open || !state.code) throw new Error("El fichaje de " + SESSION + " no está abierto");
output[OUT] = state.code;
