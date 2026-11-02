// ClickUp 124b4z9w0da: prepara las nóminas del residente de pruebas (solo las suyas).
// MODE=reset    → borra nov. y dic. de 2026 y deja noviembre con 3.452 € ya organizado
//                 (700/450/120/300/542), el «mes pasado» de diciembre.
// MODE=drop-dec → borra solo diciembre de 2026, para volver a registrarla como nueva.
// MODE=assert   → noviembre sigue intacto y diciembre está organizado con HOUSING €
//                 en Vivienda (el reparto reutilizado no toca el mes anterior).
// Variables: E2E_EMAIL, E2E_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY (scripts/e2e.sh).
var YEAR = 2026;

var res = http.post(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
if (res.status !== 200) throw new Error("Login falló: " + res.status);
var session = json(res.body);
var userId = session.user.id;
var headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + session.access_token,
  "Content-Type": "application/json",
};
var base = SUPABASE_URL + "/rest/v1/resident_monthly_payouts";
var own = "?user_id=eq." + userId + "&period_year=eq." + YEAR;

function remove(months) {
  var deleted = http.delete(base + own + "&period_month=in.(" + months + ")", { headers: headers });
  if (deleted.status !== 204) throw new Error("Borrado falló: " + deleted.status + " " + deleted.body);
}

function read(month) {
  var got = http.get(base + own + "&period_month=eq." + month + "&select=*", { headers: headers });
  if (got.status !== 200) throw new Error("Lectura falló: " + got.status);
  return json(got.body)[0] || null;
}

if (MODE === "reset") {
  remove("11,12");
  var created = http.post(base, {
    headers: headers,
    body: JSON.stringify({
      user_id: userId,
      period_year: YEAR,
      period_month: 11,
      gross_total_eur: 3452,
      housing_expense_eur: 700,
      food_expense_eur: 450,
      transport_expense_eur: 120,
      leisure_expense_eur: 300,
      other_expense_eur: 542,
      expenses_organized_at: new Date().toISOString(),
    }),
  });
  if (created.status !== 201) throw new Error("Alta falló: " + created.status + " " + created.body);
} else if (MODE === "drop-dec") {
  remove("12");
} else if (MODE === "assert") {
  var nov = read(11);
  if (!nov || Number(nov.housing_expense_eur) !== 700 || Number(nov.other_expense_eur) !== 542) {
    throw new Error("Noviembre ha cambiado: " + JSON.stringify(nov));
  }
  var dec = read(12);
  if (!dec || !dec.expenses_organized_at) throw new Error("Diciembre sin organizar");
  if (Number(dec.housing_expense_eur) !== Number(HOUSING)) {
    throw new Error("Vivienda de diciembre: " + dec.housing_expense_eur + " ≠ " + HOUSING);
  }
} else {
  throw new Error("MODE desconocido: " + MODE);
}
