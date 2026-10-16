/**
 * Nombres en español de países y ciudades que el catálogo trae en inglés o en
 * su idioma local, más alias habituales. Se mantiene a mano: el catálogo de
 * ciudades no trae exónimos y en Hermes no hay `Intl.DisplayNames`.
 *
 * Las claves son SIEMPRE el nombre tal y como está en `data/geo/` (inglés), que
 * es lo que se guarda en BD. Esto solo cambia lo que se muestra y lo que se
 * busca. `__tests__/utils/geoSearch.test.js` comprueba que cada clave existe en
 * el catálogo.
 */

// Formas abreviadas o coloquiales que un residente escribe para buscar un país.
// El nombre en inglés del catálogo ya cuenta como alias, no hace falta repetirlo.
export const COUNTRY_ALIASES = {
  US: ["USA", "EEUU", "EE UU", "EE. UU.", "EU", "America", "Estados Unidos de America"],
  GB: ["UK", "Inglaterra", "Gran Bretaña", "Escocia", "Gales", "Irlanda del Norte", "England", "Great Britain"],
  NL: ["Holanda", "Holland"],
  AE: ["EAU", "UAE", "Emiratos", "Dubai"],
  CZ: ["Republica Checa", "Czech Republic"],
  KR: ["Corea"],
  RU: ["Rusia"],
  MM: ["Birmania"],
  CI: ["Ivory Coast", "Côte d'Ivoire"],
  VA: ["Vaticano"],
  DE: ["Germany"],
  CH: ["Switzerland"],
};

// Ciudades con nombre habitual en español, por país (ISO).
export const CITY_NAMES_ES = {
  GB: {
    London: "Londres",
    Edinburgh: "Edimburgo",
    Cardiff: "Cardiff",
  },
  US: {
    "New York City": "Nueva York",
    Philadelphia: "Filadelfia",
    "New Orleans": "Nueva Orleans",
    "San Francisco": "San Francisco",
  },
  DE: {
    Munich: "Múnich",
    Köln: "Colonia",
    "Frankfurt am Main": "Fráncfort",
    Hamburg: "Hamburgo",
    Berlin: "Berlín",
    Nürnberg: "Núremberg",
    Dresden: "Dresde",
  },
  FR: {
    Marseille: "Marsella",
    Bordeaux: "Burdeos",
    Toulouse: "Toulouse",
    Strasbourg: "Estrasburgo",
    Nice: "Niza",
    Lille: "Lille",
  },
  IT: {
    Milan: "Milán",
    Rome: "Roma",
    Florence: "Florencia",
    Turin: "Turín",
    Naples: "Nápoles",
    Venice: "Venecia",
    Genoa: "Génova",
    Padova: "Padua",
  },
  PT: {
    Lisbon: "Lisboa",
    Porto: "Oporto",
  },
  CH: {
    Genève: "Ginebra",
    Zürich: "Zúrich",
    Basel: "Basilea",
    Bern: "Berna",
    Lausanne: "Lausana",
  },
  BE: {
    Brussels: "Bruselas",
    Antwerpen: "Amberes",
    Gent: "Gante",
    Leuven: "Lovaina",
  },
  NL: {
    Amsterdam: "Ámsterdam",
    "The Hague": "La Haya",
    Rotterdam: "Róterdam",
  },
  AT: { Vienna: "Viena" },
  SE: { Stockholm: "Estocolmo", Göteborg: "Gotemburgo" },
  DK: { Copenhagen: "Copenhague" },
  PL: { Warsaw: "Varsovia", Kraków: "Cracovia" },
  CZ: { Prague: "Praga" },
  RU: { Moscow: "Moscú", "Saint Petersburg": "San Petersburgo" },
  GR: { Athens: "Atenas" },
  IE: { Dublin: "Dublín" },
  NO: { Oslo: "Oslo" },
  FI: { Helsinki: "Helsinki" },
  HU: { Budapest: "Budapest" },
  JP: { Tokyo: "Tokio", Kyoto: "Kioto" },
  CN: { Beijing: "Pekín", Shanghai: "Shanghái" },
  EG: { Cairo: "El Cairo" },
  CO: { "Bogotá D.C.": "Bogotá" },
  BR: { "Rio de Janeiro": "Río de Janeiro", "São Paulo": "São Paulo" },
  CA: { "Montréal": "Montreal" },
};

// Ciudades que se ofrecen arriba antes de escribir nada: destinos habituales de
// rotación externa. Las ciudades donde ya hay planes o reseñas se suman desde la
// pantalla.
export const FEATURED_CITIES = {
  ES: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao", "Málaga", "Zaragoza", "Santander"],
  US: ["New York City", "Boston", "Houston", "Los Angeles", "Chicago", "Philadelphia", "Miami", "Rochester", "Baltimore", "Cleveland"],
  GB: ["London", "Oxford", "Cambridge", "Manchester", "Edinburgh", "Birmingham", "Liverpool"],
  DE: ["Berlin", "Munich", "Hamburg", "Heidelberg", "Frankfurt am Main", "Köln"],
  FR: ["Paris", "Lyon", "Marseille", "Bordeaux", "Toulouse", "Strasbourg"],
  IT: ["Rome", "Milan", "Florence", "Bologna", "Turin", "Naples"],
  PT: ["Lisbon", "Porto", "Coimbra"],
  CH: ["Zürich", "Genève", "Basel", "Bern", "Lausanne"],
  BE: ["Brussels", "Leuven", "Antwerpen", "Gent"],
  NL: ["Amsterdam", "Rotterdam", "Utrecht", "Leiden"],
  AT: ["Vienna", "Innsbruck", "Graz"],
  SE: ["Stockholm", "Göteborg"],
  DK: ["Copenhagen"],
  IE: ["Dublin"],
  CA: ["Toronto", "Montréal", "Vancouver"],
  MX: ["Ciudad de México", "Guadalajara", "Monterrey"],
  AR: ["Buenos Aires", "Córdoba", "Rosario"],
  CL: ["Santiago"],
  CO: ["Bogotá D.C.", "Medellín"],
  BR: ["São Paulo", "Rio de Janeiro"],
  AU: ["Sydney", "Melbourne"],
  JP: ["Tokyo"],
};

// Otras formas de escribir una ciudad que también deben encontrarla: el nombre
// local cuando el catálogo lo trae en inglés, o siglas habituales.
export const CITY_ALIASES = {
  DE: { Munich: ["München"], Köln: ["Cologne"], Nürnberg: ["Nuremberg"] },
  AT: { Vienna: ["Wien"] },
  IT: {
    Milan: ["Milano"],
    Florence: ["Firenze"],
    Naples: ["Napoli"],
    Turin: ["Torino"],
    Venice: ["Venezia"],
    Genoa: ["Genova"],
  },
  BE: { Brussels: ["Bruxelles", "Brussel"] },
  CH: { Genève: ["Geneva"] },
  CZ: { Prague: ["Praha"] },
  PL: { Warsaw: ["Warszawa"] },
  DK: { Copenhagen: ["København"] },
  SE: { Göteborg: ["Gothenburg"] },
  RU: { Moscow: ["Moskva"] },
  US: { "New York City": ["New York", "NYC"], "Los Angeles": ["LA"] },
  MX: { "Ciudad de México": ["Mexico City", "CDMX", "DF"] },
  CO: { "Bogotá D.C.": ["Bogota"] },
};
