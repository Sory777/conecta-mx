// Edge Function: ingest-position
//
// Punto único de entrada para TODAS las posiciones GPS, sin importar si
// vienen de la PWA en el celular del conductor o del gateway que traduce
// el protocolo del hardware GPS/GSM. Ambos llaman este mismo endpoint.
//
// Autenticación: NO se usa el JWT del dueño. El dispositivo manda su propio
// "device token" (generado una vez desde el dashboard). Aquí se compara el
// hash del token contra devices.token_hash. Así, si roban el hardware o se
// pierde el celular, solo se revoca ese token — no la cuenta del dueño.
//
// Regla de negocio clave: si la suscripción del dueño no está activa
// (vencida / cancelada), se rechaza el insert. Así es como "se les cobra
// mensualidad": sin pago al corriente, el rastreo se detiene.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface IngestBody {
  device_token: string;
  lat: number;
  lng: number;
  speed_kmh?: number;
  heading?: number;
  accuracy_m?: number;
  recorded_at?: string; // ISO; si no viene, se usa "ahora"
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const { device_token, lat, lng, speed_kmh, heading, accuracy_m, recorded_at } = body;

  if (!device_token || typeof lat !== 'number' || typeof lng !== 'number') {
    return jsonResponse({ error: 'missing_fields' }, 400);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return jsonResponse({ error: 'invalid_coordinates' }, 400);
  }

  const tokenHash = await sha256Hex(device_token);

  const { data: device, error: deviceError } = await admin
    .from('devices')
    .select('id, vehicle_id, is_active, vehicles ( id, owner_id )')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (deviceError || !device || !device.is_active) {
    return jsonResponse({ error: 'invalid_device_token' }, 401);
  }

  const ownerId = (device as any).vehicles?.owner_id;
  if (!ownerId) {
    return jsonResponse({ error: 'vehicle_not_found' }, 404);
  }

  // Verifica que la suscripción del dueño esté vigente.
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('owner_id', ownerId)
    .maybeSingle();

  const now = new Date();
  const isWithinPeriod =
    subscription && new Date(subscription.current_period_end) > now;
  const isUsableStatus =
    subscription &&
    (subscription.status === 'active' || subscription.status === 'trialing');

  if (!subscription || !isUsableStatus || !isWithinPeriod) {
    return jsonResponse(
      { error: 'subscription_inactive', message: 'La suscripción no está vigente. El rastreo está pausado.' },
      402, // 402 Payment Required
    );
  }

  const { error: insertError } = await admin.from('positions').insert({
    device_id: device.id,
    vehicle_id: device.vehicle_id,
    lat,
    lng,
    speed_kmh: speed_kmh ?? null,
    heading: heading ?? null,
    accuracy_m: accuracy_m ?? null,
    recorded_at: recorded_at ?? now.toISOString(),
  });

  if (insertError) {
    console.error('insert_failed', insertError);
    return jsonResponse({ error: 'insert_failed' }, 500);
  }

  return jsonResponse({ ok: true });
});
