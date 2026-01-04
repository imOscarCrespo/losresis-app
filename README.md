# Los Resis React Native App

Aplicación móvil React Native con Expo que replica las funcionalidades de la plataforma web Vue.js, conectada a Supabase.

## Estructura del Proyecto

```
losresis-react-app/
├── config/           # Configuración (Supabase, etc.)
├── services/         # Servicios para llamadas al backend
├── components/       # Componentes reutilizables
├── screens/          # Pantallas de la aplicación
├── utils/            # Utilidades y helpers
└── assets/           # Imágenes, fuentes, etc.
```

## Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con:

```
EXPO_PUBLIC_SUPABASE_URL=tu_url_de_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
```

### Configurar Supabase

1. Obtén tu URL y clave anónima desde tu proyecto de Supabase
2. Agrega las variables al archivo `.env`
3. El connector se inicializará automáticamente

## Uso del Connector de Supabase

### Importar el cliente

```javascript
import { supabase, supabaseQuery } from "../config/supabase";
```

### Ejemplo básico de uso

```javascript
// Usando supabaseQuery (recomendado - maneja errores automáticamente)
const result = await supabaseQuery(() => supabase.from("users").select("*"));

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}

// O usando el cliente directamente
const { data, error } = await supabase.from("users").select("*");
```

## Crear un Nuevo Servicio

1. Crea un archivo en `services/` (ej: `userService.js`)
2. Usa el template de `services/exampleService.js` como referencia
3. Exporta las funciones desde `services/index.js`

Ejemplo:

```javascript
// services/userService.js
import { supabase, supabaseQuery } from "../config/supabase";

export const getUsers = async () => {
  return supabaseQuery(() => supabase.from("users").select("*"));
};

export const getUserById = async (id) => {
  return supabaseQuery(() =>
    supabase.from("users").select("*").eq("id", id).single()
  );
};
```

## Crear Componentes Reutilizables

1. Crea el componente en `components/`
2. Exporta desde `components/index.js`
3. Importa donde lo necesites: `import { Button } from '../components'`

## Scripts Disponibles

- `npm start` - Inicia el servidor de desarrollo
- `npm run ios` - Ejecuta en iOS
- `npm run android` - Ejecuta en Android
- `npm run web` - Ejecuta en web

## Deploy con EAS Build

### iOS

- `eas build --platform ios --profile production --auto-submit` - Build y deploy automático a TestFlight
- `eas build --platform ios --profile production` - Build de producción para iOS

### Android

- `eas build --platform android --profile production` - Genera el AAB (Android App Bundle) para Google Play Store
  - El archivo AAB se descargará automáticamente o estará disponible en el dashboard de Expo
  - Sube el archivo `.aab` generado a Google Play Console

### Builds locales (gratuito)

- `eas build --platform ios --profile production --local` - Build iOS local
- `eas build --platform android --profile production --local` - Build Android local
- `eas submit --platform ios --profile production --path /ruta/al/archivo.ipa` - Submit manual de iOS

## Próximos Pasos

- [ ] Configurar variables de entorno
- [ ] Crear servicios específicos para cada funcionalidad
- [ ] Crear componentes reutilizables
- [ ] Implementar pantallas según la app Vue.js
