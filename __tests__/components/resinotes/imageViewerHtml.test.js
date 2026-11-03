// Cuentas del zoom del visor de imágenes de ResiNotes (ClickUp 124b4z9w5nh).
const { ZOOM_MATH, imageViewerHtml } = require("../../../components/resinotes/imageViewerHtml");

// eslint-disable-next-line no-new-func
const math = new Function(`${ZOOM_MATH}; return { MAX_SCALE, DOUBLE_TAP_SCALE, clampScale, clampOffset, zoomAround };`)();

describe("zoom del visor", () => {
  it("no baja del tamaño inicial ni pasa del zoom máximo", () => {
    expect(math.clampScale(0.3)).toBe(1);
    expect(math.clampScale(3)).toBe(3);
    expect(math.clampScale(40)).toBe(math.MAX_SCALE);
    expect(math.clampScale(NaN)).toBe(1);
  });

  it("al tamaño inicial la imagen no se puede mover", () => {
    expect(math.clampOffset(120, 1, 390, 390)).toBe(0);
  });

  it("ampliada, no deja que la imagen se salga de la pantalla", () => {
    // 390 px de ancho a 3× = 1170 px: como mucho 390 px hacia cada lado.
    expect(math.clampOffset(10000, 3, 390, 390)).toBe(390);
    expect(math.clampOffset(-10000, 3, 390, 390)).toBe(-390);
    expect(math.clampOffset(100, 3, 390, 390)).toBe(100);
  });

  it("una imagen horizontal (más baja que la pantalla) no se mueve en vertical hasta que la rebasa", () => {
    // 220 px de alto en 800 px de pantalla: a 2× (440) aún no la llena.
    expect(math.clampOffset(200, 2, 220, 800)).toBe(0);
    expect(math.clampOffset(200, 6, 220, 800)).toBe(200);
  });

  it("el doble toque amplía alrededor del punto tocado", () => {
    const next = math.zoomAround({ scale: 1, x: 0, y: 0 }, math.DOUBLE_TAP_SCALE, 100, -50);
    expect(next.scale).toBe(2.5);
    // El punto tocado queda bajo el dedo: (p - x) / escala es el mismo antes y después.
    expect((100 - next.x) / next.scale).toBeCloseTo(100);
    expect((-50 - next.y) / next.scale).toBeCloseTo(-50);
  });

  it("la página escapa la URL de la imagen", () => {
    const html = imageViewerHtml('https://x.test/a.jpg?t=1&b="><script>alert(1)</script>');
    expect(html).toContain('src="https://x.test/a.jpg?t=1&amp;b=&quot;&gt;&lt;script&gt;');
    expect(html).not.toContain('"><script>alert(1)');
  });
});
