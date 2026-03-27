import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#670CF5";

export const BottomMenuHeroHeader = ({
  title,
  subtitle = null,
  rightSlot = null,
  bottomContent = null,
  style = null,
  contentContainerStyle = null,
  titleStyle = null,
  subtitleStyle = null,
  bottomContentStyle = null,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(Math.min(insets.top, 12), 12),
          paddingBottom: bottomContent ? 22 : 24,
        },
        style,
      ]}
    >
      <View style={[styles.contentContainer, contentContainerStyle]}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, titleStyle]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
            ) : null}
          </View>
          {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
        </View>

        {bottomContent ? (
          <View style={[styles.bottomContent, bottomContentStyle]}>
            {bottomContent}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 20,
  },
  rightSlot: {
    paddingTop: 2,
  },
  bottomContent: {
    marginTop: 14,
  },
});
