# 03 · Investigación de necesidades reales del residente

> Investigación web realizada el 2026-05-25 sobre foros (casiMedicos), prensa médica
> española (Redacción Médica, ConSalud, Infobae España, eldiario.es), comunicados
> sindicales (CESM, Asociación MIR España, CSIF), y publicaciones académicas. El
> objetivo es validar (o refutar) las hipótesis del documento [02](./02-analisis-datos-posthog.md)
> con la voz real del residente español y mapear qué falta.

## 1. Pain points validados

### 1.1 Burnout y guardias — **prioridad máxima**
Dato cuantificable: **94% de los médicos jóvenes diagnosticados con desgaste
profesional**, **80% supera las 48h/semana legales europeas**, **43,6% no descansa
adecuadamente tras la guardia**.

> *"Te deshumanizas como mecanismo de defensa"*
> — Testimonio en Redacción Médica, 2025
> ([fuente](https://www.redaccionmedica.com/secciones/formacion/salud-mental-en-el-mir-te-deshumanizas-como-mecanismo-de-defensa--6272))

> *"El 'burnout' afecta a 9 de cada 10 médicos jóvenes: las guardias y la falta de
> descanso ponen en jaque la salud mental de los MIR"*
> — Infobae España, 12 nov 2025
> ([fuente](https://www.infobae.com/espana/2025/11/12/el-burnout-afecta-a-9-de-cada-10-medicos-jovenes-las-guardias-y-la-falta-de-descanso-ponen-en-jaque-la-salud-mental-de-los-mir/))

### 1.2 Huelga MIR 18-22 mayo 2026 y derechos laborales — **momento histórico**
Demandas: jornada de 35h/semana, máximo 4 guardias presenciales/mes, recuperación del
25% de poder adquisitivo perdido en 15 años. La Asociación MIR España ha convocado
paros nacionales para coincidir con la toma de posesión MIR.

> *"Continúan las jornadas laborales que superan los límites máximos de 45 horas que
> establece la normativa europea (...) el sistema se sirve de forma estructural de las
> guardias"*
> — Asociación MIR España vía ConSalud, 2026
> ([fuente](https://www.consalud.es/formacion/huelga-mir-puntos-reivindicaciones-claves-acabar-precariedad-residentes_85665_102.html))

> *"Los hospitales no aguantan ni una hora sin residentes"*
> — eldiario.es, 2026
> ([fuente](https://www.eldiario.es/sociedad/mir-sanidad-publica-iran-huelga-hospitales-no-aguantan-hora-residentes_1_6091876.html))

### 1.3 Relación con el tutor deficiente
Encuesta CSIF: **40% de los MIR-EIR califica de "mala" la relación con su tutor**.
Urgencias es la especialidad más insatisfecha. La Asociación MIR España recopiló más
de **400 quejas anónimas formales** en un solo año, principalmente sobre incumplimiento
de libranzas, exceso de guardias y falta de supervisión.

> *"Los MIR recaban 400 quejas sobre su formación: estas son las más frecuentes"*
> — Redacción Médica, 2025
> ([fuente](https://www.redaccionmedica.com/secciones/formacion/los-mir-recaban-400-quejas-sobre-su-formacion-estas-son-las-mas-frecuentes-5712))

### 1.4 Nómina opaca y desigual por CCAA
Las guardias suponen entre el **30-37% de retención IRPF + Seguridad Social** y los
residentes denuncian no entender por qué cobran tan distinto cada mes. Diferencias
brutales por comunidad: de 1.094€ netos R1 Navarra a 1.642€ R5 Baleares
([CESM 2025](https://www.cesm.org/2025/02/03/estas-son-las-retribuciones-de-los-mir-en-2024-segun-especialidad-y-comunidad-autonoma/),
[SIMEG Informe Guardias dic 2024](https://simeg.org/wp/wp-content/uploads/2025/02/Informe-Guardias-Medicas-diciembre-2024.pdf)).

### 1.5 Burocracia de rotaciones externas
Solicitud a la Comisión de Docencia con **5 meses de antelación**, máximo 4 meses/año y
12 meses totales en toda la residencia. La SERMEF y ContigoDOC han tenido que publicar
guías porque "hay que empezar con un año de antelación, muchos trámites lentos"
([SERMEF](https://www.sermef.es/como-preparo-mi-rotacion/),
[ContigoDOC](https://www.contigodoc.es/rotaciones-externas-medicos-residentes)).

### 1.6 Acceso desigual a herramientas clínicas
El Ministerio paga **UpToDate Anywhere** para todo el SNS, pero el acceso depende de la
CCAA y muchos R1 no saben activarlo. **Fisterra** (guías clínicas españolas) existe
pero su app móvil es mediocre. No hay equivalente español de **MDCalc** (calculadoras
clínicas) bien mantenido.

### 1.7 Acoso y casos sensibles
El caso del Hospital de Tudela (nov 2025: denuncia de agresión sexual entre residentes
+ aislamiento institucional posterior) evidencia la necesidad de **canales seguros y
peer-support real**, no solo PAIME — que muchos residentes desconocen o temen usar por
miedo a represalias.

## 2. Necesidades por categoría

| Categoría | Necesidad concreta no cubierta hoy |
|---|---|
| **Salud mental** | Detección temprana de burnout (cuestionario MBI mensual), recursos PAIME accesibles, líneas anónimas, peer-support inter-hospital |
| **Guardias / derechos** | Calculadora de guardias legales (¿cuántas llevo este mes? ¿he librado?), denuncia anónima a Asociación MIR España, alertas de huelga/movilización |
| **Formación bedside** | Acceso rápido a guías clínicas españolas (Fisterra, protocolos hospital), calculadoras médicas integradas, banco de imágenes/casos |
| **Libro del residente** | Tracking de procedimientos con códigos oficiales BOE por especialidad, exportación a memoria anual del MEF, alertas "te faltan X procedimientos para fin de año" |
| **Post-MIR** | Mapeo de fellowships España + extranjero, oposiciones por CCAA, alertas bolsa SAS/SERMAS, plantillas CV médico, USMLE/PLAB roadmap |
| **Finanzas** | Simulador nómina por CCAA y año, IRPF de guardias, ahorro/inversión para R5 que termina sin contrato, créditos para opos |
| **Networking** | Red inter-hospital por especialidad (no solo grupo de chat — un "Doximity ES"), mentor R5→R1 |
| **Sesiones clínicas** | Plantillas, banco de casos compartido, ayuda IA para preparar sesión, traducción/inglés médico para artículos/congresos |

## 3. Análisis de competencia

| App | Qué hace | Por qué la usa el residente |
|---|---|---|
| **UpToDate** | Evidencia clínica actualizada por tema | Gold standard mundial; SNS lo paga pero acceso fragmentado por CCAA |
| **Medscape** | Noticias + calculadoras + fármacos + CME | App "todo en uno" más descargada por residentes; gratis |
| **Epocrates** | Vademécum + interacciones farmacológicas | Consulta rápida en planta |
| **MDCalc** | 900+ calculadoras y scores (CHA2DS2-VASc, Wells, qSOFA, GFR…) | Estándar bedside; no hay equivalente español |
| **AMBOSS** | Library + Qbank + NEJM Resident 360 (integrado) | Crece en Europa; combina formación continua + consulta |
| **NEJM Resident 360** | Hub para residentes Medicina Interna (migrado a AMBOSS) | Modelo aspiracional de "todo para un residente" |
| **Osmosis (Elsevier)** | Vídeos cortos por enfermedad | Repaso visual para R1-R2 |
| **Fisterra** | Guías clínicas en español (atención primaria) | Referencia AP; integrada en Univadis |
| **Univadis** | Noticias + guías Fisterra + herramientas | "Medscape española" de Aptitude Health |
| **Doximity** | LinkedIn para médicos (USA) | Networking + dialer anónimo; no existe equivalente español |
| **Figure 1** | "Instagram de médicos" para casos clínicos | Casos con foto anonimizada; ya en español |
| **Sermo** | Red social profesional global con anonimato | Encuestas, segundas opiniones |
| **MIR Asturias / AMIR / CTO / PROMIR** | Preparación pre-MIR | NO sirve para R1-R5; oportunidad de "siguiente paso" |
| **WeMir** | Comunidad Telegram/web | Foros y memes; volátil |
| **casiMedicos** | Foro veterano (desde 2003) | SEO altísimo, comunidad activa pero web antigua |
| **LosResis** *(nosotros)* | Red social vertical ES + agenda + libro + nóminas | Cubre lo social/admin; NO cubre clínica bedside ni derechos laborales |

**Insight competitivo**: no existe hoy una app que combine
**(a) red social vertical ES**, **(b) consulta clínica bedside en español**, y
**(c) tracking laboral/formativo real** con datos del propio hospital.
Es decir, "UpToDate + MDCalc + Doximity + Libro del residente" en una sola app
española vertical = blue ocean para LosResis.

## 4. Conclusiones para LosResis

| # | Idea | Hueco |
|---|---|---|
| 1 | **Consulta clínica bedside ES**: calculadoras (MDCalc-like) + protocolos del hospital + Fisterra + atajo a UpToDate institucional. Reemplaza el asistente clínico LLM actual (que no funciona) por algo determinista. | **Hueco grande** |
| 2 | **Contador de derechos laborales**: guardias del mes, libranzas pendientes, horas semanales con alerta de >48h, exportable a Inspección/sindicato. Conectado a canal "Denuncia anónima" hacia Asociación MIR España. | **Hueco grande** |
| 3 | **Libro del residente "real"**: códigos BOE por especialidad, exportación a memoria anual MEF, alertas de progreso. Mejora la feature actual (54% uso). | **Hueco mediano** (existe pobre) |
| 4 | **Salud mental con MBI mensual + recursos PAIME + chat peer-support anónimo**, con detección de riesgo y push a recursos locales. | **Hueco grande** |
| 5 | **Hub Post-MIR**: roadmap fellowships ES/UE/USA, bolsas SAS/SERMAS, oposiciones por CCAA, plantilla CV médico, recordatorios de plazos. Activable desde R3. | **Hueco grande** |
| 6 | **Simulador de nómina + IRPF por CCAA y año**, comparativa entre comunidades, proyección anual. Extiende la feature actual (51% uso). | **Cubierto parcial** |
| 7 | **Asistente de sesión clínica**: plantillas por tipo, traducción/resumen paper inglés, banco imágenes anonimizadas estilo Figure 1 vertical España. | **Hueco mediano** |

**Recomendación táctica**: el bajo retorno diario (13%) se cura con utilidad **clínica
diaria** (idea 1) y **legal/laboral diaria** (idea 2). Lo social ya está saturado
(grupos al 100%); lo formativo/clínico es donde está el lock-in defensivo. Ver
secuencia completa en [`04-propuesta-features-engagement.md`](./04-propuesta-features-engagement.md).

## Fuentes

**Burnout y salud mental**
- [Infobae — Burnout afecta a 9 de cada 10 médicos jóvenes (nov 2025)](https://www.infobae.com/espana/2025/11/12/el-burnout-afecta-a-9-de-cada-10-medicos-jovenes-las-guardias-y-la-falta-de-descanso-ponen-en-jaque-la-salud-mental-de-los-mir/)
- [Redacción Médica — "Te deshumanizas como mecanismo de defensa"](https://www.redaccionmedica.com/secciones/formacion/salud-mental-en-el-mir-te-deshumanizas-como-mecanismo-de-defensa--6272)
- [Rev Clín Esp — Residentes, guardias y síndrome burnout](https://www.revclinesp.es/es-residentes-guardias-sindrome-burnout-articulo-S0014256510001268)
- [Elsevier Medicina Clínica — Estrés laboral y burnout en residentes](https://www.elsevier.es/es-revista-medicina-clinica-2-articulo-estres-laboral-burnout-medicos-residentes-S0025775321002074)

**Huelga, guardias, derechos laborales**
- [iSanidad — Huelga MIR nacional](https://isanidad.com/367935/los-medicos-residentes-se-plantean-una-huelga-nacional-si-no-mejoran-sus-condiciones-de-trabajo/)
- [El Español Invertia — MIR amenazan huelga sobre máximos de guardias](https://www.elespanol.com/invertia/observatorios/sanidad/20260408/mir-amenazan-ir-huelga-sanidad-no-impone-maximo-dias-guardia-mes/1003744199072_0.html)
- [ConSalud — Puntos clave reivindicaciones MIR](https://www.consalud.es/formacion/huelga-mir-puntos-reivindicaciones-claves-acabar-precariedad-residentes_85665_102.html)
- [Gaceta de Salud — Fechas huelga MIR 18-22 mayo 2026](https://www.gacetadesalud.com/actualidad-gs/noticias/13891187/04/26/los-mir-anuncian-una-huelga-estas-son-las-fechas-y-como-afectara-a-los-pacientes.html)
- [eldiario.es — "Los hospitales no aguantan ni una hora sin residentes"](https://www.eldiario.es/sociedad/mir-sanidad-publica-iran-huelga-hospitales-no-aguantan-hora-residentes_1_6091876.html)

**Tutores y formación**
- [Redacción Médica — 40% MIR-EIR califica de mala la relación con tutor](https://www.redaccionmedica.com/secciones/formacion/el-40-de-los-mir-eir-afirman-que-la-relacion-con-su-tutor-es-mala--8385)
- [Redacción Médica — 400 quejas MIR sobre formación](https://www.redaccionmedica.com/secciones/formacion/los-mir-recaban-400-quejas-sobre-su-formacion-estas-son-las-mas-frecuentes-5712)
- [Elsevier — Formación médica especializada en España](https://www.elsevier.es/es-revista-medicina-clinica-practica-5-articulo-la-formacion-medica-especializada-espana-S2603924923000526)

**Nómina e IRPF**
- [CESM — Retribuciones MIR 2024 por especialidad y CCAA](https://www.cesm.org/2025/02/03/estas-son-las-retribuciones-de-los-mir-en-2024-segun-especialidad-y-comunidad-autonoma/)
- [ConSalud — Cuánto cobran R1 por CCAA con/sin guardias](https://www.consalud.es/formacion/mir/mir-2025-cuanto-cobran-r1-cada-comunidad-autonoma-con-sin-guardias.html)
- [Redacción Médica — Cuánto se gana como médico residente](https://www.redaccionmedica.com/recursos-salud/faqs-preguntas-frecuentes-mir/sueldo-mir-cuanto-se-gana-como-medico-residente)
- [SIMEG — Informe Guardias Médicas dic 2024 (PDF)](https://simeg.org/wp/wp-content/uploads/2025/02/Informe-Guardias-Medicas-diciembre-2024.pdf)

**Rotaciones externas**
- [SERMEF — Cómo preparo mi rotación](https://www.sermef.es/como-preparo-mi-rotacion/)
- [ConSalud — Consejos rotación en extranjero](https://www.consalud.es/formacion/mir-consejos-para-hacer-una-rotacion-en-el-extranjero.html)
- [ContigoDOC — Rotaciones externas](https://www.contigodoc.es/rotaciones-externas-medicos-residentes)
- [REC CardioClinics — Rotaciones externas, ¿hay vida más allá?](https://www.reccardioclinics.org/en-rotaciones-externas-hay-vida-mas-articulo-S2605153221000674)
- [Redacción Médica — Ser MIR en Londres](https://www.redaccionmedica.com/secciones/formacion/ser-mir-en-londres-cuanto-vuelves-a-espana-es-como-si-no-te-hubieras-ido--9995)

**Acoso / casos sensibles**
- [Navarra Sur — Caso Hospital Tudela (nov 2025)](https://navarrasur.es/navarra-sur-tudela/386608/una-mir-del-hospital-de-tudela-denuncia-agresion-sexual-y-aislamiento-tras-presentar-una-denuncia-contra-otro-residente/)

**Apps competidoras**
- [Wolters Kluwer — UpToDate for Residents](https://www.wolterskluwer.com/en/solutions/uptodate/roles/residents-fellows-students)
- [BVSSPA — UpToDate vía SNS (PDF)](https://bvsspa.es/wp-content/uploads/2022/09/Resumen-Funcionalidades-UpToDate-_-Sistema-Nacional-de-Salud.pdf)
- [MDCalc](https://www.mdcalc.com/) · [Medscape](https://www.medscape.com/) · [NEJM Resident 360](https://resident360.nejm.org/) · [AMBOSS + NEJM](https://support.amboss.com/hc/en-us/articles/23699429949841-NEJM-Knowledge-and-AMBOSS)
- [Fisterra — Guías clínicas](https://www.fisterra.com/guias-clinicas/) · [Univadis España](https://app.univadis.com/es/) · [ConSalud — Univadis + Fisterra](https://www.consalud.es/salud35/nacional/univadis-amplia-su-cartera-de-servicios-con-las-guias-fisterra.html)
- [Sermo](https://www.sermo.com/) · [Edición Médica — Figure 1 en español](https://www.edicionmedica.ec/secciones/gestion/figure-1-la-red-social-para-m-dicos-tendr-su-versi-n-en-espa-ol-88001) · [Salud Digital — Redes sociales médicos](https://saluddigital.com/en/comunidades-conectadas/redes-sociales-para-profesionales-de-la-salud/) · [mediQuo Pro](https://www.mediquo.com/)

**Comunidad / foros**
- [casiMedicos (portal)](https://casimedicos.com/) · [Iniciativa contra guardias 24h](https://www.casimedicos.com/foro/threads/iniciativa-contra-las-guardias-medicas-de-24-horas-stop-guardias-24-horas.26750/) · [Consejos guardias para futuros residentes](https://www.casimedicos.com/foro/threads/consejos-para-afrontar-las-guardias-medicas-guia-para-futuros-residentes.25041/) · [Sección MIR/Residentes](https://www.casimedicos.com/mir-residentes/)

**Post-MIR / fellowship / oposiciones**
- [Ministerio — Formación Sanitaria Especializada](https://fse.mscbs.gob.es/)
- [Ministerio — Guía del Residente 2025 (PDF)](https://www.sanidad.gob.es/areas/profesionesSanitarias/formacionEspecializada/registroNacional/docs/Guia_del_residente_2025.pdf)
- [Hospital Clínico San Carlos — Guía Residentes 2025 (PDF)](https://www.comunidad.madrid/hospital/clinicosancarlos/sites/clinicosancarlos/files/inline-files/GUIA_RESIDENTES_HCSC_2025%20v5.pdf)
- [ICOMEM — Trabajar como médico en EEUU (PDF)](https://www.icomem.es/files/pdf/trabajarextranjero/EEUU.pdf)
- [PROMIR Blog — Residencia MIR](https://blog.promir.es/residencia-mir/)
