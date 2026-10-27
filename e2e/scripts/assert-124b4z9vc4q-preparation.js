// ClickUp 124b4z9vc4q (fase 2): comprueba por API lo que ve cada parte de la
// preparación de la tutoría del 10/11/2026 del residente R1 del Hospital E2E.
//   EXPECT=draft → el residente la ve como borrador y el owner del panel NO la ve.
//   EXPECT=sent  → el residente la ve enviada y el owner la ve con el texto LEARNINGS.
// Variables: E2E_EMAIL, E2E_PASSWORD, PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD,
// SUPABASE_URL, SUPABASE_ANON_KEY (las pasa scripts/e2e.sh), EXPECT y LEARNINGS.
var TUTORING_ID = "1b9691d0-8234-4ee5-910f-a3c4fd9963b2";

if (!PANEL_OWNER_EMAIL) throw new Error("Falta ~/.config/losresis/e2e-panel.env con PANEL_OWNER_EMAIL");

var login = function (email, password) {
  var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  });
  if (res.status !== 200) throw new Error("Login falló: " + res.status);
  return json(res.body).access_token;
};
var read = function (token) {
  var res = http.get(
    SUPABASE_URL + "/rest/v1/hospital_tutoring_preparation?select=status,sent_at,answers" +
      "&tutoring_id=eq." + TUTORING_ID,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token } }
  );
  if (res.status !== 200) throw new Error("Lectura falló: " + res.status + " " + res.body);
  return json(res.body);
};

var mine = read(login(E2E_EMAIL, E2E_PASSWORD));
var panel = read(login(PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD));

if (mine.length !== 1 || mine[0].status !== EXPECT) {
  throw new Error("El residente esperaba " + EXPECT + " y ve " + JSON.stringify(mine));
}
if (mine[0].answers.learnings !== LEARNINGS) {
  throw new Error("Respuesta guardada inesperada: " + mine[0].answers.learnings);
}
if (EXPECT === "draft" && panel.length !== 0) {
  throw new Error("El panel ve el borrador");
}
if (EXPECT === "sent" && (panel.length !== 1 || panel[0].answers.learnings !== LEARNINGS)) {
  throw new Error("El panel no ve la enviada: " + JSON.stringify(panel));
}
