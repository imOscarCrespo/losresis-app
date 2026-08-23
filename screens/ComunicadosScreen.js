import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import posthogLogger from "../services/posthogService";
import {
  getResidentAnnouncements,
  markAnnouncementRead,
} from "../services/docenciaService";

/**
 * Los comunicados que la Unidad Docente le manda al residente desde
 * /dashboard/comunicados.
 *
 * Es una lista y nada más: **el comunicado ES su título y su cuerpo**, no hay
 * detalle que abrir ni acción que tomar. Por eso se pintan enteros y no se navega a
 * ninguna parte al tocarlos.
 *
 * Hasta ahora el comunicado solo llegaba como notificación. Eso sigue funcionando
 * igual —el trigger `set_notification_destination` lo manda a Notificaciones y no se
 * ha tocado, para no romper las notificaciones de las versiones ya instaladas—, pero
 * una notificación se va con el tiempo y el comunicado se queda: esta pantalla es su
 * historial.
 *
 * Al abrirla se marcan como leídos los que no lo estaban. Se hace aquí y no al tocar
 * cada uno porque no hay nada que tocar: el residente los tiene todos delante. La
 * fecha de lectura es la que alimenta el badge de la tarjeta de Inicio y el "leídos"
 * de la analítica del panel, que hasta ahora contaba siempre cero porque nadie
 * escribía `read_at`.
 */

const formatSentAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function ComunicadosScreen({ userProfile, onBack }) {
  const userId = userProfile?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  // Los que ya se han sellado en esta sesión. Sin esto, cada `load()` (el pull to
  // refresh, por ejemplo) volvería a lanzar la RPC por cada comunicado: la de la
  // base no pisa la fecha, pero son llamadas de más.
  const sealed = useRef(new Set());

  const load = useCallback(async () => {
    if (!userId) return;

    try {
      const rows = await getResidentAnnouncements(userId);
      setItems(rows);
      setFailed(false);

      // Se marcan DESPUÉS de pintar y sin esperar: la pantalla ya tiene lo que
      // necesita, y si esto falla el residente no se entera porque no cambia nada de
      // lo que está leyendo. El estado local se deja como vino de la base para que
      // "no leído" siga marcado mientras lo tiene delante; en la próxima entrada ya
      // aparecerá leído.
      const nuevos = rows.filter(
        (row) => !row.is_read && !sealed.current.has(row.id)
      );

      nuevos.forEach((row) => {
        sealed.current.add(row.id);
        markAnnouncementRead(row.id);
      });
    } catch (error) {
      console.error("Error loading announcements:", error);
      setFailed(true);
      setItems([]);
    }
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    posthogLogger.logScreen("ComunicadosScreen");
    setLoading(true);
    // El guard evita el setState tras desmontar si el residente sale mientras carga.
    load().finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [load]);

  return (
    <HeroScreenLayout
      title="Comunicados"
      subtitle="Avisos y noticias de tu Unidad Docente"
      onBack={onBack}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#670CF5" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
              tintColor="#670CF5"
            />
          }
        >
          {failed ? (
            <View style={styles.empty}>
              <Icon name="alert-circle-outline" size={24} color="#670CF5" />
              <Text style={styles.emptyTitle}>No hemos podido cargarlos</Text>
              <Text style={styles.emptyText}>
                Desliza hacia abajo para volver a intentarlo.
              </Text>
            </View>
          ) : items.length ? (
            items.map((item) => {
              const sentAt = formatSentAt(item.sent_at);
              const meta = [item.created_by_name, sentAt]
                .filter(Boolean)
                .join(" · ");

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.is_read ? null : (
                      <View style={styles.dot} accessibilityLabel="Sin leer" />
                    )}
                  </View>
                  {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
                  <Text style={styles.cardBody}>{item.body}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.empty}>
              <Icon name="megaphone" size={24} color="#670CF5" />
              <Text style={styles.emptyTitle}>Todavía no hay comunicados</Text>
              <Text style={styles.emptyText}>
                Cuando tu Unidad Docente mande un aviso a tu promoción, lo leerás
                aquí.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 10, paddingBottom: 40 },
  card: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: "#1B0977" },
  // El punto es lo único que marca "sin leer". Un badge con texto competiría con el
  // título, y aquí lo que hay que leer es el comunicado.
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#670CF5",
  },
  cardMeta: { fontSize: 12, color: "#94A3B8" },
  cardBody: { fontSize: 14, color: "#334155", lineHeight: 21 },
  empty: {
    alignItems: "center",
    gap: 8,
    padding: 26,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#1B0977" },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
});
