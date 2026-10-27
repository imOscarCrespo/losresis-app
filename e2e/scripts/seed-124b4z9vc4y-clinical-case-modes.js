// ClickUp 124b4z9vc4y (fase 4): prepara los modos de casos clínicos para el
// residente de pruebas (R1 MFyC del Hospital E2E, un hospital is_test).
//   - Como residente: borra SUS casos clínicos y registra dos casos libres ya
//     completados («Asma E2E» y «Migraña E2E»), para vincularlos en el flujo.
//     Solo toca datos suyos.
//   - Como owner del panel: pone R1 de la plantilla MFyC en «Casos por
//     categoría» con Respiratorio (mínimo 2) y Neurología (mínimo 1), ids fijos,
//     y la deja publicada. Guarda en output.wasPublished cómo estaba, para que
//     restore-124b4z9vc4y-clinical-cases-template.js la deje igual.
// Variables: E2E_EMAIL, E2E_PASSWORD, PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD,
// SUPABASE_URL, SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var TEMPLATE_ID = "df9bf83a-b7b2-406b-b24b-603a59a8d4a5";

if (!PANEL_OWNER_EMAIL) throw new Error("Falta ~/.config/losresis/e2e-panel.env con PANEL_OWNER_EMAIL");

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
var owner = login(PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD).access_token;

var cleared = http.request(
  SUPABASE_URL + "/rest/v1/libro_clinical_case?user_id=eq." + resident.user.id,
  { method: "DELETE", headers: headers(resident.access_token) }
);
if (cleared.status !== 204) throw new Error("No se pudieron borrar sus casos: " + cleared.status);

var template = json(
  http.get(SUPABASE_URL + "/rest/v1/libro_template?select=is_published&id=eq." + TEMPLATE_ID, {
    headers: headers(owner),
  }).body
);
if (!template.length) throw new Error("No se encuentra la plantilla MFyC del Hospital E2E");
output.wasPublished = template[0].is_published ? "true" : "false";

var saved = http.post(SUPABASE_URL + "/rest/v1/rpc/save_libro_clinical_case_block", {
  headers: headers(owner),
  body: JSON.stringify({
    p_template_id: TEMPLATE_ID,
    p_residency_year: 1,
    p_block: {
      id: "c4a5e000-0000-4000-8000-000000000001",
      position: 99,
      requirement_mode: "category",
      requirements: [
        { id: "c4a5e000-0000-4000-8000-0000000000f1", title: "Respiratorio", description: "Patología respiratoria aguda o crónica reagudizada.", is_required: true, minimum_cases: 2, position: 0 },
        { id: "c4a5e000-0000-4000-8000-0000000000f2", title: "Neurología", description: null, is_required: true, minimum_cases: 1, position: 1 },
      ],
    },
  }),
});
if (saved.status !== 200) throw new Error("No se pudieron guardar las categorías: " + saved.status + " " + saved.body);

if (!template[0].is_published) {
  var published = http.request(SUPABASE_URL + "/rest/v1/libro_template?id=eq." + TEMPLATE_ID, {
    method: "PATCH",
    headers: headers(owner),
    body: JSON.stringify({ is_published: true }),
  });
  if (published.status !== 204) throw new Error("No se pudo publicar: " + published.status + " " + published.body);
}

var completedCase = function (title, date) {
  return {
    user_id: resident.user.id,
    residency_year: 1,
    requirement_id: null,
    title: title,
    status: "completed",
    case_date: date,
    chief_complaint: "Motivo de consulta de prueba",
    relevant_history: "Sin antecedentes relevantes",
    physical_exam: "Exploración de prueba",
    complementary_tests: "Pruebas de prueba",
    clinical_course: "Evolución favorable",
    final_diagnosis: "Diagnóstico de prueba",
    treatment_and_outcome: "Tratamiento de prueba",
    reflection: "Reflexión de prueba",
  };
};
var created = http.post(SUPABASE_URL + "/rest/v1/libro_clinical_case", {
  headers: headers(resident.access_token),
  body: JSON.stringify([completedCase("Asma E2E", "2026-10-02"), completedCase("Migraña E2E", "2026-10-05")]),
});
if (created.status !== 201) throw new Error("No se pudieron crear sus casos libres: " + created.status + " " + created.body);
