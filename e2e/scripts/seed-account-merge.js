// Fusión de cuentas (Althaia, 2026-11-23): crea una cuenta propia de residente
// —como la de Daunel— con un dato suyo (un evento de agenda), sin email
// corporativo, en el mismo centro que el residente de hospital de pruebas.
// El flujo escribe en su perfil el email del acceso del hospital (E2E_EMAIL) y
// las une. Variables: SUPABASE_URL, SUPABASE_ANON_KEY.
var stamp = Date.now() + "-" + Math.floor(Math.random() * 1e6);
var email = "e2e-account-merge-" + stamp + "@losresis.test";
var password = "E2e-" + stamp + "-x";
var marker = "E2E fusion " + stamp;
var headers = function (token) {
  var h = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  return h;
};

var signup = http.post(SUPABASE_URL + "/auth/v1/signup", {
  headers: headers(),
  body: JSON.stringify({ email: email, password: password }),
});
if (signup.status !== 200) throw new Error("No se pudo crear la cuenta propia: " + signup.status);
var session = json(signup.body);
var token = session.access_token;
var userId = session.user.id;

var profile = http.request(SUPABASE_URL + "/rest/v1/users?id=eq." + userId, {
  method: "PATCH",
  headers: headers(token),
  body: JSON.stringify({
    name: "E2E",
    surname: "Fusion",
    city: "Madrid",
    is_resident: true,
    is_student: false,
    hospital_id: "e474d858-b87d-4ba5-b5b9-97e44128fdfa",
    speciality_id: "a34a6d80-a608-48bc-93a2-415fcbb7148e",
    resident_year: 2,
    onboarding_completed: true,
  }),
});
if (profile.status >= 300) throw new Error("No se pudo preparar el perfil: " + profile.status + " " + profile.body);

var today = new Date().toISOString().slice(0, 10);
var event = http.post(SUPABASE_URL + "/rest/v1/agenda_events", {
  headers: headers(token),
  body: JSON.stringify({ user_id: userId, event_type: "study", title: marker, event_date: today }),
});
if (event.status >= 300) throw new Error("No se pudo crear el dato de la cuenta propia: " + event.status + " " + event.body);

output.OWN_EMAIL = email;
output.OWN_PASSWORD = password;
output.MARKER = marker;
