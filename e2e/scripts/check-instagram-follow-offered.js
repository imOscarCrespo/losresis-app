// Comprueba que la app guardó `instagram_follow_offered` en user_metadata del
// residente creado por el hospital (así no se le vuelve a enseñar).
// Variables: E2E_EMAIL, E2E_NEW_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY.
var auth = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_NEW_PASSWORD }),
});
if (auth.status !== 200) throw new Error("Login del residente de hospital falló: " + auth.status);
var meta = json(auth.body).user.user_metadata || {};
if (meta.instagram_follow_offered !== true) {
  throw new Error("instagram_follow_offered no se guardó: " + JSON.stringify(meta));
}
