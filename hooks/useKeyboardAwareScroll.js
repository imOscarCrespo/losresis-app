import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DEFAULT_FOCUS_DELAY = Platform.OS === "ios" ? 180 : 90;
const DEFAULT_EXTRA_SCROLL_SPACE = 24;

const measureInWindowAsync = (node) =>
  new Promise((resolve, reject) => {
    if (!node?.measureInWindow) {
      reject(new Error("Node cannot be measured"));
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      resolve({ x, y, width, height });
    });
  });

export const useKeyboardAwareScroll = ({
  bottomPadding = 24,
  extraScrollSpace = DEFAULT_EXTRA_SCROLL_SPACE,
  enabled = true,
} = {}) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const focusedInputRef = useRef(null);
  const scrollOffsetYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const timeoutsRef = useRef(new Set());
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const clearScheduledScrolls = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current.clear();
  }, []);

  const setFocusedInput = useCallback((inputRef) => {
    focusedInputRef.current = inputRef?.current || inputRef || null;
  }, []);

  const getFocusedInputNode = useCallback(
    (inputRef) =>
      inputRef?.current ||
      inputRef ||
      focusedInputRef.current ||
      TextInput.State.currentlyFocusedInput?.() ||
      null,
    []
  );

  const scrollToFocusedInput = useCallback(
    async (inputRef, options = {}) => {
      if (!enabled) return;

      const targetNode = getFocusedInputNode(inputRef);
      const scrollNode = scrollViewRef.current;

      if (!targetNode || !scrollNode?.scrollTo) {
        return;
      }

      try {
        const [scrollFrame, inputFrame] = await Promise.all([
          measureInWindowAsync(scrollNode),
          measureInWindowAsync(targetNode),
        ]);

        const visibleTop = scrollFrame.y + (options.topMargin ?? 0);
        const visibleBottom =
          scrollFrame.y +
          scrollFrame.height -
          keyboardHeightRef.current -
          (options.bottomMargin ?? 0);
        const targetSpacing = options.extraScrollSpace ?? extraScrollSpace;
        const inputBottom = inputFrame.y + inputFrame.height;

        if (inputBottom + targetSpacing > visibleBottom) {
          const delta = inputBottom + targetSpacing - visibleBottom;
          scrollNode.scrollTo({
            y: Math.max(0, scrollOffsetYRef.current + delta),
            animated: true,
          });
          return;
        }

        if (inputFrame.y - targetSpacing < visibleTop) {
          const delta = visibleTop - (inputFrame.y - targetSpacing);
          scrollNode.scrollTo({
            y: Math.max(0, scrollOffsetYRef.current - delta),
            animated: true,
          });
        }
      } catch (error) {
        // Ignore measurements that fail during transient layout changes.
      }
    },
    [enabled, extraScrollSpace, getFocusedInputNode]
  );

  const scheduleScrollToFocusedInput = useCallback(
    (inputRef, options = {}, delay = DEFAULT_FOCUS_DELAY) => {
      if (!enabled) return;

      const timeoutId = setTimeout(() => {
        timeoutsRef.current.delete(timeoutId);
        scrollToFocusedInput(inputRef, options);
      }, delay);

      timeoutsRef.current.add(timeoutId);
    },
    [enabled, scrollToFocusedInput]
  );

  useEffect(() => {
    if (!enabled) return undefined;

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleKeyboardShow = (event) => {
      const nextKeyboardHeight = Math.max(
        0,
        (event?.endCoordinates?.height || 0) - insets.bottom
      );
      keyboardHeightRef.current = nextKeyboardHeight;
      setKeyboardHeight(nextKeyboardHeight);
      scheduleScrollToFocusedInput(null, {}, Platform.OS === "ios" ? 32 : 16);
    };

    const handleKeyboardHide = () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      clearScheduledScrolls();
    };
  }, [clearScheduledScrolls, enabled, insets.bottom, scheduleScrollToFocusedInput]);

  const scrollViewProps = useMemo(
    () => ({
      ref: scrollViewRef,
      keyboardShouldPersistTaps: "handled",
      keyboardDismissMode: Platform.OS === "ios" ? "interactive" : "on-drag",
      automaticallyAdjustKeyboardInsets: Platform.OS === "ios",
      contentInsetAdjustmentBehavior: "automatic",
      scrollEventThrottle: 16,
      onScroll: (event) => {
        scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
      },
    }),
    []
  );

  const contentContainerBottomPadding =
    bottomPadding + insets.bottom + (Platform.OS === "android" ? keyboardHeight : 0);

  return {
    contentContainerBottomPadding,
    scheduleScrollToFocusedInput,
    scrollToFocusedInput,
    scrollViewProps,
    setFocusedInput,
  };
};
