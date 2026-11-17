const test = require('node:test');
const assert = require('node:assert/strict');
const { bookInput } = require('../services/library');

test('book input accepts a non-negative integer and ignores client availability', () => {
  const result = bookInput({ title: 'Book', totalCopies: '3', availableCopies: 99 });
  assert.equal(result.totalCopies, 3);
  assert.equal(result.type, 'Physical Book');
  assert.equal(result.availableCopies, undefined);
});

test('book input rejects missing, fractional, negative and invalid copy counts', () => {
  for (const totalCopies of ['', undefined, '-1', '1.5', 'not a number']) {
    assert.throws(() => bookInput({ totalCopies }), /non-negative whole number/);
  }
});
