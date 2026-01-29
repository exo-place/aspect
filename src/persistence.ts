import type { CardGraph } from "./graph";
import type { Store } from "./store/store";

export function autoSave(graph: CardGraph, store: Store, debounceMs = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    store.save(graph.toJSON());
  };

  const prev = graph.onChange;
  graph.onChange = () => {
    prev?.();
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  return () => {
    if (timer !== null) clearTimeout(timer);
    graph.onChange = prev;
  };
}
