// Tras unir cuentas: la cuenta propia ya no existe y su dato (el evento de
// agenda MARKER) está en el acceso del hospital. Después borra ese evento para
// dejar al residente de pruebas como estaba.
// Variables: SUPABASE_URL, SUPABASE_ANON_KEY, E2E_EMAIL, E2E_PASSWORD,
// E2E_NEW_PASSWORD, OWN_EMAIL, OWN_PASSWORD, MARKER.
var headers = function (token) {
  var h = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  return h;
};
var login = function (email, password) {
  return http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    headers: headers(),
    body: JSON.stringify({ email: email, password: password }),
  });
};

var own = login(OWN_EMAIL, OWN_PASSWORD);
if (own.status === 200) throw new Error("La cuenta propia sigue existiendo tras unirlas");

var hosp = login(E2E_EMAIL, E2E_PASSWORD);
if (hosp.status !== 200) hosp = login(E2E_EMAIL, E2E_NEW_PASSWORD);
if (hosp.status !== 200) throw new Error("No se pudo entrar en el acceso del hospital: " + hosp.status);
var token = json(hosp.body).access_token;

var url = SUPABASE_URL + "/rest/v1/agenda_events?title=eq." + encodeURIComponent(MARKER);
var found = http.get(url + "&select=id", { headers: headers(token) });
var rows = json(found.body);
if (!rows || rows.length !== 1) throw new Error("El dato de la cuenta propia no ha llegado al acceso del hospital: " + found.body);

var del = http.request(url, { method: "DELETE", headers: headers(token) });
if (del.status >= 300) throw new Error("No se pudo limpiar el evento de prueba: " + del.status);
output.merged = "ok";
