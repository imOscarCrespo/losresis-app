// Tras salir del onboarding, la cuenta vacía debe haberse borrado: entrar con
// sus credenciales ya no funciona. Variables: SUPABASE_URL, SUPABASE_ANON_KEY,
// SELF_EMAIL y SELF_PASSWORD (las deja seed-onboarding-exit.js).
var login = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: SELF_EMAIL, password: SELF_PASSWORD }),
});
if (login.status === 200) throw new Error("La cuenta vacía sigue existiendo tras salir del onboarding");
if (login.status !== 400) throw new Error("Respuesta inesperada al comprobar el borrado: " + login.status);
output.deleted = "ok";
