const fields = {
  headline: ['fontFamily','fontSize','fontWeight','color','textAlign','lineHeight'],
  copy: ['fontFamily','fontSize','fontWeight','color','textAlign','lineHeight'],
  cta: ['show','fontFamily','fontSize','fontWeight','color','background'],
  logo: ['show','size']
};

const label = key => ({
  fontFamily:'Font family',
  fontSize:'Size',
  fontWeight:'Weight',
  color:'Color',
  textAlign:'Alignment',
  lineHeight:'Line height',
  show:'Show',
  background:'Background',
  size:'Size'
}[key] || key);

const targets = {
  headline:'#preview-headline',
  copy:'#preview-copy',
  cta:'#preview-cta',
  logo:'#preview-logo'
};

let baseline = null;
let state = {};

function groupForNode(node) {
  return Object.entries(targets)
    .find(([, selector]) => node.matches(selector))?.[0] || null;
}

function editableNodes(preview) {
  return Object.entries(targets)
    .map(([group, selector]) => ({
      group,
      node: preview.querySelector(selector)
    }))
    .filter(item => item.node);
}

export function applyLocalEdits(preview, value = state) {
  for (const [group, values] of Object.entries(value)) {
    const node = preview.querySelector(targets[group]);
    if (!node) continue;

    for (const [key, setting] of Object.entries(values)) {
      if (setting === '' || setting === 'auto') continue;

      if (key === 'show') {
        node.hidden = setting === 'off';
        continue;
      }

      if (key === 'fontSize' || key === 'size') {
        node.style.fontSize = `${setting}px`;
      } else if (key === 'background') {
        node.style.background = setting;
      } else if (key === 'x') {
        node.style.left = `${setting}px`;
      } else if (key === 'y') {
        node.style.top = `${setting}px`;
      } else {
        node.style[key] = setting;
      }
    }
  }
}

export function resetLocalEdits(preview) {
  if (baseline) {
    preview.setAttribute('style', baseline.previewStyle);
  }

  for (const [group, selector] of Object.entries(targets)) {
    const node = preview.querySelector(selector);

    if (node && baseline?.[group]) {
      node.setAttribute('style', baseline[group].style);
      node.hidden = baseline[group].hidden;
      node.dataset.placement = baseline[group].placement;
    }
  }

  state = {};
}

export function beginLocalEdits(preview) {
  baseline = {
    previewStyle: preview.getAttribute('style') || ''
  };

  for (const [group, selector] of Object.entries(targets)) {
    const node = preview.querySelector(selector);

    baseline[group] = node
      ? {
          style: node.getAttribute('style') || '',
          hidden: node.hidden,
          placement: node.dataset.placement || ''
        }
      : null;
  }

  state = {};
}

function makeDirectlyEditable(preview, changed, onSelect) {
  let selected = null;
  let dragging = null;

  const select = (node, group) => {
    if (selected) {
      selected.classList.remove('direct-edit-selected');
    }

    selected = node;

    if (selected) {
      selected.classList.add('direct-edit-selected');
      preview.dataset.selectedEditorElement = group;
      onSelect?.(group);
    } else {
      delete preview.dataset.selectedEditorElement;
    }
  };

  for (const { group, node } of editableNodes(preview)) {
    node.classList.add('direct-edit-target');
    node.dataset.editorGroup = group;

    node.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      select(node, group);

      const previewRect = preview.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();

      const scaleX = preview.offsetWidth
        ? previewRect.width / preview.offsetWidth
        : 1;

      const scaleY = preview.offsetHeight
        ? previewRect.height / preview.offsetHeight
        : 1;

      const safeScaleX = scaleX || 1;
      const safeScaleY = scaleY || 1;

      const startLeft =
        Number.parseFloat(getComputedStyle(node).left) ||
        ((nodeRect.left - previewRect.left) / safeScaleX);

      const startTop =
        Number.parseFloat(getComputedStyle(node).top) ||
        ((nodeRect.top - previewRect.top) / safeScaleY);

      node.style.position = 'absolute';
      node.style.margin = '0';

      dragging = {
        node,
        group,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startLeft,
        startTop,
        scaleX: safeScaleX,
        scaleY: safeScaleY
      };

      node.setPointerCapture?.(event.pointerId);
    });

    node.addEventListener('pointermove', event => {
      if (!dragging || dragging.node !== node) return;

      const deltaX =
        (event.clientX - dragging.startClientX) / dragging.scaleX;

      const deltaY =
        (event.clientY - dragging.startClientY) / dragging.scaleY;

      const left = Math.round(dragging.startLeft + deltaX);
      const top = Math.round(dragging.startTop + deltaY);

      node.style.left = `${left}px`;
      node.style.top = `${top}px`;

      const values = state[group] ||= {};
      values.x = left;
      values.y = top;

      changed(state);
    });

    const stopDragging = event => {
      if (!dragging || dragging.node !== node) return;

      try {
        node.releasePointerCapture?.(event.pointerId);
      } catch {}

      dragging = null;
    };

    node.addEventListener('pointerup', stopDragging);
    node.addEventListener('pointercancel', stopDragging);

    node.addEventListener('click', event => {
      event.stopPropagation();
      select(node, group);
    });
  }

  preview.addEventListener('click', event => {
    if (event.target === preview) {
      select(null, null);
    }
  });

  return {
    selectGroup(group) {
      const node = preview.querySelector(targets[group]);
      if (node) select(node, group);
    },

    destroy() {
      if (selected) {
        selected.classList.remove('direct-edit-selected');
      }

      for (const { node } of editableNodes(preview)) {
        node.classList.remove(
          'direct-edit-target',
          'direct-edit-selected'
        );
      }
    }
  };
}

