import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "@losresis:hideResidentSalary:";

const keyFor = (userId) => `${KEY_PREFIX}${userId}`;

// Cache en memoria para que al volver al inicio dentro de la misma sesión el
// ojo no parpadee esperando al disco. Misma idea que `feedCache` en useFeed.
const sessionCache = new Map();

/**
 * Si el residente ha escondido su dinero, y el interruptor para cambiarlo.
 *
 * Existe por una razón social, no técnica: el residente enseña la app a
 * compañeros —para presumir de la agenda, para explicar el Libro— y el sueldo
 * es lo único de la pantalla que no quiere que lean. Sin esto la única salida
 * es no abrir la app delante de nadie.
 *
 * La preferencia se guarda **por usuario y en el dispositivo** (AsyncStorage,
 * igual que el resto de preferencias locales de la app), no en su perfil: es una
 * decisión sobre esta pantalla y este teléfono, y no tiene por qué viajar a un
 * servidor ni a otro dispositivo.
 *
 * Arranca **oculto** hasta que el disco contesta, y es a propósito: el fallo que
 * este interruptor evita es justo que el número aparezca un instante al abrir la
 * app delante de alguien. Quien no lo haya escondido ve el punteado unos
 * milisegundos, que no le cuesta nada; al revés sí costaría.
 */
export const useSalaryVisibility = (userId) => {
  const [hidden, setHidden] = useState(() => sessionCache.get(userId) ?? true);
  const [ready, setReady] = useState(() => sessionCache.has(userId));

  useEffect(() => {
    if (!userId) {
      setHidden(true);
      setReady(false);
      return;
    }

    const cached = sessionCache.get(userId);
    if (cached !== undefined) {
      setHidden(cached);
      setReady(true);
      return;
    }

    let alive = true;
    AsyncStorage.getItem(keyFor(userId))
      .then((raw) => {
        if (!alive) return;
        const value = raw === "true";
        sessionCache.set(userId, value);
        setHidden(value);
        setReady(true);
      })
      .catch(() => {
        // Sin preferencia legible se enseña el sueldo: es el estado que el
        // residente no ha pedido cambiar.
        if (!alive) return;
        setHidden(false);
        setReady(true);
      });

    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = useCallback(() => {
    setHidden((current) => {
      const next = !current;
      if (userId) {
        sessionCache.set(userId, next);
        AsyncStorage.setItem(keyFor(userId), next ? "true" : "false").catch(
          () => {}
        );
      }
      return next;
    });
    setReady(true);
  }, [userId]);

  return { hidden, ready, toggle };
};

export default useSalaryVisibility;
