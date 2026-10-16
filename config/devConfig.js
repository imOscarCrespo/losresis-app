/**
 * Configuración de desarrollo local
 *
 * DEV_USER_TYPE: Sobreescribe el tipo de usuario del perfil real en local.
 * Útil para probar vistas que dependen del rol sin cambiar datos en Supabase.
 *
 * Valores posibles:
 *   null          → usa el perfil real de Supabase (comportamiento por defecto)
 *   "resident"    → simula un médico residente   (is_resident: true)
 *   "student"     → simula un estudiante PostMIR (is_student: true)
 *   "admin"       → simula un super admin        (is_super_admin: true, is_resident: true)
 *
 * ⚠️ No commitear este archivo con un valor distinto de null en producción.
 */

export const DEV_USER_TYPE = null;

/**
 * DEV_E2E: modo de pruebas automáticas (Maestro en el simulador).
 * Solo se activa en builds de desarrollo arrancando Metro con EXPO_PUBLIC_E2E=1.
 * En builds de tienda __DEV__ es false y todo lo que cuelga de aquí desaparece.
 *   - Muestra el acceso "Entrar como test" (email + contraseña) en WelcomeScreen.
 *   - No aplica el bloqueo de reseña obligatoria al residente de pruebas.
 */
export const DEV_E2E = __DEV__ && process.env.EXPO_PUBLIC_E2E === "1";

/*

usuario resident hospital/especialitat/ciutat

grups a crear


hospital
especialitat - any MIR
hospital-especialitat
ciutat





*/
