// LOCAL FIXTURE ONLY: fake Auth/Storage, real local PostgREST/SQL. Never reads .env.
import http from 'node:http';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const LOCAL_JWT_SECRET = 'ucom-local-cash-fixture-jwt-secret-20261007-32chars';
const OWNER = '00000000-0000-4000-8000-000000000001';
const STAFF = '00000000-0000-4000-8000-000000000002';
const isDailyFixture = process.argv.includes('--daily');
const database = isDailyFixture ? process.env.UCOM_DAILY_BROWSER_DATABASE ?? 'ucom_cash_daily_browser_20261009' : 'ucom_cash_http_20261008';
if (isDailyFixture && !/^ucom_cash_daily_browser_[a-z0-9_]+$/.test(database)) throw new Error('Local fixture database name required');
const restOrigin = isDailyFixture ? 'http://127.0.0.1:55442' : 'http://127.0.0.1:55440';
const sqlQuote = value => "'" + String(value).replaceAll("'", "''") + "'";
export function localJwt(role, sub) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, ...(sub ? { sub } : {}), aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })}`;
  return `${unsigned}.${createHmac('sha256', LOCAL_JWT_SECRET).update(unsigned).digest('base64url')}`;
}
function claims(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const expected = createHmac('sha256', LOCAL_JWT_SECRET).update(`${header}.${payload}`).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return value.exp > Date.now() / 1000 ? value : null;
  } catch { return null; }
}
function user(id) {
  return { id, aud: 'authenticated', role: 'authenticated', email: id === OWNER ? 'admin@ucom.local' : 'staff@ucom.local', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-10-07T00:00:00Z' };
}
function session(id) {
  return { access_token: localJwt('authenticated', id), token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, refresh_token: id, user: user(id) };
}
async function body(request) {
  const chunks = []; let length = 0;
  for await (const chunk of request) { length += chunk.length; if (length > 11 * 1024 * 1024) throw new Error('Fixture body too large'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
function sql(actor, statement) {
  const source = `begin; set local role authenticated; set local request.jwt.claims=${sqlQuote(JSON.stringify({ sub: actor, role: 'authenticated' }))}; set local request.jwt.claim.sub=${sqlQuote(actor)}; set local request.jwt.claim.role='authenticated'; ${statement}; commit;`;
  const result = spawnSync('docker', ['exec', '-i', 'ucom-cash-review-20261007', 'psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], { input: source, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Local Storage RLS fixture rejected operation');
  return result.stdout;
}
function json(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); }

export function startFixtureAdapter() {
  const signedUploads = new Map(); const files = new Map(); const downloads = new Map();
  const server = http.createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', 'http://localhost:3007');
    response.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-upsert, cache-control, accept-profile, content-profile, prefer, range, range-unit');
    response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,DELETE,OPTIONS');
    response.setHeader('Access-Control-Expose-Headers', 'content-range, range-unit, preference-applied');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    try {
      const url = new URL(request.url, 'http://localhost:55441');
      if (url.pathname === '/liff-sdk.js') {
        response.writeHead(200, { 'Content-Type': 'application/javascript' });
        response.end(`window.liff = { init(config) {
          window.__liffFixture = { config, initialSearch: window.location.search };
          const mode = new URLSearchParams(window.location.search).get('mockLiff');
          if (mode === 'pending') return new Promise(() => {});
          if (mode === 'fail') return Promise.reject(new Error('Fixture LIFF init failure'));
          return Promise.resolve();
        } };`);
        return;
      }
      const actor = claims((request.headers.authorization ?? '').replace(/^Bearer /i, ''));
      if (url.pathname === '/auth/v1/token') {
        const payload = JSON.parse((await body(request)).toString() || '{}');
        const id = url.searchParams.get('grant_type') === 'refresh_token' ? payload.refresh_token : payload.email === 'admin@ucom.local' ? OWNER : payload.email === 'staff@ucom.local' ? STAFF : null;
        if (![OWNER, STAFF].includes(id) || (url.searchParams.get('grant_type') === 'password' && payload.password !== 'fixture-password')) return json(response, 400, { error: 'invalid_grant', error_description: 'Local fixture credentials required' });
        return json(response, 200, session(id));
      }
      if (url.pathname === '/auth/v1/user') return actor && [OWNER, STAFF].includes(actor.sub) ? json(response, 200, user(actor.sub)) : json(response, 401, { message: 'Fixture session required' });
      if (url.pathname === '/auth/v1/logout') return json(response, 200, {});
      if (url.pathname.startsWith('/rest/v1/')) {
        const headers = { ...request.headers }; delete headers.host; delete headers['content-length'];
        const raw = ['GET', 'HEAD'].includes(request.method) ? undefined : await body(request);
        const upstream = await fetch(`${restOrigin}/${url.pathname.slice('/rest/v1/'.length)}${url.search}`, { method: request.method, headers, body: raw });
        response.writeHead(upstream.status, Object.fromEntries([...upstream.headers].filter(([name]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(name))));
        response.end(Buffer.from(await upstream.arrayBuffer())); return;
      }
      const uploadPath = '/storage/v1/object/upload/sign/ucom-cash-evidence/';
      if (url.pathname.startsWith(uploadPath)) {
        const path = decodeURIComponent(url.pathname.slice(uploadPath.length));
        if (request.method === 'POST') {
          if (!actor?.sub || !path.startsWith(`${actor.sub}/`)) return json(response, 403, { message: 'Fixture ownership check failed' });
          const token = randomUUID(); signedUploads.set(token, { path, actor: actor.sub });
          return json(response, 200, { url: `/object/upload/sign/ucom-cash-evidence/${path}?token=${token}` });
        }
        const signature = signedUploads.get(url.searchParams.get('token'));
        if (!signature || signature.path !== path) return json(response, 403, { message: 'Fixture upload signature required' });
        const raw = await body(request);
        const part = /Content-Type:\s*(image\/(?:jpeg|png|webp)|application\/pdf)/i.exec(raw.toString('latin1'));
        const mime = part?.[1] ?? request.headers['content-type'];
        const boundary = /boundary="?([^";]+)/i.exec(request.headers['content-type'] ?? '')?.[1];
        const start = part && boundary ? raw.indexOf('\r\n\r\n', part.index) + 4 : 0;
        const end = boundary ? raw.indexOf(`\r\n--${boundary}`, start) : raw.length;
        const file = raw.subarray(start, end < 0 ? raw.length : end);
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime) || file.length > 10 * 1024 * 1024 || !file.length) return json(response, 400, { message: 'Fixture MIME/size rejected' });
        sql(signature.actor, `insert into storage.objects(bucket_id,name,metadata) values('ucom-cash-evidence',${sqlQuote(path)},${sqlQuote(JSON.stringify({ mimetype: mime, size: file.length }))}::jsonb)`);
        files.set(path, { raw: file, mime }); signedUploads.delete(url.searchParams.get('token'));
        return json(response, 200, { Key: `ucom-cash-evidence/${path}` });
      }
      const signPath = '/storage/v1/object/sign/ucom-cash-evidence/';
      if (url.pathname.startsWith(signPath)) {
        const path = decodeURIComponent(url.pathname.slice(signPath.length));
        if (request.method === 'POST') {
          if (!actor?.sub || !sql(actor.sub, `select count(*) from storage.objects where bucket_id='ucom-cash-evidence' and name=${sqlQuote(path)}`).split('\n').includes('1')) return json(response, 403, { message: 'Fixture evidence read rejected' });
          const token = randomUUID(); downloads.set(token, path);
          return json(response, 200, { signedURL: `/object/sign/ucom-cash-evidence/${path}?token=${token}` });
        }
        if (downloads.get(url.searchParams.get('token')) !== path || !files.has(path)) return json(response, 403, { message: 'Fixture evidence signature required' });
        const file = files.get(path); response.writeHead(200, { 'Content-Type': file.mime }); response.end(file.raw); return;
      }
      json(response, 404, { message: 'Local fixture endpoint not implemented' });
    } catch { json(response, 503, { message: 'Local fixture adapter unavailable' }); }
  });
  server.listen(55441, '127.0.0.1', () => console.log(`LOCAL FIXTURE Auth/Storage adapter: http://localhost:55441 (real REST -> ${restOrigin})`));
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const adapter = startFixtureAdapter();
  const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3007'], {
    stdio: 'inherit', env: { ...process.env, UCOM_LOCAL_CASH_LAB: '1', LINE_LIFF_ID: '1234567890-LocalFixture', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:55441', NEXT_PUBLIC_SUPABASE_ANON_KEY: localJwt('anon'), SUPABASE_SERVICE_ROLE_KEY: '', LINE_CHANNEL_ACCESS_TOKEN: '', LINE_GROUP_ID: '', LINE_APP_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '', CRON_SECRET: '' },
  });
  const stop = () => { app.kill('SIGTERM'); adapter.close(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  app.on('exit', () => adapter.close());
}
