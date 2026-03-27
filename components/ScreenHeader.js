import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

export const ScreenHeader = ({
  title,
  onBack = null,
  backIcon = "arrow-back",
  leftSlot = null,
  rightSlot = null,
  iconName = null,
  iconSize = 18,
  iconColor = COLORS.PRIMARY || "#670CF5",
  iconBackgroundColor = "rgba(103,12,245,0.07)",
  iconBorderColor = "rgba(103,12,245,0.12)",
  notificationCount = 0,
  onNotificationPress = null,
  centerTitle = false,
  compact = false,
  titleNumberOfLines = 1,
  style = null,
  titleStyle = null,
  subtitleStyle = null,
}) => {
  const [leftWidth, setLeftWidth] = useState(0);
  const [rightWidth, setRightWidth] = useState(0);
  const shouldCenterTitle = centerTitle || Boolean(onBack);

  const renderLeft = () => {
    if (leftSlot) {
      return leftSlot;
    }

    if (!onBack) {
      return null;
    }

    return (
      <TouchableOpacity
        onPress={onBack}
        style={styles.iconButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Ionicons name={backIcon} size={22} color="#670CF5" />
      </TouchableOpacity>
    );
  };

  const renderRight = () => {
    if (rightSlot) {
      return rightSlot;
    }

    if (onNotificationPress) {
      return (
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={onNotificationPress}
          activeOpacity={0.7}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={COLORS.GRAY_DARK}
          />
          {notificationCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {notificationCount > 99 ? "99+" : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    if (iconName) {
      return (
        <View
          style={[
            styles.headerIcon,
            {
              backgroundColor: iconBackgroundColor,
              borderColor: iconBorderColor,
            },
          ]}
        >
          <Ionicons name={iconName} size={iconSize} color={iconColor} />
        </View>
      );
    }

    return null;
  };

  const leftContent = renderLeft();
  const rightContent = renderRight();
  const centeredSideInset = Math.max(leftWidth, rightWidth, 36) + 10;

  if (shouldCenterTitle) {
    return (
      <View style={[styles.header, compact && styles.headerCompact, style]}>
        <View
          style={styles.sideRail}
          onLayout={({ nativeEvent }) => {
            setLeftWidth(nativeEvent.layout.width);
          }}
        >
          {leftContent || <View style={styles.sideSlotPlaceholder} />}
        </View>

        <View
          pointerEvents="none"
          style={[
            styles.centeredContentShell,
            {
              paddingLeft: centeredSideInset,
              paddingRight: centeredSideInset,
            },
          ]}
        >
          <View style={styles.centeredContent}>
            <Text
              style={[
                styles.title,
                styles.titleCentered,
                compact && styles.titleCompact,
                titleStyle,
              ]}
              numberOfLines={titleNumberOfLines}
            >
              {title}
            </Text>
          </View>
        </View>

        <View
          style={[styles.sideRail, styles.sideRailRight]}
          onLayout={({ nativeEvent }) => {
            setRightWidth(nativeEvent.layout.width);
          }}
        >
          {rightContent || <View style={styles.sideSlotPlaceholder} />}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.header, compact && styles.headerCompact, style]}>
      {leftContent}

      <View
        style={[
          styles.headerContent,
          shouldCenterTitle && styles.headerContentCentered,
        ]}
      >
        <Text
          style={[styles.title, compact && styles.titleCompact, titleStyle]}
          numberOfLines={titleNumberOfLines}
        >
          {title}
        </Text>
      </View>

      {rightContent}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: COLORS.WHITE,
  },
  headerCompact: {
    paddingBottom: 10,
  },
  headerContent: {
    flex: 1,
  },
  headerContentCentered: {
    alignItems: "center",
  },
  centeredContentShell: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
  },
  centeredContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B0977",
    letterSpacing: -0.2,
  },
  titleCentered: {
    textAlign: "center",
  },
  titleCompact: {
    fontSize: 17,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(103,12,245,0.06)",
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sideRail: {
    minWidth: 36,
    minHeight: 36,
    justifyContent: "center",
    zIndex: 1,
  },
  sideRailRight: {
    marginLeft: "auto",
    alignItems: "flex-end",
  },
  notificationButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 1,
    right: 0,
    backgroundColor: COLORS.ERROR,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: COLORS.WHITE,
    fontSize: 10,
    fontWeight: "700",
  },
  sideSlotPlaceholder: {
    width: 36,
    height: 36,
  },
});
