// pugdon push relay (Cloudflare Worker).
// Mastodon sends Web Push (RFC 8291) to /push/<sealed>; the relay decrypts it and forwards
// the title and body to Expo Push, which delivers through FCM / APNs.
// Stateless: the subscription's keys and the Expo token travel inside <sealed>,
// AES-GCM encrypted with the SEAL_KEY secret. Nothing is stored or logged.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const enc = new TextEncoder();

export const b64u = {
    encode(bytes) {
        let s = '';
        for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    decode(str) {
        const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
        return Uint8Array.from(s, (c) => c.charCodeAt(0));
    },
};

const concat = (...parts) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let i = 0;
    for (const p of parts) { out.set(p, i); i += p.length; }
    return out;
};

const sealKey = (env) =>
    crypto.subtle.importKey('raw', b64u.decode(env.SEAL_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function seal(env, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(env), enc.encode(JSON.stringify(data)));
    return b64u.encode(concat(iv, new Uint8Array(ct)));
}

export async function unseal(env, sealed) {
    const bytes = b64u.decode(sealed);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await sealKey(env), bytes.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
}

const hkdf = async (salt, ikm, info, bits) =>
    new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']),
        bits,
    ));

// RFC 8291 / RFC 8188 "aes128gcm", one record (Mastodon payloads are well under 4096 bytes).
// uaPrivateD, uaPublic, authSecret: the subscription's keys; body: the request body.
export async function decrypt({ uaPrivateD, uaPublic, authSecret }, body) {
    const salt = body.slice(0, 16);
    const idlen = body[20];
    const asPublic = body.slice(21, 21 + idlen);
    const ciphertext = body.slice(21 + idlen);

    const uaKey = await crypto.subtle.importKey('jwk', {
        kty: 'EC', crv: 'P-256', d: b64u.encode(uaPrivateD),
        x: b64u.encode(uaPublic.slice(1, 33)), y: b64u.encode(uaPublic.slice(33, 65)),
    }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaKey, 256));

    const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 256);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);

    const padded = new Uint8Array(await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']),
        ciphertext,
    ));
    // Drop the zero padding and the 0x02 last-record delimiter.
    let end = padded.length - 1;
    while (end >= 0 && padded[end] === 0) end--;
    return padded.slice(0, end);
}

async function register(request, env) {
    const { token, account } = await request.json().catch(() => ({}));
    if (typeof token !== 'string' || !/^Expo(nent)?PushToken\[.+\]$/.test(token) ||
        typeof account !== 'string' || !account || account.length > 200) {
        return new Response('Bad request', { status: 400 });
    }
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const publicKey = b64u.encode(await crypto.subtle.exportKey('raw', pair.publicKey));
    const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const auth = b64u.encode(crypto.getRandomValues(new Uint8Array(16)));
    const sealed = await seal(env, { t: token, a: account, d, p: publicKey, s: auth });
    return Response.json({ endpoint: `${new URL(request.url).origin}/push/${sealed}`, p256dh: publicKey, auth });
}

// Mastodon deletes the subscription on 400 / 404 / 410 and retries on other errors.
async function push(request, env, sealed) {
    let sub;
    try { sub = await unseal(env, sealed); } catch { return new Response('Unknown subscription', { status: 410 }); }
    // ponytail: aes128gcm only (Mastodon 4.4+ with subscription[standard]); add the legacy aesgcm draft if older servers matter.
    if (request.headers.get('Content-Encoding') !== 'aes128gcm') return new Response('Unsupported encoding', { status: 410 });

    let payload;
    try {
        const plain = await decrypt(
            { uaPrivateD: b64u.decode(sub.d), uaPublic: b64u.decode(sub.p), authSecret: b64u.decode(sub.s) },
            new Uint8Array(await request.arrayBuffer()),
        );
        payload = JSON.parse(new TextDecoder().decode(plain));
    } catch {
        return new Response('Undecryptable', { status: 400 });
    }

    // Never forward payload.access_token.
    const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify([{
            to: sub.t,
            title: payload.title,
            body: payload.body,
            sound: 'default',
            data: { account: sub.a, notificationId: String(payload.notification_id), type: payload.notification_type },
        }]),
    });
    if (!res.ok) return new Response('Expo unavailable', { status: 502 });
    const ticket = (await res.json()).data?.[0];
    if (ticket?.details?.error === 'DeviceNotRegistered') return new Response('Device gone', { status: 410 });
    return new Response(null, { status: 201 });
}

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);
        if (request.method !== 'POST') return new Response('Not found', { status: 404 });
        if (pathname === '/register') return register(request, env);
        const match = pathname.match(/^\/push\/([\w-]+)$/);
        if (match) return push(request, env, match[1]);
        return new Response('Not found', { status: 404 });
    },
};
