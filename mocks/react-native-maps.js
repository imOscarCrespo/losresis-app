import React from "react";
import { View } from "react-native";

const MapView = (props) => React.createElement(View, props);
MapView.Animated = (props) => React.createElement(View, props);

const Marker = (props) => React.createElement(View, props);
const Callout = (props) => React.createElement(View, props);
const Polygon = (props) => React.createElement(View, props);
const Polyline = (props) => React.createElement(View, props);
const Circle = (props) => React.createElement(View, props);
const Overlay = (props) => React.createElement(View, props);

export { Marker, Callout, Polygon, Polyline, Circle, Overlay };
export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = null;
export default MapView;
