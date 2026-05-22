import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomMenuHeroHeader } from "./BottomMenuHeroHeader";

export const HeroScreenLayout = ({
  title,
  subtitle = null,
  onBack = null,
  leftSlot = undefined,
  rightSlot = null,
  bottomContent = null,
  children,
  overlay = null,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
  containerStyle = null,
  contentStyle = null,
  headerStyle = null,
}) => {
  const resolvedLeftSlot =
    leftSlot !== undefined
      ? leftSlot
      : onBack
      ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={22} color="#670CF5" />
          </TouchableOpacity>
        )
      : null;

  const inner = (
    <>
      <View style={[styles.heroShell, headerStyle]}>
        <BottomMenuHeroHeader
          title={title}
          subtitle={subtitle}
          leftSlot={resolvedLeftSlot}
          rightSlot={rightSlot}
          bottomContent={bottomContent}
        />
      </View>
      <View style={[styles.contentShell, contentStyle]}>{children}</View>
      {overlay}
    </>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, containerStyle]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {inner}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[styles.container, containerStyle]}>{inner}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroShell: {
    position: "relative",
    marginBottom: 12,
  },
  contentShell: {
    flex: 1,
    position: "relative",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(103,12,245,0.10)",
  },
});
