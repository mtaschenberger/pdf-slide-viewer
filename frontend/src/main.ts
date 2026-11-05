import { Call, Events } from "@wailsio/runtime";
import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";
import "./style.css";
pdfjs.GlobalWorkerOptions.workerSrc = worker;
type Snapshot = {
  generation: number;
  revision: number;
  name: string;
  pageCount: number;
  live: number;
  cue: number;
};
type Candidate = { generation: number; name: string };
const call = <T>(method: string, ...args: unknown[]) =>
  Call.ByName(`main.Service.${method}`, ...args) as Promise<T>;
const audience = location.search.includes("audience");
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = audience
  ? '<main class="audience"><div class="stage"><canvas id="audience-canvas"></canvas></div></main>'
  : `<main class="operator"><header><div><div class="eyebrow">PRESENTATION CONTROL</div><h1>PDF Slide Viewer</h1></div><div class="header-actions"><button id="open" class="primary">Open PDF</button><button id="audience">Open audience</button><button id="fullscreen">Toggle fullscreen</button></div></header><div class="status"><span id="status">Open a PDF to begin</span><span>← ↑ / → ↓ Browse cue &nbsp; · &nbsp; Enter / Space Take live</span></div><section class="previews"><article><div class="panel-heading"><div><span class="dot live-dot"></span> LIVE <small>Audience sees this page</small></div><strong id="live-label">—</strong></div><div class="stage"><canvas id="live-canvas"></canvas><div class="empty">No presentation loaded</div></div></article><article><div class="panel-heading"><div><span class="dot cue-dot"></span> CUE <small>Preview before taking live</small></div><strong id="cue-label">—</strong></div><div class="stage"><canvas id="cue-canvas"></canvas><div class="empty">Choose a PDF to get started</div></div></article></section><section class="controls"><div><label for="page">Cue page</label><div class="navigation"><button id="prev" aria-label="Previous cue page">←</button><input id="page" type="number" min="1" value="1"><span id="total">/ —</span><button id="next" aria-label="Next cue page">→</button></div></div><button id="take" class="take">Take live <span>↵</span></button></section><p class="hint">Escape exits audience fullscreen. Use Toggle fullscreen to position the audience window on another display.</p></main>`;
