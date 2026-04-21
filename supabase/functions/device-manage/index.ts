// Supabase Edge Function: Device Code Management
// Admin actions qua service_role key (RLS chặn anon cho write)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

  const secret = req.headers.get('x-device-secret');
  if (secret !== DEVICE_API_SECRET) return json({ error: 'Unauthorized' }, 401);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ===== DEVICE CODES =====
      case 'add_code': {
        const { code, codeHash, deviceLabel, appSource } = body;
        if (!code || !codeHash) return json({ error: 'Missing code or hash' }, 400);
        const { error } = await sb.from('device_codes').insert({
          code, code_hash: codeHash, device_label: deviceLabel || '', app_source: appSource || 'gth-pricing', status: 'available',
        });
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'update_code': {
        const { id, code, codeHash, deviceLabel } = body;
        if (!id) return json({ error: 'Missing id' }, 400);
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (code !== undefined) updates.code = code;
        if (codeHash !== undefined) updates.code_hash = codeHash;
        if (deviceLabel !== undefined) updates.device_label = deviceLabel;
        // Đổi code → revoke thiết bị cũ (code_hash thay đổi → thiết bị không match)
        if (codeHash) {
          updates.status = 'available';
          updates.device_info = {};
          updates.activated_at = null;
          updates.activated_by = '';
        }
        const { error } = await sb.from('device_codes').update(updates).eq('id', id);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'revoke_code': {
        const { id } = body;
        if (!id) return json({ error: 'Missing id' }, 400);
        const { error } = await sb.from('device_codes').update({
          status: 'revoked', updated_at: new Date().toISOString(),
        }).eq('id', id);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'delete_code': {
        const { id } = body;
        if (!id) return json({ error: 'Missing id' }, 400);
        const { error } = await sb.from('device_codes').delete().eq('id', id);
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      case 'activate_code': {
        const { codeHash, appSource, deviceInfo, activatedBy } = body;
        if (!codeHash) return json({ error: 'Missing codeHash' }, 400);
        // Tìm mã available khớp hash
        const { data: code, error: findErr } = await sb.from('device_codes')
          .select('id, status')
          .eq('code_hash', codeHash)
          .eq('app_source', appSource || 'gth-pricing')
          .maybeSingle();
        if (findErr) return json({ error: findErr.message }, 500);
        if (!code) return json({ error: 'Mã không hợp lệ' }, 404);
        if (code.status === 'active') return json({ success: true, data: { id: code.id, already: true } });
        if (code.status === 'revoked') return json({ error: 'Mã đã bị thu hồi' }, 403);
        // Kích hoạt
        const { error: actErr } = await sb.from('device_codes').update({
          status: 'active', device_info: deviceInfo || {}, activated_at: new Date().toISOString(), activated_by: activatedBy || '', updated_at: new Date().toISOString(),
        }).eq('id', code.id);
        return actErr ? json({ error: actErr.message }, 500) : json({ success: true, data: { id: code.id } });
      }

      // ===== SETTINGS =====
      case 'save_setting': {
        const { key, value, updatedBy } = body;
        if (!key) return json({ error: 'Missing key' }, 400);
        const { error } = await sb.from('device_settings').upsert({
          key, value, updated_at: new Date().toISOString(), updated_by: updatedBy || '',
        });
        return error ? json({ error: error.message }, 500) : json({ success: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
