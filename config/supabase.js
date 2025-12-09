import { createClient } from "@supabase/supabase-js";

// Variables de entorno de Supabase
// En Expo, las variables deben empezar con EXPO_PUBLIC_ para ser accesibles
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validar que las variables estén definidas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan las variables de entorno de Supabase. " +
      "Asegúrate de tener EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env"
  );
}

// Crear cliente de Supabase (similar a tu configuración en Next.js)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper para manejar errores de Supabase (opcional, para facilitar el manejo de errores)
export const handleSupabaseError = (error) => {
  if (error) {
    console.error("Supabase Error:", error.message);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
  return null;
};

// Helper genérico para queries (opcional, para facilitar el manejo de respuestas)
export const supabaseQuery = async (queryFn) => {
  try {
    const { data, error } = await queryFn();
    const errorResult = handleSupabaseError(error);
    if (errorResult) return errorResult;

    return {
      success: true,
      data,
      error: null,
    };
  } catch (error) {
    console.error("Query Error:", error);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
};

export default supabase;
