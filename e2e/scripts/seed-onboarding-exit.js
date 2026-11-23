// Salida del onboarding (Althaia, 2026-11-23): crea una cuenta nueva y vacía,
// como la que se crea al pulsar «Continuar con Google» por error. El registro
// por email está abierto y se confirma solo, así que basta la anon key.
// El flujo la borra al salir del onboarding; check-onboarding-exit-deleted.js
// comprueba que ya no existe. Variables: SUPABASE_URL, SUPABASE_ANON_KEY.
var stamp = Date.now() + "-" + Math.floor(Math.random() * 1e6);
var email = "e2e-onboarding-exit-" + stamp + "@losresis.test";
var password = "E2e-" + stamp + "-x";

var signup = http.post(SUPABASE_URL + "/auth/v1/signup", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: email, password: password }),
});
if (signup.status !== 200) throw new Error("No se pudo crear la cuenta de prueba: " + signup.status);

output.SELF_EMAIL = email;
output.SELF_PASSWORD = password;
