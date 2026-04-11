begin;

truncate table
  public.speciality_quiz_answer,
  public.speciality_quiz_option,
  public.speciality_quiz_question,
  public.speciality_quiz_session
restart identity cascade;

insert into public.dimension_weights (dimension, weight, category)
values
  ('block_1_orientacion_cognitiva', 1.50, 'speciality_quiz_v2'),
  ('block_2_relacion_medico_paciente', 1.50, 'speciality_quiz_v2'),
  ('block_3_tolerancia_estres_entorno', 1.30, 'speciality_quiz_v2'),
  ('block_4_estilo_vida_equilibrio', 1.30, 'speciality_quiz_v2'),
  ('block_5_personalidad_profesional', 1.00, 'speciality_quiz_v2'),
  ('block_6_motivaciones_valores', 1.00, 'speciality_quiz_v2'),
  ('block_7_orientacion_academica', 1.00, 'speciality_quiz_v2')
on conflict (dimension)
do update set
  weight = excluded.weight,
  category = excluded.category;

with questions (
  order_index,
  text,
  dimension,
  question_type,
  option_a,
  option_b,
  option_c,
  option_d
) as (
  values
    (1, 'Durante una guardia, recibes un paciente con síntomas inespecíficos. Tu impulso inicial es:', 'block_1_orientacion_cognitiva', 'choice',
      'Revisar historia y pruebas hasta comprender el mecanismo fisiopatológico',
      'Actuar rápidamente para estabilizar y resolver lo urgente',
      'Explicar al paciente lo que ocurre y tranquilizarlo',
      'Derivar a quien tenga más experiencia en ese tipo de casos'),
    (2, 'Te sientes más satisfecho/a cuando:', 'block_1_orientacion_cognitiva', 'choice',
      'Descubres un diagnóstico que otros no habían visto',
      'Realizas un procedimiento técnicamente exigente con éxito',
      'Un paciente te agradece tu acompañamiento durante su proceso',
      'Contribuyes a mejorar un protocolo o sistema de trabajo'),
    (3, 'Cuando estudias medicina, disfrutas más:', 'block_1_orientacion_cognitiva', 'choice',
      'Comprendiendo mecanismos fisiopatológicos complejos',
      'Aprendiendo técnicas prácticas y habilidades manuales',
      'Analizando historias clínicas reales con contexto humano',
      'Revisando literatura científica y estudios recientes'),
    (4, 'En un caso difícil, lo que más te incomoda es:', 'block_1_orientacion_cognitiva', 'choice',
      'No tener suficiente información diagnóstica',
      'No poder intervenir de inmediato',
      'No poder dedicar tiempo suficiente al paciente',
      'No poder explorar nuevas hipótesis o enfoques'),

    (5, '¿Qué tipo de relación te resulta más gratificante?', 'block_2_relacion_medico_paciente', 'choice',
      'Episodios clínicos complejos con resolución diagnóstica',
      'Intervenciones resolutivas con resultado inmediato',
      'Seguimiento longitudinal durante años',
      'Impacto poblacional o sistémico'),
    (6, 'Si un paciente no mejora rápidamente:', 'block_2_relacion_medico_paciente', 'choice',
      'Revisas el diagnóstico en profundidad',
      'Consideras nuevas intervenciones prácticas',
      'Aumentas la comunicación y apoyo emocional',
      'Analizas si el abordaje global debe cambiar'),
    (7, 'Te identificas más con:', 'block_2_relacion_medico_paciente', 'choice',
      'El clínico que resuelve enigmas diagnósticos',
      'El médico que interviene con destreza técnica',
      'El profesional que acompaña procesos vitales',
      'El médico que impulsa cambios estructurales'),
    (8, '¿Qué escenario te agotaría más?', 'block_2_relacion_medico_paciente', 'choice',
      'Trabajo sin profundidad intelectual',
      'Trabajo sedentario sin acción práctica',
      'Poco contacto humano significativo',
      'Rutina sin posibilidad de mejora o innovación'),

    (9, '¿En qué ambiente trabajas mejor?', 'block_3_tolerancia_estres_entorno', 'choice',
      'Entorno estructurado y predecible',
      'Ambiente dinámico con decisiones rápidas',
      'Consultas programadas con tiempo por paciente',
      'Entornos académicos o de innovación'),
    (10, 'Ante situaciones críticas:', 'block_3_tolerancia_estres_entorno', 'choice',
      'Prefieres analizar antes de actuar',
      'Te activas y rindes mejor bajo presión',
      'Te centras en el bienestar emocional del paciente',
      'Evalúas si el sistema podría mejorarse'),
    (11, '¿Qué tipo de guardia toleras mejor?', 'block_3_tolerancia_estres_entorno', 'choice',
      'Diagnósticos complejos y debate clínico',
      'Politrauma y emergencias constantes',
      'Seguimiento de pacientes conocidos',
      'Organización de equipos y protocolos'),
    (12, 'A largo plazo prefieres:', 'block_3_tolerancia_estres_entorno', 'choice',
      'Profundizar en un área clínica específica',
      'Desarrollar habilidades técnicas de alto nivel',
      'Construir relaciones duraderas con pacientes',
      'Participar en proyectos de investigación o gestión'),

    (13, 'Tu prioridad profesional principal es:', 'block_4_estilo_vida_equilibrio', 'choice',
      'Excelencia diagnóstica y reconocimiento clínico',
      'Impacto inmediato y resultados tangibles',
      'Equilibrio con vida personal y familiar',
      'Proyección académica o investigadora'),
    (14, '¿Qué tipo de reconocimiento valoras más?', 'block_4_estilo_vida_equilibrio', 'choice',
      'Ser referente clínico en tu área',
      'Ser técnicamente excelente en procedimientos',
      'Ser apreciado por pacientes y compañeros',
      'Publicar o liderar proyectos innovadores'),
    (15, 'Respecto al horario ideal:', 'block_4_estilo_vida_equilibrio', 'choice',
      'Regular y estructurado, aunque intenso',
      'Variable e intenso, con adrenalina',
      'Compatible con estabilidad personal',
      'Flexible según proyectos y objetivos'),
    (16, 'Respecto a las guardias:', 'block_4_estilo_vida_equilibrio', 'choice',
      'Las acepto si son intelectualmente estimulantes',
      'Las disfruto por la acción y variedad',
      'Prefiero minimizarlas para equilibrio personal',
      'Las veo como oportunidad de aprendizaje'),

    (17, 'En equipo, sueles ser:', 'block_5_personalidad_profesional', 'choice',
      'Analítico/a y reservado/a',
      'Decidido/a y directivo/a',
      'Empático/a y cohesionador/a',
      'Visionario/a y creativo/a'),
    (18, 'Ante la incertidumbre diagnóstica:', 'block_5_personalidad_profesional', 'choice',
      'Buscas más datos y pruebas',
      'Tomas decisiones prácticas con lo disponible',
      'Escuchas a las personas implicadas',
      'Reformulas el problema desde otro ángulo'),
    (19, 'Prefieres trabajar:', 'block_5_personalidad_profesional', 'choice',
      'En profundidad sobre pocos casos complejos',
      'Con volumen alto y resolución rápida',
      'Con continuidad y seguimiento de pacientes',
      'En entornos mixtos clínico-académicos'),
    (20, 'Si volvieras a empezar medicina, elegirías algo que:', 'block_5_personalidad_profesional', 'choice',
      'Exija alto razonamiento clínico',
      'Requiera habilidad técnica avanzada',
      'Permita relación humana prolongada',
      'Integre asistencia e investigación'),

    (21, 'Te motiva más:', 'block_6_motivaciones_valores', 'choice',
      'Comprender profundamente la enfermedad',
      'Intervenir y ver resultados rápidos',
      'Acompañar procesos humanos difíciles',
      'Contribuir al avance científico'),
    (22, '¿Qué importancia tiene el prestigio de la especialidad?', 'block_6_motivaciones_valores', 'choice',
      'Muy importante - influye significativamente',
      'Importante - lo considero',
      'Poco importante - priorizo otros factores',
      'Nada importante - no me influye'),
    (23, '¿Qué importancia tiene la remuneración económica?', 'block_6_motivaciones_valores', 'choice',
      'Muy importante - busco alta remuneración',
      'Importante pero no determinante',
      'Secundaria a otros factores',
      'No es un factor en mi decisión'),
    (24, '¿Qué te atrajo originalmente de la medicina?', 'block_6_motivaciones_valores', 'choice',
      'El desafío intelectual y científico',
      'La capacidad de intervenir y curar',
      'Ayudar a personas en momentos difíciles',
      'Contribuir al conocimiento y la sociedad'),

    (25, '¿Te interesa combinar práctica clínica con investigación?', 'block_7_orientacion_academica', 'choice',
      'Sí, es fundamental para mí',
      'Sí, ocasionalmente',
      'No especialmente - prefiero clínica pura',
      'Solo si es investigación clínica aplicada'),
    (26, '¿Te gustaría trabajar en un hospital universitario con docencia?', 'block_7_orientacion_academica', 'choice',
      'Sí, es mi objetivo principal',
      'Sí, lo consideraría positivamente',
      'Me es indiferente',
      'Prefiero práctica sin carga docente'),
    (27, '¿Te atrae el desarrollo de nuevas técnicas o tecnologías?', 'block_7_orientacion_academica', 'choice',
      'Mucho - quiero estar en la vanguardia',
      'Bastante - me interesa la innovación',
      'Algo - si mejora la atención al paciente',
      'Poco - prefiero técnicas establecidas'),
    (28, '¿Cómo ves tu carrera a 20 años?', 'block_7_orientacion_academica', 'choice',
      'Referente clínico en mi subespecialidad',
      'Experto técnico reconocido',
      'Médico de confianza para mis pacientes',
      'Investigador/docente con impacto académico')
),
inserted_questions as (
  insert into public.speciality_quiz_question (
    order_index,
    text,
    dimension,
    question_type
  )
  select
    order_index,
    text,
    dimension,
    question_type
  from questions
  order by order_index
  returning id, order_index
)
insert into public.speciality_quiz_option (
  question_id,
  label,
  value,
  order_index
)
select
  iq.id,
  opt.label,
  opt.value,
  opt.order_index
from inserted_questions iq
join questions q
  on q.order_index = iq.order_index
cross join lateral (
  values
    (q.option_a, 1, 1),
    (q.option_b, 2, 2),
    (q.option_c, 3, 3),
    (q.option_d, 4, 4)
) as opt(label, value, order_index)
order by iq.order_index, opt.order_index;

commit;
