import {
  CITY_RESULTS_LIMIT,
  cleanCustomCityName,
  findCityOption,
  findCountryOption,
  formatLocation,
  getCityLabel,
  getCountryLabel,
  getCountryOptions,
  searchCities,
  searchCountries,
} from "../../utils/geoSearch";
import { getCitiesOfCountry } from "../../services/geoCatalog";
import { CITY_ALIASES, CITY_NAMES_ES, FEATURED_CITIES } from "../../data/geo/spanishPlaceNames";

const labels = (sections) => sections.flatMap((section) => section.data.map((o) => o.label));
const firstLabel = (sections) => labels(sections)[0];

describe("searchCountries", () => {
  it("sin texto muestra España arriba y luego todos los países", () => {
    const sections = searchCountries("");
    expect(sections[0].title).toBe("Frecuentes");
    expect(sections[0].data.map((o) => o.label)).toEqual(["España"]);
    expect(sections[1].data).toHaveLength(getCountryOptions().length - 1);
    expect(sections[1].data.some((o) => o.isoCode === "ES")).toBe(false);
  });

  it("muestra los nombres en español", () => {
    const names = labels(searchCountries(""));
    expect(names).toEqual(
      expect.arrayContaining(["Alemania", "Reino Unido", "Estados Unidos", "Costa de Marfil", "Hong Kong"])
    );
  });

  it("ordena alfabéticamente ignorando tildes", () => {
    const all = searchCountries("")[1].data.map((o) => o.label);
    expect(all.indexOf("Austria")).toBeLessThan(all.indexOf("Bélgica"));
    expect(all.indexOf("Bélgica")).toBeLessThan(all.indexOf("Bolivia"));
  });

  it.each([
    ["USA", "Estados Unidos"],
    ["eeuu", "Estados Unidos"],
    ["EE. UU.", "Estados Unidos"],
    ["UK", "Reino Unido"],
    ["inglaterra", "Reino Unido"],
    ["holanda", "Países Bajos"],
    ["germany", "Alemania"],
    ["alemania", "Alemania"],
    ["ESPAÑA", "España"],
    ["espana", "España"],
    ["paises bajos", "Países Bajos"],
    ["suiza", "Suiza"],
  ])("«%s» encuentra %s el primero", (query, expected) => {
    expect(firstLabel(searchCountries(query))).toBe(expected);
  });

  it("guarda el nombre del catálogo, no el traducido", () => {
    const germany = searchCountries("alemania")[0].data[0];
    expect(germany).toMatchObject({ id: "Germany", isoCode: "DE", label: "Alemania" });
  });

  it("sin coincidencias devuelve una lista vacía", () => {
    expect(labels(searchCountries("zzzz"))).toEqual([]);
  });
});

describe("país guardado en BD", () => {
  it("traduce lo guardado y tolera mayúsculas", () => {
    expect(getCountryLabel("United States")).toBe("Estados Unidos");
    expect(getCountryLabel("spain")).toBe("España");
    expect(findCountryOption("Spain").isoCode).toBe("ES");
  });

  it("un valor desconocido se muestra tal cual", () => {
    expect(getCountryLabel("Narnia")).toBe("Narnia");
    expect(findCountryOption("Narnia")).toBeNull();
    expect(getCountryLabel("")).toBe("");
  });
});

