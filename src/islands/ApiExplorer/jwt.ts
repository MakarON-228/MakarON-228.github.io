// JWT HS256 через WebCrypto — порт create_access_token и разбора токена из auth.py (python-jose): заголовок
// {"alg":"HS256","typ":"JWT"}, полезная нагрузка {"sub": "<id>", "exp": <секунды>} компактным JSON, подпись HMAC-SHA256.
// Проверка — как jwt.decode: подпись, алгоритм, exp не раньше текущей секунды, sub — строка.

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad base64');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const hmacKey = (secret: string, use: KeyUsage) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [use]);

export interface Claims {
  sub: string;
  exp: number;
}

export async function sign(claims: Claims, secret: string): Promise<string> {
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify({ sub: claims.sub, exp: claims.exp })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

/** Нагрузка токена или null — любая ошибка разбора, подписи или срока (JWTError в auth.py). */
export async function verify(token: string, secret: string, nowSeconds: number): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [head, body, sig] = parts as [string, string, string];
    const header = JSON.parse(new TextDecoder().decode(fromB64url(head))) as Record<string, unknown>;
    if (header['alg'] !== 'HS256') return null;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), fromB64url(sig), enc.encode(`${head}.${body}`));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(body))) as unknown;
    if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) return null;
    const c = claims as Record<string, unknown>;
    if ('exp' in c) {
      if (typeof c['exp'] !== 'number' || !Number.isInteger(c['exp']) || c['exp'] < nowSeconds) return null;
    }
    if ('sub' in c && typeof c['sub'] !== 'string') return null;
    return c;
  } catch {
    return null;
  }
}

/** Хэш пароля для базы в памяти. Отступление от auth.py: там bcrypt_sha256 (passlib); хэш ни в один ответ не попадает. */
export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(password));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
