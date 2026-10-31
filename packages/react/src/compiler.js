import { parse, tokenizer } from 'acorn';
import { marked } from 'marked';

const jsOptions = { ecmaVersion: 'latest' };
export class DilSyntaxError extends SyntaxError {
  constructor(message, source, offset) {
    const before = source.slice(0, offset).split('\n');
    const line = before.length, column = before.at(-1).length + 1;
    super(`${message} (${line}:${column})`);
    this.name = 'DilSyntaxError'; this.offset = offset; this.line = line; this.column = column;
  }
}

export function parseDil(source) {
  if (typeof source !== 'string' || source.length > 200000) throw new TypeError('DIL source must be a string of at most 200000 characters');
  let pos = 0, depth = 0, count = 0;
  const fail = (message, at = pos) => { throw new DilSyntaxError(message, source, at); };
  const starts = text => source.startsWith(text, pos);
  const space = () => { while (/\s/.test(source[pos] || '') && pos < source.length) pos++; };
  function javascript(raw, start, body = false) {
    try {
      const ast = parse(body ? raw : `(${raw}\n)`, jsOptions);
      if (body && ast.body.some(n => !['VariableDeclaration', 'FunctionDeclaration'].includes(n.type))) fail('Only variable or function declarations are allowed in @body', start);
      return body ? ast : ast.body[0].expression;
    } catch (error) {
      if (error instanceof DilSyntaxError) throw error;
      fail(error.message.replace(/ \(\d+:\d+\)$/, ''), start + Math.max(0, (error.pos || 0) - (body ? 0 : 1)));
    }
  }
  function braces(prefix = '{') {
    const start = pos; pos += prefix.length;
    const codeStart = pos;
    let level = 0;
    try {
      const stream = tokenizer(source.slice(pos), jsOptions);
      while (true) {
        const token = stream.getToken(), label = token.type.label;
        if (label === 'eof') fail('Missing closing brace }', start);
        if (label === '}' && level === 0) {
          pos = codeStart + token.end;
          return { raw: source.slice(codeStart, codeStart + token.start), start: codeStart, end: pos };
        }
        if (label === '{' || label === '${') level++;
        if (label === '}') level--;
      }
    } catch (error) {
      if (error instanceof DilSyntaxError) throw error;
      fail(error.message, codeStart + (error.pos || 0));
    }
  }
  function expression(prefix = '{') {
    const code = braces(prefix);
    return { type: 'Expression', ...code, expression: javascript(code.raw, code.start) };
  }
  function conditional(prefix = '{#if') {
    const start = pos, test = expression(prefix), consequent = children();
    let alternate = [];
    if (starts('{:else if')) alternate = [conditional('{:else if')];
    else {
      if (starts('{:else}')) { pos += 7; alternate = children(); }
      if (!starts('{/if}')) fail('Missing {/if}', start);
      pos += 5;
    }
    return { type: 'If', start, end: pos, test, consequent, alternate };
  }
  function each() {
    const start = pos, header = braces('{#each');
    const tokens = [...tokenizer(header.raw, jsOptions)];
    // Restrict the alias to identifiers; do not split on "as" inside strings.
    let level = 0, separator;
    for (const token of tokens) {
      if (['(', '[', '{', '${'].includes(token.type.label)) level++;
      if ([')', ']', '}'].includes(token.type.label)) level--;
      if (!level && token.type.label === 'name' && token.value === 'as') separator = token;
    }
    if (!separator) fail('Use {#each expression as item[, index]}', start);
    const raw = header.raw.slice(0, separator.start), aliases = header.raw.slice(separator.end).trim();
    if (!/^[A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)?$/.test(aliases)) fail('Invalid each alias', header.start + separator.end);
    // Validate reserved words and duplicate aliases using the JS parser.
    javascript(`(${aliases})=>0`, header.start + separator.end);
    const body = children();
    if (!starts('{/each}')) fail('Missing {/each}', start);
    pos += 7;
    return { type: 'Each', start, end: pos, collection: { raw, expression: javascript(raw, header.start) }, aliases, children: body };
  }
  function element() {
    const start = pos;
    const tag = source.slice(++pos).match(/^[A-Za-z][\w-]*/)[0]; pos += tag.length;
    const attributes = [], seen = new Set();
    while (pos < source.length) {
      space();
      if (starts('/>') || starts('>')) break;
      const attributeStart = pos;
      const name = source.slice(pos).match(/^[A-Za-z_:][\w:.-]*/)?.[0];
      if (!name) fail('Invalid attribute');
      if (seen.has(name)) fail(`Duplicate attribute: ${name}`);
      seen.add(name); pos += name.length; space();
      let value = { type: 'Literal', value: true };
      if (starts('=')) {
        pos++; space();
        if (starts('{')) value = expression();
        else if (starts('"') || starts("'")) {
          const quote = source[pos++], valueStart = pos;
          while (pos < source.length && source[pos] !== quote) pos++;
          if (pos === source.length) fail('Unclosed attribute string', valueStart);
          value = { type: 'Literal', value: source.slice(valueStart, pos), start: valueStart - 1, end: pos + 1 }; pos++;
        } else {
          const number = source.slice(pos).match(/^-?(?:\d+(?:\.\d+)?|\.\d+)(?=\s|\/?>)/)?.[0];
          if (!number || !Number.isFinite(Number(number))) fail('Value must be a number, a quoted string or {expression}');
          value = { type: 'Literal', value: Number(number), start: pos, end: pos + number.length };
          pos += number.length;
        }
      }
      attributes.push({ name, value, start: attributeStart, end: pos });
    }
    if (starts('/>')) { pos += 2; return { type: 'Element', tag, attributes, children: [], start, end: pos }; }
    if (!starts('>')) fail(`Unclosed tag <${tag}>`, start);
    pos++;
    let body;
    if (tag === 'CodeBlock') {
      const end = source.indexOf('</CodeBlock>', pos);
      if (end < 0) fail('Missing </CodeBlock>', start);
      body = [{ type: 'RawText', value: source.slice(pos, end).replace(/^\n|\n\s*$/g, ''), start: pos, end }]; pos = end;
    } else body = children();
    const closing = source.slice(pos).match(/^<\/([\w-]+)\s*>/);
    if (!closing || closing[1] !== tag) fail(`Expected </${tag}>`);
    pos += closing[0].length;
    return { type: 'Element', tag, attributes, children: body, start, end: pos };
  }
  function children() {
    if (++depth > 80) fail('Nesting limit exceeded');
    const nodes = [];
    const text = value => {
      if (nodes.at(-1)?.type === 'Text') { nodes.at(-1).value += value; nodes.at(-1).end = pos; }
      else nodes.push({ type: 'Text', value, start: pos - value.length, end: pos });
    };
    while (pos < source.length && !starts('</') && !/^\{\/[A-Za-z][\w-]*\s*\}/.test(source.slice(pos)) && !starts('{:')) {
      if (++count > 100000) fail('Source is too complex');
      if (starts('{@body')) {
        const start = pos, code = braces('{@body');
        nodes.push({ type: 'Body', ...code, program: javascript(code.raw, code.start, true), directiveStart: start });
      } else if (starts('{#if')) nodes.push(conditional());
      else if (starts('{#each')) nodes.push(each());
      else if (starts('{#') || starts('{@')) fail('Unsupported directive');
      else if (starts('{')) nodes.push(expression());
      else if (/^<[A-Za-z][\w-]*(?:\s|\/?>)/.test(source.slice(pos))) nodes.push(element());
      else if (starts('\\[') || starts('\\(')) {
        const start = pos, block = starts('\\['), delimiter = block ? '\\]' : '\\)';
        pos += 2; const end = source.indexOf(delimiter, pos);
        if (end < 0) fail('Unclosed formula', start);
        nodes.push({ type: 'Math', value: source.slice(pos, end).trim(), block, start, end: end + 2 }); pos = end + 2;
      } else if (starts('`')) {
        const start = pos, fence = source.slice(pos).match(/^`+/)[0];
        const end = source.indexOf(fence, pos + fence.length);
        if (end < 0) fail('Unclosed Markdown code', start);
        pos = end + fence.length; text(source.slice(start, pos));
      } else if (starts('\\') && pos + 1 < source.length) { const escaped = source.slice(pos, pos + 2); pos += 2; text(escaped); }
      else { const start = pos++; while (pos < source.length && !/[{<`\\]/.test(source[pos])) pos++; text(source.slice(start, pos)); }
    }
    depth--;
    return nodes;
  }
  const root = { type: 'Document', start: 0, children: children() };
  if (pos !== source.length) fail('Unexpected closing token');
  root.end = pos;
  return root;
}

