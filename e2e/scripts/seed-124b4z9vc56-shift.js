// ClickUp 124b4z9vc56: deja una guardia de 24 h del 26/10/2026 en la agenda del
// residente de pruebas (solo sus datos), para registrar su postguardia. Si ya
// existe no hace nada. Variables: E2E_EMAIL, E2E_PASSWORD, SUPABASE_URL,
// SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var SHIFT_DATE = "2026-10-26";

var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
if (res.status !== 200) throw new Error("Login falló: " + res.status);
var session = json(res.body);
var headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + session.access_token,
  "Content-Type": "application/json",
};

var existing = http.get(
  SUPABASE_URL + "/rest/v1/agenda_events?select=id&event_type=eq.shift" +
    "&user_id=eq." + session.user.id + "&event_date=eq." + SHIFT_DATE,
  { headers: headers }
);
if (existing.status !== 200) throw new Error("Lectura falló: " + existing.status);

if (json(existing.body).length === 0) {
  var created = http.post(SUPABASE_URL + "/rest/v1/agenda_events", {
    headers: headers,
    body: JSON.stringify({
      user_id: session.user.id,
      event_type: "shift",
      title: "Guardia",
      event_date: SHIFT_DATE,
      all_day: true,
      metadata: { shift_duration: "24h" },
    }),
  });
  if (created.status !== 201) throw new Error("Alta falló: " + created.status + " " + created.body);
}
