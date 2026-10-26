// node --test relay/  (Node 22; not run by jest)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { b64u, decrypt } from './index.js';

const env = { SEAL_KEY: b64u.encode(crypto.getRandomValues(new Uint8Array(32))) };
const enc = new TextEncoder();

test('decrypts the RFC 8291 example', async () => {
    // Appendix A: the 86-byte header, then the ciphertext.
    const body = Uint8Array.from([
        ...b64u.decode('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'),
        ...b64u.decode('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ'),
    ]);
    const plain = await decrypt({
        uaPrivateD: b64u.decode('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94'),
        uaPublic: b64u.decode('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'),
        authSecret: b64u.decode('BTBZMqHH6r4Tts7J_aSIgg'),
    }, body);
    assert.equal(new TextDecoder().decode(plain), 'When I grow up, I want to be a watermelon');
});

// What a Mastodon server does with the subscription (RFC 8291, one record).
async function encryptLikeMastodon(p256dh, auth, text) {
    const concat = (...p) => Uint8Array.from(p.flatMap((x) => [...x]));
    const hkdf = async (salt, ikm, info, bits) => new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bits));
    const uaPublic = b64u.decode(p256dh);
    const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
    const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, as.privateKey, 256));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const ikm = await hkdf(b64u.decode(auth), ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 256);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce },
        await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']),
        concat(enc.encode(text), [2, 0, 0, 0])));
    return concat(salt, [0, 0, 16, 0, 65], asPublic, ct);
}

const post = (path, body, headers = {}) =>
    worker.fetch(new Request(`https://relay.test${path}`, { method: 'POST', body, headers }), env);

async function subscribe() {
    const res = await post('/register', JSON.stringify({ token: 'ExponentPushToken[abc]', account: 'pug@bolha.one' }));
    assert.equal(res.status, 200);
    return res.json();
}

test('register → push forwards title and body to Expo, never the access token', async (t) => {
    const sub = await subscribe();
    assert.match(sub.endpoint, /^https:\/\/relay\.test\/push\/[\w-]+$/);

    const sent = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        sent.push({ url, body: JSON.parse(init.body) });
        return Response.json({ data: [{ status: 'ok' }] });
    });
    const payload = { access_token: 'secret', notification_id: 42, notification_type: 'mention', title: 'Ana mentioned you', body: 'hi' };
    const res = await post(new URL(sub.endpoint).pathname,
        await encryptLikeMastodon(sub.p256dh, sub.auth, JSON.stringify(payload)), { 'Content-Encoding': 'aes128gcm' });

    assert.equal(res.status, 201);
    assert.deepEqual(sent[0].body, [{
        to: 'ExponentPushToken[abc]', title: 'Ana mentioned you', body: 'hi', sound: 'default',
        data: { account: 'pug@bolha.one', notificationId: '42', type: 'mention' },
    }]);
    assert.ok(!JSON.stringify(sent).includes('secret'));
});

test('gone devices, forged endpoints and legacy encoding answer 410', async (t) => {
    const sub = await subscribe();
    const path = new URL(sub.endpoint).pathname;
    const body = await encryptLikeMastodon(sub.p256dh, sub.auth, '{"title":"t","body":"b"}');
    t.mock.method(globalThis, 'fetch', async () =>
        Response.json({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }));

    assert.equal((await post(path, body, { 'Content-Encoding': 'aes128gcm' })).status, 410);
    assert.equal((await post('/push/forged', body, { 'Content-Encoding': 'aes128gcm' })).status, 410);
    assert.equal((await post(path, body, { 'Content-Encoding': 'aesgcm' })).status, 410);
});

test('register rejects anything but an Expo token', async () => {
    assert.equal((await post('/register', JSON.stringify({ token: 'nope', account: 'a' }))).status, 400);
    assert.equal((await post('/register', 'not json')).status, 400);
});
