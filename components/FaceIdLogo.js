import React from "react";
import Svg, { Path } from "react-native-svg";

export const FaceIdLogo = ({
  width = 24,
  height = 24,
  color = "#007AFF",
  style,
}) => {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      style={style}
    >
      <Path
        d="M7 3H5C3.89543 3 3 3.89543 3 5V7M7 21H5C3.89543 21 3 20.1046 3 19V17M17 3H19C20.1046 3 21 3.89543 21 5V7M17 21H19C20.1046 21 21 20.1046 21 19V17M11 13H12V9M16 9.5V8M9 16.5C10.5 17.5 13.5 17.5 15 16.5M8 9.5V8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
};
