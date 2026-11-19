// Ensayo de los cursos de Althaia (noviembre de 2026): grupos a la vez y una
// actividad repetida por grupo (ADR 0042 y 0046 del panel).
//
// Deja el curso de pruebas «E2E · Curso con sesiones» del Hospital E2E (en
// borrador, sin avisos) con QR dinámico, mínimo del 80 % y estas sesiones:
//   hoy    08:00–14:00  Grup A                         (a la vez que B)
//   hoy    08:00–14:00  Grup B
//   hoy    15:00–16:00  Pràctic S1 (Grup 1)  actividad «Pràctic S1»
//   hoy    17:00–18:00  Pràctic S1 (Grup 2)  actividad «Pràctic S1»
//   mañana 09:00–11:00  Simulació
// Unidades para el %: Grup A/B, Pràctic S1 y Simulació = 3.
// El residente de pruebas queda inscrito sin ningún fichaje y con el fichaje
// de Grup A y Grup B abierto (las dos salas a la vez). Repetible.
// Lo hace el owner del panel del Hospital E2E, como desde el panel.
// Variables: PANEL_OWNER_EMAIL, PANEL_OWNER_PASSWORD, E2E_EMAIL, SUPABASE_URL,
// SUPABASE_ANON_KEY (las pasa scripts/e2e.sh).
var COURSE = "e2e0b92a-0000-4000-8000-000000000003";

// Fecha local (la del Mac y el simulador, en Madrid), no UTC.
var pad = function (n) { return (n < 10 ? "0" : "") + n; };
var day = function (offset) {
  var now = new Date();
  var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
};
var TODAY = day(0);
var TOMORROW = day(1);

var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: PANEL_OWNER_EMAIL, password: PANEL_OWNER_PASSWORD }),
});
if (res.status !== 200) throw new Error("Login del panel falló: " + res.status);
var token = json(res.body).access_token;
var headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + token,
  "Content-Type": "application/json",
};

var rpc = function (name, params) {
  var r = http.post(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    headers: headers,
    body: JSON.stringify(params),
  });
  if (r.status !== 200 && r.status !== 204) {
    throw new Error(name + " falló: " + r.status + " " + r.body);
  }
  return r.body ? json(r.body) : null;
};

var updated = http.request(SUPABASE_URL + "/rest/v1/courses?id=eq." + COURSE, {
  method: "PATCH",
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({
    event_dates: [TODAY, TOMORROW],
    enrollment_mode: "in_app",
    checkin_code_mode: "rotating",
    min_attendance_percent: 80,
  }),
});
if (updated.status !== 200 || json(updated.body).length !== 1) {
  throw new Error("Preparar el curso falló: " + updated.status + " " + updated.body);
}

rpc("set_course_sessions", {
  p_course_id: COURSE,
  p_sessions: [
    { session_date: TODAY, title: "Grup A", starts_at: "08:00", ends_at: "14:00", location: "Aula A", activity: null },
    { session_date: TODAY, title: "Grup B", starts_at: "08:00", ends_at: "14:00", location: "Aula B", activity: null },
    { session_date: TODAY, title: "Pràctic S1 (Grup 1)", starts_at: "15:00", ends_at: "16:00", location: "Aula E", activity: "Pràctic S1" },
    { session_date: TODAY, title: "Pràctic S1 (Grup 2)", starts_at: "17:00", ends_at: "18:00", location: "Aula F", activity: "Pràctic S1" },
    { session_date: TOMORROW, title: "Simulació", starts_at: "09:00", ends_at: "11:00", location: "Aula J", activity: null },
  ],
});

var sessions = json(
  http.get(
    SUPABASE_URL + "/rest/v1/course_session?course_id=eq." + COURSE + "&select=id,title,session_date",
    { headers: headers }
  ).body
);
var idOf = function (title) {
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].title === title) return sessions[i].id;
  }
  throw new Error("No está la sesión " + title);
};

var enrollment = rpc("add_course_enrollment_by_email", { p_course_id: COURSE, p_email: E2E_EMAIL });
var enrollmentId = enrollment.enrollment_id;

// Sin fichajes de una pasada anterior (las sesiones de mañana no se pueden marcar).
["Grup A", "Grup B", "Pràctic S1 (Grup 1)", "Pràctic S1 (Grup 2)"].forEach(function (title) {
  rpc("set_course_session_attendance", {
    p_enrollment_id: enrollmentId,
    p_session_id: idOf(title),
    p_attended: false,
  });
});

// Las dos salas a la vez: abrir A cierra lo demás del curso; abrir B no cierra A.
rpc("open_course_session_checkin", { p_session_id: idOf("Grup A") });
rpc("open_course_session_checkin", { p_session_id: idOf("Grup B") });

var open = function (title) {
  return rpc("get_course_session_checkin", { p_session_id: idOf(title) }).is_open;
};
if (!open("Grup A") || !open("Grup B")) {
  throw new Error("Grup A y Grup B tendrían que tener el fichaje abierto a la vez");
}
output.seeded = "ok";
