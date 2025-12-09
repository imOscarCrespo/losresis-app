# `expo start` vs TestFlight - ¿Cuál usar?

## ❓ ¿Necesito tener `expo start` corriendo?

**Depende de cómo compartas la app:**

### ❌ Con `expo start` (Expo Go):

**SÍ necesitas tenerlo corriendo constantemente**

```bash
# TÚ ejecutas:
expo start

# Tu socio necesita:
# - Escanear QR o usar enlace
# - Tu ordenador DEBE estar encendido
# - expo start DEBE estar corriendo
# - Si apagas tu ordenador → tu socio NO puede usar la app
```

**Problemas para compartir con socios:**

- ❌ Tu ordenador debe estar siempre encendido
- ❌ Debes tener `expo start` corriendo 24/7
- ❌ Si apagas tu ordenador, la app deja de funcionar
- ❌ No es práctico para producción

### ✅ Con TestFlight (Build de producción):

**NO necesitas `expo start`**

```bash
# TÚ ejecutas esto UNA VEZ:
eas build --platform ios --profile production --auto-submit

# Después:
# - Puedes apagar tu ordenador ✅
# - NO necesitas expo start ✅
# - Tu socio descarga desde TestFlight
# - La app funciona independientemente
```

**Ventajas para compartir con socios:**

- ✅ Tu ordenador puede estar apagado
- ✅ NO necesitas `expo start` corriendo
- ✅ Tu socio usa la app como cualquier app normal
- ✅ Perfecto para producción

## 📊 Comparación Rápida

|                                   | `expo start` (Expo Go) | TestFlight  |
| --------------------------------- | ---------------------- | ----------- |
| Necesitas `expo start` corriendo  | ✅ SÍ                  | ❌ NO       |
| Tu ordenador debe estar encendido | ✅ SÍ                  | ❌ NO       |
| App funciona sin tu ordenador     | ❌ NO                  | ✅ SÍ       |
| Para compartir con socios         | ❌ No recomendado      | ✅ Perfecto |
| Para desarrollo rápido            | ✅ Ideal               | ⚠️ Lento    |
| Para producción                   | ❌ No                  | ✅ Sí       |

## 🎯 Recomendación

### Para Desarrollo (solo tú):

```bash
expo start
```

- ✅ Rápido para probar cambios
- ✅ Ver cambios en tiempo real
- ✅ Solo para desarrollo local

### Para Compartir con Socios:

```bash
eas build --platform ios --profile production --auto-submit
```

- ✅ App independiente
- ✅ No requiere tu ordenador
- ✅ No requiere `expo start`
- ✅ Profesional y práctico

## 💡 Resumen

**Si quieres que tu socio use la app sin depender de tu ordenador:**

1. ✅ **NO uses `expo start`** para compartir
2. ✅ **Usa TestFlight** (build de producción)
3. ✅ Crea el build una vez
4. ✅ Tu socio descarga desde TestFlight
5. ✅ La app funciona sin tu ordenador
6. ✅ Puedes apagar tu ordenador tranquilamente

**`expo start` es solo para desarrollo rápido, NO para compartir con socios.**
