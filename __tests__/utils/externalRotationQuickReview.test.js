import {
  getPendingReviewInvites,
  hasExtendedDetails,
  contactTextFromReview,
  hasReviewContact,
  isSameCenterName,
  normalizeContactUrl,
  quickReviewFieldsFromPlan,
  sanitizeHighlightTags,
  toggleHighlightTag,
  validateQuickReview,
  validateQuickReviewStep,
} from "../../utils/externalRotationQuickReview";

const TODAY = new Date(2026, 9, 16);

// Reseña rápida mínima: sin ningún texto libre, ni siquiera el contacto.
const quickForm = {
  hospitalName: "Boston Children's Hospital",
  country: "United States",
  city: "Boston",
  startDate: "2026-06-01",
  endDate: "2026-07-31",
  recommendation: "depends",
  difficulty: "hard",
  rotationKind: "hands_on",
  highlightTags: [],
  beforeYouGo: "",
  tutorName: "",
};

describe("validateQuickReview", () => {
  it("permite publicar una reseña útil sin redactar texto libre", () => {
    expect(validateQuickReview(quickForm, TODAY)).toBeNull();
  });

  it("no obliga a etiquetas, consejo ni detalles opcionales", () => {
    expect(
      validateQuickReview(
        { ...quickForm, highlightTags: undefined, beforeYouGo: undefined, serviceName: "" },
        TODAY
      )
    ).toBeNull();
  });

  it("señala el primer paso con problema para volver a él", () => {
    expect(validateQuickReview({ ...quickForm, recommendation: "" }, TODAY)).toMatchObject({
      stepIndex: 1,
      message: "Completa: Si la recomiendas.",
    });
    expect(validateQuickReview({ ...quickForm, city: "" }, TODAY).stepIndex).toBe(0);
  });
});

describe("validateQuickReviewStep", () => {
  it("nombra todos los campos que faltan en el paso 1", () => {
    expect(
      validateQuickReviewStep("where", { ...quickForm, hospitalName: " ", startDate: "" }, TODAY)
    ).toEqual({
      title: "Faltan campos obligatorios",
      message: "Completa: Hospital y fecha de inicio.",
    });
  });

  it("exige las tres preguntas del paso 2 sin respuestas por defecto", () => {
    expect(
      validateQuickReviewStep(
        "how",
        { ...quickForm, recommendation: "", difficulty: "", rotationKind: "" },
        TODAY
      ).message
    ).toBe("Completa: Si la recomiendas, si fue fácil conseguirla y tipo de rotación.");
  });

  it("rechaza una fecha de inicio futura y un fin anterior al inicio", () => {
    expect(
      validateQuickReviewStep("where", { ...quickForm, startDate: "2026-10-17" }, TODAY).title
    ).toBe("Revisa las fechas");
    expect(
      validateQuickReviewStep("where", { ...quickForm, endDate: "2026-05-31" }, TODAY).message
    ).toBe("La fecha de fin no puede ser anterior a la de inicio.");
    expect(
      validateQuickReviewStep("where", { ...quickForm, startDate: "2026-10-16", endDate: "" }, TODAY)
    ).toBeNull();
  });

  it("los pasos 3 y 4 son opcionales: se publica sin contacto", () => {
    expect(validateQuickReviewStep("highlights", {}, TODAY)).toBeNull();
    expect(validateQuickReviewStep("advice", {}, TODAY)).toBeNull();
  });

  it("el contacto acepta cualquier texto, sin formato de correo, teléfono ni enlace", () => {
    ["docencia@hospital", "Secretaría de Docencia", "999", "www.hospital.es/rotaciones"].forEach(
      (tutorName) => {
        expect(validateQuickReview({ ...quickForm, tutorName }, TODAY)).toBeNull();
      }
    );
  });
});

describe("etiquetas", () => {
  it("solo guarda etiquetas del catálogo, sin repetir y en su orden", () => {
    expect(
      sanitizeHighlightTags(["good_atmosphere", "made_up", "learned_a_lot", "good_atmosphere"])
    ).toEqual(["learned_a_lot", "good_atmosphere"]);
    expect(sanitizeHighlightTags(null)).toEqual([]);
  });

  it("permite varias selecciones y quitar una", () => {
    let tags = toggleHighlightTag([], "high_cost_of_living");
    tags = toggleHighlightTag(tags, "learned_a_lot");
    expect(tags).toEqual(["learned_a_lot", "high_cost_of_living"]);
    expect(toggleHighlightTag(tags, "learned_a_lot")).toEqual(["high_cost_of_living"]);
  });
});

describe("hasExtendedDetails", () => {
  it("distingue una reseña rápida de una ampliada", () => {
    expect(hasExtendedDetails({ ...quickForm, beforeYouGo: "Pide el visado pronto" })).toBe(false);
    expect(hasExtendedDetails({ ...quickForm, costNotes: "Alquiler 1.200 $" })).toBe(true);
    expect(hasExtendedDetails({ ...quickForm, accommodationNotes: "   " })).toBe(false);
  });
});

describe("isSameCenterName", () => {
  it("tolera tildes y nombres más largos, pero no un genérico de una palabra", () => {
    expect(isSameCenterName("Hospital Clínic", "Hospital Clinic de Barcelona")).toBe(true);
    expect(isSameCenterName("Hospital", "Hospital Clínic")).toBe(false);
    expect(isSameCenterName("", "Hospital Clínic")).toBe(false);
  });
});

