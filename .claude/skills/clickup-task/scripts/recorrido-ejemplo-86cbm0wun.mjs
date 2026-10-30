// EJEMPLO de recorrido para panel_browser.mjs (tarea 86cbm0wun, pendientes de Docencia).
// Copia este fichero al scratchpad como recorrido-<número>.mjs y adáptalo a los criterios de
// aceptación de la tarea. Uso:
//   PW_DIR=<scratchpad>/pw node .claude/skills/clickup-task/scripts/panel_browser.mjs \
//     https://panel.losresis.com <scratchpad>/recorrido-<número>.mjs <scratchpad>/evidencias

// R1 es el residente real del Hospital E2E: así el salto al módulo enseña filas reales.
const R = {
  lucia: { id: "d1ee0bdd-2c53-4093-83ea-d697b3f49e19", name: "Lucía", surname: "Martín", resident_year: 2 },
  pablo: { id: "aaaaaaaa-0000-4000-8000-000000000002", name: "Pablo", surname: "Ruiz", resident_year: 1 },
  ana: { id: "aaaaaaaa-0000-4000-8000-000000000003", name: "Ana", surname: "Gómez", resident_year: 3 },
  javier: { id: "aaaaaaaa-0000-4000-8000-000000000004", name: "Javier", surname: "Soto", resident_year: 4 },
};
const SPEC = "mock-spec";
const C = "2026-09-01T10:00:00Z"; // dentro del curso 2026-2027

const evaluacion = (user_id, extra = {}) => ({
  user_id, period_end: null, created_at: C, completed_at: null, finalized_at: null,
  objective_answers: {}, rubric_answers: {}, final_reflection: null, service: null, ...extra,
});
const hecha = { answers: {}, completed_at: C };

const DATOS = {
  tutorias: [
    { resident_user_id: R.lucia.id, status: "scheduled", scheduled_at: "2026-10-20T09:00:00Z" }, // vencida
    { resident_user_id: R.javier.id, status: "scheduled", scheduled_at: "2026-11-12T09:00:00Z" },
  ],
  autoevaluaciones: [
    { resident_user_id: R.pablo.id, status: "pending", due_date: "2026-11-15", created_at: C },
    { resident_user_id: R.pablo.id, status: "pending", due_date: "2026-10-15", created_at: C }, // vencida
    { resident_user_id: R.javier.id, status: "submitted", due_date: "2026-10-01", created_at: C },
  ],
  evaluaciones: [
    evaluacion(R.lucia.id, { period_end: "2026-10-10" }), // las dos partes, vencida
    evaluacion(R.lucia.id, { completed_at: C }), // falta el servicio
    evaluacion(R.pablo.id, { service: hecha }), // falta el residente
  ],
};

// Lo que tiene que salir con DATOS.
const ESPERADO = {
  resumen: ["Evaluaciones", "3", "2 te tocan", "2 del residente", "1 vencida",
            "Tutorías", "2 te tocan", "Autoevaluaciones", "1 te tocan", "2 del residente"],
  filas: {
    [R.lucia.id]: ["Eval. 2", "Tut. 1"],
    [R.pablo.id]: ["Eval. 1", "Autoev. 2"],
    [R.ana.id]: ["Todo al día"],
    [R.javier.id]: ["Tut. 1", "Autoev. 1"],
  },
};

const ESCENARIOS = {
  mixto: { datos: DATOS },
  vacio: { datos: { tutorias: [], autoevaluaciones: [], evaluaciones: [] } },
  "error-tutorias": { datos: DATOS, fallan: ["tutorias"] },
};


const json = (route, body, headers = {}) =>
  route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) }).then(() => true);

