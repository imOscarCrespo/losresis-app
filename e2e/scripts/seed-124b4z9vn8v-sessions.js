// ClickUp 124b4z9vn8v: deja el curso de pruebas «E2E · Curso con sesiones» del
// Hospital E2E (en borrador, sin avisos, QR fijo) con 4 sesiones: anteayer,
// ayer, hoy y mañana. El residente de pruebas queda inscrito con las dos
// primeras marcadas a mano y la de hoy sin fichar, y el fichaje de hoy
// abierto. Devuelve el código de la sesión de hoy y el de la de mañana.
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
var DAYS = [day(-2), day(-1), day(0), day(1)];

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
    event_dates: DAYS,
    enrollment_mode: "in_app",
    checkin_code_mode: "fixed",
    min_attendance_percent: null,
  }),
});
if (updated.status !== 200 || json(updated.body).length !== 1) {
  throw new Error("Preparar el curso falló: " + updated.status + " " + updated.body);
}

rpc("set_course_sessions", {
  p_course_id: COURSE,
  p_sessions: [
    { session_date: DAYS[0], title: "Teoría", starts_at: "09:00", ends_at: "14:00", location: "Aula 1" },
    { session_date: DAYS[1], title: "Casos clínicos" },
    {
      session_date: DAYS[2],
      title: "Sesión práctica",
      starts_at: "16:00",
      ends_at: "20:00",
      location: "Sala de simulación",
    },
    { session_date: DAYS[3], title: "Evaluación" },
  ],
});

var enrollment = rpc("add_course_enrollment_by_email", {
  p_course_id: COURSE,
  p_email: E2E_EMAIL,
});
var enrollmentId = enrollment.enrollment_id;

rpc("set_course_attendance", { p_enrollment_id: enrollmentId, p_session_date: DAYS[0], p_attended: true });
rpc("set_course_attendance", { p_enrollment_id: enrollmentId, p_session_date: DAYS[1], p_attended: true });
rpc("set_course_attendance", { p_enrollment_id: enrollmentId, p_session_date: DAYS[2], p_attended: false });

rpc("open_course_checkin", { p_course_id: COURSE });

output.todayCode = rpc("get_course_session_checkin_code", {
  p_course_id: COURSE,
  p_session_date: DAYS[2],
}).code;
output.tomorrowCode = rpc("get_course_session_checkin_code", {
  p_course_id: COURSE,
  p_session_date: DAYS[3],
}).code;
