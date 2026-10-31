import { compileDil } from '@intlui/react/compiler';
import { createRendererCapabilities } from '@intlui/react/capabilities';

const components = new Set([...createRendererCapabilities().components, 'Chart', 'CodeBlock']);
const apis = new Set(['useState', 'useConstants', 'useAppData', 'useTheme']);

export function compileUiSource(source) {
  if (typeof source !== 'string' || !source.trim() || source.length > 50000) throw Error('Invalid source.');
  const compiled = compileDil(source);
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'Element') {
      if (!components.has(value.tag)) throw Error('Unsupported component.');
    }
    if (value.type === 'MemberExpression' && value.object?.name === 'DIL') {
      const name = value.computed ? value.property.value : value.property.name;
      if (!apis.has(name)) throw Error('Unsupported DIL API.');
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  }
  visit(compiled.ast);
  if (compiled.diagnostics.some(item => item.severity !== 'info')) throw Error('Source did not compile.');
  return compiled;
}
export function validateSource(source) {return compileUiSource(source).requiredComponents;}
