import { BridgeExtension } from "@10play/tentap-editor";
import { createResiNotesBridges } from "./resinotesBridges";

// El lado de la app de los bridges de tablas y bloques (ver resinotesBridges.js).
export const { TableBridge, CalloutBridge } = createResiNotesBridges(BridgeExtension);
