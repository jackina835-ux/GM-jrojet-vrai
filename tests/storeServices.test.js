const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup() {
  const calls = [];
  let record = { store_id: 7, is_online: true, delivery_enabled: true, headquarters_address: 'Rue du marche' };
  const model = {
    findOrCreate: async args => { calls.push(['create', args]); return [record, false]; },
    update: async (data, options) => { calls.push(['update', data, options]); record = { ...record, ...data }; },
    findByPk: async id => { calls.push(['read', id]); return record; },
  };
  const context = vm.createContext({ exports: {}, require: name => {
    if (name === '../models/StoreServices') return model;
    if (name === '../utils/storeServicesTable') return async () => {};
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../controllers/storeServicesController.js'), 'utf8'), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { controller: context.exports, res, calls, model };
}

test('vendor only reads authenticated store settings', async () => {
  const { controller, res, calls } = setup();
  await controller.get({ store: { id: 7 }, query: { store_id: 99 } }, res);
  assert.equal(calls[0][1], 7);
  assert.equal(res.body.services.store_id, 7);
});
test('false is saved, unrelated fields and moderation state are preserved', async () => {
  const { controller, res, calls } = setup();
  await controller.update({ store: { id: 7 }, body: { store_id: 99, is_online: false, is_active: false } }, res);
  const update = calls.find(call => call[0] === 'update');
  assert.equal(update[2].where.store_id, 7);
  assert.deepEqual(Object.keys(update[1]), ['is_online']);
  assert.equal(res.body.services.is_online, false);
  assert.equal(res.body.services.delivery_enabled, true);
});
test('address is trimmed and may be removed', async () => {
  for (const [input, expected] of [['  Rue 1  ', 'Rue 1'], ['', '']]) {
    const { controller, res } = setup();
    await controller.update({ store: { id: 7 }, body: { headquarters_address: input } }, res);
    assert.equal(res.body.services.headquarters_address, expected);
  }
});
test('invalid statuses, addresses and empty updates rejected without writes', async () => {
  for (const body of [{ is_online: 'false' }, { delivery_enabled: 1 }, { headquarters_address: 'a'.repeat(301) }, { headquarters_address: null }, {}]) {
    const { controller, res, calls } = setup();
    await controller.update({ store: { id: 7 }, body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  }
});
test('database failures never report a saved setting', async () => {
  const { controller, res, model } = setup();
  model.update = async () => { throw new Error('private database error'); };
  await controller.update({ store: { id: 7 }, body: { delivery_enabled: false } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.equal(JSON.stringify(res.body).includes('private'), false);
});
