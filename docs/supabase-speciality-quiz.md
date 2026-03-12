## Comandos SQL para Supabase – Test de Especialidad

### 1. Tabla de perfiles de especialidad

```sql
-- Tabla con la información de perfil de cada especialidad
create table if not exists speciality_profile (
  id uuid primary key default gen_random_uuid(),
  -- slug estable para mapear con la web / app
  speciality_key text not null unique,
  name text not null,
  category text not null check (
    category in (
      'atencion_primaria',
      'quirurgica',
      'medica',
      'urgencias_criticos',
      'diagnostica',
      'salud_publica'
    )
  ),
  -- Texto largo con los bullets que definen el perfil
  description text not null,
  created_at timestamptz not null default now()
);

-- Si en tu schema ya existe "speciality(id)" y quieres enlazarlo:
-- alter table speciality_profile
--   add column speciality_id uuid references speciality(id);
```

### 2. Inserts de perfiles de especialidad

```sql
-- ESPECIALIDADES DE ATENCIÓN PRIMARIA
insert into speciality_profile (speciality_key, name, category, description) values
('medicina_familiar', 'Medicina Familiar y Comunitaria', 'atencion_primaria', $$
Valora relaciones médico-paciente a largo plazo
Prefiere atención integral y continuada
Alta tolerancia a la ambigüedad diagnóstica
Busca equilibrio trabajo-vida personal
Interés en promoción de salud y prevención
Prefiere trabajar en entornos comunitarios o rurales
Alta puntuación en amabilidad (agreeableness)
Valora la flexibilidad de horarios
Menor énfasis en prestigio profesional
Interés en tratar familias completas
$$),
('pediatria', 'Pediatría', 'atencion_primaria', $$
Alta empatía y habilidades de comunicación
Perfil de personalidad "dependable" (confiable)
Alta puntuación en amabilidad
Alta extraversión
Interés en relaciones a largo plazo con pacientes
Capacidad de comunicación con niños y familias
Tolerancia a horarios variables
Orientación al servicio del paciente
Interés en desarrollo infantil
Paciencia y capacidad de tranquilizar
$$);

-- ESPECIALIDADES QUIRÚRGICAS
insert into speciality_profile (speciality_key, name, category, description) values
('cirugia_general_digestivo', 'Cirugía General y del Aparato Digestivo', 'quirurgica', $$
Perfil de personalidad "commanding" (autoritario)
Baja puntuación en amabilidad
Baja puntuación en neuroticismo
Alta conscienciosidad
Baja tolerancia al riesgo y ambigüedad
Valora habilidades técnicas y destreza manual
Orientación a resultados inmediatos
Menor prioridad en equilibrio trabajo-vida
Alta capacidad de trabajo bajo presión
Valora trabajo en equipo y colaboración
$$),
('traumatologia_ortopedia', 'Traumatología y Cirugía Ortopédica', 'quirurgica', $$
Orientación a procedimientos técnicos
Interés en resultados visibles e inmediatos
Alta conscienciosidad
Preferencia por práctica enfocada
Valora habilidades manuales
Tolerancia a horarios irregulares
Baja puntuación en neuroticismo
Interés en deportes y biomecánica
Capacidad de toma de decisiones rápidas
Valora el prestigio profesional
$$),
('neurocirugia', 'Neurocirugía', 'quirurgica', $$
Extremadamente alta conscienciosidad
Baja tolerancia a la incertidumbre
Perfil investigativo
Valora convertirse en experto
Alta capacidad de concentración
Tolerancia a entrenamientos prolongados
Orientación a casos complejos
Menor prioridad en vida personal
Alta precisión técnica
Interés en neurociencias
$$),
('cirugia_cardiovascular', 'Cirugía Cardiovascular', 'quirurgica', $$
Alta tolerancia al estrés
Baja puntuación en neuroticismo
Orientación a procedimientos de alto riesgo
Valora resultados inmediatos
Alta conscienciosidad
Capacidad de trabajo en equipo multidisciplinar
Tolerancia a guardias frecuentes
Interés en tecnología avanzada
Alta destreza manual
Valora el prestigio y reconocimiento
$$),
('cirugia_toracica', 'Cirugía Torácica', 'quirurgica', $$
Orientación a procedimientos complejos
Alta precisión técnica
Interés en oncología y trasplantes
Baja puntuación en neuroticismo
Alta conscienciosidad
Capacidad de manejo de casos críticos
Tolerancia a horarios exigentes
Valora especialización profunda
Interés en innovación quirúrgica
Trabajo en equipos multidisciplinares
$$),
('cirugia_plastica', 'Cirugía Plástica, Estética y Reparadora', 'quirurgica', $$
Alta creatividad e innovación
Interés en resultados estéticos
Alta destreza manual
Orientación al detalle
Buenas habilidades de comunicación con pacientes
Interés en sector privado
Valora autonomía profesional
Alta conscienciosidad
Interés en reconstrucción y trauma
Capacidad artística
$$),
('cirugia_vascular', 'Cirugía Vascular', 'quirurgica', $$
Orientación a procedimientos endovasculares
Interés en tecnología e imagen
Alta precisión técnica
Baja puntuación en neuroticismo
Capacidad de manejo de emergencias
Interés en patología crónica y aguda
Alta conscienciosidad
Tolerancia a guardias
Interés en innovación tecnológica
Trabajo multidisciplinar
$$),
('cirugia_pediatrica', 'Cirugía Pediátrica', 'quirurgica', $$
Combinación de habilidades quirúrgicas y pediátricas
Alta empatía con niños y familias
Alta precisión técnica
Tolerancia a casos complejos
Alta conscienciosidad
Capacidad de comunicación especial
Interés en malformaciones congénitas
Paciencia excepcional
Tolerancia a horarios variables
Orientación al trabajo en equipo
$$),
('cirugia_oral_maxilofacial', 'Cirugía Oral y Maxilofacial', 'quirurgica', $$
Interés en anatomía facial
Alta destreza manual
Orientación estética y funcional
Interés en trauma facial
Alta precisión técnica
Capacidad de trabajo ambulatorio y hospitalario
Buenas habilidades de comunicación
Interés en odontología y medicina
Alta conscienciosidad
Creatividad en reconstrucción
$$),
('ginecologia_obstetricia', 'Ginecología y Obstetricia', 'quirurgica', $$
Tolerancia a horarios impredecibles
Capacidad de manejo de emergencias
Interés en salud reproductiva
Alta conscienciosidad
Combinación de habilidades quirúrgicas y médicas
Orientación a relaciones a largo plazo
Alta tolerancia al estrés
Interés en acompañar procesos vitales
Capacidad de trabajo bajo presión
Empatía con pacientes femeninas
$$),
('urologia', 'Urología', 'quirurgica', $$
Orientación a procedimientos técnicos
Baja integración trabajo-vida (peor WLI)
Interés en cirugía y medicina
Alta conscienciosidad
Capacidad de manejo ambulatorio y quirúrgico
Interés en oncología urológica
Tolerancia a guardias
Orientación a resultados medibles
Interés en tecnología endoscópica
Práctica mixta médico-quirúrgica
$$),
('oftalmologia', 'Oftalmología', 'quirurgica', $$
Baja apertura a la experiencia (openness)
Alta precisión y destreza manual
Orientación a procedimientos delicados
Interés en microcirugía
Alta conscienciosidad
Preferencia por horarios regulares
Interés en tecnología avanzada
Capacidad de práctica ambulatoria
Orientación al detalle
Interés en sector privado
$$),
('otorrinolaringologia', 'Otorrinolaringología', 'quirurgica', $$
Baja apertura a la experiencia
Combinación de habilidades médicas y quirúrgicas
Alta precisión técnica
Interés en anatomía compleja
Alta conscienciosidad
Capacidad de práctica ambulatoria
Orientación a procedimientos variados
Interés en tecnología endoscópica
Buenas habilidades de comunicación
Equilibrio entre cirugía y consulta
$$);

-- ESPECIALIDADES MÉDICAS
insert into speciality_profile (speciality_key, name, category, description) values
('medicina_interna', 'Medicina Interna', 'medica', $$
Perfil investigativo
Interés en diagnóstico complejo
Alta tolerancia a la complejidad
Orientación al razonamiento clínico
Alta conscienciosidad
Interés en pacientes pluripatológicos
Capacidad de manejo de incertidumbre
Valora convertirse en experto
Interés en medicina basada en evidencia
Preferencia por práctica hospitalaria
$$),
('cardiologia', 'Cardiología', 'medica', $$
Interés en procedimientos diagnósticos y terapéuticos
Alta conscienciosidad
Orientación a tecnología avanzada
Capacidad de manejo de emergencias
Interés en fisiopatología cardiovascular
Tolerancia a guardias frecuentes
Orientación a resultados inmediatos
Alta capacidad de toma de decisiones
Interés en prevención y tratamiento
Valora el prestigio profesional
$$),
('neumologia', 'Neumología', 'medica', $$
Interés en patología respiratoria crónica
Orientación a procedimientos diagnósticos
Alta conscienciosidad
Capacidad de manejo ambulatorio y hospitalario
Interés en cuidados críticos
Tolerancia a pacientes complejos
Orientación a medicina basada en evidencia
Interés en tabaquismo y salud pública
Capacidad de trabajo multidisciplinar
Interés en ventilación mecánica
$$),
('nefrologia', 'Nefrología', 'medica', $$
Interés en fisiopatología renal
Alta tolerancia a la complejidad
Orientación a relaciones a largo plazo
Capacidad de manejo de pacientes crónicos
Alta conscienciosidad
Interés en diálisis y trasplante
Tolerancia a guardias
Orientación analítica
Interés en equilibrio hidroelectrolítico
Capacidad de trabajo en equipo
$$),
('endocrinologia_nutricion', 'Endocrinología y Nutrición', 'medica', $$
Interés en metabolismo y hormonas
Orientación a pacientes crónicos
Alta capacidad analítica
Interés en diabetes y obesidad
Alta conscienciosidad
Orientación a relaciones a largo plazo
Capacidad de educación al paciente
Interés en nutrición clínica
Preferencia por práctica ambulatoria
Orientación preventiva
$$),
('reumatologia', 'Reumatología', 'medica', $$
Interés en enfermedades autoinmunes
Alta tolerancia a la incertidumbre diagnóstica
Orientación a pacientes crónicos
Capacidad de manejo del dolor
Alta conscienciosidad
Interés en inmunología
Orientación a relaciones a largo plazo
Capacidad de exploración física detallada
Interés en calidad de vida
Preferencia por práctica ambulatoria
$$),
('hematologia_hemoterapia', 'Hematología y Hemoterapia', 'medica', $$
Interés en oncohematología
Alta capacidad analítica
Orientación a casos complejos
Interés en trasplante de médula
Alta conscienciosidad
Tolerancia a pacientes graves
Interés en laboratorio y clínica
Capacidad de manejo de urgencias
Orientación a medicina de precisión
Interés en investigación
$$),
('oncologia_medica', 'Oncología Médica', 'medica', $$
Alta empatía y habilidades de comunicación
Tolerancia a situaciones emocionalmente difíciles
Interés en tratamientos sistémicos
Capacidad de acompañamiento en enfermedad grave
Alta conscienciosidad
Orientación a trabajo multidisciplinar
Interés en investigación clínica
Capacidad de manejo de efectos adversos
Tolerancia al estrés emocional
Interés en medicina personalizada
$$),
('oncologia_radioterapica', 'Oncología Radioterápica', 'medica', $$
Interés en física y radiación
Orientación a tecnología avanzada
Alta precisión técnica
Capacidad de planificación compleja
Alta conscienciosidad
Interés en oncología multidisciplinar
Orientación a procedimientos técnicos
Capacidad de trabajo en equipo
Interés en dosimetría
Horarios más regulares que oncología médica
$$),
('neurologia', 'Neurología', 'medica', $$
Interés en neurociencias
Alta capacidad de razonamiento clínico
Orientación a diagnóstico complejo
Interés en exploración neurológica
Alta conscienciosidad
Tolerancia a enfermedades crónicas
Capacidad de manejo de urgencias neurológicas
Interés en neuroimagen
Orientación analítica
Interés en neurodegeneración
$$),
('psiquiatria', 'Psiquiatría', 'medica', $$
Perfil "compassionate" (compasivo)
Alta apertura a la experiencia
Baja conscienciosidad (comparado con cirugía)
Alta empatía y habilidades de comunicación
Interés en salud mental
Tolerancia a la ambigüedad
Capacidad de escucha activa
Interés en psicofarmacología
Orientación a relaciones terapéuticas
Menor contacto con pacientes físicamente enfermos
$$),
('geriatria', 'Geriatría', 'medica', $$
Interés en población anciana
Alta empatía
Orientación a atención integral
Capacidad de manejo de pluripatología
Alta paciencia
Interés en calidad de vida
Orientación a cuidados paliativos
Capacidad de trabajo multidisciplinar
Interés en síndromes geriátricos
Valoración funcional
$$),
('medicina_fisica_rehabilitacion', 'Medicina Física y Rehabilitación', 'medica', $$
Interés en recuperación funcional
Orientación a resultados a largo plazo
Alta paciencia
Capacidad de trabajo multidisciplinar
Interés en discapacidad
Orientación a calidad de vida
Capacidad de motivación al paciente
Interés en biomecánica
Horarios más regulares
Orientación a objetivos funcionales
$$),
('alergologia', 'Allergología', 'medica', $$
Interés en inmunología
Orientación a práctica ambulatoria
Capacidad de manejo de urgencias (anafilaxia)
Interés en diagnóstico etiológico
Alta conscienciosidad
Orientación a prevención
Capacidad de educación al paciente
Interés en pruebas diagnósticas
Horarios regulares
Práctica mixta adultos y niños
$$),
('dermatologia', 'Dermatología', 'medica', $$
Considerada más lifestyle-friendly
Orientación visual y diagnóstico por imagen
Interés en patología cutánea
Alta capacidad de observación
Horarios regulares
Interés en procedimientos dermatológicos
Capacidad de práctica ambulatoria
Interés en sector privado
Orientación estética y médica
Equilibrio trabajo-vida favorable
$$);

-- ESPECIALIDADES DE URGENCIAS Y CRÍTICOS
insert into speciality_profile (speciality_key, name, category, description) values
('anestesiologia_reanimacion', 'Anestesiología y Reanimación', 'urgencias_criticos', $$
Perfil "rescuer" (rescatador) para emergencias
Baja puntuación en neuroticismo
Alta tolerancia al estrés agudo
Orientación a procedimientos técnicos
Capacidad de toma de decisiones rápidas
Interés en farmacología
Alta conscienciosidad
Preferencia por entorno hospitalario
Tolerancia a horarios variables
Interés en manejo del dolor
$$),
('medicina_urgencias', 'Medicina de Urgencias', 'urgencias_criticos', $$
Perfil "rescuer" (rescatador)
Peor integración trabajo-vida (lowest WLI)
Alta tolerancia al estrés
Orientación a resultados inmediatos
Capacidad de multitarea
Interés en patología aguda variada
Alta extraversión
Tolerancia a horarios por turnos
Capacidad de toma de decisiones rápidas
Interés en estabilización y diagnóstico inicial
$$);

-- ESPECIALIDADES DIAGNÓSTICAS
insert into speciality_profile (speciality_key, name, category, description) values
('radiodiagnostico', 'Radiodiagnóstico', 'diagnostica', $$
Interés en tecnología de imagen
Orientación analítica
Menor contacto directo con pacientes
Baja extraversión
Alta capacidad de observación
Interés en anatomía radiológica
Horarios más regulares
Alta conscienciosidad
Orientación a diagnóstico
Interés en innovación tecnológica
$$),
('medicina_nuclear', 'Medicina Nuclear', 'diagnostica', $$
Interés en isótopos y radiación
Orientación a tecnología especializada
Menor contacto con pacientes
Interés en diagnóstico funcional
Alta precisión técnica
Horarios regulares
Orientación analítica
Interés en oncología
Capacidad de interpretación de imágenes
Interés en física médica
$$),
('microbiologia_parasitologia', 'Microbiología y Parasitología', 'diagnostica', $$
Interés en laboratorio
Menor contacto con pacientes
Baja extraversión
Orientación analítica
Interés en enfermedades infecciosas
Alta conscienciosidad
Horarios regulares
Interés en diagnóstico microbiológico
Capacidad de asesoramiento clínico
Interés en resistencias antimicrobianas
$$),
('inmunologia', 'Inmunología', 'diagnostica', $$
Interés en sistema inmune
Orientación a laboratorio y clínica
Alta capacidad analítica
Interés en enfermedades autoinmunes
Menor contacto directo con pacientes
Alta conscienciosidad
Interés en investigación
Horarios regulares
Orientación a diagnóstico complejo
Interés en inmunodeficiencias
$$),
('farmacologia_clinica', 'Farmacología Clínica', 'diagnostica', $$
Interés en medicamentos
Orientación analítica
Menor contacto con pacientes
Interés en farmacocinética
Alta conscienciosidad
Orientación a investigación
Capacidad de asesoramiento
Horarios regulares
Interés en ensayos clínicos
Orientación a seguridad de medicamentos
$$);

-- ESPECIALIDADES DE SALUD PÚBLICA
insert into speciality_profile (speciality_key, name, category, description) values
('medicina_preventiva_salud_publica', 'Medicina Preventiva y Salud Pública', 'salud_publica', $$
Interés en epidemiología
Orientación a poblaciones
Menor contacto directo con pacientes individuales
Interés en prevención
Capacidad analítica y estadística
Horarios regulares
Orientación a políticas de salud
Interés en investigación
Capacidad de gestión
Menor prestigio percibido
$$),
('medicina_trabajo', 'Medicina del Trabajo', 'salud_publica', $$
Interés en salud laboral
Orientación a prevención
Capacidad de evaluación de riesgos
Horarios regulares
Interés en ergonomía
Capacidad de gestión
Orientación a sector privado
Interés en legislación laboral
Equilibrio trabajo-vida favorable
Capacidad de asesoramiento empresarial
$$),
('medicina_legal_forense', 'Medicina Legal y Forense', 'salud_publica', $$
Interés en aspectos legales
Menor contacto con pacientes vivos
Alta capacidad analítica
Interés en patología forense
Horarios variables (guardias judiciales)
Orientación a peritaje
Capacidad de trabajo bajo presión legal
Interés en toxicología
Alta precisión en documentación
Capacidad de testimonio judicial
$$);
```

