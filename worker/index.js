// Anthropic API CORS proxy for Iron Log
// Forwards requests from the frontend to Anthropic, adding CORS headers.
// The user's API key is passed per-request (not stored here).

const ALLOWED_ORIGINS = [
  'https://vgainullin.github.io',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    const headers = corsHeaders(allowed ? origin : ALLOWED_ORIGINS[0]);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers });
    }

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing x-api-key header' }), { status: 400, headers });
    }

    const body = await request.text();

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    const respBody = await resp.text();
    return new Response(respBody, {
      status: resp.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  },
};
