# ¿Cómo Funciona TestFlight? - Respuestas a Preguntas Comunes

## ❓ ¿Necesito tener el proyecto corriendo en mi ordenador?

**NO** ✅

Una vez que creas el build y lo subes a TestFlight:

1. ✅ **El build es una app independiente** - Se compila en los servidores de Expo
2. ✅ **Se instala directamente en el dispositivo** - Como cualquier app del App Store
3. ✅ **No requiere tu ordenador** - Funciona sin conexión a tu máquina
4. ✅ **Las variables de entorno están incluidas** - Se compilan dentro del build

## 🔄 Proceso Completo

### Cuando CREAS el build:

```
Tu ordenador → EAS Build (servidores de Expo) → Build compilado (.ipa)
```

- ⏱️ Tarda ~15-20 minutos
- 💻 Necesitas tu ordenador SOLO durante este proceso
- 🌐 Se compila en la nube (servidores de Expo)

### Cuando SUBES a TestFlight:

```
Build compilado → App Store Connect → TestFlight
```

- ⏱️ Tarda ~5-30 minutos (procesamiento de Apple)
- 💻 NO necesitas tu ordenador
- 🌐 Todo se hace en la nube

### Cuando tu SOCIO usa la app:

```
TestFlight → Descarga → Instala → Usa la app
```

- ✅ **NO necesita tu ordenador**
- ✅ **NO necesita conexión a tu máquina**
- ✅ **Funciona como cualquier app normal**
- ✅ **Puede usarla sin internet** (excepto para llamadas a Supabase)

## 👥 Para Múltiples Usuarios (Tu Socio, etc.)

### Opción 1: TestFlight (Recomendado)

**Ventajas:**

- ✅ App independiente (no requiere tu ordenador)
- ✅ Fácil de compartir (solo agregar emails)
- ✅ Actualizaciones automáticas
- ✅ Hasta 10,000 testers externos

**Pasos:**

1. Creas el build UNA VEZ
2. Lo subes a TestFlight
3. Agregas los emails de los testers
4. Ellos reciben invitación por email
5. Descargan TestFlight y tu app
6. ¡Listo! Pueden usar la app sin tu ordenador

### Opción 2: Expo Go (Solo para desarrollo)

**Desventajas:**

- ❌ Requiere que tu ordenador esté corriendo `expo start`
- ❌ Requiere conexión a internet
- ❌ Solo funciona mientras el servidor está activo
- ❌ No es una app independiente

**NO recomendado para producción o compartir con socios.**

## 🔐 Variables de Entorno y Configuración

### ¿Dónde se guardan las variables?

Las variables de entorno (`EXPO_PUBLIC_SUPABASE_URL`, etc.) se **incluyen en el build**:

```json
// eas.json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "...",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "..."
      }
    }
  }
}
```

Esto significa:

- ✅ Se compilan dentro del build
- ✅ Están disponibles en la app instalada
- ✅ NO necesitas servidor de desarrollo
- ✅ Funcionan sin tu ordenador

## 📱 Flujo para Tu Socio

### Primera Vez:

1. **Tú creas el build:**

   ```bash
   eas build --platform ios --profile production --auto-submit
   ```

2. **Tú agregas su email en TestFlight:**

   - App Store Connect → TestFlight → Testers
   - Agregar email de tu socio

3. **Tu socio recibe email:**

   - Invitación de TestFlight
   - Instala TestFlight (si no lo tiene)
   - Descarga tu app desde TestFlight

4. **Tu socio usa la app:**
   - ✅ Funciona sin tu ordenador
   - ✅ Funciona sin conexión a tu máquina
   - ✅ Es una app independiente

### Actualizaciones Futuras:

1. **Tú actualizas el código**
2. **Tú creas nuevo build:**
   ```bash
   # Actualizar versión en app.json primero
   eas build --platform ios --profile production --auto-submit
   ```
3. **Tu socio recibe notificación** de nueva versión en TestFlight
4. **Tu socio actualiza** desde TestFlight
5. ✅ **Sigue funcionando sin tu ordenador**

## 🆚 Comparación: TestFlight vs Expo Go

| Característica                  | TestFlight     | Expo Go (`expo start`) |
| ------------------------------- | -------------- | ---------------------- |
| Requiere `expo start` corriendo | ❌ NO          | ✅ SÍ                  |
| Requiere tu ordenador encendido | ❌ NO          | ✅ SÍ                  |
| Requiere conexión a tu máquina  | ❌ NO          | ✅ SÍ                  |
| App independiente               | ✅ SÍ          | ❌ NO                  |
| Funciona offline                | ✅ SÍ\*        | ❌ NO                  |
| Fácil de compartir              | ✅ SÍ          | ⚠️ Limitado            |
| Actualizaciones                 | ✅ Automáticas | ⚠️ Manual              |
| Para producción                 | ✅ Ideal       | ❌ Solo desarrollo     |
| Para compartir con socios       | ✅ Perfecto    | ❌ No recomendado      |

\*Funciona offline excepto para llamadas a APIs (Supabase)

## 🔍 Diferencia Clave: `expo start` vs TestFlight

### Con `expo start` (Expo Go):

```bash
# TÚ necesitas ejecutar esto:
expo start

# Tu socio necesita:
# - Expo Go instalada
# - Escanear QR o usar enlace
# - Tu ordenador DEBE estar encendido y corriendo expo start
# - Conexión a internet
# - Si apagas tu ordenador, la app deja de funcionar
```

**Problemas:**

- ❌ Tu ordenador debe estar siempre encendido
- ❌ Debes tener `expo start` corriendo constantemente
- ❌ Si apagas tu ordenador, tu socio no puede usar la app
- ❌ No es práctico para compartir con socios

### Con TestFlight (Build de producción):

```bash
# TÚ ejecutas esto UNA VEZ:
eas build --platform ios --profile production --auto-submit

# Después:
# - Puedes apagar tu ordenador
# - Tu socio descarga la app desde TestFlight
# - La app funciona independientemente
# - NO necesitas expo start
# - NO necesitas tu ordenador encendido
```

**Ventajas:**

- ✅ Tu ordenador puede estar apagado
- ✅ NO necesitas `expo start`
- ✅ Tu socio usa la app como cualquier app normal
- ✅ Perfecto para compartir con socios

## ✅ Resumen

**Para tu socio usar la app:**

1. ✅ **NO necesitas tener el proyecto corriendo**
2. ✅ **NO necesita conexión a tu ordenador**
3. ✅ **Solo necesitas crear el build UNA VEZ**
4. ✅ **Agregar su email en TestFlight**
5. ✅ **Él descarga e instala desde TestFlight**
6. ✅ **La app funciona independientemente**

**El único momento que necesitas tu ordenador es cuando:**

- Creas un nuevo build (15-20 minutos)
- Actualizas la app con nuevos cambios

**Una vez en TestFlight, la app es completamente independiente.**

## 🎯 Próximos Pasos

1. Crear cuenta de Apple Developer (si no la tienes)
2. Crear app en App Store Connect
3. Ejecutar el build:
   ```bash
   eas build --platform ios --profile production --auto-submit
   ```
4. Agregar emails de testers en TestFlight
5. ¡Compartir y usar sin tu ordenador!
