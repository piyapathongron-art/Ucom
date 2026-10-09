import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
const origin = 'http://127.0.0.1:55440';
const secret = 'ucom-local-cash-fixture-jwt-secret-20261007-32chars';
function token(sub) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return `${header}.${body}.${createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')}`;
}
const owner = token('00000000-0000-4000-8000-000000000001');
const staff = token('00000000-0000-4000-8000-000000000002');
const outsider = token('00000000-0000-4000-8000-000000000003');
async function rpc(name, payload, bearer = owner) {
  const response = await fetch(`${origin}/rpc/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` }, body: JSON.stringify(payload) });
  const body = await response.text();
  return { status: response.status, body: body ? JSON.parse(body) : null };
}
const initial = await rpc('rpc_cash_status', {});
assert.equal(initial.status, 200);
assert.match(initial.body.drawer, /^\d+(\.\d{1,2})?$/); assert.match(initial.body.pending, /^\d+(\.\d{1,2})?$/);
assert.equal((await rpc('rpc_cash_status', {}, staff)).body.isOwner, false);
assert.equal((await rpc('rpc_cash_status', {}, outsider)).status, 403);
const request = { p_operation_id: randomUUID(), p_epoch: initial.body.epoch, p_action: 'expense', p_payload: { name: 'LOCAL HTTP bank transfer', amount: '999', fund: 'transfer' } };
const committed = await rpc('rpc_cash_execute', request);
assert.equal(committed.status, 200);
assert.deepEqual((await rpc('rpc_cash_execute', request)).body, committed.body);
assert.equal((await rpc('rpc_cash_execute', { ...request, p_payload: { ...request.p_payload, amount: '998' } })).status, 400);
assert.equal((await rpc('rpc_cash_execute', { ...request, p_operation_id: randomUUID(), p_action: 'review', p_payload: { handoverId: randomUUID(), confirmed: true, reason: 'Staff attempt' } }, staff)).status, 403);
const after = await rpc('rpc_cash_status', {});
assert.equal(after.body.drawer, initial.body.drawer); assert.equal(after.body.pending, initial.body.pending);
assert.equal((await rpc('rpc_cash_pos_ack', { p_epoch: after.body.epoch, p_device: '20000000-0000-4000-8000-000000000001', p_device_token: 'b'.repeat(64), p_version: after.body.version })).status, 400);
assert.equal((await rpc('rpc_cash_pos_ack', { p_epoch: after.body.epoch, p_device: '20000000-0000-4000-8000-000000000001', p_device_token: 'a'.repeat(64), p_version: after.body.version })).status, 204);
const paused = await rpc('rpc_cash_status', {});
assert.equal(paused.body.isReceivingPaused, true);
const proof = { p_epoch: after.body.epoch, p_device: '20000000-0000-4000-8000-000000000001', p_device_token: 'a'.repeat(64) };
const receipt = { p_operation_id: randomUUID(), p_epoch: after.body.epoch, p_action: 'income', p_payload: { name: 'Blocked during pause', amount: '1', fund: 'pending', device: proof.p_device, deviceToken: proof.p_device_token } };
assert.equal((await rpc('rpc_cash_execute', receipt)).status, 400);
assert.equal((await rpc('rpc_cash_pos_resume', { ...proof, p_device_token: 'b'.repeat(64) })).status, 400);
assert.equal((await rpc('rpc_cash_status', {})).body.isReceivingPaused, true);
assert.equal((await rpc('rpc_cash_pos_resume', proof)).status, 204);
const resumed = await rpc('rpc_cash_status', {});
assert.equal(resumed.body.isReceivingPaused, false); assert.equal(resumed.body.ackVersion, null);
assert.equal((await rpc('rpc_cash_pos_ack', { ...proof, p_version: after.body.version })).status, 400);
assert.equal((await rpc('rpc_cash_status', {})).body.isReceivingPaused, false);
assert.equal((await rpc('rpc_cash_execute', { p_operation_id: randomUUID(), p_epoch: after.body.epoch, p_action: 'close', p_payload: { version: resumed.body.version, drawerCount: resumed.body.drawer, pendingCount: resumed.body.pending, note: 'Blocked without explicit pause' } })).status, 400);
console.log('Local real PostgREST HTTP checks passed: funds, replay binding, roles, pause rejects receipt, proof-bound resume invalidates closing ACK.');
