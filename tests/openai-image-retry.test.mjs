import test from 'node:test';
import assert from 'node:assert/strict';
import { retryImageRequest } from '../src/openai-image.mjs';

const logger = { info() {}, warn() {}, error() {} };
const options = { sleep: async () => {}, logger };
test('timeout then success retries once', async () => { let calls = 0; const value = await retryImageRequest(async () => { calls += 1; if (calls === 1) throw Object.assign(new Error('Connect Timeout Error'), { name: 'APIConnectionTimeoutError', cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }); return 'ok'; }, options); assert.equal(value, 'ok'); assert.equal(calls, 2); });
test('temporary 5xx retries and three failures reject', async () => { let calls = 0; await retryImageRequest(async () => { calls += 1; if (calls < 3) throw Object.assign(new Error('temporary'), { status: 503 }); return 'ok'; }, options); assert.equal(calls, 3); calls = 0; await assert.rejects(() => retryImageRequest(async () => { calls += 1; throw Object.assign(new Error('temporary'), { status: 503 }); }, options)); assert.equal(calls, 3); });
test('400 and 401 do not retry', async () => { for (const status of [400, 401]) { let calls = 0; await assert.rejects(() => retryImageRequest(async () => { calls += 1; throw Object.assign(new Error('permanent'), { status }); }, options)); assert.equal(calls, 1); } });
test('successful first attempt runs once', async () => { let calls = 0; await retryImageRequest(async () => { calls += 1; return 'ok'; }, options); assert.equal(calls, 1); });
