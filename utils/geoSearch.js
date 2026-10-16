/**
 * Búsqueda de países y ciudades en español para Rotaciones Externas.
 *
 * Lo que se guarda en BD no cambia: el nombre del catálogo (`data/geo/`, en
 * inglés para los países), que es el identificador estable que ya usan las apps
 * publicadas para filtrar y cruzar coincidencias. Aquí solo se decide qué se
 * muestra (español) y qué encuentra el buscador (español, inglés, nombre local
 * y alias, sin tildes ni mayúsculas).
 */
import { getAllCountries, getCitiesOfCountry } from "../services/geoCatalog";
import {
  CITY_ALIASES,
  CITY_NAMES_ES,
  COUNTRY_ALIASES,
  FEATURED_CITIES,
} from "../data/geo/spanishPlaceNames";
import { normalizeSearchText } from "./filterUtils";

export const FREQUENT_COUNTRY_CODES = ["ES"];
export const CITY_RESULTS_LIMIT = 50;

const unique = (values) => [...new Set(values.filter(Boolean))];

const byLabel = (left, right) =>
  left.sortKey < right.sortKey ? -1 : left.sortKey > right.sortKey ? 1 : 0;

// Menor es mejor: igual > empieza por el texto > alguna palabra empieza por el texto > lo contiene.
const matchRank = (keys, query) => {
  let best = null;
  for (const key of keys) {
    let rank = null;
    if (key === query) rank = -1;
    else if (key.startsWith(query)) rank = 0;
    else if (key.split(/[\s\-'.()]+/).some((word) => word.startsWith(query))) rank = 1;
    else if (key.includes(query)) rank = 2;
    if (rank !== null && (best === null || rank < best)) best = rank;
  }
  return best;
};

const rankOptions = (options, query) =>
  options
    .map((option) => ({ option, rank: matchRank(option.searchKeys, query) }))
    .filter((entry) => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || byLabel(a.option, b.option))
    .map((entry) => entry.option);

let countryOptionsCache = null;
let countriesByName = null;

/** Todos los países: `{ id: nombre del catálogo, isoCode, label: nombre en español }`. */
export const getCountryOptions = () => {
  if (countryOptionsCache) return countryOptionsCache;
  countryOptionsCache = getAllCountries()
    .map((country) => {
      const label = country.es || country.name;
      return {
        id: country.name,
        isoCode: country.isoCode,
        label,
        latitude: country.latitude,
        longitude: country.longitude,
        sortKey: normalizeSearchText(label),
        searchKeys: unique(
          [label, country.name, ...(COUNTRY_ALIASES[country.isoCode] || [])].map(
            normalizeSearchText
          )
        ),
      };
    })
    .sort(byLabel);
  return countryOptionsCache;
};

/** País a partir del nombre guardado en BD (tolera mayúsculas y tildes). */
export const findCountryOption = (storedName) => {
  const key = normalizeSearchText(storedName);
  if (!key) return null;
  if (!countriesByName) {
    countriesByName = getCountryOptions().reduce((acc, option) => {
      acc[normalizeSearchText(option.id)] = option;
      return acc;
    }, {});
  }
  return countriesByName[key] || null;
};

export const getCountryLabel = (storedName) =>
  findCountryOption(storedName)?.label || storedName || "";

/**
 * Secciones para el selector de país. Sin texto: España arriba como frecuente y
 * después todos los demás. Con texto: una sola lista ordenada por relevancia.
 */
export const searchCountries = (query) => {
  const options = getCountryOptions();
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    const frequent = FREQUENT_COUNTRY_CODES.map((code) =>
      options.find((option) => option.isoCode === code)
    ).filter(Boolean);
    return [
      { key: "frequent", title: "Frecuentes", data: frequent },
      {
        key: "all",
        title: "Todos los países",
        data: options.filter((option) => !FREQUENT_COUNTRY_CODES.includes(option.isoCode)),
      },
    ];
  }

  return [{ key: "results", title: null, data: rankOptions(options, normalizedQuery) }];
};

const cityOptionsCache = {};
const cityIndexCache = {};

const toCityOption = (isoCode, name, extra = {}) => {
  const label = CITY_NAMES_ES[isoCode]?.[name] || name;
  return {
    id: name,
    label,
    sortKey: normalizeSearchText(label),
    searchKeys: unique(
      [label, name, ...(CITY_ALIASES[isoCode]?.[name] || [])].map(normalizeSearchText)
    ),
    ...extra,
  };
};

/** Ciudades del catálogo de un país, sin duplicados, con su nombre en español. */
export const getCityOptions = (isoCode) => {
  if (!isoCode) return [];
  if (cityOptionsCache[isoCode]) return cityOptionsCache[isoCode];

  const seen = new Set();
  const options = [];
  for (const city of getCitiesOfCountry(isoCode)) {
    if (seen.has(city.name)) continue;
    seen.add(city.name);
    options.push(
      toCityOption(isoCode, city.name, {
        latitude: city.latitude,
        longitude: city.longitude,
      })
    );
  }
  cityOptionsCache[isoCode] = options.sort(byLabel);
  cityIndexCache[isoCode] = options.reduce((acc, option) => {
    acc[normalizeSearchText(option.id)] = option;
    return acc;
  }, {});
  return cityOptionsCache[isoCode];
};

/** Ciudad a partir del nombre guardado; null si no está en el catálogo (texto libre). */
export const findCityOption = (isoCode, storedName) => {
  const key = normalizeSearchText(storedName);
  if (!isoCode || !key) return null;
  getCityOptions(isoCode);
  return cityIndexCache[isoCode]?.[key] || null;
};

/** Nombre a mostrar de una ciudad sin cargar el catálogo del país (va en cada render). */
export const getCityLabelByCode = (isoCode, storedCityName) =>
  CITY_NAMES_ES[isoCode]?.[storedCityName] || storedCityName || "";

export const getCityLabel = (storedCountryName, storedCityName) => {
  if (!storedCityName) return "";
  const isoCode = findCountryOption(storedCountryName)?.isoCode;
  return CITY_NAMES_ES[isoCode]?.[storedCityName] || storedCityName;
};

/** "Londres, Reino Unido" a partir de lo guardado en BD. */
export const formatLocation = (storedCityName, storedCountryName) =>
  [getCityLabel(storedCountryName, storedCityName), getCountryLabel(storedCountryName)]
    .filter(Boolean)
    .join(", ");

/** Texto libre de ciudad tal y como se guarda: sin espacios sobrantes. */
export const cleanCustomCityName = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Secciones para el selector de ciudad.
 *
 * - Sin texto: destinos habituales del país más las ciudades donde ya hay planes
 *   o reseñas (`knownCities`, pueden ser texto libre). Nunca la lista entera.
 * - Con texto: como mucho `CITY_RESULTS_LIMIT` resultados por relevancia.
 *
 * `customCity` es el texto que se puede guardar tal cual cuando ninguna opción
 * coincide exactamente, para no bloquear a quien rota en una ciudad que no está
 * en el catálogo.
 */
export const searchCities = (isoCode, query, { knownCities = [] } = {}) => {
  const options = getCityOptions(isoCode);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    const featuredNames = unique([...(FEATURED_CITIES[isoCode] || []), ...knownCities]);
    const seen = new Set();
    const featured = [];
    for (const name of featuredNames) {
      const option = findCityOption(isoCode, name) || toCityOption(isoCode, cleanCustomCityName(name));
      const key = normalizeSearchText(option.id);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      featured.push(option);
    }
    return {
      sections: featured.length
        ? [{ key: "featured", title: "Destinos habituales", data: featured.sort(byLabel) }]
        : [],
      customCity: null,
      totalCities: options.length,
      hasMore: false,
    };
  }

  // Las ciudades de texto libre que ya usan otros residentes también se encuentran.
  const knownCustom = unique(knownCities.map(cleanCustomCityName))
    .filter((name) => !findCityOption(isoCode, name))
    .map((name) => toCityOption(isoCode, name));
  const matches = rankOptions([...knownCustom, ...options], normalizedQuery);
  const hasExactMatch = matches.some((option) =>
    option.searchKeys.includes(normalizedQuery)
  );

  return {
    sections: [
      { key: "results", title: null, data: matches.slice(0, CITY_RESULTS_LIMIT) },
    ],
    customCity: hasExactMatch ? null : cleanCustomCityName(query),
    totalCities: options.length,
    hasMore: matches.length > CITY_RESULTS_LIMIT,
  };
};
