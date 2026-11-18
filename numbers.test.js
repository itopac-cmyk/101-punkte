const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function load(file, key) {
  const context = {};
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  return context[key];
}

const parse = load('./numbers.js', 'GermanNumbers').parse;

const cases = [
  ['42', 42],
  ['zweiundvierzig', 42],
  ['zwei und vierzig', 42],
  ['hundertfünf', 105],
  ['hundertfuenf', 105],
  ['hundert fünf', 105],
  ['Hundertfünf', 105],
  ['minus 101', -101],
  ['minus einhunderteins', -101],
  ['minus hunderteins', -101],
  ['minus einhundertundeins', -101],
  ['minus hundert eins', -101],
  ['Minus Einundvierzig', -41],
  ['null', 0],
  ['hundert', 100],
  ['einhundert', 100],
  ['zweihundertfünfzig', 250],
  ['einundzwanzig', 21],
  ['dreiunddreißig', 33],
  ['dreiunddreissig', 33],
  ['siebzehn', 17],
  ['sechzehn', 16],
  ['minus hundert', -100],
  ['zwo', 2],
  ['zwölf', 12],
  ['elf', 11],
  ['zehn', 10],
  ['eins', 1],
  ['eine', 1],
  ['ein', 1],
  ['tausend', 1000],
  ['eintausend', 1000],
  ['zweitausend', 2000],
  ['elfhundert', 1100],
  ['eintausendzweihundert', 1200],
  ['hundertundeins', 101],
  ['einhunderteins', 101],
  ['einhundertundeins', 101],
  ['hunderteinundzwanzig', 121],
  ['zweihundertundeins', 201],
  ['neunundneunzig', 99],
  ['achtundachtzig', 88],
  ['sechsundsechzig', 66],
  ['zwanzig', 20],
  ['dreißig', 30],
  ['fünfzig', 50],
  ['einunddreißig', 31],
  ['siebzig', 70],
  ['-101', -101],
  ['−101', -101],
  ['minus101', -101],
  ['101 Punkte', 101],
  ['minus 101 Punkte', -101],
  ['42.', 42],
  ['plus 15', 15],
  ['keine', 0],
  ['nichts', 0],
  ['keine Punkte', 0],
  ['oh', 0],
  ['1.001', 1001],
  ['100 1', 101],
  ['1 0 1', 101],
  ['20 1', 21],
  ['funfzig', 50],
  ['dreisig', 30],
  ['2 hundert', 200],
  ['hundert 5', 105],
  ['das sind zweiundvierzig', 42],
  ['bitte minus zehn', -10],
  ['zwoelf', 12],
  ['minuszwei', -2],
  ['zweihundert', 200],
  ['dreitausendvierhundertfuenfundzwanzig', 3425],
  ['zweitausenddreihundert', 2300],
  ['tausendeins', 1001],
  ['tausendundeins', 1001],
  ['elfhundertfünf', 1105],
  ['einundzwanzighundert', 2100],
  ['hunderttausend', 100000],
  ['', null],
  ['   ', null],
  ['hallo', null],
  ['und', null],
  ['minus', null],
  ['eine million', null],
  ['1,5', null],
  ['1000000', null],
  ['15 15', null],
  ['vierzig zwei', 42],
  ['vierzig und zwei', 42],
  ['vierzigzwei', 42],
  ['zwei vierzig', 42],
  ['zweivierzig', 42],
  ['Minus 42', -42],
  ['minus zweiundvierzig punkte', -42],
  ['vier zwei', 42],
  ['eins null eins', 101],
  ['äh zweiundvierzig bitte', 42],
  ['hundert vierzig zwei', 142],
  ['ok minus hundertfünf', -105],
  ['ja 30', 30]
];

let failed = 0;
for (const [input, expected] of cases) {
  const actual = parse(input);
  if (actual !== expected) {
    failed++;
    console.error('FAIL', JSON.stringify(input), 'expected', expected, 'got', actual);
  }
}

const ones = ['', 'ein', 'zwei', 'drei', 'vier', 'fuenf', 'sechs', 'sieben', 'acht', 'neun'];
const teens = ['zehn', 'elf', 'zwolf', 'dreizehn', 'vierzehn', 'fuenfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const tens = ['', '', 'zwanzig', 'dreissig', 'vierzig', 'fuenfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
function under100(x) {
  if (x < 10) return ones[x];
  if (x < 20) return teens[x - 10];
  const t = Math.floor(x / 10);
  const o = x % 10;
  return (o ? ones[o] + 'und' : '') + tens[t];
}
function under1000(x) {
  const h = Math.floor(x / 100);
  const r = x % 100;
  return (h ? ones[h] + 'hundert' : '') + (r ? under100(r) : '');
}
function spell(n) {
  if (n === 0) return 'null';
  const th = Math.floor(n / 1000);
  const r = n % 1000;
  return (th ? under1000(th) + 'tausend' : '') + (r ? under1000(r) : '');
}

for (let n = 0; n <= 2500; n++) {
  const actual = parse(spell(n));
  if (actual !== n) {
    failed++;
    console.error('ROUNDTRIP', n, spell(n), actual);
    if (failed > 20) break;
  }
}

for (const n of [3000, 3425, 9999, 10101, 100000, 250250]) {
  const actual = parse(spell(n));
  if (actual !== n) {
    failed++;
    console.error('ROUNDTRIP', n, spell(n), actual);
  }
}

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('numbers ok', cases.length, 'cases + roundtrip');
