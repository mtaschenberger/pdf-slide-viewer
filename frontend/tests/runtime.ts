// Test-only transport. A cross-tab lock models the Go service's authoritative mutex.
type State = {
  generation: number;
  revision: number;
  name: string;
  pageCount: number;
  live: number;
  cue: number;
};
let state: State = {
  generation: 0,
  revision: 0,
  name: "",
  pageCount: 0,
  live: 0,
  cue: 0,
};
const channel = new BroadcastChannel("pdf-test");
const listeners: ((event: { data: State }) => void)[] = [];
channel.onmessage = (e) => {
  if (e.data.revision <= state.revision) return;
  state = e.data;
  listeners.forEach((f) => f({ data: state }));
};
function emit() {
  state = { ...state, revision: state.revision + 1 };
  localStorage.setItem("presentation", JSON.stringify(state));
  channel.postMessage(state);
  listeners.forEach((f) => f({ data: structuredClone(state) }));
}
export const Events = {
  On(_name: string, fn: (event: { data: State }) => void) {
    listeners.push(fn);
  },
};
export const Call = {
  async ByName(name: string, ...args: number[]) {
    const method = name.split(".").pop();
    if (method === "Move")
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Number(new URLSearchParams(location.search).get("delayMove") || 0),
        ),
      );
    return navigator.locks.request("presentation", () => {
      const stored = localStorage.getItem("presentation");
      if (stored) state = JSON.parse(stored);
      switch (method) {
        case "Snapshot":
          return structuredClone(state);
        case "Open":
          state = { ...state, generation: 1, pageCount: 0, live: 0, cue: 0 };
          emit();
          return { generation: 2, name: "four-slides.pdf" };
        case "Commit":
          state = {
            ...state,
            generation: 2,
            name: "four-slides.pdf",
            pageCount: args[1],
            live: 1,
            cue: 2,
          };
          emit();
          break;
        case "Move":
          if (args[0] === state.generation) {
            state.cue = Math.max(
              1,
              Math.min(state.pageCount, state.cue + args[1]),
            );
            emit();
          }
          break;
        case "Cue":
          if (args[0] === state.generation) {
            state.cue = Math.max(1, Math.min(state.pageCount, args[1]));
            emit();
          }
          break;
        case "Take":
          if (args[0] === state.generation) {
            state.live = state.cue;
            state.cue = Math.min(state.pageCount, state.cue + 1);
            emit();
          }
          break;
        default:
          return null;
      }
      return structuredClone(state);
    });
  },
};
