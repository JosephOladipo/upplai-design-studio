// ==========================================================
// CALENDAR -> FULL CREATE EDITOR
// ==========================================================

document.addEventListener('calendar:design-edit', event => {
  const sourcePreview = event.detail?.preview;
  const calendarId = event.detail?.id;

  if (!sourcePreview || !calendarId) return;

  // Copy the generated Calendar design into Create's
  // real 1080 x 1350 preview canvas.
  preview.className = sourcePreview.className;
  preview.innerHTML = sourcePreview.innerHTML;

  // Remove old inline styles from Create before
  // copying the generated design styles.
  preview.removeAttribute('style');

  for (const property of sourcePreview.style) {
    preview.style.setProperty(
      property,
      sourcePreview.style.getPropertyValue(property),
      sourcePreview.style.getPropertyPriority(property)
    );
  }

  // Remove old data-* attributes that do not belong
  // to the imported Calendar design.
  for (const attribute of [...preview.attributes]) {
    if (
      attribute.name.startsWith('data-') &&
      !sourcePreview.hasAttribute(attribute.name)
    ) {
      preview.removeAttribute(attribute.name);
    }
  }

  // Copy data-* attributes from the Calendar design.
  for (const attribute of [...sourcePreview.attributes]) {
    if (attribute.name.startsWith('data-')) {
      preview.setAttribute(
        attribute.name,
        attribute.value
      );
    }
  }

  preview.style.visibility = 'visible';

  // Start a fresh local-editing session
  // using the imported Calendar design.
  beginLocalEdits(preview);
  localEditor = null;

  frame.hidden = false;
  frame.classList.remove('invalid');

  // Preserve the design style so Create knows
  // which type of design is being edited.
  currentStyle =
    sourcePreview.classList.contains('openai-style')
      ? 'openai-style'
      : [...sourcePreview.classList].find(name =>
          designStyles.some(style => style.id === name)
        ) || 'calendar-design';

  // Remember which Calendar item owns this design.
  // We will use this when we add Save Back to Calendar.
  sessionStorage.setItem(
    'upplai-calendar-design-edit',
    calendarId
  );

  // Calendar-table.js has already opened Create.
  // Now open Create's normal full editor.
  editorPanel.hidden = false;
  editDesign.hidden = false;
  zoomControls.hidden = false;

  stage.style.transform = 'none';

  localEditor = setupLocalEditor(
    preview,
    editorControls
  );

  requestAnimationFrame(fitCanvasZoom);

  status.textContent =
    'Editing Calendar design in the full Design Editor.';
});