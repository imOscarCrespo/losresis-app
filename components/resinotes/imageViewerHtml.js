/*
 * Visor de imágenes de ResiNotes (ClickUp 124b4z9w5nh): la página que carga el
 * WebView de ImageViewer.
 *
 * El zoom va en JS dentro del WebView para que sea igual en iPhone y Android
 * (el zoom de ScrollView solo existe en iOS y la app no tiene reanimated):
 *   * la imagen empieza entera y centrada (object-fit: contain);
 *   * pellizcar amplía o reduce (entre 1× y MAX_SCALE), arrastrar mueve la
 *     imagen ampliada y nunca la deja salir de la pantalla;
 *   * doble toque amplía a DOUBLE_TAP_SCALE en el punto tocado; otro doble
 *     toque vuelve al tamaño inicial.
 * Avisa a la app con postMessage: {type: "loaded"} o {type: "error"}.
 * No guarda nada: muestra la URL firmada que ya usa la nota.
 */

// Las cuentas del zoom, como texto para meterlas en la página. Jest las evalúa
// tal cual (__tests__/components/imageViewerHtml.test.js).
export const ZOOM_MATH = `
var MAX_SCALE = 6;
var DOUBLE_TAP_SCALE = 2.5;
var DOUBLE_TAP_MS = 450;
function clampScale(scale) {
  if (!(scale > 0)) return 1;
  return Math.min(MAX_SCALE, Math.max(1, scale));
}
// Con la imagen (ya encajada en la pantalla: fitW x fitH) ampliada a scale, el
// desplazamiento máximo en cada eje para que no deje hueco por ese lado.
function clampOffset(offset, scale, fitSize, viewSize) {
  var overflow = Math.max(0, (fitSize * scale - viewSize) / 2);
  return Math.min(overflow, Math.max(-overflow, offset));
}
// Zoom alrededor de un punto (px, py, relativo al centro de la pantalla): ese
// punto de la imagen se queda bajo el dedo.
function zoomAround(state, nextScale, px, py) {
  var ratio = nextScale / state.scale;
  return {
    scale: nextScale,
    x: px - (px - state.x) * ratio,
    y: py - (py - state.y) * ratio,
  };
}
`;

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const imageViewerHtml = (src) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; touch-action: none; }
  #stage { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
  #img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; transform-origin: center center; will-change: transform; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; opacity: 0; transition: opacity 120ms; }
  #img.ready { opacity: 1; }
  #img.animate { transition: transform 200ms ease-out, opacity 120ms; }
</style>
</head>
<body>
<div id="stage"><img id="img" alt="" src="${escapeAttr(src)}" /></div>
<script>
${ZOOM_MATH}
(function () {
  var img = document.getElementById("img");
  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  var state = { scale: 1, x: 0, y: 0 };
  var gesture = null;
  var lastTap = 0;
  var lastTapPoint = null;

  img.addEventListener("load", function () { img.classList.add("ready"); post({ type: "loaded" }); });
  img.addEventListener("error", function () { post({ type: "error" }); });
  if (img.complete && img.naturalWidth) { img.classList.add("ready"); post({ type: "loaded" }); }

  function view() { return { w: window.innerWidth, h: window.innerHeight }; }
  function fit() { return { w: img.offsetWidth || 1, h: img.offsetHeight || 1 }; }
  function center(t) { var v = view(); return { x: t.clientX - v.w / 2, y: t.clientY - v.h / 2 }; }

  function apply(next, animate) {
    var v = view();
    var f = fit();
    state.scale = clampScale(next.scale);
    state.x = state.scale === 1 ? 0 : clampOffset(next.x, state.scale, f.w, v.w);
    state.y = state.scale === 1 ? 0 : clampOffset(next.y, state.scale, f.h, v.h);
    img.classList.toggle("animate", Boolean(animate));
    img.style.transform = "translate(" + state.x + "px," + state.y + "px) scale(" + state.scale + ")";
  }

  function distance(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  function midpoint(a, b) { return center({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }); }

  document.addEventListener("touchstart", function (e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      gesture = { kind: "pinch", dist: distance(e.touches[0], e.touches[1]), start: { scale: state.scale, x: state.x, y: state.y }, mid: midpoint(e.touches[0], e.touches[1]) };
    } else if (e.touches.length === 1) {
      var p = center(e.touches[0]);
      gesture = { kind: "pan", from: p, start: { scale: state.scale, x: state.x, y: state.y }, moved: false };
    }
  }, { passive: false });

  document.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (!gesture) return;
    if (gesture.kind === "pinch" && e.touches.length === 2) {
      var ratio = distance(e.touches[0], e.touches[1]) / (gesture.dist || 1);
      var mid = midpoint(e.touches[0], e.touches[1]);
      var zoomed = zoomAround(gesture.start, Math.min(MAX_SCALE, Math.max(1, gesture.start.scale * ratio)), gesture.mid.x, gesture.mid.y);
      apply({ scale: zoomed.scale, x: zoomed.x + mid.x - gesture.mid.x, y: zoomed.y + mid.y - gesture.mid.y }, false);
    } else if (gesture.kind === "pan" && e.touches.length === 1) {
      var p = center(e.touches[0]);
      if (Math.abs(p.x - gesture.from.x) > 8 || Math.abs(p.y - gesture.from.y) > 8) gesture.moved = true;
      if (state.scale > 1) apply({ scale: state.scale, x: gesture.start.x + p.x - gesture.from.x, y: gesture.start.y + p.y - gesture.from.y }, false);
    }
  }, { passive: false });

  document.addEventListener("touchend", function (e) {
    e.preventDefault();
    var g = gesture;
    if (e.touches.length === 1) {
      // De pellizcar a un dedo: sigue como arrastre desde aquí.
      gesture = { kind: "pan", from: center(e.touches[0]), start: { scale: state.scale, x: state.x, y: state.y }, moved: true };
      return;
    }
    gesture = null;
    if (!g || g.kind !== "pan" || g.moved) return;
    var now = Date.now();
    var point = g.from;
    if (now - lastTap < DOUBLE_TAP_MS && lastTapPoint && Math.abs(point.x - lastTapPoint.x) < 40 && Math.abs(point.y - lastTapPoint.y) < 40) {
      lastTap = 0;
      if (state.scale > 1.01) apply({ scale: 1, x: 0, y: 0 }, true);
      else apply(zoomAround(state, DOUBLE_TAP_SCALE, point.x, point.y), true);
    } else {
      lastTap = now;
      lastTapPoint = point;
    }
  }, { passive: false });

  window.addEventListener("resize", function () { apply(state, false); });
})();
</script>
</body>
</html>`;
