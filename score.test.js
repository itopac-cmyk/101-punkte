const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('./score.js', 'utf8'), context);
const Score = context.Score;

function blank() {
  return Array.from({ length: 11 }, () => [null, null]);
}

const scores = blank();
scores[0] = [40, 25];
scores[1] = [10, -101];
scores[2] = [0, 30];
scores[3] = [20, 15];
assert.strictEqual(Score.blockSum(scores, 0, 0, 4), 70);
assert.strictEqual(Score.blockSum(scores, 1, 0, 4), -31);
assert.strictEqual(Score.running(scores, 0, 3), 70);
assert.strictEqual(Score.running(scores, 1, 1), -76);
assert.strictEqual(Score.running(scores, 0, 4), null);
assert.strictEqual(Score.total(scores, 0), 70);
assert.strictEqual(Score.firstTenComplete(scores), false);
assert.strictEqual(Score.winner(scores), null);
assert.strictEqual(Score.cleanPrefix(scores), 4);

for (let r = 0; r < 10; r++) {
  if (scores[r][0] == null) scores[r] = [1, 2];
}
assert.strictEqual(Score.firstTenComplete(scores), true);
assert.strictEqual(Score.sumFirstTen(scores, 0), 70 + 6);
assert.strictEqual(Score.isComplete(scores), false);

scores[10] = [5, 5];
const win = Score.winner(scores);
assert.strictEqual(win.kind, 'win');
assert.strictEqual(win.a, 81);
assert.strictEqual(win.b, -14);
assert.strictEqual(win.team, 1);
assert.strictEqual(win.margin, 95);

const tied = blank();
for (let r = 0; r < 11; r++) tied[r] = [3, 3];
assert.strictEqual(Score.winner(tied).kind, 'tie');

const neg = blank();
for (let r = 0; r < 11; r++) neg[r] = [10, 10];
neg[4] = [-101, 80];
const low = Score.winner(neg);
assert.strictEqual(low.team, 0);
assert.strictEqual(low.margin, 80 - -101 + (10 * 10) - (10 * 10));

const partial = blank();
partial[5] = [4, null];
assert.strictEqual(Score.cleanPrefix(partial), -1);
assert.strictEqual(Score.blockSum(partial, 0, 4, 8), 4);
assert.strictEqual(Score.blockSum(partial, 1, 4, 8), null);

console.log('score ok');
