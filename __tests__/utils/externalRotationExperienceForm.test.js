import { validateExperienceForm } from "../../utils/externalRotationExperienceForm";

const TODAY = new Date(2026, 9, 16);

const validForm = {
  hospitalName: "Boston Children's Hospital",
  country: "United States",
  city: "Boston",
  startDate: "2026-06-01",
  endDate: "2026-07-31",
  highlightSummary: "Mucho volumen de cirugía.",
  beforeYouGo: "Pide el visado con tiempo.",
  answers: {},
};

const questions = [
  { id: "q1", type: "rating", is_optional: false },
  { id: "q2", type: "rating", is_optional: true },
  { id: "q3", type: "text", is_optional: false },
];

describe("validateExperienceForm", () => {
  it("acepta un formulario completo con hospital internacional escrito a mano", () => {
    expect(
      validateExperienceForm(
        { ...validForm, answers: { q1: { rating: 4 } } },
        questions,
        TODAY
      )
    ).toBeNull();
  });

  it("nombra los campos obligatorios que faltan", () => {
    const result = validateExperienceForm(
      { ...validForm, hospitalName: "  ", city: "" },
      [],
      TODAY
    );
    expect(result.title).toBe("Faltan campos obligatorios");
    expect(result.message).toBe("Completa: Hospital y ciudad.");
  });

  it("cuenta solo las valoraciones obligatorias sin responder", () => {
    const result = validateExperienceForm(validForm, questions, TODAY);
    expect(result.message).toBe("Completa: 1 valoración.");
  });

  it("no deja publicar con fecha de inicio futura", () => {
    const result = validateExperienceForm(
      { ...validForm, startDate: "2026-10-17", endDate: "" },
      [],
      TODAY
    );
    expect(result.title).toBe("Revisa las fechas");
  });

  it("acepta una rotación que empieza hoy y sigue en curso", () => {
    expect(
      validateExperienceForm(
        { ...validForm, startDate: "2026-10-16", endDate: "2026-12-16" },
        [],
        TODAY
      )
    ).toBeNull();
  });

  it("no deja publicar con fecha de fin anterior a la de inicio", () => {
    const result = validateExperienceForm(
      { ...validForm, endDate: "2026-05-31" },
      [],
      TODAY
    );
    expect(result.message).toBe("La fecha de fin no puede ser anterior a la de inicio.");
  });

  it("la fecha de fin es opcional", () => {
    expect(validateExperienceForm({ ...validForm, endDate: "" }, [], TODAY)).toBeNull();
  });
});
