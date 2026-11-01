// ClickUp 124b4z9vn93: coloca los dos cursos de prueba del Hospital E2E en los
// que está inscrito el residente de pruebas (en borrador, no salen en ningún
// listado): «inscrito por Docencia» en hoy, para ver «Asistencia de hoy» y
// «Fichar», e «inscrito por mí» en otro día del mismo mes, para comprobar que al
// volver de la ficha la Agenda sigue en ese día. Mover la fecha rehace sus
// copias en la agenda. Lo hace el owner del panel del Hospital E2E.
// Variables: PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD, SUPABASE_URL,
// SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var TODAY_COURSE = "e2e0b92a-0000-4000-8000-000000000001"; // E2E · Curso inscrito por Docencia
var OTHER_COURSE = "e2e0b92a-0000-4000-8000-000000000002"; // E2E · Curso inscrito por mí
var MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre",
];

// Fecha local (la del Mac y el simulador), no UTC.
var pad = function (n) { return (n < 10 ? "0" : "") + n; };
var dateKey = function (d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
};
var now = new Date();
// Otro día del mismo mes, para no tener que cambiar de mes en el calendario.
var other = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (now.getDate() <= 14 ? 7 : -7));

var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: PANEL_OWNER_EMAIL, password: PANEL_OWNER_PASSWORD }),
});
if (res.status !== 200) throw new Error("Login del panel falló: " + res.status);
var token = json(res.body).access_token;

var move = function (courseId, day) {
  var updated = http.request(SUPABASE_URL + "/rest/v1/courses?id=eq." + courseId, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ event_dates: [day] }),
  });
  if (updated.status !== 200 || json(updated.body).length !== 1) {
    throw new Error("Mover el curso falló: " + updated.status + " " + updated.body);
  }
};

move(TODAY_COURSE, dateKey(now));
move(OTHER_COURSE, dateKey(other));

output.otherDate = dateKey(other);
// Como lo escribe la cabecera del día en la Agenda («…, 8 de noviembre de 2026»).
output.otherDayTitle = other.getDate() + " de " + MONTHS[other.getMonth()] + " de " + other.getFullYear();
