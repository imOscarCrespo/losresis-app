import React, { memo, useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";
import {
  ROOMMATE_THEME,
  getRoommateAvatarUrl,
  getBudgetLabel,
  getRoommateDisplayName,
  getRoommateInitials,
  getRoommateTags,
} from "../../utils/roommateUtils";

const SWIPE_OUT_DISTANCE = 420;
const SWIPE_OUT_Y = -30;

const CandidateCard = memo(function CandidateCard({
  candidate,
  onOpenProfile,
  onOpenFilters,
}) {
  const displayName = getRoommateDisplayName(candidate.profile);
  const budgetLabel = getBudgetLabel(candidate.profile);
  const tags = getRoommateTags(candidate.profile, candidate.lifestyle);

  return (
    <View style={styles.card}>
      <Pressable style={styles.cardPressable} onPress={() => onOpenProfile?.(candidate)}>
        <View style={styles.heroGradient}>
          <View style={styles.avatarBubble}>
            {getRoommateAvatarUrl(candidate.profile.avatar_url) ? (
              <Image
                source={{ uri: getRoommateAvatarUrl(candidate.profile.avatar_url) }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>{getRoommateInitials(candidate.profile)}</Text>
            )}
          </View>
          <View style={styles.compatibilityPill}>
            <View style={styles.compatibilityDot} />
            <Text style={styles.compatibilityText}>
              {candidate.compatibility}% compatibilidad
            </Text>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardName}>{displayName}</Text>
            <Text style={styles.cardMeta}>
              {candidate.profile.speciality?.name ||
                candidate.profile.occupation_label ||
                "Perfil verificado"}
            </Text>
            <Text style={styles.cardMeta}>
              {candidate.profile.hospital?.name || candidate.profile.city}
            </Text>
            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.bodyGrid}>
            <View style={styles.infoCard}>
              <Icon name="wallet-outline" size={18} color={ROOMMATE_THEME.PRIMARY} />
              <Text style={styles.infoLabel}>Presupuesto</Text>
              <Text style={styles.infoValue}>{budgetLabel}</Text>
            </View>
            <View style={styles.infoCard}>
              <Icon
                name="calendar-outline"
                size={18}
                color={ROOMMATE_THEME.SECONDARY}
              />
              <Text style={styles.infoLabel}>Entrada</Text>
              <Text style={styles.infoValue}>
                {candidate.profile.move_in_date || "Flexible"}
              </Text>
            </View>
          </View>

          <Text style={styles.quote}>
            {candidate.profile.bio ||
              candidate.profile.ideal_roommate ||
              "Busca una convivencia fácil, responsable y con buen rollo."}
          </Text>

          <View style={styles.detailRow}>
            <TouchableOpacity
              style={styles.detailButton}
              onPress={() => onOpenProfile?.(candidate)}
            >
              <Text style={styles.detailButtonText}>Ver perfil completo</Text>
              <Icon
                name="arrow-forward-outline"
                size={16}
                color={ROOMMATE_THEME.ACCENT}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterIcon} onPress={onOpenFilters}>
              <Icon name="options-outline" size={18} color={ROOMMATE_THEME.ACCENT} />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </View>
  );
});

