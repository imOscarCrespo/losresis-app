// ClickUp 124b4z9vc4y (fase 2): el tutor revisa el caso EPOC del residente R1
// como lo haría desde el panel (RPC review_clinical_case).
// env OUTCOME: "changes_requested" o "reviewed".
// Variables: E2E_EMAIL, E2E_PASSWORD, PANEL_TUTOR_EMAIL, PANEL_TUTOR_PASSWORD,
// SUPABASE_URL, SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var EPOC = "c4a5e000-0000-4000-8000-0000000000e1";

if (!PANEL_TUTOR_EMAIL) throw new Error("Falta PANEL_TUTOR_EMAIL en ~/.config/losresis/e2e-panel.env");

var login = function (email, password) {
  var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  });
  if (res.status !== 200) throw new Error("Login falló: " + res.status);
  return json(res.body);
};
var headers = function (token) {
  return { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" };
};

var resident = login(E2E_EMAIL, E2E_PASSWORD);
var tutor = login(PANEL_TUTOR_EMAIL, PANEL_TUTOR_PASSWORD).access_token;

var cases = json(
  http.get(
    SUPABASE_URL + "/rest/v1/libro_clinical_case?select=id,review_status&requirement_id=eq." + EPOC + "&user_id=eq." + resident.user.id,
    { headers: headers(resident.access_token) }
  ).body
);
if (cases.length !== 1 || cases[0].review_status !== "pending") {
  throw new Error("EPOC no está pendiente de revisión: " + JSON.stringify(cases));
}

var params =
  OUTCOME === "changes_requested"
    ? {
        p_case_id: cases[0].id,
        p_outcome: "changes_requested",
        p_overall_assessment: "Buen planteamiento inicial.",
        p_strengths: null,
        p_improvements: "Falta profundizar en la reflexión.",
        p_comments_for_resident: "Amplía la reflexión y vuelve a enviarlo.",
      }
    : {
        p_case_id: cases[0].id,
        p_outcome: "reviewed",
        p_overall_assessment: "Buen análisis del caso. Adecuada interpretación de pruebas.",
        p_strengths: "Buen razonamiento clínico.\nReflexión crítica y realista.",
        p_improvements: "Profundizar en indicaciones de ventilación no invasiva.",
        p_comments_for_resident: "Muy buen trabajo.",
      };

var reviewed = http.post(SUPABASE_URL + "/rest/v1/rpc/review_clinical_case", {
  headers: headers(tutor),
  body: JSON.stringify(params),
});
if (reviewed.status !== 200) throw new Error("La revisión falló: " + reviewed.status + " " + reviewed.body);
