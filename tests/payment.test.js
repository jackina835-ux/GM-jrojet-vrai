const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mobileMoney = require('../utils/mobileMoney');

// Isolated controller tests: config/db is never loaded, no production connection.
function setup({ order = null, accounts = [] } = {}) {
  const calls = [];
  const Account = {
    findAll: async args => { calls.push(['accounts', args]); return accounts; },
    upsert: async args => calls.push(['upsert', args]),
    destroy: async args => calls.push(['destroy', args]),
  };
  const models = { Store: {}, Order: { findOne: async args => { calls.push(['order', args]); return order; } } };
  const context = vm.createContext({ exports: {}, require: name => {
    if (name === '../models') return models;
    if (name === '../models/StorePaymentAccount') return Account;
    if (name === '../utils/mobileMoney') return mobileMoney;
    throw new Error(`Unexpected dependency ${name}`);
  } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../controllers/paymentController.js'), 'utf8'), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { controller: context.exports, res, calls, Account };
}

test('Malagasy phone normalization rejects invalid input', () => {
  for (const phone of ['034 12 345 67', '+261341234567', '00261341234567']) assert.equal(mobileMoney.normalizePhone(phone), '+261341234567');
  for (const phone of ['', null, 341234567, '1234', '+33123456789', '0341234567<script>', '034123456789']) assert.equal(mobileMoney.normalizePhone(phone), null);
});
test('vendor account belongs to authenticated store, body cannot override it', async () => {
  const { controller, res, calls } = setup();
  await controller.saveAccount({ store: { id: 7 }, body: { store_id: 999, provider: 'mvola', phone: '0341234567', password: 'not-stored' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0][1].store_id, 7);
  assert.equal(calls[0][1].phone, '+261341234567');
  assert.equal(calls[0][1].password, undefined);
  assert.equal(res.body.automaticPaymentAvailable, false);
});
test('invalid provider or number cannot write', async () => {
  for (const body of [{ provider: 'unknown', phone: '0341234567' }, { provider: 'mvola', phone: '123' }]) {
    const { controller, res, calls } = setup();
    await controller.saveAccount({ store: { id: 7 }, body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  }
});
test('buyer ownership checked before exposing accounts', async () => {
  const { controller, res, calls } = setup();
  await controller.getOrderOptions({ buyer: { id: 8 }, params: { orderId: '22' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(calls[0][1].where.buyer_id, 8);
  assert.equal(calls.length, 1);
});
test('checkout uses server total, masks wallet, never reports automatic payment available', async () => {
  const { controller, res } = setup({ order: { id: 22, store_id: 7, total: '12000.00', status: 'pending', Store: { name: 'Test' } }, accounts: [{ provider: 'mvola', phone: '+261341234567' }] });
  await controller.getOrderOptions({ buyer: { id: 8 }, params: { orderId: '22' }, body: { total: 1 } }, res);
  assert.equal(res.body.order.total, '12000.00');
  assert.equal(res.body.automaticPaymentAvailable, false);
  assert.equal(res.body.providers.length, 3);
  assert.equal(JSON.stringify(res.body).includes('+261341234567'), false);
});
test('cancelled orders cannot open checkout', async () => {
  const { controller, res, calls } = setup({ order: { status: 'cancelled' } });
  await controller.getOrderOptions({ buyer: { id: 8 }, params: { orderId: '22' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(calls.length, 1);
});
test('deletion scoped to authenticated store', async () => {
  const { controller, res, calls } = setup();
  await controller.deleteAccount({ store: { id: 7 }, params: { provider: 'mvola' } }, res);
  assert.equal(calls[0][1].where.store_id, 7);
  assert.equal(calls[0][1].where.provider, 'mvola');
});
test('database failure fails closed with no leaked error or account', async () => {
  const { controller, res, Account } = setup();
  Account.upsert = async () => { throw new Error('private SQL phone'); };
  await controller.saveAccount({ store: { id: 7 }, body: { provider: 'mvola', phone: '0341234567' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.equal(JSON.stringify(res.body).includes('private'), false);
});
