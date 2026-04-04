import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readLayerToken(name: string) {
  const css = readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
  const match = css.match(new RegExp(`${name}:\\s*(\\d+);`));

  expect(match, `Missing CSS token ${name}`).toBeTruthy();

  return Number(match?.[1]);
}

describe('global overlay z-layer tokens', () => {
  it('keeps lightbox below floating menus and floating menus below toast and tooltip', () => {
    const dialogOverlay = readLayerToken('--z-layer-dialog-overlay');
    const dialog = readLayerToken('--z-layer-dialog');
    const lightbox = readLayerToken('--z-layer-lightbox');
    const floating = readLayerToken('--z-layer-floating');
    const toast = readLayerToken('--z-layer-toast');
    const tooltip = readLayerToken('--z-layer-tooltip');

    expect(dialogOverlay).toBeLessThan(dialog);
    expect(dialog).toBeLessThan(lightbox);
    expect(lightbox).toBeLessThan(floating);
    expect(floating).toBeLessThan(toast);
    expect(toast).toBeLessThan(tooltip);
  });
});
