// ClickUp 124b4z9vn92: pone en hoy los dos cursos de prueba del Hospital E2E en
// los que está inscrito el residente de pruebas (uno por Docencia, otro por él
// mismo; ambos en borrador, no salen en ningún listado). Mover la fecha rehace
// sus copias en la agenda. Lo hace el owner del panel del Hospital E2E.
// Variables: PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD, SUPABASE_URL,
// SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var COURSE_IDS = [
  "e2e0b92a-0000-4000-8000-000000000001", // E2E · Curso inscrito por Docencia
  "e2e0b92a-0000-4000-8000-000000000002", // E2E · Curso inscrito por mí
];
// Fecha local (la del Mac y el simulador), no UTC: de 00:00 a 01:00/02:00 en
// Madrid el día UTC aún es el anterior.
var now = new Date();
var pad = function (n) { return (n < 10 ? "0" : "") + n; };
var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: PANEL_OWNER_EMAIL, password: PANEL_OWNER_PASSWORD }),
});
if (res.status !== 200) throw new Error("Login del panel falló: " + res.status);
var session = json(res.body);

var updated = http.request(
  SUPABASE_URL + "/rest/v1/courses?id=in.(" + COURSE_IDS.join(",") + ")",
  {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ event_dates: [today] }),
  }
);
if (updated.status !== 200 || json(updated.body).length !== 2) {
  throw new Error("Mover los cursos falló: " + updated.status + " " + updated.body);
}
