# 🚀 Quick Start: Deploy a TestFlight en 5 Pasos

## ⚠️ Importante: NO necesitas tener el proyecto corriendo

Una vez que el build está en TestFlight, **la app funciona independientemente**. Tu socio puede usarla sin tu ordenador. Ver `HOW_TESTFLIGHT_WORKS.md` para más detalles.

## Paso 1: Instalar EAS CLI

```bash
npm install -g eas-cli
eas login
```

## Paso 2: Configurar Proyecto

```bash
eas build:configure
```

Selecciona:

- Plataforma: `iOS`
- Usar EAS Build: `Yes`

## Paso 3: Verificar App Store Connect

1. Ve a https://appstoreconnect.apple.com/
2. Crea una nueva app si no existe
3. Anota el **Bundle ID** (debe ser `com.losresis.app`)

## Paso 4: Crear Build y Enviar

```bash
eas build --platform ios --profile production --auto-submit
```

Este comando:

- ✅ Crea el build de producción
- ✅ Lo envía automáticamente a TestFlight
- ⏱️ Tarda ~15-20 minutos
- 💻 **Solo necesitas tu ordenador durante este proceso**

## Paso 5: Esperar y Configurar Testers

1. Espera a que Apple procese el build (5-30 min)
2. Ve a App Store Connect → TestFlight
3. Agrega testers internos/externos (emails de tu socio, etc.)
4. ¡Listo! 🎉 **La app funciona sin tu ordenador**

---

**¿Problemas?** Consulta `TESTFLIGHT_DEPLOY.md` para la guía completa.
