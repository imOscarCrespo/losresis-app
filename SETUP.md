# Configuración de Variables de Entorno

## Cómo configurar Supabase en Expo

En Expo, las variables de entorno funcionan de manera diferente a Next.js. Deben empezar con `EXPO_PUBLIC_` para ser accesibles en el cliente.

### Paso 1: Crear archivo .env

Crea un archivo `.env` en la raíz del proyecto (al mismo nivel que `package.json`):

```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=tu_url_de_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
```

### Paso 2: Obtener las credenciales de Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **Settings** → **API**
3. Copia:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Paso 3: Ejemplo de archivo .env

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.xxxxx
```

### Paso 4: Reiniciar el servidor

**IMPORTANTE**: Después de crear o modificar el archivo `.env`, debes:

1. Detener el servidor de Expo (Ctrl+C)
2. Reiniciar con `npm start` o `npx expo start`

Las variables de entorno se cargan al iniciar el servidor, no se recargan automáticamente.

### Notas importantes

- ✅ El archivo `.env` está en `.gitignore` (no se subirá a git)
- ✅ Las variables deben empezar con `EXPO_PUBLIC_` para ser accesibles
- ✅ No uses comillas en los valores del `.env`
- ✅ Reinicia el servidor después de cambiar las variables

### Verificar que funciona

El connector lanzará un error si las variables no están definidas. Si ves el error, verifica:

1. Que el archivo `.env` existe en la raíz del proyecto
2. Que las variables empiezan con `EXPO_PUBLIC_`
3. Que reiniciaste el servidor de Expo
