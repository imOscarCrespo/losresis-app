import React from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

export const ScreenScaffold = ({
  header,
  children,
  style = null,
  headerShellStyle = null,
  headerShellVariant = "default",
  contentSurfaceStyle = null,
  keyboardAvoiding = false,
  keyboardBehavior = Platform.OS === "ios" ? "padding" : undefined,
  keyboardVerticalOffset = 0,
}) => {
  const isBrandHeaderShell = headerShellVariant === "brand";
  const content = (
    <>
      {header ? (
        <View
          style={[
            styles.headerShell,
            isBrandHeaderShell && styles.headerShellBrand,
            headerShellStyle,
          ]}
        >
          {header}
        </View>
      ) : null}
      <View style={[styles.contentSurface, contentSurfaceStyle]}>{children}</View>
    </>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, style]}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[styles.container, style]}>{content}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerShell: {
    backgroundColor: "#FFFFFF",
    position: "relative",
    zIndex: 2,
    elevation: 2,
  },
  headerShellBrand: {
    backgroundColor: "#670CF5",
  },
  contentSurface: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    position: "relative",
    zIndex: 1,
  },
});
