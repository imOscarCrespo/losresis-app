import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("RESEND_FROM") ?? "LosResis <notificaciones@losresis.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
serve(async (req)=>{
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", {
      status: 405
    });
    if (!RESEND_API_KEY) return new Response("Missing RESEND_API_KEY", {
      status: 500
    });
    const payload = await req.json().catch(()=>({}));
    const record = payload.record ?? payload.new ?? null;
    if (!record) return new Response("No record", {
      status: 200
    });
    // Solo si el status ha pasado a "APPROVED"
    if (record.status !== "APPROVED") return new Response("No action for this status", {
      status: 200
    });
    // 1️⃣ Obtener el email y el dominio
    const workEmail = record.work_email;
    if (!workEmail) return new Response("Missing work_email", {
      status: 200
    });
    const domain = workEmail.split("@")[1]?.toLowerCase();
    if (!domain) return new Response("Invalid email domain", {
      status: 200
    });
    // 2️⃣ Obtener hospital_id del usuario
    const { data: userData, error: userError } = await supabase.from("users").select("name, hospital_id").eq("id", record.user_id).single();
    if (userError || !userData?.hospital_id) return new Response("User or hospital not found", {
      status: 200
    });
    const userName = userData?.name ?? "¡Hola!";
    const hospitalId = userData.hospital_id;
    // 3️⃣ Obtener los dominios actuales del hospital
    const { data: hospitalData, error: hospitalError } = await supabase.from("hospitals").select("email_domain").eq("id", hospitalId).single();
    if (hospitalError) return new Response("Hospital not found", {
      status: 200
    });
    // 4️⃣ Convertir a array y añadir nuevo dominio sin duplicar
    let currentDomains = [];
    if (hospitalData?.email_domain) {
      try {
        currentDomains = JSON.parse(hospitalData.email_domain);
      } catch  {
        currentDomains = [];
      }
    }
    if (!currentDomains.includes(domain)) {
      currentDomains.push(domain);
      await supabase.from("hospitals").update({
        email_domain: JSON.stringify(currentDomains)
      }).eq("id", hospitalId);
    }
    // 5️⃣ Preparar el contenido del email
    const subject = "✅ Tu correo ha sido verificado en Los Resis";
    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; padding: 24px; color: #111827;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 32px 40px;">
            <h1 style="font-size: 22px; color: #111827; margin-bottom: 16px;">
              🎉 Tu correo ha sido verificado
            </h1>
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Hemos validado tu correo profesional (<strong>${workEmail}</strong>).
              Ya puedes <strong>completar tu perfil</strong> y disfrutar de todas las funcionalidades de Los Resis.
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="https://app.losresis.com"
                style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none;
                       padding: 12px 24px; border-radius: 8px; font-weight: 600;">
                Completar perfil →
              </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
              Gracias por formar parte de <strong>Los Resis</strong> 💙
              Si tienes cualquier duda, puedes escribirnos a <a href="mailto:contacto@losresis.com">contacto@losresis.com</a>.
            </p>
          </td>
        </tr>
      </table>
    </div>
    `.trim();
    // 6️⃣ Enviar email con Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM,
        to: [
          workEmail,
          "contacto@losresis.com"
        ],
        subject,
        html
      })
    });
    const detail = await res.text();
    if (!res.ok) {
      console.error("Error sending email:", detail);
      return new Response(detail, {
        status: res.status
      });
    }
    console.log(`Email sent to ${workEmail} and domain ${domain} added`);
    return new Response("OK", {
      status: 200
    });
  } catch (err) {
    console.error("Internal Error:", err);
    return new Response("Internal Error", {
      status: 500
    });
  }
});
