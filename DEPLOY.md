# Guía de Despliegue - LosResis React Native App

## Opciones de Publicación

Tienes dos opciones principales para publicar tu aplicación:

### 1. Expo Go (Desarrollo y Testing)

**Ventajas:**

- ✅ Rápido y fácil
- ✅ No requiere builds
- ✅ Ideal para testing y desarrollo
- ✅ Gratis

**Desventajas:**

- ❌ Requiere la app Expo Go instalada
- ❌ Limitaciones de APIs nativas
- ❌ No es una app independiente

**Pasos:**

1. **Configurar variables de entorno:**

   ```bash
   # Crea un archivo .env en la raíz del proyecto
   EXPO_PUBLIC_SUPABASE_URL=https://chgretwxywvaaruwovbb.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
   ```

2. **Iniciar sesión en Expo:**

   ```bash
   npx expo login
   ```

3. **Publicar para Expo Go:**

   ```bash
   npx expo publish
   ```

   O usar el nuevo sistema EAS:

   ```bash
   npx expo start
   # Luego escanea el QR con Expo Go
   ```

4. **Compartir el enlace:**
   - Obtendrás una URL como: `exp://exp.host/@tu-usuario/losresis-react-app`
   - Comparte esta URL o el QR code con otros usuarios
   - Necesitan tener Expo Go instalada

### 2. Build de Producción (EAS Build)

**Ventajas:**

- ✅ App independiente (no requiere Expo Go)
- ✅ Puedes publicar en App Store y Google Play
- ✅ Acceso completo a APIs nativas
- ✅ App profesional

**Desventajas:**

- ❌ Requiere cuenta de Expo (gratis con límites)
- ❌ Builds toman tiempo
- ❌ Para App Store/Play Store necesitas cuentas de desarrollador

**Pasos:**

1. **Instalar EAS CLI:**

   ```bash
   npm install -g eas-cli
   ```

2. **Iniciar sesión:**

   ```bash
   eas login
   ```

3. **Configurar el proyecto:**

   ```bash
   eas build:configure
   ```

4. **Configurar variables de entorno en EAS:**

   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://chgretwxywvaaruwovbb.supabase.co
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value tu_anon_key_aqui
   ```

5. **Crear build para iOS:**

   ```bash
   eas build --platform ios
   ```

6. **Crear build para Android:**

   ```bash
   eas build --platform android
   ```

7. **O crear build para ambas plataformas:**
   ```bash
   eas build --platform all
   ```

### 3. Build Local (Opcional)

Si prefieres hacer builds localmente:

```bash
# iOS (requiere Mac y Xcode)
eas build --platform ios --local

# Android (requiere Android Studio)
eas build --platform android --local
```

## Configuración de Variables de Entorno

### Para Desarrollo Local:

Crea un archivo `.env` en la raíz del proyecto:

```
EXPO_PUBLIC_SUPABASE_URL=https://chgretwxywvaaruwovbb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### Para Producción (EAS):

Usa `eas secret:create` como se muestra arriba, o configura en `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://chgretwxywvaaruwovbb.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "tu_anon_key_aqui"
      }
    }
  }
}
```

## Verificar Configuración

Antes de publicar, verifica que:

1. ✅ Las variables de entorno están configuradas
2. ✅ `app.json` tiene la configuración correcta
3. ✅ El `scheme` en `app.json` coincide con la configuración de Supabase
4. ✅ Las URLs de redirección en Supabase incluyen:
   - `losresis://auth/callback` (para la app)
   - `exp://exp.host/@tu-usuario/losresis-react-app/--/auth/callback` (para Expo Go)

## Comandos Útiles

```bash
# Ver configuración actual
npx expo config

# Verificar que todo está bien
npx expo doctor

# Iniciar en modo desarrollo
npx expo start

# Publicar para Expo Go
npx expo publish

# Ver builds
eas build:list

# Ver secretos configurados
eas secret:list
```

## Notas Importantes

1. **Seguridad**: Nunca subas el archivo `.env` a Git. Ya está en `.gitignore`
2. **Anon Key**: El `anon_key` de Supabase es público y seguro de exponer en el cliente
3. **Service Role Key**: NUNCA uses el `service_role` key en el cliente, solo en el backend
4. **URLs de Redirección**: Asegúrate de configurar todas las URLs de redirección en Supabase

## Siguiente Paso Recomendado

Para empezar rápido, usa **Expo Go**:

1. Crea el archivo `.env` con tus credenciales
2. Ejecuta `npx expo start`
3. Escanea el QR con Expo Go en tu teléfono
4. ¡Listo! Ya puedes usar la app sin localhost
