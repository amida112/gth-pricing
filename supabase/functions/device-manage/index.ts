// Supabase Edge Function: Device Management
// Xử lý approve/block/delete thiết bị — dùng service_role key để bypass RLS
// Client gọi function này thay vì gọi trực tiếp DB

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Secret key để xác thực request từ app (không phải ai cũng gọi được)
const DEVICE_API_SECRET = Deno.env.get('DEVICE_API_SECRET') || 'gth-device-secret-2026';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // Xác thực bằng secret header
  const secret = req.headers.get('x-device-secret');
  if (secret !== DEVICE_API_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { action, id, ids, approvedBy, key, value, updatedBy, deviceName, fingerprint, ip, city, region, country, lat, lon } = body;

    switch (action) {
      case 'approve': {
        if (!id) return json({ error: 'Missing id' }, 400);
        const { error } = await sb.from('device_whitelist').update({
          status: 'approved',
          approved_by: approvedBy || '',
          approved_at: new Date().toISOString(),
        }).eq('id', id);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'approve_batch': {
        if (!ids?.length) return json({ error: 'Missing ids' }, 400);
        const { error } = await sb.from('device_whitelist').update({
          status: 'approved',
          approved_by: approvedBy || '',
          approved_at: new Date().toISOString(),
        }).in('id', ids);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'block': {
        if (!id) return json({ error: 'Missing id' }, 400);
        const { error } = await sb.from('device_whitelist').update({ status: 'blocked' }).eq('id', id);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'delete': {
        if (!id) return json({ error: 'Missing id' }, 400);
        const { error } = await sb.from('device_whitelist').delete().eq('id', id);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'update_name': {
        if (!id) return json({ error: 'Missing id' }, 400);
        const { error } = await sb.from('device_whitelist').update({ device_name: deviceName || '' }).eq('id', id);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'save_setting': {
        if (!key) return json({ error: 'Missing key' }, 400);
        const { error } = await sb.from('device_settings').upsert({
          key,
          value,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy || '',
        });
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'update_last_seen': {
        if (!id) return json({ error: 'Missing id' }, 400);
        const updates: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
        if (ip) updates.ip_address = ip;
        if (city) updates.city = city;
        if (region) updates.region = region;
        if (country) updates.country = country;
        if (lat != null) updates.lat = lat;
        if (lon != null) updates.lon = lon;
        const { error } = await sb.from('device_whitelist').update(updates).eq('id', id);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'update_fingerprint': {
        if (!id || !fingerprint) return json({ error: 'Missing id or fingerprint' }, 400);
        const { error } = await sb.from('device_whitelist').update({ fingerprint }).eq('id', id);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
