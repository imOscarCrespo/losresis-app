// ClickUp 124b4z9vbvu: lo que el residente envió desde la app lo ve Docencia, y el
// residente no puede leer ni escribir la valoración del servicio.
// Variables: las de seed-124b4z9vbvu-evaluation.js y EVALUATION_ID.
var login = function (email, password) {
  var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  });
  if (res.status !== 200) throw new Error("Login falló: " + res.status);
  return json(res.body).access_token;
};
var headers = function (token) {
  return { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" };
};
var owner = login(PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD);
var resident = login(E2E_EMAIL, E2E_PASSWORD);

// Docencia ve la autoevaluación enviada, con una valoración por objetivo.
var rows = json(
  http.get(
    SUPABASE_URL + "/rest/v1/rotation_self_assessment?select=objectives_completed_at,completed_at,rubric_answers,period_start,rotation_assessment_version(content)&id=eq." + EVALUATION_ID,
    { headers: headers(owner) }
  ).body
);
if (rows.length !== 1) throw new Error("Docencia no ve la evaluación");
var row = rows[0];
if (!row.objectives_completed_at || !row.completed_at) throw new Error("La autoevaluación no consta como enviada");
var blocks = row.rotation_assessment_version.content.blocks;
var objectivesBlock = blocks.filter(function (b) { return b.kind === "objectives"; })[0];
var rated = Object.keys(row.rubric_answers[objectivesBlock.id] || {}).length;
if (rated !== 5) throw new Error("Docencia ve " + rated + " valoraciones de objetivos, se esperaban 5");

// El residente no lee la valoración del servicio…
var service = json(
  http.get(SUPABASE_URL + "/rest/v1/rotation_service_evaluation?select=assessment_id&assessment_id=eq." + EVALUATION_ID, {
    headers: headers(resident),
  }).body
);
if (service.length !== 0) throw new Error("El residente lee la valoración del servicio");
// …ni la escribe.
var write = http.post(SUPABASE_URL + "/rest/v1/rpc/save_rotation_service_evaluation", {
  headers: headers(resident),
  body: JSON.stringify({ p_assessment_id: EVALUATION_ID, p_answers: {} }),
});
if (write.status === 200) throw new Error("El residente ha podido escribir la valoración del servicio");
// Y el owner tampoco valora: es cosa del Responsable de la especialidad.
var ownerWrite = http.post(SUPABASE_URL + "/rest/v1/rpc/save_rotation_service_evaluation", {
  headers: headers(owner),
  body: JSON.stringify({ p_assessment_id: EVALUATION_ID, p_answers: {} }),
});
if (ownerWrite.status === 200) throw new Error("El owner ha podido valorar como servicio");
output.evaluationChecked = true;
