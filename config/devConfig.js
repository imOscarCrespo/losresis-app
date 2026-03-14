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

export const DEV_USER_TYPE = "student";
