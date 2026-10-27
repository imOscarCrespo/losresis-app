// ClickUp 124b4z9vc56: comprueba por API la postguardia de la guardia del
// 26/10/2026 del residente de pruebas:
//   - está completada, con autonomía «apoyo puntual» y valoración 4;
//   - el Libro tiene exactamente COUNT de PROCEDURE en las fechas de la guardia
//     (26 y 27), por muchas veces que se guarde: no se duplica.
// Variables: E2E_EMAIL, E2E_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY, PROCEDURE, COUNT.
var SHIFT_DATE = "2026-10-26";

var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
if (res.status !== 200) throw new Error("Login falló: " + res.status);
var session = json(res.body);
var headers = { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + session.access_token };
var get = function (path) {
  var r = http.get(SUPABASE_URL + "/rest/v1/" + path, { headers: headers });
  if (r.status !== 200) throw new Error("Lectura falló: " + r.status + " " + r.body);
  return json(r.body);
};

var debriefs = get(
  "shift_debrief?select=status,autonomy,rating,procedures,agenda_event_id&shift_date=eq." + SHIFT_DATE
);
if (debriefs.length !== 1) throw new Error("Postguardias: " + JSON.stringify(debriefs));
var debrief = debriefs[0];
if (debrief.status !== "completed" || debrief.autonomy !== "occasional_support" || debrief.rating !== 4) {
  throw new Error("Postguardia inesperada: " + JSON.stringify(debrief));
}

var nodes = get(
  "libro_node?select=id&section=eq.clinical_practice&name=eq." + encodeURIComponent(PROCEDURE)
);
if (nodes.length !== 1) throw new Error("Actividad " + PROCEDURE + ": " + JSON.stringify(nodes));

var entries = get(
  "libro_entry?select=count,performed_at&node_id=eq." + nodes[0].id +
    "&performed_at=gte." + SHIFT_DATE + "&performed_at=lte.2026-10-27"
);
var total = 0;
for (var i = 0; i < entries.length; i++) total += entries[i].count;
if (total !== Number(COUNT)) {
  throw new Error("El Libro tiene " + total + " de " + PROCEDURE + " y se esperaban " + COUNT);
}
