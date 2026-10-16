// Validación del formulario «Compartir experiencia» de rotaciones externas.
// Las fechas llegan como "YYYY-MM-DD", así que se comparan como texto.

const REQUIRED_FIELDS = [
  ["hospitalName", "hospital"],
  ["country", "país"],
  ["city", "ciudad"],
  ["startDate", "fecha de inicio"],
  ["highlightSummary", "qué destacas"],
  ["beforeYouGo", "qué saber antes de ir"],
];

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const joinLabels = (labels) =>
  labels.length > 1
    ? `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`
    : labels[0];

/**
 * Devuelve el primer problema del formulario como { title, message }, o null si
 * se puede publicar.
 */
export const validateExperienceForm = (form, questions = [], today = new Date()) => {
  const missing = REQUIRED_FIELDS.filter(
    ([field]) => !String(form?.[field] || "").trim()
  ).map(([, label]) => label);

  const unansweredRatings = questions.filter(
    (question) =>
      question.type === "rating" &&
      !question.is_optional &&
      !form?.answers?.[question.id]?.rating
  );

  if (unansweredRatings.length) {
    missing.push(
      unansweredRatings.length === 1
        ? "1 valoración"
        : `${unansweredRatings.length} valoraciones`
    );
  }

  if (missing.length) {
    const text = joinLabels(missing);
    return {
      title: "Faltan campos obligatorios",
      message: `Completa: ${text.charAt(0).toUpperCase()}${text.slice(1)}.`,
    };
  }

  if (form.startDate > toDateKey(today)) {
    return {
      title: "Revisa las fechas",
      message: "La fecha de inicio no puede ser posterior a hoy: cuenta una rotación que ya hayas empezado.",
    };
  }

  if (form.endDate && form.endDate < form.startDate) {
    return {
      title: "Revisa las fechas",
      message: "La fecha de fin no puede ser anterior a la de inicio.",
    };
  }

  return null;
};
