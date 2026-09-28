// ============================================================
// UPPLAI DESIGN STUDIO — GENERAL CANVAS EDITOR
// Automation creates the design. Human editing takes control.
// ============================================================

let baseline = null;
let state = {};
let activeEditor = null;

const LEGACY_IDS = {
  headline: 'headline',
  copy: 'supporting-copy',
  cta: 'cta',
  logo: 'logo'
};

const FONT_OPTIONS = [
  '',
  'Arial',
  'Georgia',
  'Helvetica',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Times New Roman',
  'Courier New',
  'Impact',
  'system-ui, sans-serif',
  'Inter'
];

export const SHAPE_OPTIONS = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'rounded-rectangle', label: 'Rounded Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'line', label: 'Line' },
  { id: 'pill', label: 'Pill' },
  { id: 'star', label: 'Star' },
  { id: 'arrow', label: 'Arrow' }
];

function addShape(preview, shapeType) {
  const node = document.createElement('div');
  const option = SHAPE_OPTIONS.find(item => item.id === shapeType);
  const newId = 'shape-' + Date.now().toString(36);

  node.dataset.editorId = newId;
  node.dataset.editorType = 'shape';
  node.dataset.editorLabel = option?.label || 'New Shape';
  node.dataset.shapeType = shapeType;
  node.dataset.editorText = 'false';
  node.dataset.editorMovable = 'true';
  node.dataset.editorResizable = 'true';
  node.dataset.editorDeletable = 'true';
  node.dataset.editorCreated = 'true';
  node.style.position = 'absolute';
  node.style.left = '140px';
  node.style.top = '140px';
  node.style.width = '220px';
  node.style.height = '90px';
  node.style.background = '#50c4f8';
  node.style.zIndex = '10';

  if (shapeType === 'circle') {
    node.style.width = '160px';
    node.style.height = '160px';
    node.style.borderRadius = '50%';
  } else if (shapeType === 'ellipse') {
    node.style.width = '220px';
    node.style.height = '130px';
    node.style.borderRadius = '50%';
  } else if (shapeType === 'rounded-rectangle') {
    node.style.borderRadius = '24px';
  } else if (shapeType === 'pill') {
    node.style.height = '72px';
    node.style.borderRadius = '999px';
  } else if (shapeType === 'triangle') {
    node.style.width = '180px';
    node.style.height = '160px';
    node.style.clipPath = 'polygon(50% 0%, 100% 100%, 0% 100%)';
  } else if (shapeType === 'line') {
    node.style.width = '240px';
    node.style.height = '8px';
  } else if (shapeType === 'star') {
    node.style.width = '160px';
    node.style.height = '160px';
    node.style.clipPath = 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)';
  } else if (shapeType === 'arrow') {
    node.style.width = '240px';
    node.style.height = '110px';
    node.style.clipPath = 'polygon(0 38%, 65% 38%, 65% 0, 100% 50%, 65% 100%, 65% 62%, 0 62%)';
  }

  preview.append(node);
  state[newId] = {
    x: 140,
    y: 140,
    width: px(node.style.width),
    height: px(node.style.height),
    background: '#50c4f8'
  };
  return newId;
}

function editableNodes(preview) {
  const found = new Map();

  preview.dataset.editorId = 'background'; preview.dataset.editorType = 'background'; preview.dataset.editorLabel = 'Background'; preview.dataset.editorDeletable = 'false'; preview.dataset.editorMovable = 'false'; preview.dataset.editorResizable = 'false'; found.set('background', preview);

  preview.querySelectorAll('[data-editor-id]').forEach(node => {
    const id = node.dataset.editorId;
    if (id) found.set(id, node);
  });

  // Backward compatibility while other templates are migrated.
  const legacy = [
    ['headline', preview.querySelector('#preview-headline'), 'text', 'Headline'],
    ['supporting-copy', preview.querySelector('#preview-copy'), 'text', 'Supporting Copy'],
    ['cta', preview.querySelector('#preview-cta'), 'button', 'CTA'],
    ['logo', preview.querySelector('#preview-logo'), 'logo', 'Logo']
  ];

  for (const [id, node, type, label] of legacy) {
    if (!node || found.has(id)) continue;

    node.dataset.editorId = id;
    node.dataset.editorType = type;
    node.dataset.editorLabel = label;
    node.dataset.editorDeletable = 'true';
    node.dataset.editorMovable = 'true';
    node.dataset.editorResizable = 'true';
    node.dataset.editorText = String(type === 'text' || type === 'button');

    found.set(id, node);
  }

  return [...found.entries()].map(([id, node]) => ({
    id,
    node,
    type: node.dataset.editorType || 'object',
    label: node.dataset.editorLabel || id
  }));
}

function nodeById(preview, id) {
  return editableNodes(preview).find(item => item.id === id)?.node || null;
}