describe("searchCities", () => {
  it("sin texto muestra destinos habituales, no la lista entera", () => {
    const { sections, customCity } = searchCities("US", "");
    const names = labels(sections);
    expect(names).toContain("Nueva York");
    expect(names.length).toBeLessThan(20);
    expect(customCity).toBeNull();
  });

  it("suma las ciudades donde ya hay planes o reseñas, también de texto libre", () => {
    const names = labels(searchCities("US", "", { knownCities: ["Cincinnati", "Pueblo Inventado"] }).sections);
    expect(names).toEqual(expect.arrayContaining(["Cincinnati", "Pueblo Inventado"]));
  });

  it("solo muestra ciudades del país elegido", () => {
    expect(labels(searchCities("GB", "madrid").sections)).not.toContain("Madrid");
    expect(labels(searchCities("ES", "madrid").sections)[0]).toBe("Madrid");
  });

  it.each([
    ["GB", "londres", "Londres"],
    ["GB", "London", "Londres"],
    ["GB", "LONDRES", "Londres"],
    ["US", "nueva york", "Nueva York"],
    ["US", "new york city", "Nueva York"],
    ["DE", "munich", "Múnich"],
    ["DE", "München", "Múnich"],
    ["CH", "ginebra", "Ginebra"],
    ["CH", "geneva", "Ginebra"],
    ["IT", "milano", "Milán"],
    ["AT", "wien", "Viena"],
    ["MX", "cdmx", "Ciudad de México"],
    ["ES", "malaga", "Málaga"],
  ])("en %s, «%s» encuentra %s el primero", (iso, query, expected) => {
    expect(firstLabel(searchCities(iso, query).sections)).toBe(expected);
  });

  it("guarda el nombre del catálogo de la ciudad", () => {
    const london = searchCities("GB", "londres").sections[0].data[0];
    expect(london.id).toBe("London");
    expect(london.latitude).toBeTruthy();
  });

  it("limita los resultados para no mostrar listas interminables", () => {
    const { sections, hasMore } = searchCities("US", "a");
    expect(sections[0].data).toHaveLength(CITY_RESULTS_LIMIT);
    expect(hasMore).toBe(true);
  });

  it("ofrece usar el texto como ciudad si no hay coincidencia exacta", () => {
    expect(searchCities("ES", "  Villa   Inventada ").customCity).toBe("Villa Inventada");
    expect(searchCities("GB", "londres").customCity).toBeNull();
    expect(searchCities("GB", "London").customCity).toBeNull();
  });

  it("un país sin ciudades en el catálogo permite texto libre", () => {
    const { sections, customCity, totalCities } = searchCities("AQ", "Base Esperanza");
    expect(totalCities).toBe(0);
    expect(sections[0].data).toEqual([]);
    expect(customCity).toBe("Base Esperanza");
  });

  it("no duplica ciudades repetidas en el catálogo", () => {
    const names = labels(searchCities("CO", "bogota").sections);
    expect(names.filter((name) => name === "Bogotá")).toHaveLength(1);
  });

  it("sin país no hay ciudades", () => {
    expect(searchCities("", "madrid").sections[0].data).toEqual([]);
  });
});

describe("ciudad guardada en BD", () => {
  it("traduce la ciudad y monta la ubicación", () => {
    expect(getCityLabel("United Kingdom", "London")).toBe("Londres");
    expect(formatLocation("London", "United Kingdom")).toBe("Londres, Reino Unido");
    expect(formatLocation("Cincinnati", "United States")).toBe("Cincinnati, Estados Unidos");
    expect(formatLocation("", "Spain")).toBe("España");
    expect(formatLocation(null, null)).toBe("");
  });

  it("texto libre se muestra tal cual y no está en el catálogo", () => {
    expect(formatLocation("Pueblo Inventado", "Spain")).toBe("Pueblo Inventado, España");
    expect(findCityOption("ES", "Pueblo Inventado")).toBeNull();
    expect(findCityOption("ES", "madrid").id).toBe("Madrid");
  });

  it("limpia el texto libre", () => {
    expect(cleanCustomCityName("  Nueva   Ciudad ")).toBe("Nueva Ciudad");
    expect(cleanCustomCityName(null)).toBe("");
  });
});

describe("diccionario de nombres en español", () => {
  it("cada ciudad traducida o destacada existe en el catálogo de su país", () => {
    const missing = [];
    const check = (iso, name) => {
      if (!getCitiesOfCountry(iso).some((city) => city.name === name)) missing.push(`${iso}:${name}`);
    };
    Object.entries(CITY_NAMES_ES).forEach(([iso, names]) => Object.keys(names).forEach((n) => check(iso, n)));
    Object.entries(CITY_ALIASES).forEach(([iso, names]) => Object.keys(names).forEach((n) => check(iso, n)));
    Object.entries(FEATURED_CITIES).forEach(([iso, names]) => names.forEach((n) => check(iso, n)));
    expect(missing).toEqual([]);
  });
});
