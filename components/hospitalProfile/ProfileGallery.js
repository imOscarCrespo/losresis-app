import React from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";

const SURFACE_ALT = "#F3F4F8";

// Galería horizontal de fotos del perfil del hospital: la general del hospital
// y la de cada especialidad en su plan formativo.
export function ProfileGallery({ images, itemWidth = 240, itemHeight = 156 }) {
  if (!images?.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      nestedScrollEnabled
    >
      {images.map((image, index) => (
        <View
          key={image.id || `${image.public_url}-${index}`}
          style={[styles.item, { width: itemWidth, height: itemHeight }]}
        >
          <Image
            source={{ uri: image.public_url }}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel={image.alt_text || undefined}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { gap: 12, paddingRight: 2 },
  item: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: SURFACE_ALT,
  },
  image: { width: "100%", height: "100%" },
});
