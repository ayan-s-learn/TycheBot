// The battle tracker, constructed in one place for both record versions: @pkmn/client 0.7.4 as is. T10's layer
// (worker/tracker/) replaces it here.
import { Battle as Client } from '@pkmn/client';
import { Generations } from '@pkmn/data';
import { Dex as PkmnDex } from '@pkmn/dex';

export type { Client };
export type ClientPokemon = Client['p1']['team'][number];

// @pkmn/data's default filter drops Past content, and the client then throws on Past Megas (T08).
const NATDEX = new Set([undefined, null, 'Past', 'Unobtainable']);
const gens = new Generations(PkmnDex, d => !!d.exists && NATDEX.has((d as any).isNonstandard));

/** A tracker for one player, fed only that player's stream and requests. */
export const newClient = (side: 'p1' | 'p2') => new Client(gens, side as ID);
