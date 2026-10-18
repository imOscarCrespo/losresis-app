#!/usr/bin/env node
// Trello #100 · E2E de las rutas /api/team/residents del panel (owner y tutor de la org «E2E Panel #100»).
// Uso: arrancar el panel (`npx next dev -p 3100` en losresis-panel) y
//      node e2e/scripts/panel-100-residents-api.mjs .env http://localhost:3100
// Credenciales en ~/.config/losresis/e2e-panel.env. Crea y borra sus propios residentes.
import { readFileSync } from "node:fs";

const parse = (p) => Object.fromEntries(readFileSync(p, "utf8").split("\n").filter((l) => l.includes("="))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const app = parse(process.argv[2]);
const creds = parse(`${process.env.HOME}/.config/losresis/e2e-panel.env`);
const SB = app.EXPO_PUBLIC_SUPABASE_URL, ANON = app.EXPO_PUBLIC_SUPABASE_ANON_KEY, SRV = app.SUPABASE_SERVICE_ROLE_KEY;
const PANEL = process.argv[3] || "http://localhost:3100";
const MFYC = "a34a6d80-a608-48bc-93a2-415fcbb7148e", CARDIO = "26d8f727-98c3-4764-b0fd-068dc4fce581";
const ORG = creds.PANEL_ORG_ID;
const stamp = Date.now().toString(36);
const mail = (k) => `e2e-panel-res-${k}-${stamp}@losresis.test`;

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`✅ ${name}`); } else { fail++; console.log(`❌ ${name} ${extra}`); }
};

