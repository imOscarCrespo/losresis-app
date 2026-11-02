import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.min.mjs";
import PdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&inline";

/*
 * Visor de PDFs de ResiNotes (ClickUp 124b4z9w0qg, pasada B) dentro de un
 * WebView. pdf.js va dentro del propio HTML (sin CDN). La app le pasa la URL
 * firmada y la página en la que se quedó (window.RESINOTES_PDF) y el visor le
 * cuenta por postMessage cuántas páginas hay y en cuál está el residente.
 *
 * Las páginas se pintan al acercarse a la pantalla y se liberan al alejarse,
 * para que un PDF de cientos de páginas no se coma la memoria.
 * Compilar: `npm run pdfviewer:build` → components/resinotes/pdf/pdfViewerHtml.js.
 */

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const MAX_RENDERED = 10;
const post = (message) => window.ReactNativeWebView?.postMessage(JSON.stringify(message));

const container = document.getElementById("pages");
const pages = [];
const rendered = new Map(); // número de página → { task, canvas }
let currentPage = 0;
let doc = null;
let scale = 1;

const renderPage = async (n) => {
  if (rendered.has(n) || !doc) return;
  const holder = pages[n - 1];
  const entry = { task: null, canvas: null };
  rendered.set(n, entry);
  try {
    const page = await doc.getPage(n);
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    const viewport = page.getViewport({ scale: scale * ratio });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    holder.style.height = `${viewport.height / ratio}px`;
    entry.canvas = canvas;
    entry.task = page.render({ canvasContext: canvas.getContext("2d"), viewport });
    await entry.task.promise;
    if (rendered.get(n) === entry) holder.replaceChildren(canvas);
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") rendered.delete(n);
  }
};

const releaseFarPages = () => {
  if (rendered.size <= MAX_RENDERED) return;
  const far = Array.from(rendered.keys()).sort((a, b) => Math.abs(b - currentPage) - Math.abs(a - currentPage));
  while (rendered.size > MAX_RENDERED && far.length) {
    const n = far.shift();
    const entry = rendered.get(n);
    entry?.task?.cancel();
    if (entry?.canvas) {
      entry.canvas.width = 0;
      entry.canvas.height = 0;
    }
    pages[n - 1].replaceChildren();
    rendered.delete(n);
  }
};

// La página actual es la que ocupa el centro de la pantalla.
const updateCurrentPage = () => {
  const middle = window.innerHeight / 2;
  let found = currentPage;
  for (let i = 0; i < pages.length; i++) {
    const rect = pages[i].getBoundingClientRect();
    if (rect.top <= middle && rect.bottom >= middle) {
      found = i + 1;
      break;
    }
    if (rect.top > middle) {
      found = Math.max(1, i);
      break;
    }
  }
  if (found && found !== currentPage) {
    currentPage = found;
    post({ type: "page", page: currentPage, total: pages.length });
  }
};

let scheduled = false;
window.addEventListener(
  "scroll",
  () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateCurrentPage();
      releaseFarPages();
    });
  },
  { passive: true }
);

window.resinotesGoToPage = (n) => {
  const target = pages[Math.min(Math.max(1, n), pages.length) - 1];
  target?.scrollIntoView({ block: "start" });
};

const start = async () => {
  const config = window.RESINOTES_PDF || {};
  if (!config.url) {
    post({ type: "error", reason: "no_url" });
    return;
  }
  try {
    doc = await pdfjsLib.getDocument({ url: config.url, isEvalSupported: false }).promise;
  } catch (error) {
    post({ type: "error", reason: error?.name === "PasswordException" ? "password" : "load" });
    return;
  }

  const first = await doc.getPage(1);
  const base = first.getViewport({ scale: 1 });
  scale = (container.clientWidth - 16) / base.width;

  for (let n = 1; n <= doc.numPages; n++) {
    const holder = document.createElement("div");
    holder.className = "page";
    holder.dataset.page = String(n);
    holder.style.width = `${base.width * scale}px`;
    holder.style.height = `${base.height * scale}px`;
    container.appendChild(holder);
    pages.push(holder);
  }

  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) renderPage(Number(entry.target.dataset.page));
      }),
    { rootMargin: "150% 0px" }
  );
  pages.forEach((p) => observer.observe(p));

  const initial = Math.min(Math.max(1, Number(config.page) || 1), doc.numPages);
  post({ type: "loaded", total: doc.numPages, page: initial });
  if (initial > 1) window.resinotesGoToPage(initial);
  currentPage = 0;
  updateCurrentPage();
};

start();