const handler = (escenario) => async (route, { tabla, select }) => {
  const { datos, fallan = [] } = ESCENARIOS[escenario];
  const modulo =
    tabla === "hospital_tutoring" && select === "resident_user_id,status,scheduled_at" ? "tutorias"
    : tabla === "hospital_self_assessment" && select === "resident_user_id,status,due_date,created_at" ? "autoevaluaciones"
    : tabla === "rotation_self_assessment" && select.startsWith("user_id,period_end") ? "evaluaciones"
    : null;
  if (modulo) {
    if (fallan.includes(modulo)) {
      await route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"mock: fallo forzado"}' });
      return true;
    }
    return json(route, datos[modulo]);
  }
  if (tabla === "users" && select === "id,name,surname,resident_year,speciality_id") {
    const filas = Object.values(R).map((r) => ({ ...r, speciality_id: SPEC }));
    return json(route, filas, { "content-range": `0-${filas.length - 1}/${filas.length}` });
  }
  if (tabla === "rpc/libro_year_progress_for_panel") {
    return json(route, [
      { user_id: R.lucia.id, residency_year: 2, done: 9, total: 20 },
      { user_id: R.pablo.id, residency_year: 1, done: 3, total: 20 },
      { user_id: R.ana.id, residency_year: 3, done: 18, total: 20 },
      { user_id: R.javier.id, residency_year: 4, done: 12, total: 20 },
    ]);
  }
  return false;
};

const nombre = (id) => Object.values(R).find((r) => r.id === id).name;

export default async ({ page, base, shot, check, mock }) => {
  const inicio = async (captura) => {
    await page.goto(`${base}/dashboard`);
    const bloque = page.locator("[data-testid=resumen-pendientes]");
    await bloque.waitFor();
    await page.waitForTimeout(1500);
    await bloque.scrollIntoViewIfNeeded();
    await shot(captura);
    return bloque.innerText();
  };
  const residentes = async (captura) => {
    await page.goto(`${base}/dashboard/residents-libros`);
    await page.waitForSelector(`text=${R.ana.name} ${R.ana.surname}`);
    await shot(captura);
  };
  const fila = (id) => page.locator("tr", { has: page.locator(`text=${nombre(id)} `) }).innerText();

  await mock(handler("mixto"));
  check("mixto · resumen de Inicio", await inicio("86cbm0wun-1-inicio-pendientes"), ESPERADO.resumen);
  await residentes("86cbm0wun-2-residentes-pendientes");
  for (const [id, esperados] of Object.entries(ESPERADO.filas)) {
    check(`mixto · fila ${nombre(id)}`, await fila(id), esperados);
  }

  await page.locator(`[data-testid=pendientes-${R.lucia.id}] a`, { hasText: "Eval." }).click();
  await page.waitForURL(/autoevaluacion-rotaciones\/evaluaciones\?residente=/);
  await page.waitForSelector("[data-testid=filtro-residente]");
  await shot("86cbm0wun-3-destino-evaluaciones-filtrado");
  check("destino evaluaciones", await page.locator("[data-testid=filtro-residente]").innerText(), ["Filtrando por"]);
  await page.locator("[data-testid=filtro-residente] button").click();
  await page.waitForURL((u) => !u.search.includes("residente"));
  check("Quitar limpia el filtro", page.url(), ["/evaluaciones"]);

  await page.goto(`${base}/dashboard/residents-libros`);
  await page.waitForSelector(`[data-testid=pendientes-${R.lucia.id}]`);
  await page.locator(`[data-testid=pendientes-${R.lucia.id}] a`, { hasText: "Tut." }).click();
  await page.waitForURL(/tutorias\?residente=/);
  await page.waitForSelector("[data-testid=filtro-residente]");
  await shot("86cbm0wun-4-destino-tutorias-filtrado");

  await page.goto(`${base}/dashboard/autoevaluacion?residente=${R.lucia.id}`);
  await page.waitForSelector("[data-testid=filtro-residente]");
  await shot("86cbm0wun-5-destino-autoevaluacion-filtrado");

  await mock(handler("vacio"));
  check("vacío · resumen de Inicio", await inicio("86cbm0wun-6-inicio-todo-al-dia"), ["Todo al día"]);
  await residentes("86cbm0wun-7-residentes-todo-al-dia");
  check("vacío · fila Lucía", await fila(R.lucia.id), ["Todo al día"]);

  await mock(handler("error-tutorias"));
  check("error · resumen de Inicio", await inicio("86cbm0wun-8-inicio-modulo-no-disponible"), ["No disponible", "Evaluaciones"]);
  await residentes("86cbm0wun-9-residentes-modulo-no-disponible");
  check("error · fila Lucía", await fila(R.lucia.id), ["Tut. No disponible", "Eval. 2"]);
};
