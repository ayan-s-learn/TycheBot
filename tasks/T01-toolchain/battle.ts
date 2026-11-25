// In-process gen9nationaldex games between Showdown's random players (RandomPlayerAI), checking the
// sim APIs that the spikes and later phases rely on, at the pinned Showdown build.
//   1. sim/tools/runner.ts: games through BattleStream, as S1 starts from.
//   2. Battle driven directly, as S1's other candidate: per-player streams from extractChannelMessages,
//      and a copy round-tripped through Battle.toJSON/fromJSON (sim/state.ts) after every choice must
//      end with the same log and state as the original.
//   3. sim/tools/exhaustive-runner.ts: a few games, to show it runs on gen9nationaldex.
// Usage: node battle.ts [games]   (exit code 1 if any check fails)
import { deepStrictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

type PS = typeof import('./vendor/pokemon-showdown/dist/sim/index.js');
type BattleModule = typeof import('./vendor/pokemon-showdown/dist/sim/battle.js');
type StateModule = typeof import('./vendor/pokemon-showdown/dist/sim/state.js');
type RunnerModule = typeof import('./vendor/pokemon-showdown/dist/sim/tools/runner.js');
type AIModule = typeof import('./vendor/pokemon-showdown/dist/sim/tools/random-player-ai.js');
type ExhaustiveModule = typeof import('./vendor/pokemon-showdown/dist/sim/tools/exhaustive-runner.js');
type RandomPlayerAI = InstanceType<AIModule['RandomPlayerAI']>;
type Seed = `sodium,${string}`;

// Showdown's dist/ is CommonJS without ESM export annotations, so load it with require.
const require = createRequire(import.meta.url);
const dist = './vendor/pokemon-showdown/dist/';
const { Teams }: PS = require(dist + 'sim/index.js');
const { Battle, extractChannelMessages }: BattleModule = require(dist + 'sim/battle.js');
const { State }: StateModule = require(dist + 'sim/state.js');
const { Runner }: RunnerModule = require(dist + 'sim/tools/runner.js');
const { RandomPlayerAI }: AIModule = require(dist + 'sim/tools/random-player-ai.js');
const { ExhaustiveRunner }: ExhaustiveModule = require(dist + 'sim/tools/exhaustive-runner.js');

const FORMAT = 'gen9nationaldex' as ID;
const games = Number(process.argv[2] ?? 20);
const seed = (n: number): Seed => `sodium,${n.toString(16).padStart(64, '0')}`;
const team = (file: string) => Teams.import(readFileSync(new URL(`teams/${file}`, import.meta.url), 'utf8'))!;
const [team1, team2] = [team('sample-1.txt'), team('sample-2.txt')];

function summarize(log: string[]) {
	return {
		end: log.find(l => l.startsWith('|win|') || l === '|tie'),
		turns: log.filter(l => l.startsWith('|turn|')).length,
		mega: log.filter(l => l.startsWith('|-mega|')).length,
		zmove: log.filter(l => l.startsWith('|-zpower|')).length,
	};
}

let failures = 0;
function report(label: string, results: ReturnType<typeof summarize>[]) {
	const finished = results.filter(r => r.end).length;
	const sum = (k: 'turns' | 'mega' | 'zmove') => results.reduce((a, r) => a + r[k], 0);
	console.log(`${label}: ${finished}/${results.length} games finished; ${sum('turns')} turns, ` +
		`${sum('mega')} mega evolutions, ${sum('zmove')} z-moves`);
	failures += results.length - finished;
}

// 1. runner.ts
const runnerResults = [];
for (let i = 0; i < games; i++) {
	const players: RandomPlayerAI[] = [];
	const createAI: (typeof Runner.AI_OPTIONS)['createAI'] = (stream, options) => {
		const ai = new RandomPlayerAI(stream, options);
		players.push(ai);
		return ai;
	};
	await new Runner({
		format: FORMAT, prng: seed(i), error: true,
		p1options: { team: team1, createAI }, p2options: { team: team2, createAI },
	}).run();
	runnerResults.push(summarize(players[0].log));
}
report('runner.ts (BattleStream)', runnerResults);

// 2. Battle direct, with a State round-trip copy
function directGame(n: number) {
	const control = new Battle({ formatid: FORMAT, seed: seed(n) });
	let copy = new Battle({ formatid: FORMAT, seed: seed(n) });
	for (const battle of [control, copy]) {
		battle.setPlayer('p1', { name: 'p1', team: team1 });
		battle.setPlayer('p2', { name: 'p2', team: team2 });
	}
	let choice = '';
	const capture = { write: (c: string) => { choice = c; } } as any;
	const ais = [1, 2].map(k => new RandomPlayerAI(capture, { ...Runner.AI_OPTIONS, seed: seed(1000 * n + k) }));
	while (!control.ended) {
		for (const [i, side] of control.sides.entries()) {
			const request = side.activeRequest;
			if (!request || request.wait) continue;
			ais[i].receiveRequest(JSON.parse(JSON.stringify(request)));
			control.choose(side.id, choice);
			copy.choose(side.id, choice);
			copy = Battle.fromJSON(copy.toJSON());
		}
	}
	deepStrictEqual(State.normalizeLog(copy.log), State.normalizeLog(control.log));
	deepStrictEqual(State.normalize(copy.toJSON()), State.normalize(control.toJSON()));

	const channels = extractChannelMessages(control.log.join('\n'), [0, 1, 2]);
	const splits = control.log.filter(l => l.startsWith('|split|')).length;
	// Each |split| block is 3 log lines that become 1 line per channel, and p1's and p2's views differ.
	deepStrictEqual(channels[1].length, control.log.length - 2 * splits);
	if (!splits || channels[1].join() === channels[2].join()) throw new Error('per-player streams look wrong');
	return summarize(control.log);
}
report('Battle direct + extractChannelMessages + State round-trip', Array.from({ length: games }, (_, i) => directGame(i)));

// 3. exhaustive-runner.ts. Its pools drop isNonstandard content, so on NatDex it skips Megas, Z-Crystals
// and Past Pokemon until it is adapted (plan.md, Phase 1).
const exhaustiveFailures = await new ExhaustiveRunner({ format: FORMAT, maxGames: 5, prng: seed(99) }).run();
console.log(`exhaustive-runner.ts: 5 games, ${exhaustiveFailures} failures`);
failures += exhaustiveFailures;

process.exit(failures ? 1 : 0);