export function RoommateSwipeDeck({
  candidates = [],
  onSwipe,
  onOpenFilters,
  onOpenProfile,
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const swipeLockedRef = useRef(false);
  const activeCandidate = candidates[0];
  const nextCandidate = candidates[1];

  useEffect(() => {
    swipeLockedRef.current = false;
    position.setValue({ x: 0, y: 0 });
  }, [activeCandidate?.profile?.user_id, position]);

  const animateToDecision = (decision) => {
    if (!activeCandidate || swipeLockedRef.current) {
      return;
    }

    swipeLockedRef.current = true;
    const toValue =
      decision === "like"
        ? { x: SWIPE_OUT_DISTANCE, y: SWIPE_OUT_Y }
        : { x: -SWIPE_OUT_DISTANCE, y: SWIPE_OUT_Y };

    Animated.timing(position, {
      toValue,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onSwipe?.(decision);
      position.setValue({ x: 0, y: 0 });
    });
  };

  if (!activeCandidate) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyOrb}>
          <Icon name="sparkles" size={28} color={ROOMMATE_THEME.PRIMARY} />
        </View>
        <Text style={styles.emptyTitle}>No quedan perfiles por revisar</Text>
        <Text style={styles.emptyText}>
          Ajusta filtros o vuelve más tarde para ver nuevas personas buscando
          piso.
        </Text>
        <TouchableOpacity style={styles.secondaryCta} onPress={onOpenFilters}>
          <Icon name="options-outline" size={18} color={ROOMMATE_THEME.PRIMARY} />
          <Text style={styles.secondaryCtaText}>Abrir filtros</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.deckWrap}>
      <View style={styles.deckArea}>
        {nextCandidate ? (
          <Animated.View
            style={[
              styles.card,
              styles.nextCard,
              {
                transform: [{ scale: 0.92 }, { translateY: 12 }],
              },
            ]}
          >
            <View style={styles.nextCardTop}>
              <Text style={styles.nextCardLabel}>
                Después viene {getRoommateDisplayName(nextCandidate.profile)}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View
          style={[
            styles.swipeCard,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
              ],
            },
          ]}
        >
          <CandidateCard
            candidate={activeCandidate}
            onOpenFilters={onOpenFilters}
            onOpenProfile={onOpenProfile}
          />
        </Animated.View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => animateToDecision("pass")}
        >
          <Icon name="close" size={28} color={ROOMMATE_THEME.DANGER} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.boostButton} onPress={onOpenFilters}>
          <Icon name="options-outline" size={20} color={ROOMMATE_THEME.ACCENT} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => animateToDecision("like")}
        >
          <Icon name="heart" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deckWrap: {
    flex: 1,
  },
  deckArea: {
    flex: 1,
    minHeight: 560,
    justifyContent: "center",
    alignItems: "center",
  },
  swipeCard: {
    width: "100%",
  },
  card: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: ROOMMATE_THEME.CARD,
    overflow: "hidden",
    shadowColor: ROOMMATE_THEME.ACCENT,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  nextCard: {
    position: "absolute",
    top: 18,
    left: 12,
    right: 12,
    height: "92%",
    backgroundColor: "#EEE7FF",
  },
  nextCardTop: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 24,
  },
  nextCardLabel: {
    fontSize: 16,
    color: ROOMMATE_THEME.MUTED,
    fontWeight: "700",
  },
  cardPressable: {
    flex: 1,
  },
  heroGradient: {
    minHeight: 380,
    padding: 22,
    justifyContent: "space-between",
    backgroundColor: ROOMMATE_THEME.PRIMARY,
  },
  avatarBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  compatibilityPill: {
    position: "absolute",
    top: 22,
    right: 22,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  compatibilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ROOMMATE_THEME.SECONDARY,
  },
  compatibilityText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardFooter: {
    gap: 8,
  },
  cardName: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  cardMeta: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "600",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  tag: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.20)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tagText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  cardBody: {
    padding: 22,
    gap: 18,
  },
  bodyGrid: {
    flexDirection: "row",
    gap: 12,
  },
  infoCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: ROOMMATE_THEME.SURFACE,
    gap: 6,
  },
  infoLabel: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoValue: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 15,
    fontWeight: "800",
  },
  quote: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#F6F1FF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailButtonText: {
    color: ROOMMATE_THEME.ACCENT,
    fontWeight: "800",
    fontSize: 14,
  },
  filterIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F6F1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    paddingTop: 22,
    paddingBottom: 10,
  },
  actionButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ROOMMATE_THEME.ACCENT,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  rejectButton: {
    backgroundColor: "#FFFFFF",
  },
  likeButton: {
    backgroundColor: ROOMMATE_THEME.PRIMARY,
  },
  boostButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  emptyOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ROOMMATE_THEME.SURFACE,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: ROOMMATE_THEME.ACCENT,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    color: ROOMMATE_THEME.MUTED,
    textAlign: "center",
  },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    marginTop: 8,
  },
  secondaryCtaText: {
    color: ROOMMATE_THEME.PRIMARY,
    fontWeight: "800",
    fontSize: 14,
  },
});
