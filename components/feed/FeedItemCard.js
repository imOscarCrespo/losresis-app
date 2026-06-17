import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Icon } from "../Icon";
import { getRoommateAvatarUrl } from "../../utils/roommateUtils";

const PRIMARY = "#670CF5";
const COURSE_BLUE = "#2563EB"; // mismo azul que el tipo "Curso" en la Agenda
const TEXT = "#1B0977";
const MUTED = "#6B7280";

// "hace X" compacto. Para algo más viejo de una semana, fecha corta.
function formatTimeAgo(value) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

function formatShiftDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getInitials(name) {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function FeedItemCard({
  item,
  isOwn = false,
  onToggleChapo,
  onDelete,
}) {
  const avatarUri = item.authorAvatarUrl
    ? getRoommateAvatarUrl(item.authorAvatarUrl)
    : null;
  const yearLabel = item.authorResidentYear ? `R${item.authorResidentYear}` : null;
  const isShift = item.type === "shift";
  const isCourse = item.type === "course";

  // Actividad de guardia y de curso: tarjeta compacta para no inundar el feed.
  if (isShift || isCourse) {
    const badge = isShift
      ? { color: PRIMARY, icon: "moon" }
      : { color: COURSE_BLUE, icon: "school" };
    const verb = isShift
      ? isOwn
        ? "hiciste una guardia"
        : "hizo una guardia"
      : isOwn
        ? "te has apuntado a un curso"
        : "se ha apuntado a un curso";
    const activeColor = badge.color;

    return (
      <View style={styles.shiftCard}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.shiftAvatar} />
        ) : (
          <View style={[styles.shiftAvatar, styles.avatarFallback]}>
            <Text style={styles.shiftAvatarInitials}>
              {getInitials(item.authorName) || "·"}
            </Text>
          </View>
        )}
        <View style={[styles.shiftBadge, { backgroundColor: badge.color }]}>
          <Icon name={badge.icon} size={11} color="#FFF" />
        </View>
        <View style={styles.shiftCompactCopy}>
          <Text style={styles.shiftCompactText} numberOfLines={1}>
            <Text style={styles.shiftCompactName}>
              {item.authorName || "Residente"}
            </Text>{" "}
            {verb}
          </Text>
          {isCourse ? (
            <Text style={styles.shiftCompactMeta} numberOfLines={1}>
              {!!item.shiftTitle && (
                <Text style={styles.courseTitle}>{item.shiftTitle}</Text>
              )}
              {item.shiftTitle && item.shiftDate ? " · " : ""}
              {formatShiftDate(item.shiftDate)}
            </Text>
          ) : (
            <Text style={styles.shiftCompactMeta} numberOfLines={1}>
              {[formatShiftDate(item.shiftDate), formatTimeAgo(item.activityAt)]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.shiftChapoBtn,
            { borderColor: activeColor },
            item.viewerHasChapo && { backgroundColor: activeColor },
          ]}
          onPress={() => onToggleChapo?.(item)}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            name={item.viewerHasChapo ? "thumbs-up" : "thumbs-up-outline"}
            size={15}
            color={item.viewerHasChapo ? "#FFF" : activeColor}
          />
          {item.chapoCount > 0 && (
            <Text
              style={[
                styles.shiftChapoCount,
                { color: activeColor },
                item.viewerHasChapo && styles.shiftChapoCountActive,
              ]}
            >
              {item.chapoCount}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Cabecera: autor */}
      <View style={styles.header}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>
              {getInitials(item.authorName) || "·"}
            </Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.authorName} numberOfLines={1}>
            {item.authorName || "Residente"}
          </Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            {[yearLabel, formatTimeAgo(item.activityAt)]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        {isOwn && item.type === "post" && onDelete ? (
          <TouchableOpacity
            onPress={() => onDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteBtn}
          >
            <Icon name="ellipsis-horizontal" size={18} color={MUTED} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Cuerpo */}
      {!!item.body && <Text style={styles.body}>{item.body}</Text>}
      {!!item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}

      {/* Pie: Chapó */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.chapoBtn, item.viewerHasChapo && styles.chapoBtnActive]}
          onPress={() => onToggleChapo?.(item)}
          activeOpacity={0.8}
        >
          <Icon
            name={item.viewerHasChapo ? "thumbs-up" : "thumbs-up-outline"}
            size={17}
            color={item.viewerHasChapo ? "#FFF" : PRIMARY}
          />
          <Text
            style={[
              styles.chapoLabel,
              item.viewerHasChapo && styles.chapoLabelActive,
            ]}
          >
            Chapó
          </Text>
        </TouchableOpacity>
        {item.chapoCount > 0 && (
          <Text style={styles.chapoCount}>
            {item.chapoCount} {item.chapoCount === 1 ? "Chapó" : "Chapós"}
          </Text>
        )}
      </View>
    </View>
  );
}

// Memoizado: dentro de un FlatList, evita re-renderizar cada tarjeta cuando el
// padre se re-renderiza (p. ej. al dar un Chapó, sólo cambia el ítem afectado).
export default React.memo(FeedItemCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#1B0977",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EDE9FE" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: PRIMARY, fontWeight: "700", fontSize: 15 },
  headerText: { flex: 1, marginLeft: 12 },
  authorName: { fontSize: 15, fontWeight: "700", color: TEXT },
  metaLine: { fontSize: 12.5, color: MUTED, marginTop: 2 },
  deleteBtn: { padding: 4 },
  body: { fontSize: 15, lineHeight: 21, color: "#1F2937", marginTop: 12 },
  postImage: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginTop: 12,
    backgroundColor: "#F3F4F6",
  },
  // Actividad de guardia compacta
  shiftCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    shadowColor: "#1B0977",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  shiftAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EDE9FE",
  },
  shiftAvatarInitials: { color: PRIMARY, fontWeight: "700", fontSize: 11 },
  shiftBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -10,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  shiftCompactCopy: { flex: 1, marginLeft: 8 },
  shiftCompactText: { fontSize: 13.5, color: "#1F2937" },
  shiftCompactName: { fontWeight: "700", color: TEXT },
  shiftCompactMeta: {
    fontSize: 11.5,
    color: MUTED,
    marginTop: 1,
    textTransform: "capitalize",
  },
  courseTitle: { color: "#374151", fontWeight: "600", textTransform: "none" },
  shiftChapoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    marginLeft: 8,
  },
  shiftChapoBtnActive: { backgroundColor: PRIMARY },
  shiftChapoCount: { fontSize: 12, fontWeight: "700", color: PRIMARY },
  shiftChapoCountActive: { color: "#FFF" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 12,
  },
  chapoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  chapoBtnActive: { backgroundColor: PRIMARY },
  chapoLabel: { fontSize: 13.5, fontWeight: "700", color: PRIMARY },
  chapoLabelActive: { color: "#FFF" },
  chapoCount: { fontSize: 13, color: MUTED, fontWeight: "600" },
});
