import { formatPresets, normalizeFormat, canvasDimensions, formatPath, resizeNativePreview, setCanvasDimensions } from './design-format.js';

// Format versions retain the rendered editor DOM and the existing generation state.
export function setupDesignReformat(adapter) {
  const panel = document.querySelector('#design-reformat');
  const preset = panel.querySelector('#design-format');
  const custom = panel.querySelector('#design-custom-size');
  const action = panel.querySelector('#design-format-action');
  const apply = panel.querySelector('#design-format-apply');
  const history = panel.querySelector('#design-format-versions');
  const previous = panel.querySelector('#design-format-previous');
  const nextButton = panel.querySelector('#design-format-next');
  const active = panel.querySelector('#design-format-active');
  let versions = [], current = -1, busy = false;
  for (const item of formatPresets) preset.add(new Option(`${item.label} — ${item.width} × ${item.height}`, item.id));
  preset.add(new Option('Custom', 'custom'));
  preset.value = 'story';
  preset.addEventListener('change', () => { custom.hidden = preset.value !== 'custom'; });

  const label = (name, size) => `${name} — ${size.width} × ${size.height}`;
  function sync() {
    history.replaceChildren(...versions.map((version, index) => new Option(version.label, String(index))));
    history.value = String(current);
    const full = adapter.mode() === 'full-ai-artwork';
    action.closest('label').hidden = !full;
    apply.textContent = full ? 'Create Format Version' : 'Resize as New Version';
    apply.disabled = busy;
    history.disabled = busy;
    previous.disabled = busy || current <= 0;
    nextButton.disabled = busy || current >= versions.length - 1;
    const size = canvasDimensions(current >= 0 ? versions[current].preview : adapter.preview());
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = gcd(size.width, size.height);
    active.textContent = `${size.width} × ${size.height} · ${size.width / divisor}:${size.height / divisor}`;
  }
  function snapshot(name) {
    const result = adapter.capture();
    return { ...result, label: label(name, canvasDimensions(result.preview)) };
  }
  function saveCurrent() {
    if (current >= 0) versions[current] = { ...adapter.capture(), label: versions[current].label };
  }
  function switchVersion(next) {
    if (busy) return;
    if (!versions[next]) return;
    saveCurrent(); current = next;
    adapter.restore(versions[next]); sync();
  }
  history.addEventListener('change', () => switchVersion(Number(history.value)));
  previous.addEventListener('click', () => switchVersion(current - 1));
  nextButton.addEventListener('click', () => switchVersion(current + 1));
  apply.addEventListener('click', async () => {
    if (busy || !adapter.available()) return;
    let target;
    try { target = normalizeFormat(preset.value, panel.querySelector('#design-width').value, panel.querySelector('#design-height').value); }
    catch (error) { adapter.status(error.message); return; }
    if (!versions.length) { versions.push(snapshot('Original')); current = 0; }
    saveCurrent();
    const original = versions[current];
    busy = true; sync(); adapter.busy(true);
    adapter.status(formatPath(adapter.mode(), action.value) === 'ai-reformat' ? 'Reformatting artwork for the new canvas…' : 'Recomposing editable objects…');
    try {
      // Measure the currently mounted canvas before cloning/replacing it.
      const result = { ...original, preview: resizeNativePreview(adapter.preview(), target, original.preview.cloneNode(true)) };
      if (original.aiDesign) result.aiDesign = { ...original.aiDesign, targetCanvas: target };
      if (formatPath(adapter.mode(), action.value) === 'ai-reformat') {
        const generated = await adapter.reformat(original, target);
        result.aiDesign = generated;
        result.preview.style.background = `url("${generated.image}") center / contain no-repeat #FFFFFF`;
        result.preview.dataset.generationContext = JSON.stringify({ plan: generated.plan, planId: generated.planId, value: original.value });
      }
      // Fit Original uses the exact existing flattened background with contain.
      setCanvasDimensions(result.preview, target);
      result.preview.dataset.formatAction = action.value;
      result.preview.dataset.designMode = adapter.mode();
      result.label = label(target.label + (adapter.mode() === 'full-ai-artwork' ? action.value === 'fit' ? ' · Fit Original' : ' · Reformat' : ''), target);
      versions.push(result); current = versions.length - 1;
      adapter.restore(result);
      adapter.status('New format ready. The original is available in Format Versions.');
    } catch (error) { adapter.status(error.message + ' The original design is unchanged.'); }
    finally { busy = false; adapter.busy(false); sync(); }
  });
  return {
    reset() {
      if (busy) return;
      versions = []; current = -1;
      panel.hidden = !adapter.available(); sync();
    }
  };
}
