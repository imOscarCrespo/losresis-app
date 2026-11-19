import React, { useMemo } from "react";
import { Alert, Text } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { splitTextLinks } from "../utils/textLinks";

const DEFAULT_LINK_COLOR = "#670CF5";

/**
 * Texto libre con las URLs pulsables (se abren en el navegador integrado).
 * Acepta las mismas props que <Text>; `linkStyle` se suma al estilo del enlace.
 */
export function LinkifiedText({ children, linkStyle, onLinkPress, ...textProps }) {
  const text = typeof children === "string" ? children : "";
  const parts = useMemo(() => splitTextLinks(text), [text]);

  if (!parts.some((part) => part.type === "link")) {
    return <Text {...textProps}>{children}</Text>;
  }

  const open = async (href) => {
    onLinkPress?.(href);
    try {
      await WebBrowser.openBrowserAsync(href);
    } catch (err) {
      console.error("Error opening link:", err);
      Alert.alert("No se ha podido abrir el enlace", "Inténtalo de nuevo.");
    }
  };

  return (
    <Text {...textProps}>
      {parts.map((part, index) =>
        part.type === "link" ? (
          <Text
            key={index}
            accessibilityRole="link"
            onPress={() => open(part.href)}
            style={[
              { color: DEFAULT_LINK_COLOR, textDecorationLine: "underline" },
              linkStyle,
            ]}
          >
            {part.value}
          </Text>
        ) : (
          part.value
        )
      )}
    </Text>
  );
}
