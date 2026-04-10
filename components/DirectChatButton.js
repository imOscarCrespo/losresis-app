import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#670CF5";
const WHITE = "#FFFFFF";

export function DirectChatButton({
  onPress,
  disabled = false,
  loading = false,
  label = "Abrir chat",
  loadingLabel = "Abriendo chat...",
  size = "md",
  style,
  textStyle,
}) {
  const compact = size === "sm";
  const buttonLabel = loading ? loadingLabel : label;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        compact ? styles.compact : styles.regular,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={WHITE} />
      ) : (
        <Ionicons
          name="chatbubbles-outline"
          size={compact ? 14 : 18}
          color={WHITE}
        />
      )}
      <Text
        style={[
          styles.label,
          compact ? styles.labelCompact : styles.labelRegular,
          textStyle,
        ]}
        numberOfLines={1}
      >
        {buttonLabel}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    maxWidth: "100%",
  },
  regular: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  compact: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disabled: {
    opacity: 0.7,
  },
  label: {
    color: WHITE,
    fontWeight: "800",
  },
  labelRegular: {
    fontSize: 14,
  },
  labelCompact: {
    fontSize: 12,
  },
});
