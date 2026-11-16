/**
 * El catálogo de hospitales (data/staticCatalog/hospitals.json) mezcla
 * hospitales con unidades docentes del Ministerio ("Udm Afyc De Valencia. La
 * Fe", "Ud Mpysp…"). Al residente le pedimos su hospital, no su unidad: la
 * unidad docente se deduce de hospital + especialidad. Por eso se esconden en
 * los listados donde el residente elige o explora hospitales.
 *
 * No se usa en el simulador MIR: allí las unidades docentes tienen que salir,
 * porque la plaza MIR se elige por unidad docente.
 *
 * Mismo criterio que isSubHospitalName (services/hospitalService.js) y que
 * losresis-panel (src/lib/hospitalSignup.ts).
 */
export const isTeachingUnitName = (hospitalName) =>
  (hospitalName || "").trim().toLowerCase().startsWith("ud");

export const excludeTeachingUnits = (hospitals) =>
  (hospitals || []).filter((hospital) => !isTeachingUnitName(hospital?.name));

/**
 * Hospitales que enseña Explorar hospitales. Sin especialidad, las unidades
 * docentes se esconden. Con una especialidad elegida tienen que salir: para
 * especialidades como MFyC, Medicina del Trabajo, Preventiva o Psiquiatría
 * Infantil la plaza MIR es la unidad docente, y esconderla deja el buscador
 * casi vacío (MFyC pasaba de 194 a 3).
 */
export const catalogHospitalsForExplore = (
  hospitals,
  { hideTeachingUnits = false, selectedSpecialty = "" } = {}
) =>
  hideTeachingUnits && !selectedSpecialty
    ? excludeTeachingUnits(hospitals)
    : hospitals || [];
