import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { TextInput } from "react-native";
import { useKeyboardAwareScrollContext } from "./KeyboardAwareScrollView";

export const KeyboardAwareTextInput = forwardRef(
  ({ keyboardAwareOptions, onFocus, ...props }, forwardedRef) => {
    const localRef = useRef(null);
    const keyboardAware = useKeyboardAwareScrollContext();

    useImperativeHandle(forwardedRef, () => localRef.current, []);

    const handleFocus = (event) => {
      if (keyboardAware) {
        keyboardAware.setFocusedInput(localRef);
        keyboardAware.scheduleScrollToFocusedInput(localRef, keyboardAwareOptions);
      }

      onFocus?.(event);
    };

    return <TextInput ref={localRef} {...props} onFocus={handleFocus} />;
  }
);

KeyboardAwareTextInput.displayName = "KeyboardAwareTextInput";
