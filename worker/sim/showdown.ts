// Showdown at the pin (vendor/pokemon-showdown, built by scripts/setup-showdown.sh). Its dist/ is CommonJS
// without ESM export annotations, so it loads with require; named imports fail.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

type PS = typeof import('../../vendor/pokemon-showdown/dist/sim/index.js');
type BattleModule = typeof import('../../vendor/pokemon-showdown/dist/sim/battle.js');
export type Battle = InstanceType<BattleModule['Battle']>;

const require = createRequire(import.meta.url);
const dist = '../../vendor/pokemon-showdown/dist/';
export const { Teams, Dex, PRNG, toID }: PS = require(dist + 'sim/index.js');
export const { Battle, extractChannelMessages }: BattleModule = require(dist + 'sim/battle.js');

export const FORMAT = 'gen9nationaldex' as ID;
export const PIN = readFileSync(new URL('../../showdown.pin', import.meta.url), 'utf8').trim();
