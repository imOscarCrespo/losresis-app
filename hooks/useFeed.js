import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFeed, toggleChapo } from "../services/feedService";

const PAGE_SIZE = 10;

// Snapshot del feed por usuario. HomeDashboardScreen se desmonta al cambiar de
// sección (y la app al cerrarse), así que sin esto el feed se recargaría desde
// cero —spinner + salto de tamaño— al volver a "inicio" o al abrir la app.
// Dos capas: memoria (instantánea dentro de la sesión) + disco (sobrevive al
// arranque en frío). Patrón "stale-while-revalidate": pintamos el snapshot al
// instante y refrescamos en segundo plano, sin spinner.
const feedCache = new Map(); // userId -> { items, hasMore }
const SNAPSHOT_PREFIX = "feed_snapshot_v1_";
const snapshotKey = (userId) => `${SNAPSHOT_PREFIX}${userId}`;

// Feed social del residente: Posts + Actividades de guardia de sus Conexiones.
// Paginación por cursor (activity_at del último ítem). Ver
// docs/adr/0004-feed-actividad-de-guardia-por-conexion.md
export const useFeed = (userId) => {
  const cached = userId ? feedCache.get(userId) : null;
  const [items, setItems] = useState(cached?.items || []);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  // hydrated = ya tenemos un snapshot (memoria, disco o red). Mientras sea
  // false y no haya ítems, la pantalla muestra un esqueleto en vez de spinner.
  // Si venimos de cache en memoria, arranca true (sin parpadeo al volver).
  const [hydrated, setHydrated] = useState(!!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Evita condiciones de carrera entre refrescos y paginación solapados, y
  // permite saber si la red ya respondió (para no pisar con un snapshot viejo).
  const requestRef = useRef(0);

  // Persiste el estado en memoria + disco para pintar al instante la próxima
  // vez. Sólo cuando ya hemos cargado de verdad (hydrated), para no escribir el
  // estado inicial vacío encima de un snapshot bueno.
  useEffect(() => {
    if (!userId || !hydrated) return;
    feedCache.set(userId, { items, hasMore });
    AsyncStorage.setItem(
      snapshotKey(userId),
      JSON.stringify({ items, hasMore })
    ).catch(() => {});
  }, [userId, items, hasMore, hydrated]);

  // Hidratación instantánea: cache en memoria si existe (cubre el caso en que
  // userId llega después de un render con null), si no, lee disco. La red no se
  // espera aquí; corre en paralelo en loadFirstPage y gana si llega antes.
  useEffect(() => {
    if (!userId) return;
    const mem = feedCache.get(userId);
    if (mem) {
      setItems(mem.items);
      setHasMore(mem.hasMore ?? true);
      setHydrated(true);
      return;
    }
    let alive = true;
    AsyncStorage.getItem(snapshotKey(userId))
      .then((raw) => {
        if (!alive || !raw) return;
        if (requestRef.current !== 0) return; // la red ya respondió; no pisar
        const snap = JSON.parse(raw);
        if (Array.isArray(snap?.items)) setItems(snap.items);
        if (typeof snap?.hasMore === "boolean") setHasMore(snap.hasMore);
        setHydrated(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  const loadFirstPage = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!userId) {
        setItems([]);
        setHasMore(false);
        return;
      }
      const requestId = ++requestRef.current;
      if (isRefresh) setRefreshing(true);
      // Carga inicial sin spinner: el esqueleto (pantalla) cubre el primer
      // arranque; los siguientes ya tienen snapshot que pintar.

      const { success, items: page } = await getFeed({ limit: PAGE_SIZE });
      if (requestId !== requestRef.current) return; // descartado por uno más nuevo

      if (success) {
        setItems(page);
        setHasMore(page.length === PAGE_SIZE);
      }
      // La petición terminó: dejamos de mostrar el esqueleto pase lo que pase
      // (éxito -> datos o empty real; fallo -> empty, como hacía antes).
      setHydrated(true);
      setRefreshing(false);
    },
    [userId]
  );

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore || items.length === 0) return;
    const requestId = ++requestRef.current;
    setLoadingMore(true);

    const before = items[items.length - 1]?.activityAt || null;
    const { success, items: page } = await getFeed({
      limit: PAGE_SIZE,
      before,
    });
    if (requestId !== requestRef.current) return;

    if (success) {
      setItems((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [userId, loadingMore, hasMore, items]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  // Optimista: alterna el Chapó en local y confirma con el recuento del servidor.
  const handleToggleChapo = useCallback(async (item) => {
    const { type, id } = item;
    setItems((prev) =>
      prev.map((it) =>
        it.type === type && it.id === id
          ? {
              ...it,
              viewerHasChapo: !it.viewerHasChapo,
              chapoCount: it.chapoCount + (it.viewerHasChapo ? -1 : 1),
            }
          : it
      )
    );

    const res = await toggleChapo(type, id);
    if (res.success) {
      setItems((prev) =>
        prev.map((it) =>
          it.type === type && it.id === id
            ? {
                ...it,
                viewerHasChapo: res.viewerHasChapo,
                chapoCount: res.chapoCount,
              }
            : it
        )
      );
    } else {
      // Revertir si falló.
      setItems((prev) =>
        prev.map((it) =>
          it.type === type && it.id === id
            ? {
                ...it,
                viewerHasChapo: item.viewerHasChapo,
                chapoCount: item.chapoCount,
              }
            : it
        )
      );
    }
    return res;
  }, []);

  // Quita un post recién borrado de la lista sin recargar.
  const removeItem = useCallback((type, id) => {
    setItems((prev) => prev.filter((it) => !(it.type === type && it.id === id)));
  }, []);

  // Estable entre renders: si fuera una flecha nueva cada vez, las callbacks que
  // dependen de ella (p. ej. handleDeleteFeedPost) cambiarían y romperían el
  // React.memo de las tarjetas del feed.
  const refresh = useCallback(
    () => loadFirstPage({ isRefresh: true }),
    [loadFirstPage]
  );

  return {
    items,
    hydrated,
    refreshing,
    loadingMore,
    hasMore,
    refresh,
    loadMore,
    toggleChapo: handleToggleChapo,
    removeItem,
  };
};

export default useFeed;
