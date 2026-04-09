import React, { createContext, forwardRef, useContext, useImperativeHandle, useMemo } from "react";
import { ScrollView } from "react-native";
import { useKeyboardAwareScroll } from "../hooks/useKeyboardAwareScroll";

const KeyboardAwareScrollContext = createContext(null);

export const useKeyboardAwareScrollContext = () => useContext(KeyboardAwareScrollContext);

export const KeyboardAwareScrollView = forwardRef(
  (
    {
      children,
      contentContainerStyle,
      bottomPadding = 24,
      extraScrollSpace = 24,
      keyboardShouldPersistTaps = "handled",
      keyboardDismissMode,
      onScroll,
      ...rest
    },
    forwardedRef
  ) => {
    const keyboardAware = useKeyboardAwareScroll({
      bottomPadding,
      extraScrollSpace,
    });

    useImperativeHandle(forwardedRef, () => keyboardAware.scrollViewProps.ref.current, [
      keyboardAware.scrollViewProps.ref,
    ]);

    const contextValue = useMemo(
      () => ({
        scheduleScrollToFocusedInput: keyboardAware.scheduleScrollToFocusedInput,
        setFocusedInput: keyboardAware.setFocusedInput,
      }),
      [keyboardAware.scheduleScrollToFocusedInput, keyboardAware.setFocusedInput]
    );

    return (
      <KeyboardAwareScrollContext.Provider value={contextValue}>
        <ScrollView
          {...keyboardAware.scrollViewProps}
          {...rest}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode={
            keyboardDismissMode ?? keyboardAware.scrollViewProps.keyboardDismissMode
          }
          onScroll={(event) => {
            keyboardAware.scrollViewProps.onScroll(event);
            onScroll?.(event);
          }}
          contentContainerStyle={[
            contentContainerStyle,
            {
              paddingBottom: keyboardAware.contentContainerBottomPadding,
            },
          ]}
        >
          {children}
        </ScrollView>
      </KeyboardAwareScrollContext.Provider>
    );
  }
);

KeyboardAwareScrollView.displayName = "KeyboardAwareScrollView";