### 3. Tablas para el test tipo cuestionario

```sql
-- Sesión de test de especialidades por usuario
create table if not exists speciality_quiz_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- guardamos el top 3 final para analytics / reabrir resultados
  top_results jsonb,          -- [{speciality_key, score}, ...]
  raw_scores jsonb,           -- {especialidad: score}
  meta jsonb                  -- versión del test, etc.
);

-- Preguntas del test
create table if not exists speciality_quiz_question (
  id uuid primary key default gen_random_uuid(),
  order_index int not null,
  text text not null,
  dimension text not null,    -- p.ej. 'work_life', 'prestige', 'procedimientos'
  question_type text not null default 'likert'  -- 'likert' | 'choice'
);

-- Opciones de respuesta (para preguntas tipo choice/likert)
create table if not exists speciality_quiz_option (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references speciality_quiz_question(id) on delete cascade,
  label text not null,
  value int not null,         -- 1-5 por ejemplo
  order_index int not null
);

-- Respuestas de una sesión de test
create table if not exists speciality_quiz_answer (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references speciality_quiz_session(id) on delete cascade,
  question_id uuid not null references speciality_quiz_question(id) on delete cascade,
  value int not null,         -- 1-5 o índice de opción
  created_at timestamptz not null default now(),
  unique (session_id, question_id)
);
```

