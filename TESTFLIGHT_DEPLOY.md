# Guía Completa: Desplegar en TestFlight con Expo EAS

Esta guía te llevará paso a paso para publicar tu app LosResis en TestFlight usando Expo Application Services (EAS).

## 📋 Requisitos Previos

Antes de comenzar, necesitas:

1. ✅ **Cuenta de Apple Developer Program** ($99/año)

   - Regístrate en: https://developer.apple.com/programs/
   - Puede tardar 24-48 horas en ser aprobada

2. ✅ **Cuenta de Expo** (gratis)

   - Regístrate en: https://expo.dev/signup

3. ✅ **App registrada en App Store Connect**
   - Crea la app en: https://appstoreconnect.apple.com/
   - Necesitarás: nombre de la app, bundle ID, información básica

## 🚀 Paso 1: Instalar y Configurar EAS CLI

```bash
# Instalar EAS CLI globalmente
npm install -g eas-cli

# Verificar instalación
eas --version

# Iniciar sesión en tu cuenta de Expo
eas login
```

## 🔧 Paso 2: Configurar el Proyecto

```bash
# Configurar EAS Build (genera/actualiza eas.json)
eas build:configure
```

Este comando te preguntará:

- ¿Qué plataformas quieres configurar? → Selecciona `iOS`
- ¿Quieres usar EAS Build? → `Yes`

## 📱 Paso 3: Verificar Configuración de iOS

Verifica que `app.json` tenga la configuración correcta:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.losresis.app",
      "supportsTablet": true
    }
  }
}
```

**Importante**: El `bundleIdentifier` debe coincidir exactamente con el que registraste en App Store Connect.

## 🔐 Paso 4: Configurar Credenciales de Apple

EAS puede gestionar automáticamente tus certificados y perfiles de aprovisionamiento. Tienes dos opciones:

### Opción A: Gestión Automática (Recomendada)

EAS gestionará automáticamente las credenciales durante el build. Solo necesitas:

1. Tener tu cuenta de Apple Developer activa
2. Ejecutar el build (EAS te pedirá iniciar sesión en Apple)

### Opción B: Configuración Manual

Si prefieres gestionar las credenciales manualmente:

```bash
# Configurar credenciales manualmente
eas credentials
```

## 🏗️ Paso 5: Crear el Build de Producción

### Opción 1: Build y Submit Automático (Recomendado)

```bash
# Esto crea el build y lo envía automáticamente a TestFlight
eas build --platform ios --profile production --auto-submit
```

### Opción 2: Build y Submit Separados

```bash
# Paso 1: Crear el build
eas build --platform ios --profile production

# Esperar a que termine (puede tardar 10-20 minutos)
# Verás un enlace para monitorear el progreso

# Paso 2: Una vez completado, enviar a TestFlight
eas submit --platform ios --latest
```

## 📊 Monitorear el Build

Durante el proceso de build:

1. **En la terminal**: Verás el progreso en tiempo real
2. **En el dashboard**: Recibirás un enlace como:
   ```
   https://expo.dev/accounts/[tu-usuario]/projects/losresis-react-app/builds/[build-id]
   ```

El build puede tardar:

- **10-20 minutos** en completarse
- Recibirás un email cuando termine

## ✅ Paso 6: Verificar en App Store Connect

Una vez completado el build y submit:

1. Ve a [App Store Connect](https://appstoreconnect.apple.com/)
2. Selecciona tu app
3. Ve a la pestaña **TestFlight**
4. Verás tu build en "Builds" (puede tardar unos minutos en procesarse)

**Nota**: Apple procesa el build antes de que esté disponible en TestFlight (puede tardar 5-30 minutos).

## 👥 Paso 7: Configurar Testers

### Testers Internos (hasta 100)

1. En App Store Connect → TestFlight → Testers Internos
2. Agrega los emails de tu equipo
3. Los testers deben aceptar la invitación por email

### Testers Externos (hasta 10,000)

1. En App Store Connect → TestFlight → Testers Externos
2. Crea un grupo de testers
3. Agrega los emails
4. Selecciona el build que quieres distribuir
5. Completa la información de exportación (si es necesario)
6. Envía para revisión de Apple (puede tardar 24-48 horas)

## 🔄 Actualizar la App (Nuevas Versiones)

Para actualizar la app en TestFlight:

1. **Actualizar la versión** en `app.json`:

   ```json
   {
     "expo": {
       "version": "1.0.1" // Incrementa la versión
     }
   }
   ```

2. **Crear nuevo build**:

   ```bash
   eas build --platform ios --profile production --auto-submit
   ```

3. **Esperar procesamiento** en App Store Connect

## 🐛 Solución de Problemas Comunes

### Error: "Bundle identifier already exists"

**Solución**: El bundle ID ya está registrado. Verifica que:

- El bundle ID en `app.json` coincida con el de App Store Connect
- O cambia el bundle ID en `app.json` a uno único

### Error: "No provisioning profile found"

**Solución**:

```bash
# Limpiar credenciales y regenerar
eas credentials
```

### Error: "App Store Connect API Key not found"

**Solución**:

1. Crea una API Key en App Store Connect
2. Configúrala en EAS:
   ```bash
   eas credentials
   ```

### Build falla con errores de variables de entorno

**Solución**: Verifica que las variables estén en `eas.json`:

```json
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

### La app no se instala desde TestFlight

**Solución**: Verifica que:

- El email del tester coincida con el de TestFlight
- El build haya sido procesado completamente
- El tester haya aceptado la invitación

## 📝 Checklist Pre-Deploy

Antes de crear el build, verifica:

- [ ] Cuenta de Apple Developer activa
- [ ] App creada en App Store Connect
- [ ] Bundle ID coincide en `app.json` y App Store Connect
- [ ] Variables de entorno configuradas en `eas.json`
- [ ] Versión actualizada en `app.json`
- [ ] Icono y splash screen configurados
- [ ] Iniciado sesión en EAS: `eas login`
- [ ] Proyecto vinculado: `eas build:configure`

## 🎯 Comandos Rápidos de Referencia

```bash
# Login
eas login

# Configurar proyecto
eas build:configure

# Build para producción
eas build --platform ios --profile production

# Build y submit automático
eas build --platform ios --profile production --auto-submit

# Ver builds
eas build:list

# Ver credenciales
eas credentials

# Submit manual
eas submit --platform ios --latest

# Ver estado del proyecto
eas project:info
```

## 📚 Recursos Adicionales

- [Documentación oficial de EAS Build](https://docs.expo.dev/build/introduction/)
- [Guía de TestFlight de Apple](https://developer.apple.com/testflight/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Dashboard de Expo](https://expo.dev/)

## ⚠️ Notas Importantes

1. **Primera vez**: El proceso puede tardar más (creación de certificados, etc.)
2. **Procesamiento de Apple**: Después del submit, Apple procesa el build (5-30 min)
3. **Testers externos**: Requieren revisión de Apple (24-48 horas)
4. **Límites**:
   - Testers internos: 100
   - Testers externos: 10,000
   - Builds simultáneos: Depende de tu plan de Expo

## 🎉 ¡Listo!

Una vez completados estos pasos, tu app estará disponible en TestFlight y podrás compartirla con testers para pruebas.
