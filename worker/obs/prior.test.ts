import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Library, normalMove, type Reveal } from './prior.ts';

const LIBRARY = new URL('../../data/priors/v0/species_sets.json', import.meta.url).pathname;
const lib = new Library(LIBRARY);
const none = (keys: string[]): Reveal => ({ keys, item: '', ability: '', mega: '', moves: [] });

test('library keys for species as the protocol shows them', () => {
	assert.deepEqual(lib.keysFor('Urshifu-*'), ['Urshifu-Rapid-Strike']);
	assert.deepEqual(lib.keysFor('Urshifu-Rapid-Strike'), ['Urshifu-Rapid-Strike']);
	assert.deepEqual(lib.keysFor('Urshifu'), []); // Single Strike has no library set
	assert.deepEqual(lib.keysFor('Zamazenta-*'), ['Zamazenta']);
	assert.deepEqual(lib.keysFor('Greninja-*'), ['Greninja-Bond']);
	assert.deepEqual(lib.keysFor('Greninja'), ['Greninja-Bond']);
	assert.deepEqual(lib.keysFor('Charizard-Mega-X'), ['Charizard']);
	assert.deepEqual(lib.keysFor('Charizard'), ['Charizard']);
	assert.equal(normalMove('hiddenpowerice60'), 'hiddenpower');
	assert.equal(normalMove('return102'), 'return');
});

test('the prior is the first consistent set in file order', () => {
	const sets = lib.sets.get('Charizard')!;
	assert.equal(lib.prior(none(['Charizard'])).set, sets[0]);
	for (const s of sets) {
		const r: Reveal = { keys: ['Charizard'], item: s.item, ability: s.ability, mega: '', moves: [...s.moves].sort() };
		const first = sets.find(t => Library.consistent(t, r))!;
		assert.equal(lib.prior(r).set, first);
		assert.equal(first.item, s.item);
	}
	// Mega Evolving into Y rules out the X sets, whatever else is shown.
	const y = lib.prior({ ...none(['Charizard']), mega: 'Charizard-Mega-Y' }).set!;
	assert.equal(y.mega, 'Charizard-Mega-Y');
	assert.equal(y, sets.find(s => s.mega === 'Charizard-Mega-Y'));
	// Nothing is consistent with a move no set has.
	assert.deepEqual(lib.prior({ ...none(['Charizard']), moves: ['splash'] }), { set: null, confidence: 0 });
	// Hidden Power matches any type.
	const heatran = lib.sets.get('Heatran')!.find(s => s.moves.has('hiddenpower'))!;
	assert.ok(Library.consistent(heatran, { ...none(['Heatran']), moves: ['hiddenpower'] }));
});

test('confidence: the chosen combination\'s share of the consistent weight', () => {
	for (const key of lib.sets.keys()) {
		const sets = lib.sets.get(key)!;
		const { set, confidence } = lib.prior(none([key]));
		const total = sets.reduce((a, s) => a + s.weight, 0);
		const combo = sets.filter(s => s.combo === set!.combo).reduce((a, s) => a + s.weight, 0);
		assert.ok(Math.abs(confidence - combo / total) < 1e-12, key);
		// T12 sorted the file by combination weight, so the combinations here are T12's.
		for (let i = 1; i < sets.length; i++) assert.ok(sets[i].comboWeight <= sets[i - 1].comboWeight + 1e-9, `${key} ${i}`);
	}
});

test('a hidden forme: the heaviest consistent combination across its base species\' keys', () => {
	// Two keys of one base species. Urshifu's best combination (0.5) outweighs Rapid-Strike's best (0.4), until
	// a move only Rapid-Strike's sets have is shown.
	const set = (species: string, item: string, moves: string) => `${species}||${item}|UnseenFist|${moves}|Jolly|,252,,,4,252|||||`;
	const file = {
		species: {
			'Urshifu-Rapid-Strike': [
				{ set: set('Urshifu-Rapid-Strike', 'ChoiceBand', 'CloseCombat,SurgingStrikes,Uturn,AquaJet'), weight: 0.25, statsSpecies: 'Urshifu-Rapid-Strike' },
				{ set: set('Urshifu-Rapid-Strike', 'ChoiceBand', 'CloseCombat,SurgingStrikes,Uturn,AquaJet').replace('Jolly', 'Adamant'), weight: 0.15, statsSpecies: 'Urshifu-Rapid-Strike' },
				{ set: set('Urshifu-Rapid-Strike', 'ChoiceScarf', 'CloseCombat,SurgingStrikes,Uturn,IceSpinner'), weight: 0.1, statsSpecies: 'Urshifu-Rapid-Strike' },
			],
			Urshifu: [
				{ set: set('Urshifu', 'ChoiceBand', 'CloseCombat,WickedBlow,Uturn,SuckerPunch'), weight: 0.5, statsSpecies: 'Urshifu' },
			],
		},
	};
	const path = join(mkdtempSync(join(tmpdir(), 'prior-test-')), 'species_sets.json');
	writeFileSync(path, JSON.stringify(file));
	const two = new Library(path);
	const keys = two.keysFor('Urshifu-*');
	assert.deepEqual([...keys].sort(), ['Urshifu', 'Urshifu-Rapid-Strike']);
	let p = two.prior(none(keys));
	assert.equal(p.set!.key, 'Urshifu');
	assert.ok(Math.abs(p.confidence - 0.5 / 1.0) < 1e-12);
	p = two.prior({ ...none(keys), moves: ['closecombat', 'surgingstrikes'] });
	assert.equal(p.set, two.sets.get('Urshifu-Rapid-Strike')![0]); // its combination is 0.4, and its first set
	assert.ok(Math.abs(p.confidence - 0.4 / 0.5) < 1e-12);
	p = two.prior({ ...none(keys), item: 'choicescarf' });
	assert.equal(p.set, two.sets.get('Urshifu-Rapid-Strike')![2]);
	assert.equal(p.confidence, 1);
});
