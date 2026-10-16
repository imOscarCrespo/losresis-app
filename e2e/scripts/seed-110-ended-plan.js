// Trello #110: deja al residente de pruebas con un plan de rotación ya terminado, sin reseña
// enlazada y sin respuesta a la invitación, para que el flujo pueda repetirse.
// Actúa como el propio residente (su JWT y RLS por propietario): solo toca datos suyos.
// Variables: E2E_EMAIL, E2E_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var HOSPITAL = "E2E Hospital de Pruebas";

var auth = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
if (auth.status !== 200) throw new Error("Login del residente de pruebas falló: " + auth.status);
var session = json(auth.body);
var userId = session.user.id;
var headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + session.access_token,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
var rest = SUPABASE_URL + "/rest/v1/";
var hospitalFilter = "hospital_name=eq." + encodeURIComponent(HOSPITAL);

// Reseñas que dejara una ejecución anterior a medias.
http.request(
  rest + "external_rotation_review?user_id=eq." + userId +
    "&external_hospital_name=eq." + encodeURIComponent(HOSPITAL),
  { method: "DELETE", headers: headers }
);

var plans = json(
  http.get(rest + "external_rotation?select=id&user_id=eq." + userId + "&" + hospitalFilter, {
    headers: headers,
  }).body
);

var plan = {
  start_date: "2026-07-01",
  end_date: "2026-09-30",
  country: "Spain",
  city: "Madrid",
  hospital_name: HOSPITAL,
  service_name: "Medicina Interna",
  latitude: 40.4168,
  longitude: -3.7038,
  contact_preference: "app_chat",
  review_invite_response: null,
  review_invite_responded_at: null,
};

var response = plans.length
  ? http.request(rest + "external_rotation?id=eq." + plans[0].id, {
      method: "PATCH",
      headers: headers,
      body: JSON.stringify(plan),
    })
  : http.post(rest + "external_rotation", {
      headers: headers,
      body: JSON.stringify(Object.assign({ user_id: userId }, plan)),
    });
if (response.status >= 300) throw new Error("No se pudo preparar el plan: " + response.status);
output.seededPlan = HOSPITAL;