describe("getPendingReviewInvites", () => {
  const plan = {
    id: "plan-1",
    hospital_name: "Hospital Clínic",
    city: "Barcelona",
    country: "Spain",
    start_date: "2026-07-01",
    end_date: "2026-09-30",
    review_invite_response: null,
  };

  it("invita por un plan cuya fecha de fin ya pasó", () => {
    expect(getPendingReviewInvites([plan], [], TODAY)).toEqual([plan]);
  });

  it("no invita por planes en curso, futuros o sin fecha de fin", () => {
    const plans = [
      { ...plan, id: "today", end_date: "2026-10-16" },
      { ...plan, id: "future", start_date: "2026-11-01", end_date: "2026-12-01" },
      { ...plan, id: "open", end_date: null },
    ];
    expect(getPendingReviewInvites(plans, [], TODAY)).toEqual([]);
  });

  it("no vuelve a invitar si la descartó o dijo que no la hizo", () => {
    expect(
      getPendingReviewInvites(
        [
          { ...plan, review_invite_response: "dismissed" },
          { ...plan, id: "plan-2", review_invite_response: "not_completed" },
        ],
        [],
        TODAY
      )
    ).toEqual([]);
  });

  it("no invita si ya publicó la experiencia, enlazada o del mismo centro y fechas", () => {
    expect(getPendingReviewInvites([plan], [{ rotation_id: "plan-1" }], TODAY)).toEqual([]);
    expect(
      getPendingReviewInvites(
        [plan],
        [
          {
            rotation_id: null,
            external_hospital_name: "Hospital Clinic de Barcelona",
            city: "barcelona",
            start_date: "2026-07-15",
            end_date: null,
          },
        ],
        TODAY
      )
    ).toEqual([]);
  });

  it("sí invita si la reseña propia es de otro centro o de otras fechas", () => {
    const reviews = [
      { rotation_id: null, external_hospital_name: "Hospital del Mar", city: "Barcelona", start_date: "2026-07-01" },
      { rotation_id: null, external_hospital_name: "Hospital Clínic", city: "Barcelona", start_date: "2025-01-01", end_date: "2025-02-01" },
    ];
    expect(getPendingReviewInvites([plan], reviews, TODAY)).toEqual([plan]);
  });

  it("ordena del plan terminado más reciente al más antiguo", () => {
    const older = { ...plan, id: "older", hospital_name: "Mayo Clinic", end_date: "2026-03-01" };
    expect(getPendingReviewInvites([older, plan], [], TODAY).map((p) => p.id)).toEqual([
      "plan-1",
      "older",
    ]);
  });
});

describe("quickReviewFieldsFromPlan", () => {
  it("rellena el paso 1 con los datos del plan y lo enlaza", () => {
    expect(
      quickReviewFieldsFromPlan({
        id: "plan-1",
        hospital_name: "Hospital Clínic",
        service_name: null,
        speciality_id: "spec-1",
        country: "Spain",
        city: "Barcelona",
        start_date: "2026-07-01",
        end_date: "2026-09-30",
      })
    ).toEqual({
      rotationId: "plan-1",
      hospitalName: "Hospital Clínic",
      serviceName: "",
      specialityId: "spec-1",
      country: "Spain",
      city: "Barcelona",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
    });
  });
});

describe("normalizeContactUrl", () => {
  it("añade https cuando falta y respeta el protocolo escrito", () => {
    expect(normalizeContactUrl(" hospital.es/rotaciones ")).toBe("https://hospital.es/rotaciones");
    expect(normalizeContactUrl("http://hospital.es")).toBe("http://hospital.es");
    expect(normalizeContactUrl("")).toBe("");
  });
});

describe("contactTextFromReview", () => {
  it("una reseña nueva devuelve su texto tal cual", () => {
    expect(contactTextFromReview({ tutor_name: " Secretaría de Docencia " })).toBe(
      "Secretaría de Docencia"
    );
  });

  it("una reseña de la 1.0.92 junta nombre, correo, teléfono y enlace para no perderlos", () => {
    expect(
      contactTextFromReview({
        tutor_name: "Dra. García",
        tutor_email: "docencia@hospital.es",
        contact_phone: "+34 912 345 678",
        contact_url: "https://hospital.es/rotaciones",
      })
    ).toBe("Dra. García · docencia@hospital.es · +34 912 345 678 · https://hospital.es/rotaciones");
    expect(contactTextFromReview({ tutor_name: null, tutor_email: "a@b.es" })).toBe("a@b.es");
  });

  it("sin contacto devuelve vacío", () => {
    expect(contactTextFromReview({ tutor_name: null })).toBe("");
    expect(contactTextFromReview(null)).toBe("");
  });
});

describe("hasReviewContact", () => {
  it("lee el formulario y la fila de BD; cualquier dato de contacto cuenta", () => {
    expect(hasReviewContact({ tutorName: "Secretaría de Docencia" })).toBe(true);
    expect(hasReviewContact({ tutor_name: "Dr. Pérez", tutor_email: null })).toBe(true);
    expect(hasReviewContact({ contact_url: "https://hospital.es" })).toBe(true);
    expect(hasReviewContact({ tutorName: "   " })).toBe(false);
    expect(hasReviewContact(null)).toBe(false);
  });
});
