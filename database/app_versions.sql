-- ============================================================================
-- TABLA: app_versions
-- Descripción: Almacena las versiones mínimas requeridas de la aplicación
--              para iOS y Android. Permite controlar cuándo mostrar el banner
--              de actualización a los usuarios.
-- ============================================================================

-- Crear la tabla
CREATE TABLE IF NOT EXISTS app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android', 'all')),
  min_required_version VARCHAR(20) NOT NULL,
  update_url TEXT,
  is_force_update BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Si la tabla ya existe, agregar la columna update_url si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_versions' AND column_name = 'update_url'
  ) THEN
    ALTER TABLE app_versions ADD COLUMN update_url TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_versions' AND column_name = 'is_force_update'
  ) THEN
    ALTER TABLE app_versions ADD COLUMN is_force_update BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Crear índice único parcial para asegurar solo una versión activa por plataforma
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_versions_unique_active_platform 
  ON app_versions(platform) 
  WHERE is_active = true;

-- Crear índice para búsquedas rápidas por plataforma y estado activo
CREATE INDEX IF NOT EXISTS idx_app_versions_platform_active 
  ON app_versions(platform, is_active) 
  WHERE is_active = true;

-- Crear índice para ordenar por fecha de creación
CREATE INDEX IF NOT EXISTS idx_app_versions_created_at 
  ON app_versions(created_at DESC);

-- Función para actualizar automáticamente updated_at
CREATE OR REPLACE FUNCTION update_app_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER trigger_update_app_versions_updated_at
  BEFORE UPDATE ON app_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_app_versions_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura pública (cualquiera puede leer las versiones)
CREATE POLICY "Allow public read access to app_versions"
  ON app_versions
  FOR SELECT
  USING (true);

-- Política: Solo usuarios autenticados pueden insertar (opcional, ajustar según necesidades)
-- CREATE POLICY "Allow authenticated insert to app_versions"
--   ON app_versions
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (true);

-- Política: Solo usuarios autenticados pueden actualizar (opcional, ajustar según necesidades)
-- CREATE POLICY "Allow authenticated update to app_versions"
--   ON app_versions
--   FOR UPDATE
--   TO authenticated
--   USING (true);

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Insertar versión inicial para iOS y Android con URLs de actualización
INSERT INTO app_versions (platform, min_required_version, update_url, is_force_update, is_active, description)
VALUES 
  ('ios', '1.0.4', 'https://apps.apple.com/es/app/losresis/id6756607831?l=en-GB', false, true, 'Versión inicial - iOS'),
  ('android', '1.0.4', 'https://play.google.com/store/apps/details?id=com.losresis.app', false, true, 'Versión inicial - Android')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- 
-- Para actualizar la versión mínima requerida:
-- 
-- 1. Desactivar la versión anterior:
--    UPDATE app_versions 
--    SET is_active = false 
--    WHERE platform = 'ios' AND is_active = true;
--
-- 2. Insertar nueva versión:
--    INSERT INTO app_versions (platform, min_required_version, update_url, is_force_update, is_active, description)
--    VALUES ('ios', '1.0.5', 'https://apps.apple.com/es/app/losresis/id6756607831?l=en-GB', true, true, 'Nueva versión obligatoria');
--
-- O simplemente actualizar la existente:
--    UPDATE app_versions 
--    SET min_required_version = '1.0.5', 
--        update_url = 'https://apps.apple.com/es/app/losresis/id6756607831?l=en-GB',
--        is_force_update = true,
--        description = 'Nueva versión con mejoras',
--        updated_at = NOW()
--    WHERE platform = 'ios' AND is_active = true;
--
-- ============================================================================
