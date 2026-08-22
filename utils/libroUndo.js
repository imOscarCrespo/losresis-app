// Qué registro anula el botón menos de una actividad del Libro del Residente.
//
// El menos no borra nada: inserta un libro_entry con count -1. Y lo insertaba con
// la fecha del día en que se pulsa, sin saber a qué registro correspondía, así que
// un registro de junio deshecho en agosto dejaba el +1 en junio y el -1 en agosto:
// el total del año salía bien y CUALQUIER suma por ventana de fechas salía mal.
//
// El -1 hereda la fecha del registro que anula, que es el positivo vivo más
// reciente (LIFO). Ver docs/adr/0010.
//
// Se trabaja con saldos por fecha y no con registros individuales porque un
// positivo puede valer más de uno (el registro rápido admite cantidad) y porque
// ya hay negativos escritos con la fecha vieja: mirar el saldo absorbe los dos
// casos sin tener que reconstruir un emparejamiento que no está guardado.

/** Una fecha ISO de día, que es lo que guarda libro_entry.performed_at. */
const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * El registro que anularía el siguiente menos de este nodo.
 *
 * Devuelve null cuando no hay nada que deshacer, y entonces el menos no debe
 * escribir: es la guarda de verdad, más fiable que `node.total_count > 0` porque
 * ese contador es un denormalizado que mantiene un trigger.
 *
 * Los registros sin fecha válida se ignoran (la columna es NOT NULL, así que es
 * una rama teórica). Si eso dejara el saldo a cero, el menos se bloquea: es
 * preferible no dejar deshacer que escribir un negativo con una fecha inventada.
 *
 * @param {Array<{id: string, count: number, performed_at: string, created_at?: string}>} entries
 *   todos los registros del nodo, en cualquier orden
 * @returns {{entryId: string|null, performedAt: string}|null}
 */
export const findUndoTarget = (entries) => {
  if (!Array.isArray(entries)) return null;

  const usable = entries.filter((entry) => isIsoDate(entry?.performed_at));

  // Saldo por fecha, y de paso el positivo más reciente de cada una para poder
  // decir cuál se anula (hoy solo informativo; lo pide un anula_entry_id futuro).
  const balanceByDate = new Map();
  const positiveByDate = new Map();

  usable.forEach((entry) => {
    const count = Number(entry.count);
    if (!Number.isFinite(count) || count === 0) return;

    const date = entry.performed_at;
    balanceByDate.set(date, (balanceByDate.get(date) || 0) + count);

    if (count > 0) {
      const previous = positiveByDate.get(date);
      const isNewer =
        !previous ||
        String(entry.created_at || "") >= String(previous.created_at || "");
      if (isNewer) positiveByDate.set(date, entry);
    }
  });

  // El saldo TOTAL manda, y hay que mirarlo antes que los de cada fecha: un
  // negativo escrito con el comportamiento viejo vive en otra fecha que el
  // positivo que anulaba, así que "junio tiene saldo +1" es cierto y a la vez no
  // queda nada que deshacer. Sin esta guarda, un +1 en junio deshecho en agosto
  // se podría deshacer una segunda vez.
  const total = Array.from(balanceByDate.values()).reduce(
    (sum, balance) => sum + balance,
    0
  );
  if (total <= 0) return null;

  const datesWithBalance = Array.from(balanceByDate.entries())
    .filter(([, balance]) => balance > 0)
    .map(([date]) => date)
    .sort();

  const performedAt = datesWithBalance[datesWithBalance.length - 1];
  if (!performedAt) return null;

  return {
    entryId: positiveByDate.get(performedAt)?.id || null,
    performedAt,
  };
};

export default {
  findUndoTarget,
};
