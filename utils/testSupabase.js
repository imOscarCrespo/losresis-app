/**
 * Utilidad para probar la conexión a Supabase
 * Puedes llamar esta función desde cualquier componente para verificar la conexión
 */

import { supabase } from "../config/supabase";

export const testSupabaseConnection = async () => {
  try {
    console.log("🔌 Probando conexión a Supabase...");

    // Verificar la conexión usando auth.getSession() que no requiere tablas
    // Esto verifica que el cliente puede comunicarse con Supabase
    const { data: session, error } = await supabase.auth.getSession();

    if (error) {
      // Si hay un error de autenticación pero el cliente se conectó, la conexión funciona
      // Solo falla si hay un error de red o configuración
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        console.error("❌ Error de conexión a Supabase:", error.message);
        return { success: false, error: error.message };
      }
      // Error de auth es normal si no hay sesión, pero la conexión funciona
      console.log("✅ Conexión a Supabase exitosa (sin sesión activa)");
      return {
        success: true,
        message: "Conexión exitosa - Cliente configurado correctamente",
      };
    }

    console.log("✅ Conexión a Supabase exitosa");
    return {
      success: true,
      message: "Conexión exitosa",
      hasSession: !!session?.session,
    };
  } catch (error) {
    console.error("❌ Error al conectar con Supabase:", error.message);
    return { success: false, error: error.message };
  }
};
