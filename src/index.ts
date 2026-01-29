import { CardGraph } from "./graph";
import { IndexedDbStore } from "./store/indexeddb-store";
import { autoSave } from "./persistence";
import { App } from "./ui/app";

async function main() {
  const container = document.getElementById("app");
  if (!container) throw new Error("Missing #app element");

  const store = new IndexedDbStore();
  const graph = new CardGraph();

  const saved = await store.load();
  if (saved) graph.loadJSON(saved);

  const app = new App(container, graph);
  autoSave(graph, store);
  app.bootstrap();
}

main();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
