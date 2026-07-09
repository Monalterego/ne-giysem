import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const POOF_API_KEY = Deno.env.get('POOF_API_KEY')!;
const POOF_URL = 'https://api.poof.bg/v1/remove';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    const { image_b64 } = await req.json();
    if (!image_b64) {
      return new Response(JSON.stringify({ error: 'image_b64 required' }), {
        status: 400, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    const binary = Uint8Array.from(atob(image_b64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append('image_file', new Blob([binary], { type: 'image/jpeg' }), 'image.jpg');
    form.append('format', 'png');
    form.append('channels', 'rgba');

    const res = await fetch(POOF_URL, {
      method: 'POST',
      headers: { 'x-api-key': POOF_API_KEY },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: 'Poof error ' + res.status, detail: errText }), {
        status: res.status, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    const buffer = await res.arrayBuffer();
    const result_b64 = toBase64(new Uint8Array(buffer));

    return new Response(JSON.stringify({ result_b64 }), {
      status: 200, headers: { ...CORS, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, 'content-type': 'application/json' },
    });
  }
});
