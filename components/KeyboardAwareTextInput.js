import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { TextInput } from "react-native";
import { useKeyboardAwareScrollContext } from "./KeyboardAwareScrollView";

export const KeyboardAwareTextInput = forwardRef(
  ({ keyboardAwareOptions, onFocus, onContentSizeChange, ...props }, forwardedRef) => {
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

    // Un campo multilínea crece al escribir: se recoloca para que la línea del cursor
    // no acabe debajo del teclado.
    const handleContentSizeChange = (event) => {
      if (props.multiline && keyboardAware && localRef.current?.isFocused?.()) {
        keyboardAware.scheduleScrollToFocusedInput(localRef, keyboardAwareOptions, 0);
      }
      onContentSizeChange?.(event);
    };

    return (
      <TextInput
        ref={localRef}
        {...props}
        onFocus={handleFocus}
        onContentSizeChange={handleContentSizeChange}
      />
    );
  }
);

KeyboardAwareTextInput.displayName = "KeyboardAwareTextInput";
