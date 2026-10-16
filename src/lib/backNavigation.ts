interface Layer {
  id: number;
  close: () => void;
}

const LAYER_KEY = '__dialogLayer';

const stack: Layer[] = [];
let nextId = 1;
let suppressedPops = 0;
let listening = false;

const handlePopState = () => {
  if (suppressedPops > 0) {
    suppressedPops -= 1;
    return;
  }

  stack.pop()?.close();
};

const ensureListener = () => {
  if (listening || typeof window === 'undefined') return;
  window.addEventListener('popstate', handlePopState);
  listening = true;

  if (window.history.state?.[LAYER_KEY] !== undefined) {
    const { [LAYER_KEY]: _stale, ...rest } = window.history.state;
    window.history.replaceState(rest, '');
  }
};

export const registerBackLayer = (close: () => void): Layer => {
  ensureListener();
  const layer: Layer = { id: nextId++, close };
  stack.push(layer);
  window.history.pushState({ ...(window.history.state ?? {}), [LAYER_KEY]: layer.id }, '');
  return layer;
};

export const unregisterBackLayer = (layer: Layer) => {
  const index = stack.indexOf(layer);
  if (index === -1) return;

  const isTop = index === stack.length - 1;
  stack.splice(index, 1);

  if (isTop && window.history.state?.[LAYER_KEY] === layer.id) {
    suppressedPops += 1;
    window.history.back();
  }
};

/** Solo para tests */
export const __resetBackNavigation = () => {
  stack.length = 0;
  suppressedPops = 0;
};
