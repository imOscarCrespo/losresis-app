# Sistema de Verificación de Versión

Este documento explica cómo funciona el sistema de verificación de versión que puede mostrar un banner de actualización o bloquear la app con una pantalla obligatoria cuando los usuarios tienen una versión antigua.

## Arquitectura

El sistema está compuesto por:

1. **Tabla `app_versions` en Supabase**: Almacena las versiones mínimas requeridas por plataforma
2. **`versionService.js`**: Servicio que obtiene y compara versiones desde Supabase
3. **`useVersionCheck` hook**: Hook de React que verifica la versión y actualiza el estado
4. **`supabaseQuery` wrapper**: Intercepta todas las llamadas al backend para verificar versión
5. **`UpdateBanner` component**: Muestra el aviso no bloqueante
6. **`ForceUpdateScreen` component**: Bloquea la app y solo permite ir a la store

## Flujo de Funcionamiento

### 1. Verificación Inicial
- Al iniciar la app, `useVersionCheck` se ejecuta
- Obtiene la versión actual de la app instalada
- Consulta Supabase para obtener la versión mínima requerida
- Compara ambas versiones
- Si la versión instalada es menor y `is_force_update = false`, muestra el banner
- Si la versión instalada es menor y `is_force_update = true`, bloquea la app completa

### 2. Verificación en Cada Llamada
- Antes de cada llamada al backend (a través de `supabaseQuery`), se verifica la versión
- Usa caché en AsyncStorage para evitar llamadas innecesarias
- El caché tiene una duración de 5 minutos
- Si necesita actualización, el estado se actualiza (pero no bloquea la llamada)

### 3. Caché Inteligente
- **Caché de versión mínima**: Almacena la versión mínima requerida obtenida de Supabase
- **Caché de verificación**: Almacena el resultado de la comparación (needsUpdate)
- Ambos cachés se invalidan después de 5 minutos o cuando la versión de la app cambia

## Configuración en Supabase

### 1. Crear la Tabla

Ejecuta el script SQL en Supabase SQL Editor:

```sql
-- Ver archivo: database/app_versions.sql
```

### 2. Insertar Versión Inicial

```sql
INSERT INTO app_versions (platform, min_required_version, update_url, is_force_update, is_active, description)
VALUES 
  ('ios', '1.0.4', 'https://apps.apple.com/es/app/losresis/id6756607831?l=en-GB', false, true, 'Versión inicial - iOS');
```

### 3. Actualizar Versión Mínima Requerida

Cuando publiques una nueva versión y quieras forzar la actualización:

```sql
-- Opción 1: Desactivar la anterior y crear nueva
UPDATE app_versions 
SET is_active = false 
WHERE platform = 'ios' AND is_active = true;

INSERT INTO app_versions (platform, min_required_version, update_url, is_force_update, is_active, description)
VALUES ('ios', '1.0.5', 'https://apps.apple.com/es/app/losresis/id6756607831?l=en-GB', true, true, 'Nueva versión obligatoria');

-- Opción 2: Actualizar directamente la existente
UPDATE app_versions 
SET min_required_version = '1.0.5', 
    is_force_update = true,
    description = 'Nueva versión obligatoria',
    updated_at = NOW()
WHERE platform = 'ios' AND is_active = true;
```

## Uso en el Código

### Hook useVersionCheck

```javascript
import { useVersionCheck } from '../hooks/useVersionCheck';

function MyComponent() {
  const { needsUpdate, isForceUpdate, currentVersion, isLoading } = useVersionCheck();
  
  // needsUpdate: boolean - Si necesita actualización
  // isForceUpdate: boolean - Si debe bloquear la app completa
  // currentVersion: string - Versión actual instalada
  // isLoading: boolean - Si está verificando
}
```

### Modos de UI

- `needsUpdate === true` y `isForceUpdate === false`: `UpdateBanner` en `ScreenLayout`
- `needsUpdate === true` y `isForceUpdate === true`: `ForceUpdateScreen` en `App.js`

### Servicio versionService

```javascript
import { checkVersionUpdate, clearVersionCache } from '../services/versionService';

// Verificar versión (usa caché si está disponible)
const result = await checkVersionUpdate(false);

// Forzar verificación sin caché
const result = await checkVersionUpdate(true);

// Limpiar caché (útil después de actualizar la app)
await clearVersionCache();
```

## Optimizaciones de Rendimiento

1. **Caché en AsyncStorage**: Evita múltiples llamadas al backend
2. **Verificación rápida en supabaseQuery**: Usa caché para verificación rápida antes de cada llamada
3. **Skip version check**: Las llamadas internas del sistema de versión usan `skipVersionCheck=true` para evitar recursión
4. **Duración de caché**: 5 minutos (configurable en `versionService.js`)

## Testing

### Probar el Banner

1. En Supabase, actualiza la versión mínima requerida a una versión mayor que la actual:
   ```sql
   UPDATE app_versions 
   SET min_required_version = '2.0.0'
   WHERE platform = 'ios' AND is_active = true;
   ```

2. Si `is_force_update = false`, recarga la app y deberías ver el banner
3. Si `is_force_update = true`, recarga la app y deberías ver la pantalla bloqueante

3. Limpia el caché si es necesario:
   ```javascript
   import { clearVersionCache } from '../services/versionService';
   await clearVersionCache();
   ```

### Probar el Redireccionamiento

El botón de actualización abre la store usando `update_url` desde la base de datos o el fallback de `config/versionConfig.js`:

```javascript
export const APP_STORE_URL_IOS = "https://apps.apple.com/app/idTU_APP_ID";
```

## Troubleshooting

### El banner no aparece

1. Verifica que la versión en Supabase sea mayor que la versión instalada
2. Verifica que `is_active = true` en la tabla
3. Verifica `platform` y `is_force_update`
4. Limpia el caché: `await clearVersionCache()`
5. Revisa los logs de la consola

### Llamadas infinitas al backend

- El sistema usa `skipVersionCheck=true` en las llamadas internas para evitar recursión
- Si ves llamadas infinitas, verifica que las llamadas del `versionService` usen `skipVersionCheck=true`

### El caché no se actualiza

- El caché se invalida automáticamente después de 5 minutos
- También se invalida cuando la versión de la app cambia
- Puedes forzar una actualización con `checkVersionUpdate(true)`

## Estructura de Archivos

```
├── config/
│   ├── supabase.js          # Cliente Supabase con verificación de versión
│   └── versionConfig.js     # URLs del App Store/Play Store
├── services/
│   └── versionService.js    # Lógica de verificación de versión
├── hooks/
│   └── useVersionCheck.js    # Hook React para verificar versión
├── components/
│   ├── UpdateBanner.js      # Componente del banner suave
│   └── ForceUpdateScreen.js # Pantalla bloqueante de actualización
└── database/
    └── app_versions.sql     # Script SQL para crear la tabla
```
