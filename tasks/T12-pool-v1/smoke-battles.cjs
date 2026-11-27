// Plays 200 random-player games between v1 pool teams and counts wins, ties and sim errors.
// Usage, from the root: node tasks/T12-pool-v1/smoke-battles.cjs
const fs = require('fs');
const V = require('path').join(__dirname, '../../vendor/pokemon-showdown/dist/sim/');
const { BattleStream, getPlayerStreams, Teams } = require(V + 'index.js');
const { RandomPlayerAI } = require(V + 'tools/random-player-ai.js');
const teams = fs.readFileSync(require('path').join(__dirname, '../../data/pool/v1/teams.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
(async () => {
  let done = 0, ties = 0, errors = 0;
  for (let g = 0; g < 200; g++) {
    const a = teams[g % 50], b = teams[(g * 7 + 3) % 50];
    const streams = getPlayerStreams(new BattleStream());
    const p1 = new RandomPlayerAI(streams.p1, { seed: [g, 1, 2, 3] }), p2 = new RandomPlayerAI(streams.p2, { seed: [g, 4, 5, 6] });
    void p1.start(); void p2.start();
    let out = '';
    const reader = (async () => { for await (const chunk of streams.omniscient) out += chunk; })();
    void streams.omniscient.write(`>start {"formatid":"gen9nationaldex","seed":[${g},7,8,9]}\n>player p1 {"name":"a","team":"${a.team}"}\n>player p2 {"name":"b","team":"${b.team}"}`);
    await reader;
    if (/\|error\|/.test(out) && !/\[Invalid choice\]/.test(out)) { errors++; console.log(a.id, b.id, out.match(/\|error\|.*/)[0]); }
    if (/\|win\|/.test(out)) done++; else if (/\|tie/.test(out)) ties++;
  }
  console.log(`games finished ${done}, ties ${ties}, errors ${errors}`);
})();
