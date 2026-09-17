import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Aprendizaje de dominios de hospital.
//
// Cuando un administrador aprueba una solicitud de email corporativo, el
// dominio de ese email se añade a `hospitals.email_domain`. Así el siguiente
// residente de ese hospital valida automáticamente en vez de pasar por
// revisión manual (lo lee `useEmailDomainValidation` vía
// `getHospitalEmailDomains`, que consulta la BD y no el catálogo estático).
//
// Avisar al residente NO es cosa de esta function: lo hace el trigger
// `notify_user_email_review_outcome` insertando en `notifications`, que es
// transaccional con el cambio de estado. Aquí solo vive el merge de dominios.
serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const payload = await req.json().catch(() => ({}));
    const record = payload.record ?? payload.new ?? null;
    if (!record) return new Response("No record", { status: 200 });

    // Solo si el status ha pasado a "APPROVED"
    if (record.status !== "APPROVED") {
      return new Response("No action for this status", { status: 200 });
    }

    // 1️⃣ Obtener el email y el dominio
    const workEmail = record.work_email;
    if (!workEmail) return new Response("Missing work_email", { status: 200 });

    const domain = workEmail.split("@")[1]?.toLowerCase();
    if (!domain) return new Response("Invalid email domain", { status: 200 });

    // 2️⃣ Obtener hospital_id del usuario
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("hospital_id")
      .eq("id", record.user_id)
      .single();
    if (userError || !userData?.hospital_id) {
      return new Response("User or hospital not found", { status: 200 });
    }
    const hospitalId = userData.hospital_id;

    // 3️⃣ Obtener los dominios actuales del hospital
    const { data: hospitalData, error: hospitalError } = await supabase
      .from("hospitals")
      .select("email_domain")
      .eq("id", hospitalId)
      .single();
    if (hospitalError) return new Response("Hospital not found", { status: 200 });

    // 4️⃣ Convertir a array y añadir nuevo dominio sin duplicar
    let currentDomains = [];
    if (hospitalData?.email_domain) {
      try {
        currentDomains = JSON.parse(hospitalData.email_domain);
      } catch {
        currentDomains = [];
      }
    }

    if (currentDomains.includes(domain)) {
      return new Response("OK", { status: 200 });
    }

    currentDomains.push(domain);
    const { error: updateError } = await supabase
      .from("hospitals")
      .update({ email_domain: JSON.stringify(currentDomains) })
      .eq("id", hospitalId);

    if (updateError) {
      console.error("Error adding domain:", updateError);
      return new Response("Error adding domain", { status: 500 });
    }

    console.log(`Domain ${domain} added to hospital ${hospitalId}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Internal Error:", err);
    return new Response("Internal Error", { status: 500 });
  }
});