let snapshot: Snapshot = {
  generation: 0,
  revision: 0,
  name: "",
  pageCount: 0,
  live: 0,
  cue: 0,
};
let pdf: PDFDocumentProxy | null = null;
let loading: PDFDocumentLoadingTask | null = null;
let loadedGeneration = 0;
let loadToken = 0;
let opening = false;
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
function status(text: string, error = false) {
  if (!audience) {
    $("status").textContent = text;
    $("status").classList.toggle("error", error);
  }
}
class Renderer {
  private seq = 0;
  private task: RenderTask | null = null;
  private lastDoc: PDFDocumentProxy | null = null;
  private lastKey = "";
  constructor(private canvas: HTMLCanvasElement) {}
  clear() {
    this.seq++;
    this.task?.cancel();
    this.task = null;
    this.lastDoc = null;
    this.lastKey = "";
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
  async render(doc: PDFDocumentProxy | null, page: number) {
    if (!doc || !page) {
      this.clear();
      return;
    }
    const box = this.canvas.parentElement!.getBoundingClientRect();
    const key = `${page}:${box.width}:${box.height}:${devicePixelRatio}`;
    if (doc === this.lastDoc && key === this.lastKey) return;
    this.lastDoc = doc;
    this.lastKey = key;
    const seq = ++this.seq;
    this.task?.cancel();
    this.task = null;
    try {
      const p = await doc.getPage(page);
      if (seq !== this.seq) return;
      const view = p.getViewport({ scale: 1 });
      const scale =
        Math.max(
          0.1,
          Math.min(box.width / view.width, box.height / view.height),
        ) * Math.min(devicePixelRatio || 1, 2);
      const vp = p.getViewport({ scale });
      const buffer = document.createElement("canvas");
      buffer.width = Math.ceil(vp.width);
      buffer.height = Math.ceil(vp.height);
      const context = buffer.getContext("2d")!;
      const task = p.render({
        canvasContext: context,
        canvas: buffer,
        viewport: vp,
      });
      this.task = task;
      await task.promise;
      if (seq !== this.seq) return;
      this.canvas.width = buffer.width;
      this.canvas.height = buffer.height;
      this.canvas.getContext("2d")!.drawImage(buffer, 0, 0);
      this.task = null;
    } catch (e) {
      if (seq === this.seq) {
        this.clear();
        status(`Unable to render page: ${message(e)}`, true);
      }
    }
  }
}
const renders = audience
  ? [new Renderer($("audience-canvas"))]
  : [new Renderer($("live-canvas")), new Renderer($("cue-canvas"))];
function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
function draw() {
  if (audience) void renders[0].render(pdf, snapshot.live);
  else {
    void renders[0].render(pdf, snapshot.live);
    void renders[1].render(pdf, snapshot.cue);
  }
}
function getPDF(gen: number) {
  return pdfjs.getDocument({
    url: `/document/${gen}.pdf`,
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
    stopAtErrors: true,
  });
}
async function accept(v: Snapshot) {
  if (v.revision < snapshot.revision) return;
  const changed = v.generation !== snapshot.generation;
  snapshot = v;
  if (changed) {
    const token = ++loadToken;
    if (loading) {
      void loading.destroy();
      loading = null;
    }
    renders.forEach((r) => r.clear());
    const old = pdf;
    pdf = null;
    loadedGeneration = 0;
    if (old) void old.loadingTask.destroy();
    if (v.pageCount) {
      try {
        const task = getPDF(v.generation);
        loading = task;
        const next = await task.promise;
        if (loading === task) loading = null;
        if (token !== loadToken) {
          void next.loadingTask.destroy();
          return;
        }
        pdf = next;
        loadedGeneration = v.generation;
      } catch (e) {
        if (token === loadToken)
          status(`Unable to load PDF: ${message(e)}`, true);
      }
    }
  }
  update();
  draw();
}
function update() {
  if (audience) return;
  const ready =
    !!snapshot.pageCount && loadedGeneration === snapshot.generation && !!pdf;
  $("live-label").textContent = ready
    ? `${snapshot.live} / ${snapshot.pageCount}`
    : "—";
  $("cue-label").textContent = ready
    ? `${snapshot.cue} / ${snapshot.pageCount}`
    : "—";
  $("total").textContent = `/ ${ready ? snapshot.pageCount : "—"}`;
  const input = $<HTMLInputElement>("page");
  input.value = String(ready ? snapshot.cue : 1);
  input.max = String(snapshot.pageCount || 1);
  input.disabled = !ready;
  $<HTMLButtonElement>("prev").disabled = !ready || snapshot.cue <= 1;
  $<HTMLButtonElement>("next").disabled =
    !ready || snapshot.cue >= snapshot.pageCount;
  $<HTMLButtonElement>("take").disabled = !ready;
  $<HTMLButtonElement>("open").disabled = opening;
  document
    .querySelectorAll(".empty")
    .forEach((e) => e.classList.toggle("hidden", ready));
  if (ready) status(snapshot.name);
}
// Preserve this window's input order, but never retarget queued commands to a new PDF.
let commands: Promise<void> = Promise.resolve();
function action(method: string, ...args: unknown[]) {
  const gen = snapshot.generation;
  const params = ["Cue", "Move", "Take"].includes(method)
    ? [gen, ...args]
    : args;
  const run = commands.then(async () => {
    try {
      await accept(await call<Snapshot>(method, ...params));
    } catch (e) {
      status(message(e), true);
    }
  });
  commands = run;
  return run;
}
if (!audience) {
  $("open").onclick = async () => {
    if (opening) return;
    opening = true;
    update();
    try {
      const candidate = await call<Candidate | null>("Open");
      if (!candidate) return;
      status(`Opening ${candidate.name}…`);
      let doc: PDFDocumentProxy;
      try {
        doc = await getPDF(candidate.generation).promise;
        const count = doc.numPages;
        await doc.getPage(1);
        await doc.loadingTask.destroy();
        await action("Commit", candidate.generation, count);
      } catch (e) {
        await call("Reject", candidate.generation);
        status(`Could not open PDF: ${message(e)}`, true);
      }
    } catch (e) {
      status(`Could not open PDF: ${message(e)}`, true);
    } finally {
      opening = false;
      update();
    }
  };
  $("prev").onclick = () => void action("Move", -1);
  $("next").onclick = () => void action("Move", 1);
  $("take").onclick = () => void action("Take");
  $("page").onchange = () =>
    void action("Cue", Number($<HTMLInputElement>("page").value));
  $("audience").onclick = () => void call("Audience");
  $("fullscreen").onclick = () => void call("ToggleFullscreen");
  update();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    void call("ExitFullscreen");
    return;
  }
  if ((e.target as HTMLElement)?.tagName === "INPUT") {
    if (e.key === "Enter" && !e.repeat) {
      e.preventDefault();
      void action("Cue", Number((e.target as HTMLInputElement).value));
      void action("Take");
    }
    return;
  }
  if (
    ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Enter", " "].includes(
      e.key,
    )
  ) {
    e.preventDefault();
    if (e.repeat && (e.key === "Enter" || e.key === " ")) return;
    void action(
      e.key === "Enter" || e.key === " " ? "Take" : "Move",
      ...(["ArrowLeft", "ArrowUp"].includes(e.key)
        ? [-1]
        : ["ArrowRight", "ArrowDown"].includes(e.key)
          ? [1]
          : []),
    );
  }
});
Events.On("presentation", (event) => {
  void accept(event.data as Snapshot);
});
void call<Snapshot>("Snapshot")
  .then(accept)
  .catch((e) => status(message(e), true));
let timer: number;
window.addEventListener("resize", () => {
  clearTimeout(timer);
  timer = window.setTimeout(draw, 120);
});
