const supportedComponents = Object.freeze(['text', 'checkbox', 'box', 'card', 'title', 'caption', 'input', 'button', 'row', 'slider', 'select', 'segmented-control', 'pressable', 'icon', 'divider', 'table', 'table-row', 'table-cell', 'chart', 'code', 'list', 'list-item', 'badge', 'bold', 'italic', 'inline-code', 'label', 'grid', 'grid-item', "form", "textarea", "date-picker", "radio", "radio-group", "spacer", "carousel", "carousel-item", "Link", "AsyncImage", "Cite", "Entity", "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs", "linearGradient", "radialGradient", "stop", "marker", "desc", "timer", "file-input", "download", "audio", "video", "drag-board", "webgl-scene", "geo-map", "local-store", "data-source"]);

// Describes the built-in renderer. Host adapters do not imply new DIL support.
export function createRendererCapabilities({ surface = 'react', components = supportedComponents } = {}) {
  if (!['react', 'widget'].includes(surface)) throw new TypeError('Renderer requires a React or widget surface');
  if (!Array.isArray(components) || new Set(components).size !== components.length ||
    [...components].some(name => !supportedComponents.includes(name))) throw new TypeError('Unsupported renderer components');
  return { surface, formats: components.length ? ['dil'] : [], components: [...components] };
}
