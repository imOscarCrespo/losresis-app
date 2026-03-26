import React, { useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";

export function MotionPressable({
  children,
  style,
  pressedStyle,
  disabled = false,
  scaleTo = 0.97,
  pressedOpacity = 0.94,
  animationDuration = 120,
  onPressIn,
  onPressOut,
  android_ripple,
  ...props
}) {
  const pressAnim = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue) => {
    Animated.timing(pressAnim, {
      toValue,
      duration: animationDuration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = (event) => {
    animateTo(1);
    onPressIn?.(event);
  };

  const handlePressOut = (event) => {
    animateTo(0);
    onPressOut?.(event);
  };

  const animatedStyle = {
    opacity: pressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, pressedOpacity],
    }),
    transform: [
      {
        scale: pressAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, scaleTo],
        }),
      },
      {
        translateY: pressAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
  };

  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={android_ripple}
      style={styles.pressable}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            animatedStyle,
            typeof style === "function" ? style({ pressed }) : style,
            pressed && pressedStyle,
            disabled && styles.disabled,
          ]}
        >
          {typeof children === "function" ? children({ pressed }) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: "stretch",
  },
  disabled: {
    opacity: 0.55,
  },
});