export function compileDil(source, { appData = {} } = {}) {
  const ast = parseDil(source), diagnostics = [], requiredComponents = new Set();
  let marker = 'INTLDILPLACEHOLDER';
  while (source.includes(marker)) marker += 'X';
  const literal = JSON.stringify;
  const jsx = (tag, props = '{}', children = []) => { requiredComponents.add(tag); return `__dil.jsx(${literal(tag)},${props}${children.length ? ',' + children.join(',') : ''})`; };
  function markdown(nodes, inlineOnly = false) {
    const slots = [];
    const raw = nodes.map(node => node.type === 'Text' ? node.value : `${marker}${slots.push(`(${node.raw}\n)`) - 1}TOKEN`).join('');
    const split = value => value.split(new RegExp(`(${marker}\\d+TOKEN)`, 'g')).filter(Boolean).map(part => {
      const match = part.match(new RegExp(`^${marker}(\\d+)TOKEN$`));
      return match ? slots[Number(match[1])] : literal(part.replace(/\s+/g, ' '));
    });
    function tokens(items, inline = false) {
      return items.flatMap(token => {
        switch (token.type) {
          case 'space': return [];
          case 'text': case 'escape': return token.tokens ? tokens(token.tokens, true) : split(token.text);
          case 'paragraph': return inline ? tokens(token.tokens, true) : [jsx('text', '{}', tokens(token.tokens, true))];
          case 'strong': return [jsx('bold', '{}', tokens(token.tokens, true))];
          case 'em': return [jsx('italic', '{}', tokens(token.tokens, true))];
          case 'link': return [jsx('Link', literal({ url: token.href, title: token.title }), tokens(token.tokens, true))];
          case 'codespan': return [jsx('inline-code', '{}', [literal(token.text)])];
          case 'code': return [jsx('code', '{}', [literal(token.text)])];
          case 'heading': return [jsx('title', '{}', tokens(token.tokens, true))];
          case 'hr': return [jsx('divider')];
          case 'br': return [literal('\n')];
          case 'list': return [jsx('list', literal({ marker: token.ordered ? 'number' : 'bullet' }), token.items.map(item => jsx('list-item', '{}', tokens(item.tokens, true))))];
          case 'table': return [jsx('table', '{}', [jsx('table-row', '{}', token.header.map(cell => jsx('table-cell', '{header:true}', tokens(cell.tokens, true)))), ...token.rows.map(row => jsx('table-row', '{}', row.map(cell => jsx('table-cell', '{}', tokens(cell.tokens, true)))))])];
          default:
            diagnostics.push({ severity: 'warning', message: `Unsupported Markdown: ${token.type}; displayed as text` });
            return [literal(token.raw || token.text || '')];
        }
      });
    }
    if (!raw.trim()) return [];
    if (inlineOnly) return tokens(marked.Lexer.lexInline(raw, { gfm: true }), true);
    const lexed = marked.lexer(raw, { gfm: true });
    // In mixed inline content, preserve spaces adjacent to an element/expression.
    if (lexed.length === 1 && lexed[0].type === 'paragraph') {
      const leading = /^\s/.test(raw) && !raw.startsWith('\n') ? [literal(' ')] : [];
      const trailing = /\s$/.test(raw) && !raw.endsWith('\n') ? [literal(' ')] : [];
      return [...leading, ...tokens(lexed[0].tokens, true), ...trailing];
    }
    return tokens(lexed);
  }
  function children(nodes, key, inlineOnly = false) {
    const values = [], statements = [];
    let inline = [];
    const flush = () => { values.push(...markdown(inline, inlineOnly)); inline = []; };
    for (const node of nodes) {
      if (node.type === 'Body') { statements.push(node.raw + '\n;'); continue; }
      if (node.type === 'Text' || node.type === 'Expression') { inline.push(node); continue; }
      flush(); values.push(emit(node, inlineOnly));
    }
    flush();
    const array = `[${values.join(',')}]`;
    return statements.length ? `__dil.jsx(()=>{${statements.join('\n')}return ${array};},{key:${literal(`scope:${key}`)}})` : array;
  }
  function emit(node, inlineOnly = false) {
    if (node.type === 'RawText') return literal(node.value);
    if (node.type === 'Math') return jsx('math', literal({ value: node.value, block: node.block }));
    if (node.type === 'If') return `((${node.test.raw}\n)?${children(node.consequent, node.start, inlineOnly)}:${children(node.alternate, node.end, inlineOnly)})`;
    if (node.type === 'Each') return `((${node.collection.raw}\n)).map((${node.aliases})=>${children(node.children, node.start, inlineOnly)})`;
    if (node.type === 'Element') {
      const props = `{${node.attributes.map(a => `${literal(a.name)}:${a.value.type === 'Expression' ? `(${a.value.raw}\n)` : literal(a.value.value)}`).join(',')}}`;
      if (node.tag === 'Chart') { requiredComponents.add('chart'); return `__intlChart(${props})`; }
      if (node.tag === 'CodeBlock') return jsx('code', props, node.children.map(emit));
        if (['timer', 'file-input', 'download', 'audio', 'video', 'drag-board', 'webgl-scene', 'geo-map', 'local-store', 'data-source'].includes(node.tag)) diagnostics.push({ severity: 'info', code: 'library-extension', component: node.tag, start: node.start, end: node.end, message: `${node.tag}: independent library extension.` });
      if (['AsyncImage', 'Cite', 'Entity'].includes(node.tag)) diagnostics.push({ severity: 'info', code: 'host-capability', component: node.tag, start: node.start, end: node.end, message: `${node.tag}: references are resolved by the host application.` });
      if (node.tag === 'MapWidgetV2') diagnostics.push({ severity: 'warning', code: 'unsupported-capability', component: node.tag, start: node.start, end: node.end, message: 'MapWidgetV2: map not implemented; this component remains explicitly unsupported.' });
      return jsx(node.tag, props, [children(node.children, node.start, inlineOnly || node.tag === 'button' || node.tag === 'pressable')]);
    }
    throw new Error(`Unknown AST node ${node.type}`);
  }
  const chartHelper = `function __intlChart(p){const c=p.content||{};return __dil.jsx("chart",{data:c.data||[],series:(c.series||[]).map(s=>({...s,type:s.type||c.chartType||"bar"})),xAxis:{dataKey:c.xKey,scale:c.xAxisScale,label:c.xAxisLabel,min:c.xAxisMin,max:c.xAxisMax},yAxis:{min:c.yAxisMin,max:c.yAxisMax,label:c.yAxisLabel},meta:c.meta,height:p.height||280});}`;
  const code = `${chartHelper}\nDIL.render(${children(ast.children, 'root')});`;
  // Check the whole emitted program, catching cross-declaration errors too.
  try { parse(code, jsOptions); } catch (error) { throw new DilSyntaxError(`Invalid generated program: ${error.message}`, source, 0); }
  return { ast, diagnostics, requiredComponents: [...requiredComponents].sort(), payload: { code, constants: {}, appData, fallbackMarkdown: source, fallbackMarkdownVersion: 1 } };
}
