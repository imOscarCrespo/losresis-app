import { splitTextLinks } from "../../utils/textLinks";

describe("splitTextLinks", () => {
  it("separa las URLs de «Más información» del curso de Althaia", () => {
    const text =
      "Modul I _ SOPS® Hospital Survey: https://www.althaia.cat/redcap/surveys/?s=K9XTL34JPNM8NRK3\n" +
      "Modul I _ SOPS® Workplace Safety Supplemental: https://www.althaia.cat/redcap/surveys/?s=RMNC8DTXL3LKXEJ8";
    expect(splitTextLinks(text)).toEqual([
      { type: "text", value: "Modul I _ SOPS® Hospital Survey: " },
      {
        type: "link",
        value: "https://www.althaia.cat/redcap/surveys/?s=K9XTL34JPNM8NRK3",
        href: "https://www.althaia.cat/redcap/surveys/?s=K9XTL34JPNM8NRK3",
      },
      { type: "text", value: "\nModul I _ SOPS® Workplace Safety Supplemental: " },
      {
        type: "link",
        value: "https://www.althaia.cat/redcap/surveys/?s=RMNC8DTXL3LKXEJ8",
        href: "https://www.althaia.cat/redcap/surveys/?s=RMNC8DTXL3LKXEJ8",
      },
    ]);
  });

  it("texto sin enlaces: un único trozo", () => {
    expect(splitTextLinks("Llamar al 938 75 93 00")).toEqual([
      { type: "text", value: "Llamar al 938 75 93 00" },
    ]);
  });

  it("www. sin protocolo abre con https", () => {
    expect(splitTextLinks("Ver www.losresis.com.")).toEqual([
      { type: "text", value: "Ver " },
      { type: "link", value: "www.losresis.com", href: "https://www.losresis.com" },
      { type: "text", value: "." },
    ]);
  });

  it("deja fuera la puntuación y el paréntesis de cierre", () => {
    expect(splitTextLinks("(formulario: https://forms.gle/abc),")).toEqual([
      { type: "text", value: "(formulario: " },
      { type: "link", value: "https://forms.gle/abc", href: "https://forms.gle/abc" },
      { type: "text", value: ")," },
    ]);
  });

  it("conserva paréntesis que son de la URL", () => {
    const url = "https://es.wikipedia.org/wiki/Seguridad_(medicina)";
    expect(splitTextLinks(url)).toEqual([{ type: "link", value: url, href: url }]);
  });

  it("valores vacíos o no texto", () => {
    expect(splitTextLinks("")).toEqual([]);
    expect(splitTextLinks(null)).toEqual([]);
  });
});
