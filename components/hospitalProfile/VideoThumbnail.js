import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Icon } from "../Icon";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const WHITE = "#FFFFFF";

// Miniatura de un vídeo de YouTube o Vimeo (ya parseado con
// parseInstitutionalVideo). Al tocarla, quien la usa abre el vídeo fuera.
export function VideoThumbnail({ video, onPress, accessibilityLabel }) {
  if (!video) return null;

  return (
    <TouchableOpacity
      style={styles.thumb}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {video.thumbnailUrl ? (
        <Image source={{ uri: video.thumbnailUrl }} style={styles.image} resizeMode="cover" />
      ) : null}
      <View style={styles.playBadge}>
        <Icon name="play" size={26} color={WHITE} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  playBadge: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
});
