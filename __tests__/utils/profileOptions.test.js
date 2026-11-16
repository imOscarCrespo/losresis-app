import { prepareHospitalOptions } from "../../utils/profileOptions";
import { isTeachingUnitName } from "../../utils/teachingUnits";

// Un usuario nunca se enlaza a una unidad docente: los selectores de hospital
// del perfil (y Roomies, Viviendas, Reseñas) no las ofrecen. Solo salen en el
// simulador MIR y en Explorar hospitales con una especialidad elegida.
describe("prepareHospitalOptions", () => {
  it("no ofrece ninguna unidad docente del catálogo real", () => {
    const catalog = require("../../data/staticCatalog/hospitals.json");
    const options = prepareHospitalOptions(catalog);

    expect(options.length).toBeGreaterThan(150);
    expect(options.some((o) => isTeachingUnitName(o.name))).toBe(false);
  });
});
