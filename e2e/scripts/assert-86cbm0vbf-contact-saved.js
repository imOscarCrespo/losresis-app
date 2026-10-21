// ClickUp 86cbm0vbf: comprueba el contacto en texto libre de la experiencia de pruebas.
// La app no deja abrir la ficha propia desde «Explorar destinos», así que se lee la fila.
// Actúa como el propio residente (su JWT y RLS por propietario): solo lee datos suyos.
// Variables: E2E_EMAIL, E2E_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY (las pasa scripts/e2e.sh)
// y EXPECTED_CONTACT (el texto esperado en tutor_name; vacío = sin contacto).
var HOSPITAL = "E2E Hospital de Pruebas";

var auth = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
if (auth.status !== 200) throw new Error("Login del residente de pruebas falló: " + auth.status);
var session = json(auth.body);

var rows = json(
  http.get(
    SUPABASE_URL +
      "/rest/v1/external_rotation_review?select=tutor_name,tutor_email,contact_phone,contact_url" +
      "&user_id=eq." + session.user.id +
      "&external_hospital_name=eq." + encodeURIComponent(HOSPITAL),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + session.access_token,
      },
    }
  ).body
);
if (rows.length !== 1) throw new Error("Se esperaba 1 experiencia de pruebas y hay " + rows.length);

var expected = {
  tutor_name: EXPECTED_CONTACT || null,
  tutor_email: null,
  contact_phone: null,
  contact_url: null,
};
Object.keys(expected).forEach(function (key) {
  if (rows[0][key] !== expected[key]) {
    throw new Error(key + " guardado como " + rows[0][key] + ", se esperaba " + expected[key]);
  }
});
output.contactSaved = true;
