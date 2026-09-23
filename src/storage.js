const KEY = 'upplai-design-studio:form:v1';

export function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return { value: value && typeof value === 'object' && !Array.isArray(value) ? value : {}, available: true };
  } catch {
    return { value: {}, available: false };
  }
}

export function saveState(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
