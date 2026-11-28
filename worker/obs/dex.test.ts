import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEX_PATH, dexTables } from './dex.ts';

test('the committed static tables are the Dex at the pin, under the vocab hash', () => {
	assert.equal(readFileSync(DEX_PATH, 'utf8'), JSON.stringify(dexTables()) + '\n', 'rerun node worker/obs/dex.ts');
});
