import { supabase } from "../config/supabase";

// Los Recordatorios del servicio son el tablón compartido de losresis-panel
// (su ADR 0008): misma tabla `recordatorio`, mismo ciclo de vida. La app es la
// vista del Residente: lo señalado a él más lo sin asignar de su servicio.
// El acceso viene del perfil (hospital + especialidad), no de ninguna cuenta.

const COLUMNS =
  "id, servicio_id, caso_id, texto, fecha, destinatario_user_id, autor_declarado_user_id, cerrado_en, cerrado_por_user_id, created_at";

// Vencido hace más de una semana se archiva: sale de la lista, sigue en la
// base. Mismo umbral que el panel.
const DIAS_ARRASTRE = 7;

const todayISO = () => {
  // Fecha LOCAL formateada a mano: con toISOString() la medianoche española
  // del 26 es el 25 a las 22:00Z y el tablón viviría un día en el pasado.
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

export const daysOverdue = (fecha) => {
  const target = new Date(`${fecha}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - target.getTime()) / 86_400_000);
};

// El servicio (hospital + especialidad) del residente; lo crea si aún no
// existe. El RPC valida el alcance por perfil en el servidor.
export const ensureServicio = async (hospitalId, specialityId) => {
  const { data, error } = await supabase.rpc("seguimiento_ensure_servicio", {
    p_hospital_id: hospitalId,
    p_speciality_id: specialityId,
  });

  if (error) {
    throw error;
  }

  return data;
};

// El servicio del residente, SIN crearlo si no existe. Lo usa el inicio, que
// solo lee: `ensureServicio` siembra las cuatro carpetas al crear el servicio, y
// eso no puede pasar por abrir la app. Sin servicio tampoco hay recordatorios
// (`recordatorio.servicio_id` es NOT NULL), así que null es una respuesta buena.
export const findServicio = async (hospitalId, specialityId) => {
  if (!hospitalId || !specialityId) {
    return null;
  }

  const { data, error } = await supabase
    .from("servicio")
    .select("id")
    .eq("hospital_id", hospitalId)
    .eq("speciality_id", specialityId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id || null;
};

// La vista del residente: lo asignado a mí + lo sin asignar del servicio.
// Lo asignado a OTRA persona no aparece (es ruido de otro), y lo vencido hace
// más de una semana se considera archivado. Devuelve, además de las listas
// activas, los cerrados de hoy para poder deshacer un "Hecho" accidental.
export const getServiceReminders = async (servicioId, userId) => {
  const { data, error } = await supabase
    .from("recordatorio")
    .select(`${COLUMNS}, caso(id, nhc)`)
    .eq("servicio_id", servicioId)
    .or(`destinatario_user_id.eq.${userId},destinatario_user_id.is.null`)
    .order("fecha", { ascending: true });

  if (error) {
    throw error;
  }

  const today = todayISO();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const forMe = [];
  const unassigned = [];
  const recentlyClosed = [];

  for (const row of data || []) {
    if (row.cerrado_en) {
      if (
        row.cerrado_por_user_id === userId &&
        new Date(row.cerrado_en) >= startOfToday
      ) {
        recentlyClosed.push(row);
      }
      continue;
    }
    if (row.fecha <= today && daysOverdue(row.fecha) > DIAS_ARRASTRE) {
      continue; // archivado
    }
    if (row.destinatario_user_id === userId) {
      forMe.push(row);
    } else {
      unassigned.push(row);
    }
  }

  recentlyClosed.sort(
    (a, b) => new Date(b.cerrado_en) - new Date(a.cerrado_en)
  );

  return { forMe, unassigned, recentlyClosed, today };
};

// Búsqueda del caso por NHC dentro del servicio, para vincular el recordatorio
// al paciente. El panel conoce al paciente SOLO por su NHC (su ADR 0004).
export const findCasoByNhc = async (servicioId, nhc) => {
  const trimmed = String(nhc || "").trim();
  if (!trimmed) {
    return null;
  }

  const { data, error } = await supabase
    .from("caso")
    .select("id, nhc")
    .eq("servicio_id", servicioId)
    .eq("nhc", trimmed)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
};

// Crear desde la app: el autor declarado es el residente autenticado (aquí la
// sesión es personal, no hace falta el selector del panel). Sin destinatario =
// "de quien esté de turno". El push al destinatario lo pone el trigger de la
// tabla, no el cliente.
export const createServiceReminder = async ({
  servicioId,
  texto,
  fecha,
  casoId = null,
  destinatarioUserId = null,
  autorUserId,
}) => {
  const trimmed = String(texto || "").trim();
  if (!trimmed) {
    throw new Error("El recordatorio necesita un texto");
  }

  const { error } = await supabase.from("recordatorio").insert({
    servicio_id: servicioId,
    caso_id: casoId,
    texto: trimmed,
    fecha,
    destinatario_user_id: destinatarioUserId,
    autor_declarado_user_id: autorUserId,
  });

  if (error) {
    throw error;
  }
};

// Cerrar = "Hecho". Puede cerrarlo cualquiera del servicio, también si está
// asignado a otro: el destinatario es etiqueta, no permiso (panel ADR 0008).
export const closeServiceReminder = async (reminderId, userId) => {
  const { error } = await supabase
    .from("recordatorio")
    .update({
      cerrado_en: new Date().toISOString(),
      cerrado_por_user_id: userId,
    })
    .eq("id", reminderId);

  if (error) {
    throw error;
  }
};

export const reopenServiceReminder = async (reminderId) => {
  const { error } = await supabase
    .from("recordatorio")
    .update({
      cerrado_en: null,
      cerrado_por_account_id: null,
      cerrado_por_user_id: null,
    })
    .eq("id", reminderId);

  if (error) {
    throw error;
  }
};

// Residentes del mismo servicio, para el selector de destinatario. Solo
// residentes en v1: los médicos del equipo no entran en esta pantalla.
export const getResidentPeers = async (hospitalId, specialityId) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, surname, resident_year")
    .eq("hospital_id", hospitalId)
    .eq("speciality_id", specialityId)
    .eq("is_resident", true);

  if (error) {
    throw error;
  }

  return (data || [])
    .filter((user) => `${user.name || ""}${user.surname || ""}`.trim() !== "")
    .sort((a, b) =>
      `${a.surname || ""} ${a.name || ""}`.localeCompare(
        `${b.surname || ""} ${b.name || ""}`,
        "es"
      )
    );
};

export const residentDisplayName = (user) => {
  const name = `${user?.name || ""} ${user?.surname || ""}`.trim();
  return name || "Sin nombre";
};
