import { describe, expect, test } from 'bun:test';
import { renderPublicPage } from './publicPages.js';

const shell = '<html><body><div id="app-root"></div></body></html>';

describe('renderPublicPage', () => {
  test.each([
    ['/', 'subscription service'],
    ['/pricing', '€5/month'],
    ['/terms', 'merchant of record'],
    ['/privacy', 'Privacy notice'],
    ['/refund-policy', '14 days'],
    ['/contact', 'Contact dkrypt'],
  ])('renders public fallback content for %s', (pathname, expected) => {
    const rendered = renderPublicPage(shell, pathname);

    expect(rendered).toContain('data-app-fallback');
    expect(rendered).toContain(expected);
    expect(rendered).toContain('contact<span>@</span>dylib.dev');
    expect(rendered).not.toContain('<div id="app-root"></div>');
  });
});
