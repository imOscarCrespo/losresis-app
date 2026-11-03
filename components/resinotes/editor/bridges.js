import { BridgeExtension } from "@10play/tentap-editor";
import { createResiNotesBridges } from "./resinotesBridges";

// Quien escucha los toques en imágenes del editor abierto (solo hay uno a la vez).
const imageTapListeners = new Set();

/** Escucha los toques en imágenes del editor. Devuelve la función para dejar de escuchar. */
export const onEditorImageTap = (listener) => {
  imageTapListeners.add(listener);
  return () => imageTapListeners.delete(listener);
};

// El lado de la app de los bridges de tablas, bloques, selección y toques (ver resinotesBridges.js).
export const { TableBridge, CalloutBridge, SelectionBridge, TapsBridge } = createResiNotesBridges(BridgeExtension, {
  onImageTap: (src) => imageTapListeners.forEach((listener) => listener(src)),
});
