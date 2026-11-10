import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../rules.ts';

describe('booking status machine', () => {
  test('allowed moves', () => {
    assert.equal(R.canTransition('requested', 'confirmed'), true);
    assert.equal(R.canTransition('requested', 'cancelled'), true);
    assert.equal(R.canTransition('confirmed', 'cancelled'), true);
    assert.equal(R.canTransition('confirmed', 'completed'), true);
  });
  test('refused moves, including skips and reversals', () => {
    assert.equal(R.canTransition('requested', 'completed'), false);
    assert.equal(R.canTransition('cancelled', 'confirmed'), false);
    assert.equal(R.canTransition('completed', 'cancelled'), false);
    assert.equal(R.canTransition('confirmed', 'requested'), false);
    assert.equal(R.canTransition('requested', 'requested'), false);
  });
});

describe('client cancellation window', () => {
  test('allowed at exactly 14 days and more', () => {
    assert.equal(R.clientMayCancel('confirmed', '2026-11-24', '2026-11-10').ok, true);
    assert.equal(R.clientMayCancel('requested', '2026-12-10', '2026-11-10').ok, true);
  });
  test('refused at 13 days and inside it', () => {
    assert.equal(R.clientMayCancel('confirmed', '2026-11-23', '2026-11-10').ok, false);
    assert.equal(R.clientMayCancel('confirmed', '2026-11-12', '2026-11-10').ok, false);
  });
  test('refused once completed or cancelled', () => {
    assert.equal(R.clientMayCancel('completed', '2026-12-10', '2026-11-10').ok, false);
    assert.equal(R.clientMayCancel('cancelled', '2026-12-10', '2026-11-10').ok, false);
  });
  test('an invalid date is refused, not treated as open', () => {
    assert.equal(R.clientMayCancel('confirmed', 'soon', '2026-11-10').ok, false);
  });
});

describe('dates and money', () => {
  test('impossible calendar dates are rejected', () => {
    assert.equal(R.parseIsoDate('2027-02-30'), null);
    assert.equal(R.parseIsoDate('2027-13-01'), null);
    assert.equal(R.parseIsoDate('27-02-01'), null);
    assert.notEqual(R.parseIsoDate('2028-02-29'), null, 'leap day exists in 2028');
  });
  test('days between is exact across a month boundary', () => {
    assert.equal(R.daysBetween('2026-01-31', '2026-02-01'), 1);
    assert.equal(R.daysBetween('2026-11-10', '2026-11-24'), 14);
  });
  test('total is price times travellers, whole rupees', () => {
    assert.equal(R.bookingTotal(98000, 3), 294000);
  });
  test('NPR formatting', () => {
    assert.equal(R.formatNpr(98000), 'NPR 98,000');
    assert.equal(R.formatNpr(0), 'NPR 0');
  });
  test('seats open never goes negative', () => {
    assert.equal(R.seatsOpen(10, 4), 6);
    assert.equal(R.seatsOpen(10, 12), 0);
  });
});

describe('opening a departure', () => {
  const base = { price_npr: 98000, price_source: 'Rate sheet v3', seats_total: 12, start_date: '2026-12-30' };
  test('needs a price source', () => {
    assert.equal(R.canOpenDeparture({ ...base, price_source: null }, '2026-11-10').ok, false);
    assert.equal(R.canOpenDeparture({ ...base, price_source: '   ' }, '2026-11-10').ok, false);
  });
  test('needs a price above zero and a seat', () => {
    assert.equal(R.canOpenDeparture({ ...base, price_npr: 0 }, '2026-11-10').ok, false);
    assert.equal(R.canOpenDeparture({ ...base, seats_total: 0 }, '2026-11-10').ok, false);
  });
  test('refuses a past start date', () => {
    assert.equal(R.canOpenDeparture({ ...base, start_date: '2026-11-09' }, '2026-11-10').ok, false);
  });
  test('accepts a complete, future departure', () => {
    assert.equal(R.canOpenDeparture(base, '2026-11-10').ok, true);
  });
});

describe('inputs', () => {
  test('emails', () => {
    assert.equal(R.isValidEmail('a@b.co'), true);
    assert.equal(R.isValidEmail('a b@c.co'), false);
    assert.equal(R.isValidEmail('a@b'), false);
  });
  test('Nepal phone numbers', () => {
    assert.equal(R.isValidNepalPhone('+977 9800000000'), true);
    assert.equal(R.isValidNepalPhone('9812345678'), true);
    assert.equal(R.isValidNepalPhone('01-4441234'), true);
    assert.equal(R.isValidNepalPhone('12345'), false);
    assert.equal(R.isValidNepalPhone('+1 2025550123'), false);
  });
  test('password rules', () => {
    assert.notEqual(R.passwordProblem('short1'), null);
    assert.notEqual(R.passwordProblem('allletters'), null);
    assert.notEqual(R.passwordProblem('12345678901'), null);
    assert.equal(R.passwordProblem('Walk2026trail'), null);
  });
});

describe('permit checklist wording', () => {
  test('every government-facing item says to check the official source or is marked unverified', () => {
    for (const p of R.PERMIT_TEMPLATE) {
      assert.ok(/official source|UNVERIFIED|office|municipal|Internal|operator/i.test(p.note), p.key);
    }
  });
  test('the checklist covers TIMS, restricted area and park entry', () => {
    const keys = R.PERMIT_TEMPLATE.map((p) => p.key);
    for (const k of ['tims', 'restricted', 'park']) assert.ok(keys.includes(k));
  });
});