function px(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function scaleFor(preview) {
  const rect = preview.getBoundingClientRect();

  return {
    x: preview.offsetWidth ? rect.width / preview.offsetWidth : 1,
    y: preview.offsetHeight ? rect.height / preview.offsetHeight : 1
  };
}

// The preview can be transformed for Fit/zoom. All direct manipulation stays
// in unscaled design coordinates derived from its live screen rectangle.
export function screenToCanvas(preview, clientX, clientY) {
  const rect = preview.getBoundingClientRect();
  const scale = scaleFor(preview);
  return {
    x: (clientX - rect.left) / (scale.x || 1),
    y: (clientY - rect.top) / (scale.y || 1)
  };
}

function canvasPosition(preview, node) {
  const previewRect = preview.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const scale = scaleFor(preview);

  return {
    x: Math.round((nodeRect.left - previewRect.left) / (scale.x || 1)),
    y: Math.round((nodeRect.top - previewRect.top) / (scale.y || 1)),
    width: Math.round(nodeRect.width / (scale.x || 1)),
    height: Math.round(nodeRect.height / (scale.y || 1))
  };
}

function snapshotNode(preview, node) {
  const position = canvasPosition(preview, node);

  return {
    style: node.getAttribute('style') || '',
    hidden: node.hidden,
    text: node.dataset.editorText === 'true' ? node.textContent : null,
    placement: node.dataset.placement || '',
    parent: node.parentNode,
    nextSibling: node.nextSibling,
    position
  };
}

function ensureState(id) {
  return state[id] ||= {};
}

function emitChanged(changed) {
  changed?.(state);
}

function translateValues(node) {
  const values = String(node.style.translate || '').match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
  return values ? { x: Number(values[1]), y: Number(values[2]) } : { x: 0, y: 0 };
}

function setPosition(preview, node, id, x, y) {
  const values = ensureState(id);
  const current = canvasPosition(preview, node);
  const translate = translateValues(node);
  // Translation moves the rendered object without changing its participation
  // in the template's flex/grid layout. This keeps selection and dragging
  // visually stable for existing template elements.
  node.style.translate = `${Math.round(translate.x + x - current.x)}px ${Math.round(translate.y + y - current.y)}px`;

  values.x = Math.round(x);
  values.y = Math.round(y);
}

function setSize(node, id, width, height) {
  const values = ensureState(id);

  if (Number.isFinite(width) && width > 0) {
    node.style.width = `${Math.round(width)}px`;
    values.width = Math.round(width);
  }

  if (Number.isFinite(height) && height > 0) {
    node.style.height = `${Math.round(height)}px`;
    values.height = Math.round(height);
  }
}

function applyValue(node, key, value) {
  if (value === undefined || value === null || value === '') return;

  switch (key) {
    case 'text':
      node.textContent = value;
      break;

    case 'hidden':
      node.hidden = Boolean(value);
      break;

    case 'placement':
      node.dataset.placement = value;
      break;

    case 'x':
      node.style.position = 'absolute';
      node.style.left = `${value}px`;
      break;

    case 'y':
      node.style.position = 'absolute';
      node.style.top = `${value}px`;
      break;

    case 'width':
      node.style.width = `${value}px`;
      break;

    case 'height':
      node.style.height = `${value}px`;
      break;

    case 'fontSize':
      node.style.fontSize = `${value}px`;
      break;

    case 'fontFamily':
      node.style.fontFamily = value;
      break;

    case 'fontWeight':
      node.style.fontWeight = value;
      break;

    case 'fontStyle':
      node.style.fontStyle = value;
      break;

    case 'textDecoration':
      node.style.textDecoration = value;
      break;

    case 'color':
      node.style.color = value;
      break;

    case 'background':
      node.style.background = value;
      break;
    case 'backgroundImage':
      node.style.backgroundImage = value;
      break;
    case 'backgroundSize':
      node.style.backgroundSize = value;
      break;
    case 'backgroundPosition':
      node.style.backgroundPosition = value;
      break;
    case 'locked':
      node.dataset.editorLocked = String(Boolean(value));
      break;
    case 'strokeColor':
      node.style.webkitTextStrokeColor = value;
      break;
    case 'strokeWidth':
      node.style.webkitTextStrokeWidth = String(value) + 'px';
      break;
    case 'textShadow':
      node.style.textShadow = value;
      break;

    case 'textAlign':
      node.style.textAlign = value;
      break;

    case 'lineHeight':
      node.style.lineHeight = value;
      break;

    case 'letterSpacing':
      node.style.letterSpacing = `${value}px`;
      break;

    case 'opacity':
      node.style.opacity = value;
      break;

    case 'rotation':
      node.style.rotate = `${value}deg`;
      break;

    case 'borderRadius':
      node.style.borderRadius = `${value}px`;
      break;

    case 'borderWidth':
      node.style.borderWidth = `${value}px`;
      node.style.borderStyle = 'solid';
      break;

    case 'borderColor':
      node.style.borderColor = value;
      break;
  }
}

export function applyLocalEdits(preview, value = state) {
  for (const [id, values] of Object.entries(value || {})) {
    const node = nodeById(preview, id);
    if (!node) continue;

    for (const [key, setting] of Object.entries(values)) {
      applyValue(node, key, setting);
    }
  }
}

export function beginLocalEdits(preview) {
  baseline = {
    previewStyle: preview.getAttribute('style') || '',
    nodes: {}
  };

  for (const { id, node } of editableNodes(preview)) {
    baseline.nodes[id] = snapshotNode(preview, node);
  }

  state = {};
}

export function resetLocalEdits(preview) {
  if (!baseline) return;

  preview.setAttribute('style', baseline.previewStyle || '');

  // Remove editor-created duplicates.
  preview
    .querySelectorAll('[data-editor-created="true"]')
    .forEach(node => node.remove());

  for (const { id, node } of editableNodes(preview)) {
    const original = baseline.nodes[id];
    if (!original) continue;

    node.setAttribute('style', original.style || '');
    node.hidden = original.hidden;

    if (original.text !== null) {
      node.textContent = original.text;
    }

    if (original.placement) {
      node.dataset.placement = original.placement;
    } else {
      delete node.dataset.placement;
    }
  }

  state = {};
}

function button(text, action, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = text;

  if (className) element.className = className;

  element.addEventListener('click', action);

  return element;
}

function field(labelText, input) {
  const wrapper = document.createElement('label');
  wrapper.className = 'editor-field';

  const title = document.createElement('span');
  title.textContent = labelText;

  wrapper.append(title, input);

  return wrapper;
}

function numberInput(value, options = {}) {
  const input = document.createElement('input');
  input.type = 'number';

  if (options.min !== undefined) input.min = options.min;
  if (options.max !== undefined) input.max = options.max;
  if (options.step !== undefined) input.step = options.step;

  input.value = Number.isFinite(value) ? value : '';

  return input;
}

function selectInput(options, value = '') {
  const select = document.createElement('select');

  for (const option of options) {
    const element = document.createElement('option');

    if (typeof option === 'string') {
      element.value = option;
      element.textContent = option || 'Default';
    } else {
      element.value = option.value;
      element.textContent = option.label;
    }

    select.append(element);
  }

  select.value = value;

  return select;
}

function colorInput(value, fallback = '#101d30') {
  const input = document.createElement('input');
  input.type = 'color';

  const valid =
    typeof value === 'string' &&
    /^#[0-9a-f]{6}$/i.test(value.trim());

  input.value = valid ? value : fallback;

  return input;
}

function computedHex(node, property, fallback = '#101d30') {
  const value = getComputedStyle(node)[property];

  const match = value?.match(
    /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/
  );

  if (!match) return fallback;

  return (
    '#' +
    [match[1], match[2], match[3]]
      .map(number =>
        Number(number).toString(16).padStart(2, '0')
      )
      .join('')
  );
}

function makeDirectEditor(preview, changed, selectedChanged) {
  let selectedId = null;
  let dragging = null;
  let resizing = null;

  const handles = new Map();
  const cleanup = [];

  const deselect = () => {
    for (const { node } of editableNodes(preview)) {
      node.classList.remove('direct-edit-selected');
    }

    selectedId = null;
    delete preview.dataset.selectedEditorElement;
    selectedChanged?.(null);
  };

  const select = id => {
    const node = nodeById(preview, id);
    if (!node) return;

    for (const { node: candidate } of editableNodes(preview)) {
      candidate.classList.remove('direct-edit-selected');
    }

    node.classList.add('direct-edit-selected');

    selectedId = id;
    preview.dataset.selectedEditorElement = id;

    selectedChanged?.(id);
  };

  const install = item => {
    const { id, node } = item;

    if (handles.has(node)) return;

    node.classList.add('direct-edit-target');
    node.dataset.editorGroup = id;

    const pointerDown = event => {
      if (event.button !== 0) return;

      const resizeHandle =
        event.target.closest?.('.editor-resize-handle');

      if (resizeHandle) return;

      event.preventDefault();
      event.stopPropagation();

      select(id);

      if (node.dataset.editorMovable === 'false' || node.dataset.editorLocked === 'true') return;

      const position = canvasPosition(preview, node);
      const pointer = screenToCanvas(preview, event.clientX, event.clientY);

      dragging = {
        node,
        id,
        pointerId: event.pointerId,
        grabX: pointer.x - position.x,
        grabY: pointer.y - position.y,
        left: position.x,
        top: position.y,
        moved: false
      };

      node.setPointerCapture?.(event.pointerId);
    };

    const pointerMove = event => {
      if (!dragging || dragging.node !== node) return;

      const pointer = screenToCanvas(preview, event.clientX, event.clientY);
      const x = pointer.x - dragging.grabX;
      const y = pointer.y - dragging.grabY;

      // A click selects only. Do not convert or reposition a layout element
      // until an intentional drag has crossed a small design-space threshold.
      if (!dragging.moved && Math.hypot(x - dragging.left, y - dragging.top) < 2) return;
      dragging.moved = true;

      setPosition(preview, node, id, x, y);
      emitChanged(changed);
    };

    const pointerUp = event => {
      if (!dragging || dragging.node !== node) return;

      try {
        node.releasePointerCapture?.(event.pointerId);
      } catch {}

      dragging = null;
    };

    const click = event => {
      event.stopPropagation();
      select(id);
    };

    const doubleClick = event => {
      if (node.dataset.editorText !== 'true') return;

      event.preventDefault();
      event.stopPropagation();

      select(id);

      node.contentEditable = 'true';
      node.focus();

      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    };

    const textInput = () => {
      if (node.dataset.editorText !== 'true') return;

      ensureState(id).text = node.textContent;
      emitChanged(changed);
    };

    const blur = () => {
      if (node.contentEditable === 'true') {
        node.contentEditable = 'false';
      }
    };

    node.addEventListener('pointerdown', pointerDown);
    node.addEventListener('pointermove', pointerMove);
    node.addEventListener('pointerup', pointerUp);
    node.addEventListener('pointercancel', pointerUp);
    node.addEventListener('click', click);
    node.addEventListener('dblclick', doubleClick);
    node.addEventListener('input', textInput);
    node.addEventListener('blur', blur);

    cleanup.push(() => {
      node.removeEventListener('pointerdown', pointerDown);
      node.removeEventListener('pointermove', pointerMove);
      node.removeEventListener('pointerup', pointerUp);
      node.removeEventListener('pointercancel', pointerUp);
      node.removeEventListener('click', click);
      node.removeEventListener('dblclick', doubleClick);
      node.removeEventListener('input', textInput);
      node.removeEventListener('blur', blur);
    });

    if (node.dataset.editorResizable !== 'false') {
      const resize = document.createElement('span');

      resize.className = 'editor-resize-handle';
      resize.setAttribute('aria-hidden', 'true');
      resize.dataset.editorUi = 'true';

      node.append(resize);

      const resizeDown = event => {
        event.preventDefault();
        event.stopPropagation();

        select(id);

        const position = canvasPosition(preview, node);
        const pointer = screenToCanvas(preview, event.clientX, event.clientY);

        resizing = {
          node,
          id,
          pointerId: event.pointerId,
          grabX: pointer.x - position.x,
          grabY: pointer.y - position.y,
          width: position.width,
          height: position.height
        };

        resize.setPointerCapture?.(event.pointerId);
      };

      const resizeMove = event => {
        if (!resizing || resizing.node !== node || node.dataset.editorLocked === 'true') return;

        const pointer = screenToCanvas(preview, event.clientX, event.clientY);
        const position = canvasPosition(preview, node);
        const width = Math.max(20, pointer.x - position.x);
        const height = Math.max(20, pointer.y - position.y);

        setSize(node, id, width, height);

        emitChanged(changed);
      };

      const resizeUp = event => {
        if (!resizing || resizing.node !== node || node.dataset.editorLocked === 'true') return;

        try {
          resize.releasePointerCapture?.(event.pointerId);
        } catch {}

        resizing = null;
      };

      resize.addEventListener('pointerdown', resizeDown);
      resize.addEventListener('pointermove', resizeMove);
      resize.addEventListener('pointerup', resizeUp);
      resize.addEventListener('pointercancel', resizeUp);

      cleanup.push(() => {
        resize.remove();
      });

      handles.set(node, resize);
    }
  };

  editableNodes(preview).forEach(install);

  const canvasClick = event => {
    if (event.target === preview) deselect();
  };

  preview.addEventListener('click', canvasClick);

  cleanup.push(() =>
    preview.removeEventListener('click', canvasClick)
  );

  return {
    select,

    selected() {
      return selectedId;
    },

    refresh() {
      editableNodes(preview).forEach(install);
    },

    destroy() {
      cleanup.splice(0).forEach(fn => fn());

      editableNodes(preview).forEach(({ node }) => {
        node.classList.remove(
          'direct-edit-target',
          'direct-edit-selected'
        );

        node.removeAttribute('contenteditable');
      });

      delete preview.dataset.selectedEditorElement;
    }
  };
}

function duplicateObject(preview, id) {
  const source = nodeById(preview, id);
  if (!source) return null;

  const clone = source.cloneNode(true);

  clone
    .querySelectorAll('[data-editor-ui="true"]')
    .forEach(node => node.remove());

  const newId =
    `${id}-copy-${Date.now().toString(36)}`;

  clone.dataset.editorId = newId;
  clone.dataset.editorLabel =
    `${source.dataset.editorLabel || id} Copy`;
  clone.dataset.editorCreated = 'true';

  const position = canvasPosition(preview, source);

  clone.style.position = 'absolute';
  clone.style.left = `${position.x + 24}px`;
  clone.style.top = `${position.y + 24}px`;

  source.parentNode.append(clone);

  state[newId] = {
    x: position.x + 24,
    y: position.y + 24
  };

  return newId;
}

function deleteObject(preview, id) {
  const node = nodeById(preview, id);
  if (!node) return false;

  if (node.dataset.editorDeletable === 'false') {
    return false;
  }

  node.hidden = true;
  ensureState(id).hidden = true;

  return true;
}

function moveLayer(preview, id, direction) {
  const node = nodeById(preview, id);
  if (!node) return;

  if (direction === 'front') {
    node.parentNode.append(node);
  } else if (direction === 'back') {
    node.parentNode.prepend(node);
  } else if (direction === 'forward') {
    const next = node.nextElementSibling;
    if (next) next.after(node);
  } else if (direction === 'backward') {
    const previous = node.previousElementSibling;
    if (previous) previous.before(node);
  }
}

function renderInspector({
  preview,
  container,
  id,
  directEditor,
  changed,
  rerender,
  undo,
  redo,
  canUndo,
  canRedo
}) {
  container.replaceChildren();

  const items = editableNodes(preview);

  const shell = document.createElement('div');
  shell.className = 'canvas-editor-shell';

  const historyControls = document.createElement('div');
  historyControls.className = 'editor-history-controls';

  const undoButton = button('↶ Undo', undo);
  undoButton.disabled = !canUndo;

  const redoButton = button('↷ Redo', redo);
  redoButton.disabled = !canRedo;

  historyControls.append(undoButton, redoButton);
  shell.append(historyControls);

  const toolbar = document.createElement('div');
  toolbar.className = 'canvas-editor-toolbar';

  toolbar.append(
    button('+ Text', () => {
      const node = document.createElement('div');

      const newId =
        `text-${Date.now().toString(36)}`;

      node.dataset.editorId = newId;
      node.dataset.editorType = 'text';
      node.dataset.editorLabel = 'New Text';
      node.dataset.editorText = 'true';
      node.dataset.editorMovable = 'true';
      node.dataset.editorResizable = 'true';
      node.dataset.editorDeletable = 'true';
      node.dataset.editorCreated = 'true';

      node.textContent = 'New text';
      node.style.position = 'absolute';
      node.style.left = '120px';
      node.style.top = '120px';
      node.style.fontSize = '48px';
      node.style.zIndex = '20';

      preview.append(node);

      state[newId] = {
        x: 120,
        y: 120,
        fontSize: 48,
        text: 'New text'
      };

      directEditor.refresh();
      directEditor.select(newId);
      emitChanged(changed);
      rerender(newId);
    }),

    button('+ Shape', () => {
      shapePicker.hidden = !shapePicker.hidden;
    }),

    button('+ Image', () => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
      input.addEventListener('change', () => {
        const file = input.files?.[0]; if (!file) return;
        const reader = new FileReader(); reader.onload = () => {
          const node = document.createElement('img'); const newId = `image-${Date.now().toString(36)}`;
          node.src = reader.result; node.dataset.editorId = newId; node.dataset.editorType = 'image'; node.dataset.editorLabel = file.name || 'Uploaded Image'; node.dataset.editorText = 'false'; node.dataset.editorMovable = 'true'; node.dataset.editorResizable = 'true'; node.dataset.editorDeletable = 'true'; node.dataset.editorCreated = 'true'; node.style.cssText = 'position:absolute;left:140px;top:140px;width:260px;height:260px;object-fit:contain;z-index:15;'; preview.append(node);
          state[newId] = { x: 140, y: 140, width: 260, height: 260, src: reader.result }; directEditor.refresh(); directEditor.select(newId); emitChanged(changed); rerender(newId);
        }; reader.readAsDataURL(file);
      }); input.click();
    })
  );

  shell.append(toolbar);

  const shapePicker = document.createElement('div');
  shapePicker.className = 'shape-picker';
  shapePicker.hidden = true;
  shapePicker.setAttribute('aria-label', 'Choose a shape');

  for (const shape of SHAPE_OPTIONS) {
    const option = button('', () => {
      const newId = addShape(preview, shape.id);
      directEditor.refresh();
      directEditor.select(newId);
      emitChanged(changed);
      rerender(newId);
    }, 'shape-picker-option');

    option.title = shape.label;
    option.setAttribute('aria-label', shape.label);

    const icon = document.createElement('span');
    icon.className = 'shape-picker-icon';
    icon.dataset.shape = shape.id;
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.textContent = shape.label;

    option.append(icon, label);
    shapePicker.append(option);
  }

  shell.append(shapePicker);

  const layers = document.createElement('div');
  layers.className = 'editor-layers';

  const layersTitle = document.createElement('h4');
  layersTitle.textContent = 'Layers';

  layers.append(layersTitle);

  for (const item of [...items].reverse()) {
    const layer = button(
      item.label,
      () => {
        directEditor.select(item.id);
        rerender(item.id);
      },
      item.id === id
        ? 'editor-layer active'
        : 'editor-layer'
    );

    layers.append(layer);
  }

  shell.append(layers);

  if (!id) {
    const empty = document.createElement('p');
    empty.className = 'editor-empty';
    empty.textContent =
      'Select an object on the design to edit it.';

    shell.append(empty);
    container.append(shell);
    return;
  }

  const node = nodeById(preview, id);

  if (!node) {
    container.append(shell);
    return;
  }

  const type = node.dataset.editorType || 'object';
  const editableText =
    node.dataset.editorText === 'true';

  const computed = getComputedStyle(node);
  const position = canvasPosition(preview, node);
  const values = ensureState(id);

  const inspector = document.createElement('div');
  inspector.className = 'editor-inspector';

  const heading = document.createElement('div');
  heading.className = 'editor-object-heading';

  const headingText = document.createElement('div');
  const title = document.createElement('strong');
  const meta = document.createElement('span');

  title.textContent =
    node.dataset.editorLabel || id;

  meta.textContent = type;

  headingText.append(title, meta);
  heading.append(headingText);
  // ----------------------------------------------------------
  // SPECIAL INSPECTOR: BACKGROUND
  // ----------------------------------------------------------
  if (type === 'background') {
    inspector.append(heading);

    const currentBackground =
      values.background ||
      computed.backgroundColor ||
      '#ffffff';

    const currentImage =
      values.backgroundImage ||
      node.style.backgroundImage ||
      computed.backgroundImage ||
      'none';

    const hasImage =
      currentImage &&
      currentImage !== 'none';

    let currentMode =
      values.backgroundMode ||
      (hasImage ? 'image' : 'solid');

    const mode = selectInput(
      [
        { value: 'solid', label: 'Solid Color' },
        { value: 'gradient', label: 'Gradient' },
        { value: 'image', label: 'Image' }
      ],
      currentMode
    );

    inspector.append(field('Background Type', mode));

    const controls = document.createElement('div');
    controls.className = 'editor-background-controls';
    inspector.append(controls);

    const renderBackgroundControls = () => {
      controls.replaceChildren();

      currentMode = mode.value;
      values.backgroundMode = currentMode;

      // ----------------------------
      // SOLID BACKGROUND
      // ----------------------------
      if (currentMode === 'solid') {
        const solidColor = colorInput(
          values.backgroundColor ||
            computedHex(node, 'backgroundColor', '#ffffff'),
          '#ffffff'
        );

        solidColor.addEventListener('input', () => {
          values.backgroundColor = solidColor.value;
          values.background = solidColor.value;
          values.backgroundImage = 'none';

          node.style.backgroundColor = solidColor.value;
          node.style.backgroundImage = 'none';

          emitChanged(changed);
        });

        controls.append(
          field('Background Color', solidColor)
        );
      }

      // ----------------------------
      // GRADIENT BACKGROUND
      // ----------------------------
      if (currentMode === 'gradient') {
        const color1 = colorInput(
          values.gradientColor1 || '#50c4f8',
          '#50c4f8'
        );

        const color2 = colorInput(
          values.gradientColor2 || '#101d30',
          '#101d30'
        );

        const angle = numberInput(
          values.gradientAngle ?? 135,
          {
            min: 0,
            max: 360,
            step: 1
          }
        );

        const updateGradient = () => {
          values.gradientColor1 = color1.value;
          values.gradientColor2 = color2.value;
          values.gradientAngle =
            Number.parseFloat(angle.value) || 0;

          const gradient =
            `linear-gradient(${values.gradientAngle}deg, ` +
            `${values.gradientColor1}, ${values.gradientColor2})`;

          values.backgroundImage = gradient;

          node.style.backgroundImage = gradient;
          node.style.backgroundColor = '';

          emitChanged(changed);
        };

        color1.addEventListener('input', updateGradient);
        color2.addEventListener('input', updateGradient);
        angle.addEventListener('input', updateGradient);

        controls.append(
          field('Color 1', color1),
          field('Color 2', color2),
          field('Angle', angle)
        );

        updateGradient();
      }

      // ----------------------------
      // IMAGE BACKGROUND
      // ----------------------------
      if (currentMode === 'image') {
        const upload = document.createElement('input');

        upload.type = 'file';
        upload.accept =
          'image/png,image/jpeg,image/webp';

        upload.addEventListener('change', () => {
          const file = upload.files?.[0];

          if (!file) return;

          const reader = new FileReader();

          reader.addEventListener('load', () => {
            const imageValue =
              `url("${reader.result}")`;

            values.backgroundImage = imageValue;
            values.backgroundMode = 'image';

            node.style.backgroundImage = imageValue;

            if (!values.backgroundSize) {
              values.backgroundSize = 'cover';
            }

            if (!values.backgroundPosition) {
              values.backgroundPosition = 'center center';
            }

            node.style.backgroundSize =
              values.backgroundSize;

            node.style.backgroundPosition =
              values.backgroundPosition;

            node.style.backgroundRepeat = 'no-repeat';

            emitChanged(changed);
          });

          reader.readAsDataURL(file);
        });

        controls.append(
          field(
            hasImage
              ? 'Replace Background'
              : 'Upload Background',
            upload
          )
        );

        const size = selectInput(
          [
            { value: 'cover', label: 'Fill' },
            { value: 'contain', label: 'Fit' },
            { value: '100% 100%', label: 'Stretch' }
          ],
          values.backgroundSize ||
            node.style.backgroundSize ||
            'cover'
        );

        size.addEventListener('input', () => {
          values.backgroundSize = size.value;

          node.style.backgroundSize =
            size.value;

          node.style.backgroundRepeat =
            size.value === 'contain'
              ? 'no-repeat'
              : 'no-repeat';

          emitChanged(changed);
        });

        controls.append(
          field('Image Fit', size)
        );

        const position = selectInput(
          [
            {
              value: 'center center',
              label: 'Center'
            },
            {
              value: 'center top',
              label: 'Top'
            },
            {
              value: 'center bottom',
              label: 'Bottom'
            },
            {
              value: 'left center',
              label: 'Left'
            },
            {
              value: 'right center',
              label: 'Right'
            }
          ],
          values.backgroundPosition ||
            node.style.backgroundPosition ||
            'center center'
        );

        position.addEventListener('input', () => {
          values.backgroundPosition =
            position.value;

          node.style.backgroundPosition =
            position.value;

          emitChanged(changed);
        });

        controls.append(
          field('Position', position)
        );

        if (
          values.backgroundImage &&
          values.backgroundImage !== 'none'
        ) {
          controls.append(
            button(
              'Remove Background Image',
              () => {
                values.backgroundImage = 'none';
                values.backgroundMode = 'solid';

                node.style.backgroundImage = 'none';
                node.style.backgroundSize = '';
                node.style.backgroundPosition = '';
                node.style.backgroundRepeat = '';

                mode.value = 'solid';

                emitChanged(changed);
                renderBackgroundControls();
              }
            )
          );
        }
      }
    };

    mode.addEventListener('input', () => {
      values.backgroundMode = mode.value;

      if (mode.value === 'solid') {
        node.style.backgroundImage = 'none';
      }

      renderBackgroundControls();
      emitChanged(changed);
    });

    renderBackgroundControls();

    shell.append(inspector);
    container.append(shell);

    return;
  }
  const actions = document.createElement('div');
  actions.className = 'editor-object-actions';

  actions.append(
    button('Duplicate', () => {
      const newId = duplicateObject(preview, id);
      if (!newId) return;

      directEditor.refresh();
      directEditor.select(newId);

      emitChanged(changed);
      rerender(newId);
    }),

    button(
      node.hidden ? 'Show' : 'Hide',
      () => {
        node.hidden = !node.hidden;
        values.hidden = node.hidden;

        emitChanged(changed);
        rerender(id);
      }
    ),

    button('Delete', () => {
      if (!deleteObject(preview, id)) return;

      emitChanged(changed);
      rerender(null);
    }),

    button(node.dataset.editorLocked === 'true' ? 'Unlock' : 'Lock', () => { node.dataset.editorLocked = node.dataset.editorLocked === 'true' ? 'false' : 'true'; ensureState(id).locked = node.dataset.editorLocked === 'true'; emitChanged(changed); rerender(id); })
  );

  heading.append(actions);
  inspector.append(heading);
  // ----------------------------------------------------------
  // SPECIAL CONTROLS: IMAGE / LOGO
  // ----------------------------------------------------------
  if (type === 'image' || type === 'logo') {
    const imageControls = document.createElement('div');
    imageControls.className = 'editor-image-controls';

    // Replace image
    const replaceInput = document.createElement('input');
    replaceInput.type = 'file';
    replaceInput.accept = 'image/png,image/jpeg,image/webp';

    replaceInput.addEventListener('change', () => {
      const file = replaceInput.files?.[0];
      if (!file) return;

      const reader = new FileReader();

      reader.addEventListener('load', () => {
        node.src = reader.result;
        values.src = reader.result;

        emitChanged(changed);
      });

      reader.readAsDataURL(file);
    });

    imageControls.append(
      field('Replace Image', replaceInput)
    );

    // Fit / Fill
    const imageFit = selectInput(
      [
        { value: 'contain', label: 'Fit' },
        { value: 'cover', label: 'Fill' },
        { value: 'fill', label: 'Stretch' }
      ],
      values.objectFit ||
        node.style.objectFit ||
        computed.objectFit ||
        'contain'
    );

    imageFit.addEventListener('input', () => {
      values.objectFit = imageFit.value;
      node.style.objectFit = imageFit.value;

      emitChanged(changed);
    });

    imageControls.append(
      field('Image Fit', imageFit)
    );

    // Image position
    const imagePosition = selectInput(
      [
        { value: 'center center', label: 'Center' },
        { value: 'center top', label: 'Top' },
        { value: 'center bottom', label: 'Bottom' },
        { value: 'left center', label: 'Left' },
        { value: 'right center', label: 'Right' }
      ],
      values.objectPosition ||
        node.style.objectPosition ||
        computed.objectPosition ||
        'center center'
    );

    imagePosition.addEventListener('input', () => {
      values.objectPosition = imagePosition.value;
      node.style.objectPosition = imagePosition.value;

      emitChanged(changed);
    });

    imageControls.append(
      field('Image Position', imagePosition)
    );

    // Border width
    const borderWidth = numberInput(
      px(values.borderWidth || computed.borderWidth || 0),
      { min: 0, max: 50, step: 1 }
    );

    const borderColor = colorInput(
      values.borderColor ||
        computedHex(node, 'borderColor', '#000000'),
      '#000000'
    );

    const updateBorder = () => {
      values.borderWidth = px(borderWidth.value);
      values.borderColor = borderColor.value;

      node.style.borderStyle =
        values.borderWidth > 0 ? 'solid' : 'none';

      node.style.borderWidth =
        `${values.borderWidth}px`;

      node.style.borderColor =
        values.borderColor;

      emitChanged(changed);
    };

    borderWidth.addEventListener('input', updateBorder);
    borderColor.addEventListener('input', updateBorder);

    imageControls.append(
      field('Border Width', borderWidth),
      field('Border Color', borderColor)
    );

    // Corner radius
    const imageRadius = numberInput(
      px(values.borderRadius || computed.borderRadius || 0),
      { min: 0, max: 500, step: 1 }
    );

    imageRadius.addEventListener('input', () => {
      values.borderRadius = px(imageRadius.value);
      node.style.borderRadius =
        `${values.borderRadius}px`;

      emitChanged(changed);
    });

    imageControls.append(
      field('Corner Radius', imageRadius)
    );

    // Local image filters — NO AI call
    const brightness = numberInput(
      values.brightness ?? 100,
      { min: 0, max: 200, step: 1 }
    );

    const contrast = numberInput(
      values.contrast ?? 100,
      { min: 0, max: 200, step: 1 }
    );

    const saturation = numberInput(
      values.saturation ?? 100,
      { min: 0, max: 300, step: 1 }
    );

    const grayscale = numberInput(
      values.grayscale ?? 0,
      { min: 0, max: 100, step: 1 }
    );

    const imageBlur = numberInput(
      values.imageBlur ?? 0,
      { min: 0, max: 30, step: 0.5 }
    );

    const updateFilters = () => {
      values.brightness =
        Number.parseFloat(brightness.value) || 0;

      values.contrast =
        Number.parseFloat(contrast.value) || 0;

      values.saturation =
        Number.parseFloat(saturation.value) || 0;

      values.grayscale =
        Number.parseFloat(grayscale.value) || 0;

      values.imageBlur =
        Number.parseFloat(imageBlur.value) || 0;

      values.filter =
        `brightness(${values.brightness}%) ` +
        `contrast(${values.contrast}%) ` +
        `saturate(${values.saturation}%) ` +
        `grayscale(${values.grayscale}%) ` +
        `blur(${values.imageBlur}px)`;

      node.style.filter = values.filter;

      emitChanged(changed);
    };

    brightness.addEventListener('input', updateFilters);
    contrast.addEventListener('input', updateFilters);
    saturation.addEventListener('input', updateFilters);
    grayscale.addEventListener('input', updateFilters);
    imageBlur.addEventListener('input', updateFilters);

    imageControls.append(
      field('Brightness %', brightness),
      field('Contrast %', contrast),
      field('Saturation %', saturation),
      field('Grayscale %', grayscale),
      field('Blur', imageBlur)
    );

    inspector.append(imageControls);
  }
  if (editableText) {
    const textarea = document.createElement('textarea');
    textarea.rows = 4;
    textarea.value =
      values.text ?? node.textContent ?? '';

    textarea.addEventListener('input', () => {
      node.textContent = textarea.value;
      values.text = textarea.value;
      emitChanged(changed);
    });

    inspector.append(field('Text', textarea));

    const font = selectInput(
      FONT_OPTIONS,
      values.fontFamily || ''
    );

    font.addEventListener('input', () => {
      values.fontFamily = font.value;
      applyValue(node, 'fontFamily', font.value);
      emitChanged(changed);
    });

    inspector.append(field('Font', font));

    const fontSize = numberInput(
      px(values.fontSize || computed.fontSize),
      { min: 6, max: 500, step: 1 }
    );

    fontSize.addEventListener('input', () => {
      values.fontSize = px(fontSize.value);
      applyValue(node, 'fontSize', values.fontSize);
      emitChanged(changed);
    });

    inspector.append(field('Font size', fontSize));

    const weight = selectInput(
      [
        { value: '', label: 'Default' },
        { value: '300', label: 'Light' },
        { value: '400', label: 'Regular' },
        { value: '500', label: 'Medium' },
        { value: '600', label: 'Semi Bold' },
        { value: '700', label: 'Bold' },
        { value: '800', label: 'Extra Bold' },
        { value: '900', label: 'Black' }
      ],
      values.fontWeight || ''
    );

    weight.addEventListener('input', () => {
      values.fontWeight = weight.value;
      applyValue(node, 'fontWeight', weight.value);
      emitChanged(changed);
    });

    inspector.append(field('Weight', weight));

    const alignment = selectInput(
      [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' }
      ],
      values.textAlign || computed.textAlign || 'left'
    );

    alignment.addEventListener('input', () => {
      values.textAlign = alignment.value;
      applyValue(node, 'textAlign', alignment.value);
      emitChanged(changed);
    });

    inspector.append(field('Alignment', alignment));

    const textColor = colorInput(
      values.color || computedHex(node, 'color')
    );

    textColor.addEventListener('input', () => {
      values.color = textColor.value;
      applyValue(node, 'color', textColor.value);
      emitChanged(changed);
    });

    inspector.append(field('Color', textColor));

    const lineHeight = numberInput(
      px(values.lineHeight || computed.lineHeight),
      { min: 0.8, max: 500, step: 0.1 }
    );

    lineHeight.addEventListener('input', () => {
      values.lineHeight = lineHeight.value;
      applyValue(node, 'lineHeight', lineHeight.value);
      emitChanged(changed);
    });

    inspector.append(field('Line height', lineHeight));

    const spacing = numberInput(
      px(values.letterSpacing || computed.letterSpacing),
      { min: -20, max: 100, step: 0.5 }
    );

    spacing.addEventListener('input', () => {
      values.letterSpacing = px(spacing.value);
      applyValue(
        node,
        'letterSpacing',
        values.letterSpacing
      );
      emitChanged(changed);
    });

    inspector.append(field('Letter spacing', spacing));

    const textStyleRow = document.createElement('div');
    textStyleRow.className = 'editor-button-row';

    textStyleRow.append(
      button('Italic', () => {
        values.fontStyle =
          getComputedStyle(node).fontStyle === 'italic'
            ? 'normal'
            : 'italic';

        applyValue(node, 'fontStyle', values.fontStyle);
        emitChanged(changed);
      }),

      button('Underline', () => {
        values.textDecoration =
          getComputedStyle(node).textDecorationLine
            .includes('underline')
            ? 'none'
            : 'underline';

        applyValue(
          node,
          'textDecoration',
          values.textDecoration
        );

        emitChanged(changed);
      })
    );

    inspector.append(textStyleRow);
    const stroke = numberInput(px(values.strokeWidth || 0), { min: 0, max: 20, step: 1 });
    stroke.addEventListener('input', () => { values.strokeWidth = px(stroke.value); applyValue(node, 'strokeWidth', values.strokeWidth); emitChanged(changed); }); inspector.append(field('Stroke width', stroke));
    const strokeColor = colorInput(values.strokeColor || '#101d30'); strokeColor.addEventListener('input', () => { values.strokeColor = strokeColor.value; applyValue(node, 'strokeColor', strokeColor.value); emitChanged(changed); }); inspector.append(field('Stroke color', strokeColor));
    const shadow = numberInput(px(values.shadowBlur || 0), { min: 0, max: 100, step: 1 }); shadow.addEventListener('input', () => { values.shadowBlur = px(shadow.value); values.textShadow = `0px 0px ${values.shadowBlur}px ${values.shadowColor || '#000000'}`; applyValue(node, 'textShadow', values.textShadow); emitChanged(changed); }); inspector.append(field('Shadow / glow', shadow));
    const shadowColor = colorInput(values.shadowColor || '#000000'); shadowColor.addEventListener('input', () => { values.shadowColor = shadowColor.value; values.textShadow = `0px 0px ${values.shadowBlur || 0}px ${values.shadowColor}`; applyValue(node, 'textShadow', values.textShadow); emitChanged(changed); }); inspector.append(field('Shadow color', shadowColor));
  }

  const positionGrid = document.createElement('div');
  positionGrid.className = 'editor-position-grid';

  const xInput = numberInput(
    values.x ?? position.x,
    { step: 1 }
  );

  const yInput = numberInput(
    values.y ?? position.y,
    { step: 1 }
  );

  const widthInput = numberInput(
    values.width ?? position.width,
    { min: 1, max: 1080, step: 1 }
  );

  const heightInput = numberInput(
    values.height ?? position.height,
    { min: 1, max: 1350, step: 1 }
  );

  const updatePosition = () => {
    setPosition(
      preview,
      node,
      id,
      px(xInput.value),
      px(yInput.value)
    );

    emitChanged(changed);
  };

  xInput.addEventListener('input', updatePosition);
  yInput.addEventListener('input', updatePosition);

  widthInput.addEventListener('input', () => {
    setSize(
      node,
      id,
      px(widthInput.value),
      px(heightInput.value)
    );

    emitChanged(changed);
  });

  heightInput.addEventListener('input', () => {
    setSize(
      node,
      id,
      px(widthInput.value),
      px(heightInput.value)
    );

    emitChanged(changed);
  });

  positionGrid.append(
    field('X', xInput),
    field('Y', yInput),
    field('Width', widthInput),
    field('Height', heightInput)
  );

  inspector.append(positionGrid);

  const opacity = numberInput(
    Number.parseFloat(
      values.opacity ?? computed.opacity ?? 1
    ),
    { min: 0, max: 1, step: 0.05 }
  );

  opacity.addEventListener('input', () => {
    values.opacity = Number.parseFloat(opacity.value);
    applyValue(node, 'opacity', values.opacity);
    emitChanged(changed);
  });

  inspector.append(field('Opacity', opacity));

  const rotation = numberInput(
    px(values.rotation || 0),
    { min: -360, max: 360, step: 1 }
  );

  rotation.addEventListener('input', () => {
    values.rotation = px(rotation.value);
    applyValue(node, 'rotation', values.rotation);
    emitChanged(changed);
  });

  inspector.append(field('Rotation', rotation));

  if (
    type === 'shape' ||
    type === 'button' ||
    type === 'graphic'
  ) {
    const background = colorInput(
      values.background ||
        computedHex(node, 'backgroundColor', '#50c4f8'),
      '#50c4f8'
    );

    background.addEventListener('input', () => {
      values.background = background.value;
      applyValue(
        node,
        'background',
        background.value
      );
      emitChanged(changed);
    });

    inspector.append(field('Fill', background));

    const borderWidth = numberInput(
      px(values.borderWidth || computed.borderWidth),
      { min: 0, max: 80, step: 1 }
    );

    const borderColor = colorInput(
      values.borderColor ||
        computedHex(node, 'borderColor', '#101d30')
    );

    const updateShapeBorder = () => {
      values.borderWidth = px(borderWidth.value);
      values.borderColor = borderColor.value;
      applyValue(node, 'borderWidth', values.borderWidth);
      applyValue(node, 'borderColor', values.borderColor);
      node.style.borderStyle = values.borderWidth ? 'solid' : 'none';
      emitChanged(changed);
    };

    borderWidth.addEventListener('input', updateShapeBorder);
    borderColor.addEventListener('input', updateShapeBorder);

    inspector.append(
      field('Border width', borderWidth),
      field('Border color', borderColor)
    );

    const radius = numberInput(
      px(values.borderRadius || computed.borderRadius),
      { min: 0, max: 500, step: 1 }
    );

    radius.addEventListener('input', () => {
      values.borderRadius = px(radius.value);
      applyValue(
        node,
        'borderRadius',
        values.borderRadius
      );
      emitChanged(changed);
    });

    inspector.append(field('Corner radius', radius));
  }

  const layerActions = document.createElement('div');
  layerActions.className = 'editor-layer-actions';

  layerActions.append(
    button('To Front', () => {
      moveLayer(preview, id, 'front');
      emitChanged(changed);
      rerender(id);
    }),

    button('Forward', () => {
      moveLayer(preview, id, 'forward');
      emitChanged(changed);
      rerender(id);
    }),

    button('Backward', () => {
      moveLayer(preview, id, 'backward');
      emitChanged(changed);
      rerender(id);
    }),

    button('To Back', () => {
      moveLayer(preview, id, 'back');
      emitChanged(changed);
      rerender(id);
    })
  );

  inspector.append(layerActions);

  shell.append(inspector);
  container.append(shell);
}

