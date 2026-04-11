import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ROOMMATE_THEME,
  getBudgetLabel,
  getRoommateAvatarUrl,
  getRoommateDisplayName,
  getRoommateInitials,
  getRoommateTags,
} from "../../utils/roommateUtils";

export function RoommateProfileListCard({ candidate, onPress }) {
  const displayName = getRoommateDisplayName(candidate?.profile);
  const budgetLabel = getBudgetLabel(candidate?.profile);
  const tags = getRoommateTags(candidate?.profile, candidate?.lifestyle);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(candidate)}
      activeOpacity={0.88}
    >
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          {getRoommateAvatarUrl(candidate?.profile?.avatar_url) ? (
            <Image
              source={{ uri: getRoommateAvatarUrl(candidate.profile.avatar_url) }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarText}>
              {getRoommateInitials(candidate?.profile)}
            </Text>
          )}
        </View>

        <View style={styles.mainInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.compatibilityPill}>
              <Text style={styles.compatibilityText}>
                {candidate?.compatibility || 0}%
              </Text>
            </View>
          </View>

          <Text style={styles.meta} numberOfLines={1}>
            {candidate?.profile?.speciality?.name ||
              candidate?.profile?.occupation_label ||
              "Perfil roomie"}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {candidate?.profile?.hospital?.name || candidate?.profile?.city}
          </Text>
          <Text style={styles.budget}>{budgetLabel}</Text>
        </View>
      </View>

      {candidate?.profile?.bio ? (
        <Text style={styles.bio} numberOfLines={2}>
          {candidate.profile.bio}
        </Text>
      ) : null}

      {tags.length ? (
        <View style={styles.tagsRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <View style={styles.footerHint}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color={ROOMMATE_THEME.PRIMARY}
          />
          <Text style={styles.footerHintText}>Ver perfil y abrir chat</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={ROOMMATE_THEME.MUTED}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 18,
    gap: 14,
    shadowColor: ROOMMATE_THEME.ACCENT,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  topRow: {
    flexDirection: "row",
    gap: 14,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  mainInfo: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 18,
    fontWeight: "900",
  },
  compatibilityPill: {
    borderRadius: 999,
    backgroundColor: ROOMMATE_THEME.SURFACE,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compatibilityText: {
    color: ROOMMATE_THEME.PRIMARY,
    fontSize: 12,
    fontWeight: "900",
  },
  meta: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 13,
    fontWeight: "600",
  },
  budget: {
    marginTop: 2,
    color: ROOMMATE_THEME.TEXT,
    fontSize: 14,
    fontWeight: "800",
  },
  bio: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 14,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tagText: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 12,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerHintText: {
    color: ROOMMATE_THEME.PRIMARY,
    fontSize: 13,
    fontWeight: "800",
  },
});
