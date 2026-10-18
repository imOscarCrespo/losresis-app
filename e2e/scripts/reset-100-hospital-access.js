// Trello #100: deja al residente "creado por el hospital" como recién dado de alta —
// contraseña provisional y marca must_change_password— para que el flujo pueda repetirse.
// Actúa como el propio residente (la marca vive en user_metadata, que él puede escribir).
// Variables: E2E_EMAIL, E2E_PASSWORD (provisional), E2E_NEW_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY.
var login = function (password) {
  return http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: E2E_EMAIL, password: password }),
  });
};

var withTemp = login(E2E_PASSWORD);
var auth = withTemp.status === 200 ? withTemp : login(E2E_NEW_PASSWORD);
if (auth.status !== 200) throw new Error("Login del residente de hospital falló: " + auth.status);

var body = { data: { must_change_password: true } };
// Si entró con la nueva, vuelve a la provisional (Supabase no deja "cambiar" a la misma).
if (withTemp.status !== 200) body.password = E2E_PASSWORD;

var update = http.request(SUPABASE_URL + "/auth/v1/user", {
  method: "PUT",
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + json(auth.body).access_token,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});
if (update.status !== 200) throw new Error("No se pudo reiniciar el acceso: " + update.status);
