import { BridgeExtension } from "@10play/tentap-editor";
import { createResiNotesBridges } from "./resinotesBridges";

// El lado de la app de los bridges de tablas, bloques y selección (ver resinotesBridges.js).
export const { TableBridge, CalloutBridge, SelectionBridge } = createResiNotesBridges(BridgeExtension);