### 4. Semilla inicial de preguntas del test

```sql
insert into speciality_quiz_question (order_index, text, dimension, question_type) values
(1, '¿Prefieres relaciones a largo plazo con pacientes o resolver problemas rápidos y puntuales?', 'relacion_largo_plazo', 'likert'),
(2, '¿Qué peso tiene para ti el equilibrio trabajo-vida personal?', 'work_life', 'likert'),
(3, '¿Cuánto disfrutas los procedimientos manuales/técnicos (quirófano, intervenciones, dispositivos)?', 'procedimientos', 'likert'),
(4, '¿Cuánto te atraen las situaciones de alta urgencia y adrenalina?', 'urgencias', 'likert'),
(5, '¿Cuánto te interesa la investigación, los datos y la medicina basada en la evidencia?', 'investigacion', 'likert'),
(6, '¿Te ves más en hospitales de alta tecnología o en entornos comunitarios/centros de salud?', 'entorno', 'choice');

-- Opciones ejemplo (Likert de 1 a 5) para preguntas 1–5
insert into speciality_quiz_option (question_id, label, value, order_index)
select q.id, 'Muy poco', 1, 1
from speciality_quiz_question q where q.order_index in (1,2,3,4,5)
union all
select q.id, 'Poco', 2, 2 from speciality_quiz_question q where q.order_index in (1,2,3,4,5)
union all
select q.id, 'Algo', 3, 3 from speciality_quiz_question q where q.order_index in (1,2,3,4,5)
union all
select q.id, 'Bastante', 4, 4 from speciality_quiz_question q where q.order_index in (1,2,3,4,5)
union all
select q.id, 'Muchísimo', 5, 5 from speciality_quiz_question q where q.order_index in (1,2,3,4,5);
```

