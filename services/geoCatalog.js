/**
 * Catálogo de países y ciudades.
 *
 * Sustituye a `country-state-city`, que no se puede importar desde el grafo de
 * arranque: su index hace `require("./assets/city.json")` en la raíz, así que
 * traer `Country` traía también las 148.038 ciudades del mundo. Hermes
 * materializaba ese array literal en cada lanzamiento y se caía por el camino
 * (SIGSEGV dentro de `createArrayFromBuffer` -> `StringPrimitive::castToUTF16Ref`).
 *
 * Aquí las ciudades se cargan por país y bajo demanda, desde los ficheros que
 * genera `scripts/generate_geo_catalog.mjs`. Nada de esto se toca hasta que el
 * usuario elige un país.
 *
 * La API replica la de `country-state-city` en lo que la app usaba de verdad,
 * para que los consumidores no cambien de forma.
 */
import COUNTRIES from "../data/geo/countries.json";
import { CITY_LOADERS } from "../data/geo/cityLoaders";

// Cache por país: el parseo se hace una sola vez por sesión.
const cityCache = {};
let countriesByCode = null;

export const getAllCountries = () => COUNTRIES;

export const getCountryByCode = (isoCode) => {
  if (!isoCode) return null;
  if (!countriesByCode) {
    countriesByCode = COUNTRIES.reduce((acc, country) => {
      acc[country.isoCode] = country;
      return acc;
    }, {});
  }
  return countriesByCode[isoCode] || null;
};

/**
 * Ciudades de un país, en la misma forma que devolvía `City.getCitiesOfCountry`
 * para los campos que la app lee: `name`, `latitude` y `longitude`.
 *
 * Devuelve [] para un país sin ciudades en el catálogo, que es lo que hacía la
 * librería y lo que los llamantes ya esperan.
 */
export const getCitiesOfCountry = (isoCode) => {
  if (!isoCode) return [];
  if (cityCache[isoCode]) return cityCache[isoCode];

  const loader = CITY_LOADERS[isoCode];
  if (!loader) {
    cityCache[isoCode] = [];
    return cityCache[isoCode];
  }

  try {
    // `loader()` es el primer y único momento en que se materializa el array de
    // este país. En el arranque no se toca ninguno, que es justo lo que evita el
    // crash; y el país más grande (US) son 19.821 filas, lejos de las 148.038
    // que reventaban.
    const rows = loader();
    cityCache[isoCode] = rows.map(([name, latitude, longitude]) => ({
      name,
      latitude,
      longitude,
    }));
  } catch (error) {
    console.error(`[geoCatalog] No se pudieron cargar las ciudades de ${isoCode}:`, error);
    cityCache[isoCode] = [];
  }

  return cityCache[isoCode];
};

// Alias con la forma de `country-state-city` para que los tres consumidores
// sigan escribiendo `Country.getAllCountries()` y `City.getCitiesOfCountry()`.
export const Country = { getAllCountries, getCountryByCode };
export const City = { getCitiesOfCountry };
