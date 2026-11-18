/* Parses German integers spoken or typed for a score cell. */
(function (root) {
  var ONES = [
    ['sieben', 7],
    ['sechs', 6],
    ['neun', 9],
    ['vier', 4],
    ['fuenf', 5],
    ['drei', 3],
    ['zwei', 2],
    ['eins', 1],
    ['eine', 1],
    ['acht', 8],
    ['null', 0],
    ['zwo', 2],
    ['ein', 1]
  ];

  var TENS = [
    ['dreissig', 30],
    ['fuenfzig', 50],
    ['vierzig', 40],
    ['sechzig', 60],
    ['siebzig', 70],
    ['achtzig', 80],
    ['neunzig', 90],
    ['zwanzig', 20]
  ];

  var STEPS = [
    ['fuenfzehn', 15],
    ['dreizehn', 13],
    ['vierzehn', 14],
    ['sechzehn', 16],
    ['siebzehn', 17],
    ['achtzehn', 18],
    ['neunzehn', 19],
    ['dreissig', 30],
    ['fuenfzig', 50],
    ['vierzig', 40],
    ['sechzig', 60],
    ['siebzig', 70],
    ['achtzig', 80],
    ['neunzig', 90],
    ['zwanzig', 20],
    ['zwolf', 12],
    ['zehn', 10],
    ['elf', 11]
  ];

  var EXACT = {
    keine: 0,
    nichts: 0,
    null: 0,
    zero: 0,
    oh: 0
  };

  function matchList(s, i, list) {
    var best = null;
    for (var n = 0; n < list.length; n++) {
      var word = list[n][0];
      if (s.startsWith(word, i) && (!best || word.length > best.len)) {
        best = { v: list[n][1], len: word.length };
      }
    }
    return best;
  }

  function parseBelow100(s, i) {
    var one = matchList(s, i, ONES);
    if (one && one.v >= 1 && one.v <= 9 && s.startsWith('und', i + one.len)) {
      var ten = matchList(s, i + one.len + 3, TENS);
      if (ten) return { v: one.v + ten.v, len: one.len + 3 + ten.len };
    }
    var step = matchList(s, i, STEPS);
    if (step) return step;
    if (one) return one;
    return null;
  }

  function parseUnder1000(s, i) {
    var idx = i;
    var value = 0;
    var one = matchList(s, idx, ONES);
    var hPos = idx;
    var mult = 1;
    if (one && one.v >= 1 && one.v <= 9 && s.startsWith('hundert', idx + one.len)) {
      mult = one.v;
      hPos = idx + one.len;
    }
    if (s.startsWith('hundert', hPos)) {
      value += mult * 100;
      idx = hPos + 7;
      var restAt = idx;
      if (s.startsWith('und', idx)) restAt = idx + 3;
      var rest = parseBelow100(s, restAt);
      if (rest) {
        value += rest.v;
        idx = restAt + rest.len;
      }
      return { v: value, len: idx - i };
    }
    return parseBelow100(s, i);
  }

  function parseGlued(s) {
    if (!s) return null;
    if (Object.prototype.hasOwnProperty.call(EXACT, s)) return EXACT[s];

    var idx = 0;
    var total = 0;

    if (s.startsWith('tausend')) {
      total = 1000;
      idx = 7;
    } else {
      var lead = parseUnder1000(s, 0);
      if (lead && lead.v > 0 && s.startsWith('tausend', lead.len)) {
        total = lead.v * 1000;
        idx = lead.len + 7;
      } else if (lead && lead.v > 9 && s.startsWith('hundert', lead.len)) {
        total = lead.v * 100;
        idx = lead.len + 7;
      } else if (lead && lead.len === s.length) {
        return lead.v;
      } else {
        return null;
      }
    }

    if (s.startsWith('und', idx)) idx += 3;
    if (idx === s.length) return total;
    var tail = parseUnder1000(s, idx);
    if (!tail || idx + tail.len !== s.length) return null;
    return total + tail.v;
  }

  function spell(n) {
    if (!Number.isInteger(n) || n < 0 || n > 999999) return null;
    var ones = ['', 'ein', 'zwei', 'drei', 'vier', 'fuenf', 'sechs', 'sieben', 'acht', 'neun'];
    var teens = ['zehn', 'elf', 'zwolf', 'dreizehn', 'vierzehn', 'fuenfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
    var tens = ['', '', 'zwanzig', 'dreissig', 'vierzig', 'fuenfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
    function under100(x) {
      if (x < 10) return ones[x];
      if (x < 20) return teens[x - 10];
      var t = Math.floor(x / 10);
      var o = x % 10;
      return (o ? ones[o] + 'und' : '') + tens[t];
    }
    function under1000(x) {
      var h = Math.floor(x / 100);
      var r = x % 100;
      var out = '';
      if (h) out += ones[h] + 'hundert';
      if (r) out += under100(r);
      return out;
    }
    if (n === 0) return 'null';
    var th = Math.floor(n / 1000);
    var r = n % 1000;
    var out = '';
    if (th) out += under1000(th) + 'tausend';
    if (r) out += under1000(r);
    return out;
  }

  function normalize(raw) {
    var s = String(raw).toLowerCase().trim();
    s = s.replace(/ß/g, 'ss');
    s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
    s = s.replace(/[−–—]/g, '-');
    s = s.replace(/[;:!?„“”"'»«()[\]]+/g, ' ');
    if (/\d,\d/.test(s)) return 'komma';
    s = s.replace(/,/g, ' ');
    while (/\d\.\d{3}(?!\d)/.test(s)) {
      s = s.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');
    }
    if (/\d\.\d/.test(s)) return 'komma';
    s = s.replace(/\./g, ' ');
    s = s.replace(/\b(punkte?|strafpunkte?|bonuspunkte?|bitte|danke|genau|also|aeh|aehm|hmm+|hm|ja|okay|ok|halt|mal|naja|eigentlich|dann|fuer|team)\b/g, ' ');
    s = s.replace(/funf/g, 'fuenf');
    s = s.replace(/dreisig/g, 'dreissig');
    s = s.replace(/zwoelf/g, 'zwolf');
    s = s.replace(/([a-z])-([a-z])/g, '$1$2');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function stripLeadPhrases(s) {
    var prev;
    do {
      prev = s;
      s = s.replace(/^(das sind|das ist|es sind|es ist|macht|ergibt|noch)\s+/, '');
    } while (s !== prev);
    return s;
  }

  function placeOf(n) {
    if (n <= 0) return 0;
    return Math.pow(10, Math.floor(Math.log10(n)));
  }

  function parsePureDigits(s) {
    var tokens = s.split(/\s+/).filter(Boolean);
    if (!tokens.length || !tokens.every(function (t) { return /^\d+$/.test(t); })) return null;
    if (tokens.length === 1 || tokens.every(function (t) { return t.length === 1; })) {
      return Number(tokens.join(''));
    }
    var total = 0;
    var last = Infinity;
    for (var i = 0; i < tokens.length; i++) {
      var n = Number(tokens[i]);
      var place = placeOf(n);
      if (place >= last) return null;
      total += n;
      last = place;
    }
    return total;
  }

  function repairGerman(glued) {
    var tens = 'zwanzig|dreissig|vierzig|fuenfzig|sechzig|siebzig|achtzig|neunzig';
    var ones = 'eins|eine|ein|zwei|zwo|drei|vier|fuenf|sechs|sieben|acht|neun';
    var tensThenOne = new RegExp('(' + tens + ')(?:und)?(' + ones + ')(?!zig|zehn|und)', 'g');
    var oneThenTens = new RegExp('(' + ones + ')(?!und)(' + tens + ')', 'g');
    var s = glued.replace(tensThenOne, function (_, ten, one) {
      var o = (one === 'eins' || one === 'eine') ? 'ein' : one;
      return o + 'und' + ten;
    });
    return s.replace(oneThenTens, '$1und$2');
  }

  function isSingleDigit(n) {
    return n >= 0 && n <= 9;
  }

  function isExactTen(n) {
    return n >= 20 && n < 100 && n % 10 === 0;
  }

  function parseLoose(s) {
    var tokens = s.split(/\s+/).filter(function (t) { return t && t !== 'und'; });
    if (!tokens.length) return null;
    var nums = [];
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var n = /^\d+$/.test(token) ? Number(token) : parseGlued(repairGerman(token));
      if (n == null) n = parseGlued(token);
      if (n == null) return null;
      nums.push(n);
    }
    if (nums.length > 1 && nums.every(isSingleDigit)) {
      return Number(nums.join(''));
    }
    var merged = [];
    for (var j = 0; j < nums.length; j++) {
      var a = nums[j];
      var b = nums[j + 1];
      if (b != null && ((isExactTen(a) && isSingleDigit(b) && b > 0) || (isSingleDigit(a) && a > 0 && isExactTen(b)))) {
        merged.push(a + b);
        j++;
      } else {
        merged.push(a);
      }
    }
    if (merged.length === 1) return merged[0];
    return parsePureDigits(merged.join(' '));
  }

  function parseGermanNumber(input) {
    if (input == null) return null;
    var s = stripLeadPhrases(normalize(input));
    if (!s) return null;

    var neg = false;
    while (s) {
      if (s.charAt(0) === '-') {
        neg = !neg;
        s = s.slice(1).trim();
        continue;
      }
      if (s.startsWith('minus')) {
        neg = !neg;
        s = s.slice(5).trim();
        continue;
      }
      if (s.startsWith('negativ') && (s.length === 7 || !/[a-z]/.test(s.charAt(7)))) {
        neg = !neg;
        s = s.slice(7).trim();
        continue;
      }
      if (s.startsWith('plus') && (s.length === 4 || !/[a-z]/.test(s.charAt(4)))) {
        s = s.slice(4).trim();
        continue;
      }
      break;
    }
    if (!s || /\bkomma\b/.test(s)) return null;

    var value = null;
    if (!/[a-z]/.test(s)) {
      value = parsePureDigits(s);
    } else {
      var spelled = s.replace(/\d+/g, function (d) {
        var word = spell(Number(d));
        return word == null ? d : ' ' + word + ' ';
      });
      var glued = spelled.replace(/\s+/g, '');
      if (/\d/.test(glued)) return null;
      value = parseGlued(glued);
      if (value == null) value = parseGlued(repairGerman(glued));
      if (value == null) value = parseLoose(s);
    }

    if (value == null || !Number.isFinite(value)) return null;
    if (neg) value = -value;
    if (Object.is(value, -0)) value = 0;
    if (!Number.isSafeInteger(value) || Math.abs(value) > 999999) return null;
    return value;
  }

  root.GermanNumbers = { parse: parseGermanNumber };
})(typeof globalThis !== 'undefined' ? globalThis : this);