export function setupLocalEditor(
  preview,
  container,
  changed = () => {}
) {
  let directEditor = null;

  const render = selectedGroup => {
    container.replaceChildren();

    for (const group of Object.keys(fields)) {
      const details = document.createElement('details');

      details.open = selectedGroup
        ? group === selectedGroup
        : group === 'headline';

      const summary = document.createElement('summary');

      summary.textContent =
        group === 'copy'
          ? 'Supporting Copy'
          : group.toUpperCase();

      details.append(summary);

      const values = state[group] ||= {};

      for (const key of fields[group]) {
        const wrap = document.createElement('label');
        wrap.textContent = label(key);

        let input;

        if (key === 'show') {
          input = document.createElement('select');
          input.innerHTML =
            '<option value="on">On</option>' +
            '<option value="off">Off</option>';

        } else if (
          key === 'color' ||
          key === 'background'
        ) {
          input = document.createElement('input');
          input.type = 'color';

          input.value =
            values[key] ||
            (key === 'background'
              ? '#50c4f8'
              : '#101d30');

        } else if (key === 'fontFamily') {
          input = document.createElement('select');

          input.innerHTML =
            '<option value="">Default</option>' +
            '<option>Arial</option>' +
            '<option>Georgia</option>' +
            '<option>Helvetica</option>';

        } else if (key === 'fontWeight') {
          input = document.createElement('select');

          input.innerHTML =
            '<option value="">Default</option>' +
            '<option value="400">Regular</option>' +
            '<option value="500">Medium</option>' +
            '<option value="700">Bold</option>' +
            '<option value="800">Extra Bold</option>';

        } else if (key === 'textAlign') {
          input = document.createElement('select');

          input.innerHTML =
            '<option value="">Default</option>' +
            '<option value="left">Left</option>' +
            '<option value="center">Center</option>' +
            '<option value="right">Right</option>';

        } else {
          input = document.createElement('input');
          input.type = 'number';

          input.min =
            key === 'lineHeight'
              ? '0.8'
              : '1';

          input.max =
            key === 'lineHeight'
              ? '2'
              : '500';

          input.step =
            key === 'lineHeight'
              ? '0.1'
              : '1';
        }

        input.value = values[key] || '';

        input.oninput = () => {
          values[key] = input.value;
          applyLocalEdits(preview, state);
          changed(state);
        };

        wrap.append(input);
        details.append(wrap);
      }

      details.addEventListener('toggle', () => {
        if (details.open) {
          directEditor?.selectGroup(group);
        }
      });

      container.append(details);
    }
  };

  directEditor = makeDirectlyEditable(
    preview,
    changed,
    group => render(group)
  );

  render();

  return {
    reset: () => {
      directEditor?.destroy();

      resetLocalEdits(preview);

      directEditor = makeDirectlyEditable(
        preview,
        changed,
        group => render(group)
      );

      render();
      changed(state);
    },

    getState: () => state,

    select: group => directEditor?.selectGroup(group)
  };
}