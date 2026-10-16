import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KinetiCanvasStudio from './KinetiCanvasStudio.svelte';

describe('KinetiCanvasStudio.svelte', () => {
	it('renders the studio and switches tools', async () => {
		render(KinetiCanvasStudio);

		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('KinetiCanvas AR.STUDIO');

		const harp = page.getByRole('button', { name: 'Harp Strings' });
		const radar = page.getByRole('button', { name: 'Radar Rings' });
		await expect.element(harp).toHaveAttribute('aria-pressed', 'true');

		await radar.click();
		await expect.element(radar).toHaveAttribute('aria-pressed', 'true');
		await expect.element(harp).toHaveAttribute('aria-pressed', 'false');
	});

	it('loads the default preset and clears it', async () => {
		render(KinetiCanvasStudio);

		const status = page.getByRole('status');
		await expect.element(status).toHaveTextContent('Loaded Preset: Hybrid AR Symphony');

		await page.getByRole('button', { name: 'Clear all shapes' }).click();
		await expect.element(status).toHaveTextContent('Cleared all shapes');
	});
});
