// Crate — ACR recognition Edge Function
// Validates the user, forwards audio to AudD (configurable), normalizes the
// response, writes a caught_tracks row server-side so we never lose a catch
// to a flaky client connection.
//
// Provider is runtime-configured via ACR_PROVIDER env var.
// The acr_provider column on caught_tracks records which one served the request.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AUDD_API_TOKEN        = Deno.env.get('AUDD_API_TOKEN')!;
const ACR_PROVIDER          = (Deno.env.get('ACR_PROVIDER') || 'audd') as 'audd' | 'acrcloud';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method-not-allowed' }, 405);

  // ── Auth ────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  // ── Body ────────────────────────────────────────────────────
  let body: { audio_base64?: string; session_id?: string };
  try { body = await req.json(); }
  catch { return json({ error: 'bad-json' }, 400); }

  if (!body.audio_base64) return json({ error: 'missing-audio' }, 400);

  // ── ACR call ────────────────────────────────────────────────
  let normalized;
  let raw;
  try {
    if (ACR_PROVIDER === 'audd') {
      const form = new FormData();
      form.append('api_token', AUDD_API_TOKEN);
      form.append('audio', body.audio_base64);
      form.append('return', 'isrc,musicbrainz');
      const r = await fetch('https://api.audd.io/', { method: 'POST', body: form });
      raw = await r.json();
      if (raw.status !== 'success' || !raw.result) {
        return json({ caught: false, raw }, 200);
      }
      normalized = {
        title:   raw.result.title,
        artist:  raw.result.artist,
        isrc:    raw.result.isrc || null,
        confidence: raw.result.score ?? null
      };
    } else {
      return json({ error: 'acrcloud-not-wired' }, 501);
    }
  } catch (e) {
    return json({ error: 'acr-failed', detail: String(e) }, 502);
  }

  // ── Persist ────────────────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const { data: catchRow, error: insertErr } = await admin
    .from('caught_tracks')
    .insert({
      user_id:      userId,
      session_id:   body.session_id || null,
      title:        normalized.title,
      artist:       normalized.artist,
      source_isrc:  normalized.isrc,
      acr_provider: ACR_PROVIDER,
      acr_raw:      raw
    })
    .select()
    .single();

  if (insertErr) return json({ error: 'db-write-failed', detail: insertErr.message }, 500);

  return json({
    caught: true,
    catch: catchRow,
    provider: ACR_PROVIDER,
    confidence: normalized.confidence
  }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' }
  });
}
