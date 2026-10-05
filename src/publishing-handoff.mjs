// The sender waits for Publishing to persist and render the media. A DOM event
// alone is synchronous and cannot report failures from its async listener.
export function handoffToPublishing(detail, target = document) {
  return new Promise((resolve, reject) => {
    target.dispatchEvent(new CustomEvent('publishing:generated', { detail: { ...detail, completion: { resolve, reject } } }));
  });
}
