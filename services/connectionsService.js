import { supabase } from "../config/supabase";

// Estados normalizados de conexión que consume la UI.
export const CONNECTION_STATUS = {
  NONE: "none",
  PENDING_OUTGOING: "pending_outgoing",
  PENDING_INCOMING: "pending_incoming",
  CONNECTED: "connected",
};

const firstRow = (data) => (Array.isArray(data) ? data[0] : data) || null;

// Traduce (status, direction) de la DB al estado normalizado de la UI.
// 'rejected' se trata como 'none' (se permite reenviar).
const normalizeStatus = (row) => {
  if (!row) return CONNECTION_STATUS.NONE;
  if (row.status === "accepted") return CONNECTION_STATUS.CONNECTED;
  if (row.status === "pending") {
    return row.direction === "outgoing"
      ? CONNECTION_STATUS.PENDING_OUTGOING
      : CONNECTION_STATUS.PENDING_INCOMING;
  }
  return CONNECTION_STATUS.NONE;
};

export const sendConnectionRequest = async (addresseeId) => {
  try {
    const { data, error } = await supabase.rpc("send_connection_request", {
      p_addressee_id: addresseeId,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const row = firstRow(data);
    return { success: true, connectionId: row?.connection_id, status: row?.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const acceptConnectionRequest = async (connectionId) => {
  try {
    const { data, error } = await supabase.rpc("accept_connection_request", {
      p_connection_id: connectionId,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const row = firstRow(data);
    return { success: true, connectionId: row?.connection_id, status: row?.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const rejectConnectionRequest = async (connectionId) => {
  try {
    const { data, error } = await supabase.rpc("reject_connection_request", {
      p_connection_id: connectionId,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const row = firstRow(data);
    return { success: true, connectionId: row?.connection_id, status: row?.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const cancelConnectionRequest = async (connectionId) => {
  try {
    const { data, error } = await supabase.rpc("cancel_connection_request", {
      p_connection_id: connectionId,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const row = firstRow(data);
    return { success: true, connectionId: row?.connection_id, status: row?.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Devuelve un mapa { [otherUserId]: { status, connectionId, direction } }
// con el estado normalizado de la UI para cada residente consultado.
export const getConnectionStatuses = async (userIds = []) => {
  try {
    const ids = (userIds || []).filter(Boolean);
    if (ids.length === 0) {
      return { success: true, statuses: {} };
    }
    const { data, error } = await supabase.rpc("get_connection_statuses", {
      p_user_ids: ids,
    });
    if (error) {
      return { success: false, statuses: {}, error: error.message };
    }
    const statuses = {};
    (data || []).forEach((row) => {
      statuses[row.other_user_id] = {
        status: normalizeStatus(row),
        connectionId: row.connection_id,
        direction: row.direction,
      };
    });
    return { success: true, statuses };
  } catch (error) {
    return { success: false, statuses: {}, error: error.message };
  }
};

// Devuelve el nº de conexiones aceptadas del usuario autenticado.
// Para la línea "{x} conexiones" de la cabecera de perfil.
export const getResidentConnectionCount = async () => {
  try {
    const { data, error } = await supabase.rpc("get_resident_connection_count");
    if (error) {
      return { success: false, count: 0, error: error.message };
    }
    const count = typeof data === "number" ? data : Number(data) || 0;
    return { success: true, count };
  } catch (error) {
    return { success: false, count: 0, error: error.message };
  }
};

// Devuelve la lista de residentes conectados (status 'accepted') con los datos
// necesarios para pintar cada fila y abrir el chat directo.
export const getMyConnections = async () => {
  try {
    const { data, error } = await supabase.rpc("get_my_connections");
    if (error) {
      return { success: false, connections: [], error: error.message };
    }
    return { success: true, connections: data || [] };
  } catch (error) {
    return { success: false, connections: [], error: error.message };
  }
};

export default {
  CONNECTION_STATUS,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  getConnectionStatuses,
  getResidentConnectionCount,
  getMyConnections,
};
