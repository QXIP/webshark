const HIGHLIGHT_COLORS = ['yellow', '#ffcaca', '#b7f875', '#86f2fb', '#DD99FF', '#eea371'];

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap filter matches in highlight spans. Text and filter fragments are escaped first. */
export function highlightFilteredHtml(text: unknown, filter: string, isRedial = false): string {
  let outText = escapeHtml(text);
  if (!filter) {
    return outText;
  }
  filter.split('||').forEach((fragment, key) => {
    if (!fragment) {
      return;
    }
    const escaped = escapeHtml(fragment);
    const color = HIGHLIGHT_COLORS[key % HIGHLIGHT_COLORS.length];
    const redial = isRedial ? 'border-radius: 4px;' : 'color: black; border-radius: 2px;';
    const tag = `<span style="background-color: ${color};${redial}">${escaped}</span>`;
    if (outText.includes(escaped)) {
      outText = outText.replaceAll(escaped, tag);
    }
  });
  return outText;
}
