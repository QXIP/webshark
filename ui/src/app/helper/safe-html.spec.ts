import { escapeHtml, highlightFilteredHtml } from './safe-html';

describe('safe-html', () => {
  it('escapes HTML meta characters', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
  });

  it('highlights matches without interpolating raw filter HTML', () => {
    const html = highlightFilteredHtml('<script>alert(1)</script>', '<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('background-color: yellow');
  });

  it('returns escaped text when the filter is empty', () => {
    expect(highlightFilteredHtml('a < b', '')).toBe('a &lt; b');
  });
});