export function setupLocalEditor(
  preview,
  container,
  changed = () => {}
) {
  activeEditor?.destroy?.();

  let selectedId = 'headline';
  let directEditor = null;
  let copiedObject = null;
  let historyIndex = 0;
  let historyTimer = 0;
  let restoringHistory = false;

  const snapshot = () => {
    const clone = preview.cloneNode(true);
    clone.querySelectorAll('[data-editor-ui="true"]').forEach(node => node.remove());
    clone.querySelectorAll('.direct-edit-target, .direct-edit-selected').forEach(node => {
      node.classList.remove('direct-edit-target', 'direct-edit-selected');
      node.removeAttribute('contenteditable');
    });
    delete clone.dataset.selectedEditorElement;
    return clone.outerHTML;
  };

  let history = [snapshot()];

  const commitHistory = () => {
    historyTimer = 0;
    if (restoringHistory) return;
    const next = snapshot();
    if (history[historyIndex] === next) return;
    history = history.slice(0, historyIndex + 1);
    history.push(next);
    historyIndex = history.length - 1;
    // Do not rebuild the inspector after a routine value change. Rebuilding
    // loses the current field focus and resets the inspector scroll position.
  };

  const recordChange = () => {
    changed(state);
    if (restoringHistory) return;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(commitHistory, 180);
  };

  const restoreHistory = source => {
    const template = document.createElement('template');
    template.innerHTML = source;
    const restored = template.content.firstElementChild;
    if (!restored) return;

    restoringHistory = true;
    directEditor?.destroy();
    preview.className = restored.className;
    preview.style.cssText = restored.style.cssText;
    preview.replaceChildren(...[...restored.childNodes].map(node => node.cloneNode(true)));
    state = {};
    directEditor = makeDirectEditor(preview, recordChange, id => {
      selectedId = id;
      rerender(id);
    });
    selectedId = nodeById(preview, selectedId)
      ? selectedId
      : editableNodes(preview)[0]?.id || null;
    restoringHistory = false;
    changed(state);
    rerender(selectedId);
  };

  const undo = () => {
    if (historyTimer) {
      clearTimeout(historyTimer);
      commitHistory();
    }
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    restoreHistory(history[historyIndex]);
  };

  const redo = () => {
    if (historyTimer) {
      clearTimeout(historyTimer);
      commitHistory();
    }
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    restoreHistory(history[historyIndex]);
  };

  const rerender = id => {
    selectedId = id;

    renderInspector({
      preview,
      container,
      id: selectedId,
      directEditor,
      changed: recordChange,
      rerender,
      undo,
      redo,
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1
    });
  };

  directEditor = makeDirectEditor(
    preview,
    recordChange,
    id => {
      selectedId = id;
      rerender(id);
    }
  );

  if (!nodeById(preview, selectedId)) {
    selectedId =
      editableNodes(preview)[0]?.id || null;
  }

  rerender(selectedId);

  const keyboard = event => {
    const target = event.target;

    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable;

    if (typing) return;

    const id = directEditor.selected();

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      const selected = id && nodeById(preview, id);
      if (!selected) return;
      event.preventDefault();
      copiedObject = selected.cloneNode(true);
      copiedObject.querySelectorAll('[data-editor-ui="true"]').forEach(node => node.remove());
      copiedObject.classList.remove('direct-edit-target', 'direct-edit-selected');
      copiedObject.removeAttribute('contenteditable');
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
      if (!copiedObject) return;
      event.preventDefault();
      const pasted = copiedObject.cloneNode(true);
      const newId = 'object-' + Date.now().toString(36);
      const position = id ? canvasPosition(preview, nodeById(preview, id)) : { x: 96, y: 96 };
      pasted.dataset.editorId = newId;
      pasted.dataset.editorLabel = (pasted.dataset.editorLabel || 'Object') + ' Copy';
      pasted.dataset.editorCreated = 'true';
      pasted.style.position = 'absolute';
      pasted.style.left = (position.x + 24) + 'px';
      pasted.style.top = (position.y + 24) + 'px';
      preview.append(pasted);
      state[newId] = { x: position.x + 24, y: position.y + 24 };
      directEditor.refresh();
      directEditor.select(newId);
      recordChange();
      rerender(newId);
      return;
    }

    if (!id) return;

    const node = nodeById(preview, id);
    if (!node) return;

    if (
      event.key === 'Delete' ||
      event.key === 'Backspace'
    ) {
      event.preventDefault();

      if (deleteObject(preview, id)) {
        recordChange();
        rerender(null);
      }

      return;
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'd'
    ) {
      event.preventDefault();

      const newId = duplicateObject(preview, id);

      if (newId) {
        directEditor.refresh();
        directEditor.select(newId);
        recordChange();
        rerender(newId);
      }

      return;
    }

    const movement = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }[event.key];

    if (movement) {
      event.preventDefault();

      const position = canvasPosition(preview, node);
      const multiplier = event.shiftKey ? 10 : 1;

      setPosition(
        preview,
        node,
        id,
        position.x + movement[0] * multiplier,
        position.y + movement[1] * multiplier
      );

      recordChange();
      rerender(id);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      rerender(null);
    }
  };

  document.addEventListener('keydown', keyboard);

  const editor = {
    reset() {
      directEditor.destroy();

      resetLocalEdits(preview);

      directEditor = makeDirectEditor(
        preview,
        recordChange,
        id => rerender(id)
      );

      selectedId =
        editableNodes(preview)[0]?.id || null;

      rerender(selectedId);
      recordChange();
    },

    getState() {
      return state;
    },

    undo,
    redo,

    select(group) {
      const id = LEGACY_IDS[group] || group;

      directEditor.select(id);
      rerender(id);
    },

    destroy() {
      document.removeEventListener(
        'keydown',
        keyboard
      );

      directEditor?.destroy();

      if (activeEditor === editor) {
        activeEditor = null;
      }
    }
  };

  activeEditor = editor;

  return editor;
}
