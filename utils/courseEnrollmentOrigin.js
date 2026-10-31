// Texto de la fila "Inscripción" de un curso en la Agenda, según quién hizo la
// inscripción. La base lo deja en la copia del evento (`metadata.enrolled_by`:
// 'self' | 'hospital') junto al nombre del hospital (`enrolled_by_name`).
//
// La app nunca afirma algo que el usuario no ha hecho: si el evento no dice el
// origen (copias anteriores a guardarlo), el texto es neutro.

export const describeCourseEnrollmentOrigin = (metadata) => {
  const origin = metadata?.enrolled_by;

  if (origin === "self") {
    return "Te inscribiste en este curso desde LosResis";
  }

  if (origin === "hospital") {
    const hospitalName =
      typeof metadata.enrolled_by_name === "string"
        ? metadata.enrolled_by_name.trim()
        : "";
    return `Te ha inscrito ${hospitalName || "Docencia"}`;
  }

  return "Estás inscrito en este curso";
};
