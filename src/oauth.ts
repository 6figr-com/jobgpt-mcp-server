import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { SignJWT, jwtVerify } from 'jose';
import { Env, corsPreflight, serveWellKnown, legacyMcpHandler, serveMcp } from './worker.js';

const SCOPE = 'jobgpt:full';
const TXN_TTL_SECONDS = 600; // consent round-trip window

// ---------------------------------------------------------------------------
// API handler — invoked by the provider ONLY for /mcp requests carrying a valid
// OAuth access token. The user's sk_ key lives in the grant props (this.ctx.props).
// ---------------------------------------------------------------------------
class McpApiHandler extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const props = (this.ctx as unknown as { props: { apiKey: string } }).props;
    const apiKey = props?.apiKey;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Grant is missing a JobGPT API key. Please reconnect.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return serveMcp(request, apiKey, this.env.BACKEND_URL);
  }
}

// ---------------------------------------------------------------------------
// txn: a signed, short-lived echo of the OAuth authorize request. Lets the
// Worker stay stateless across the browser round-trip through Rasalghul + bane.
// ---------------------------------------------------------------------------
function txnSecret(env: Env): Uint8Array {
  return new TextEncoder().encode(env.MCP_OAUTH_SECRET);
}

async function signTxn(env: Env, authReq: unknown, clientName: string): Promise<string> {
  // clientName is display-only (shown on the consent card). It is signed into the
  // txn so the consent page renders the same client the Worker will actually grant
  // to — no separate, spoofable query param.
  return new SignJWT({ authReq: authReq as Record<string, unknown>, clientName })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TXN_TTL_SECONDS}s`)
    .sign(txnSecret(env));
}

async function verifyTxn(env: Env, txn: string): Promise<any> {
  const { payload } = await jwtVerify(txn, txnSecret(env));
  return payload.authReq;
}

// ---------------------------------------------------------------------------
// Default handler — everything that isn't an OAuth-token /mcp request:
//   GET /authorize      -> mint txn, bounce to the Rasalghul consent page
//   GET /oauth/callback -> exchange consent code for sk_, complete authorization
// The provider itself handles /token, /register, and the .well-known/oauth-* docs.
// ---------------------------------------------------------------------------
const defaultHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/authorize') {
      const authReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      const client = await env.OAUTH_PROVIDER.lookupClient(authReq.clientId);
      const clientName = (client && client.clientName) ? client.clientName : '';
      const txn = await signTxn(env, authReq, clientName);
      const consentUrl = `${env.BACKEND_URL}/oauth/authorize?txn=${encodeURIComponent(txn)}`;
      return Response.redirect(consentUrl, 302);
    }

    if (url.pathname === '/oauth/callback') {
      const txn = url.searchParams.get('txn') || '';
      let authReq: any;
      try {
        authReq = await verifyTxn(env, txn);
      } catch (_e) {
        return new Response('Invalid or expired authorization session. Please restart the connection.', { status: 400 });
      }

      // User denied consent on the Rasalghul page.
      const errParam = url.searchParams.get('error');
      if (errParam) {
        const denied = new URL(authReq.redirectUri);
        denied.searchParams.set('error', errParam);
        if (authReq.state) {
          denied.searchParams.set('state', authReq.state);
        }
        return Response.redirect(denied.toString(), 302);
      }

      const code = url.searchParams.get('code') || '';
      if (!code) {
        return new Response('Missing consent code.', { status: 400 });
      }

      // Exchange the consent code for the user's sk_ key (server-to-server).
      const resp = await fetch(`${env.BACKEND_URL}/api/v1/internal/mcp-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.MCP_WORKER_TOKEN}`,
        },
        body: JSON.stringify({ code }),
      });
      if (!resp.ok) {
        return new Response('Could not verify your JobGPT session. Please try connecting again.', { status: 502 });
      }
      const body = (await resp.json()) as { data?: { apiKey?: string; userId?: string } };
      const apiKey = body?.data?.apiKey;
      const userId = body?.data?.userId;
      if (!apiKey || !userId) {
        return new Response('Could not provision your JobGPT API key. Please try again.', { status: 502 });
      }

      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: authReq,
        userId,
        scope: authReq.scope && authReq.scope.length ? authReq.scope : [SCOPE],
        metadata: {},
        props: { apiKey, userId },
      });
      return Response.redirect(redirectTo, 302);
    }

    return new Response(JSON.stringify({ error: 'not_found', error_description: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

const oauthProvider = new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler: McpApiHandler as any,
  defaultHandler: defaultHandler as any,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
  scopesSupported: [SCOPE],
  allowPlainPKCE: false,
});

// ---------------------------------------------------------------------------
// Entry shim — preserves backward compatibility. A raw `sk_` bearer on /mcp
// bypasses OAuth entirely and takes the legacy path; everything else (OAuth
// tokens, discovery, /token, /register, unauthenticated probes) goes to the
// provider, which returns 401 + WWW-Authenticate to bootstrap the native flow.
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsPreflight();
    }

    const wellKnown = serveWellKnown(url.pathname);
    if (wellKnown) {
      return wellKnown;
    }

    if (url.pathname === '/mcp') {
      const auth = request.headers.get('Authorization') || '';
      const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
      if (bearer.startsWith('sk_')) {
        return legacyMcpHandler(request, env);
      }
    }

    return oauthProvider.fetch(request, env, ctx);
  },
};
