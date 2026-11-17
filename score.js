/* Pure scoring helpers for an 11-round, two-team 101 sheet. */
(function (root) {
  var ROUNDS = 11;

  function sumRange(scores, team, start, end) {
    var sum = 0;
    var any = false;
    for (var i = start; i < end; i++) {
      var value = scores[i][team];
      if (value != null) {
        sum += value;
        any = true;
      }
    }
    return any ? sum : null;
  }

  function total(scores, team) {
    var sum = sumRange(scores, team, 0, ROUNDS);
    return sum == null ? 0 : sum;
  }

  function running(scores, team, round) {
    if (scores[round][team] == null) return null;
    return sumRange(scores, team, 0, round + 1);
  }

  function blockSum(scores, team, start, end) {
    return sumRange(scores, team, start, end);
  }

  function countFilled(scores, team) {
    var n = 0;
    for (var i = 0; i < ROUNDS; i++) {
      if (scores[i][team] != null) n++;
    }
    return n;
  }

  function isComplete(scores) {
    for (var r = 0; r < ROUNDS; r++) {
      if (scores[r][0] == null || scores[r][1] == null) return false;
    }
    return true;
  }

  function firstTenComplete(scores) {
    for (var r = 0; r < 10; r++) {
      if (scores[r][0] == null || scores[r][1] == null) return false;
    }
    return true;
  }

  function sumFirstTen(scores, team) {
    return sumRange(scores, team, 0, 10);
  }

  function cleanPrefix(scores) {
    var n = 0;
    for (var r = 0; r < ROUNDS; r++) {
      if (scores[r][0] == null || scores[r][1] == null) break;
      n++;
    }
    for (var i = n; i < ROUNDS; i++) {
      if (scores[i][0] != null || scores[i][1] != null) return -1;
    }
    return n;
  }

  function winner(scores) {
    if (!isComplete(scores)) return null;
    var a = total(scores, 0);
    var b = total(scores, 1);
    if (a === b) return { kind: 'tie', a: a, b: b, margin: 0 };
    var team = a < b ? 0 : 1;
    return { kind: 'win', team: team, a: a, b: b, margin: Math.abs(a - b) };
  }

  root.Score = {
    ROUNDS: ROUNDS,
    sumRange: sumRange,
    total: total,
    running: running,
    blockSum: blockSum,
    countFilled: countFilled,
    isComplete: isComplete,
    firstTenComplete: firstTenComplete,
    sumFirstTen: sumFirstTen,
    cleanPrefix: cleanPrefix,
    winner: winner
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