const login = async (email, password) => {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }) });
  return { status: r.status, body: await r.json() };
};
const api = async (token, method, path, body) => {
  const r = await fetch(`${PANEL}${path}`, { method, headers: {
    "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const srv = async (path) => (await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })).json();
const authUser = async (id) => (await fetch(`${SB}/auth/v1/admin/users/${id}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })).json();

const owner = (await login(creds.PANEL_OWNER_EMAIL, creds.PANEL_OWNER_PASSWORD)).body.access_token;
const tutor = (await login(creds.PANEL_TUTOR_EMAIL, creds.PANEL_TUTOR_PASSWORD)).body.access_token;
check("login owner y tutor", Boolean(owner && tutor));
const created = [];

try {
  // --- Acceso
  check("sin sesión → 401", (await api(null, "GET", "/api/team/residents")).status === 401);

  // --- Owner: listado y validaciones
  let r = await api(owner, "GET", "/api/team/residents");
  check("owner GET 200", r.status === 200, JSON.stringify(r.json).slice(0, 120));
  check("owner ve el catálogo completo de especialidades", (r.json?.specialities?.length || 0) > 20);

  const valid = (k, extra = {}) => ({ email: mail(k), name: "Res", surname: `E2E ${k}`, specialityId: MFYC, residentYear: 1, ...extra });
  r = await api(owner, "POST", "/api/team/residents", { email: mail("x"), name: "Res" });
  check("faltan campos → 400", r.status === 400);
  r = await api(owner, "POST", "/api/team/residents", valid("x", { email: "alguien@gmail.com" }));
  check("dominio ajeno → 400 dominio_no_permitido", r.status === 400 && r.json?.code === "dominio_no_permitido");
  r = await api(owner, "POST", "/api/team/residents", valid("x", { residentYear: 6 }));
  check("R6 → 400", r.status === 400);
  r = await api(owner, "POST", "/api/team/residents", valid("x", { specialityId: "00000000-0000-0000-0000-000000000000" }));
  check("especialidad inexistente → 400", r.status === 400);
  r = await api(owner, "POST", "/api/team/residents", valid("x", { email: "e2e-resident@losresis.test" }));
  check("email de un residente con Google/otro hospital → 409 ya_tiene_cuenta", r.status === 409 && r.json?.code === "ya_tiene_cuenta", JSON.stringify(r.json));
  r = await api(owner, "POST", "/api/team/residents", valid("x", { email: creds.PANEL_TUTOR_EMAIL }));
  check("email de un médico → 409 es_medico", r.status === 409 && r.json?.code === "es_medico", JSON.stringify(r.json));

  // --- Owner crea A (MFyC)
  r = await api(owner, "POST", "/api/team/residents", valid("a", { email: `  ${mail("a").toUpperCase()} ` }));
  check("owner crea residente A → 201 con contraseña", r.status === 201 && r.json?.provisional_password?.length === 12, JSON.stringify(r.json?.error || ""));
  const A = { id: r.json?.user_id, email: mail("a"), pw: r.json?.provisional_password };
  if (A.id) created.push(A.id);
  check("email normalizado en minúsculas", r.json?.email === A.email);

  r = await api(owner, "POST", "/api/team/residents", valid("a"));
  check("repetir A → 409 ya_es_residente", r.status === 409 && r.json?.code === "ya_es_residente", JSON.stringify(r.json));

  const [profA] = await srv(`users?id=eq.${A.id}&select=is_resident,is_doctor,resident_state,onboarding_completed,city,resident_year,hospital_id,speciality_id,work_email,created_by_org_id,name,surname`);
  check("perfil A completo para la app", profA?.is_resident === true && profA?.is_doctor === false && profA?.resident_state === "active"
    && profA?.onboarding_completed === true && profA?.city === "Madrid" && profA?.resident_year === 1
    && profA?.speciality_id === MFYC && profA?.work_email === A.email && profA?.created_by_org_id === ORG, JSON.stringify(profA));
  const auA = await authUser(A.id);
  check("A: provider email + must_change_password", auA?.app_metadata?.provider === "email" && auA?.user_metadata?.must_change_password === true);

  // --- La app puede entrar con la provisional
  const la = await login(A.email, A.pw);
  check("A entra con la provisional (lo que hace la app)", la.status === 200 && la.body.user?.user_metadata?.must_change_password === true);

  // --- A no puede quitarse la marca de origen (trigger)
  await fetch(`${SB}/rest/v1/users?id=eq.${A.id}`, { method: "PATCH", headers: {
    apikey: ANON, Authorization: `Bearer ${la.body.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ created_by_org_id: null }) });
  const [afterPatch] = await srv(`users?id=eq.${A.id}&select=created_by_org_id`);
  check("A no puede borrar su created_by_org_id", afterPatch?.created_by_org_id === ORG);

  // --- Un residente no puede usar las rutas
  r = await api(la.body.access_token, "GET", "/api/team/residents");
  check("residente llamando a la ruta → 403", r.status === 403);

  // --- Listado del owner
  r = await api(owner, "GET", "/api/team/residents");
  const itemA = r.json?.residents?.find((x) => x.user_id === A.id);
  check("owner lista a A con estado (entró, sin cambiar contraseña)", Boolean(itemA?.last_sign_in_at) && itemA?.pending_password_change === true && itemA?.email === A.email, JSON.stringify(itemA));

  // --- A cambia la contraseña como la app (updateUser)
  const newPw = `Nueva-${stamp}-x`;
  const up = await fetch(`${SB}/auth/v1/user`, { method: "PUT", headers: {
    apikey: ANON, Authorization: `Bearer ${la.body.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password: newPw, data: { must_change_password: false } }) });
  check("A cambia su contraseña", up.status === 200);
  r = await api(owner, "GET", "/api/team/residents");
  check("owner ve a A como activo", r.json?.residents?.find((x) => x.user_id === A.id)?.pending_password_change === false);

  // --- Regenerar
  r = await api(owner, "POST", `/api/team/residents/${A.id}/reset-password`);
  check("owner regenera la de A → 200", r.status === 200 && r.json?.password?.length === 12 && r.json?.email === A.email);
  const regenerated = r.json?.password;
  check("la contraseña elegida por A deja de valer", (await login(A.email, newPw)).status === 400);
  const lr = await login(A.email, regenerated);
  check("A entra con la regenerada y vuelve a tener que cambiarla", lr.status === 200 && lr.body.user?.user_metadata?.must_change_password === true);
  check("regenerar conserva el resto de metadata", lr.body.user?.user_metadata?.name === "Res");

  // --- Tutor (alcance MFyC)
  r = await api(tutor, "GET", "/api/team/residents");
  check("tutor GET 200 solo con MFyC", r.status === 200 && r.json?.specialities?.length === 1 && r.json.specialities[0].id === MFYC);
  check("tutor ve a A (MFyC)", Boolean(r.json?.residents?.some((x) => x.user_id === A.id)));
  r = await api(tutor, "POST", "/api/team/residents", valid("c", { specialityId: CARDIO }));
  check("tutor crea fuera de su alcance → 403", r.status === 403);
  r = await api(tutor, "POST", "/api/team/residents", valid("b", { residentYear: 3 }));
  check("tutor crea B en MFyC → 201", r.status === 201);
  if (r.json?.user_id) created.push(r.json.user_id);
  const B = r.json?.user_id;

  // --- Owner crea C en Cardiología: el tutor no la ve ni la toca
  r = await api(owner, "POST", "/api/team/residents", valid("c", { specialityId: CARDIO }));
  check("owner crea C en Cardiología → 201", r.status === 201);
  const C = r.json?.user_id;
  if (C) created.push(C);
  r = await api(tutor, "GET", "/api/team/residents");
  check("tutor no ve a C", !r.json?.residents?.some((x) => x.user_id === C) && r.json?.residents?.some((x) => x.user_id === B));
  check("tutor regenerar C → 404", (await api(tutor, "POST", `/api/team/residents/${C}/reset-password`)).status === 404);
  check("tutor borrar C → 404", (await api(tutor, "DELETE", `/api/team/residents/${C}`)).status === 404);

  // --- Nadie toca residentes ajenos a la org
  check("owner borrar residente de otra org → 404", (await api(owner, "DELETE", "/api/team/residents/a7cbc63f-595e-49f3-ac53-d5a5306e3e31")).status === 404);
  check("owner borrar residente Google/Apple → 404", (await api(owner, "DELETE", "/api/team/residents/31ba1da6-ffcc-4761-b99d-28c661f31e42")).status === 404);
  check("owner borrar id inválido → 404", (await api(owner, "DELETE", "/api/team/residents/no-es-uuid")).status === 404);

  // --- Quitar acceso
  r = await api(tutor, "DELETE", `/api/team/residents/${B}`);
  check("tutor quita a B → 200", r.status === 200);
  r = await api(owner, "DELETE", `/api/team/residents/${A.id}`);
  check("owner quita a A → 200", r.status === 200);
  check("A ya no puede entrar", (await login(A.email, regenerated)).status === 400);
  check("perfil de A borrado en cascada", (await srv(`users?id=eq.${A.id}&select=id`)).length === 0);
  r = await api(owner, "DELETE", `/api/team/residents/${C}`);
  check("owner quita a C → 200", r.status === 200);
} finally {
  // Limpieza de seguridad por si algo falló a mitad.
  for (const id of created) {
    const left = await srv(`users?id=eq.${id}&select=id`);
    if (left.length) {
      await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } });
      console.log("🧹 limpiado", id);
    }
  }
  const leftovers = await srv(`users?created_by_org_id=eq.${ORG}&select=id`);
  check("no queda ningún residente de prueba de la org", leftovers.length === 0, JSON.stringify(leftovers));
  console.log(`\n${pass} OK · ${fail} FALLOS`);
  process.exit(fail ? 1 : 0);
}
