export const FALLBACK_ROOMMATE_QUESTIONS = [
  {
    code: "weekday_vibe",
    step_number: 1,
    display_order: 1,
    title: "Plan entre semana",
    prompt: "Después del hospital o la facultad, ¿qué ambiente prefieres en casa?",
    helper_text: null,
    input_type: "single_choice",
    category: "lifestyle",
    is_required: true,
    options: [
      { value: "quiet", label: "Tranquilo y silencioso" },
      { value: "balanced", label: "Algo de charla pero con calma" },
      { value: "social", label: "Con vida y planes" },
    ],
  },
  {
    code: "weekend_plan",
    step_number: 2,
    display_order: 2,
    title: "Fin de semana",
    prompt: "¿Qué plan encaja más contigo cuando libras?",
    helper_text: null,
    input_type: "single_choice",
    category: "profile",
    is_required: true,
    options: [
      { value: "stay_in", label: "Casa, descanso y recados" },
      { value: "mixed", label: "Un poco de todo" },
      { value: "go_out", label: "Salir y hacer planes" },
    ],
  },
];
