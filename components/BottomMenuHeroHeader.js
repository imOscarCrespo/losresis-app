import React from "react";
import { StyleSheet, Text, View } from "react-native";

export const BottomMenuHeroHeader = ({
  title,
  leftSlot = null,
  rightSlot = null,
  bottomContent = null,
  style = null,
  contentContainerStyle = null,
  titleStyle = null,
  bottomContentStyle = null,
}) => {
  // El color de la franja del notch lo pinta ScreenLayout (topInsetColor),
  // así que el header sólo necesita su padding propio.
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: 12,
          paddingBottom: bottomContent ? 16 : 12,
        },
        style,
      ]}
    >
      <View style={[styles.contentContainer, contentContainerStyle]}>
        <View style={styles.topRow}>
          {leftSlot ? <View style={styles.leftSlot}>{leftSlot}</View> : null}
          <View style={styles.titleBlock}>
            <Text style={[styles.title, titleStyle]}>{title}</Text>
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
    backgroundColor: "#F8F9FE",
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
    color: "#1B0977",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  leftSlot: {
    paddingTop: 2,
  },
  rightSlot: {
    paddingTop: 2,
  },
  bottomContent: {
    marginTop: 14,
  },
});
