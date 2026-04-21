import sb from './client';

// ===== DEVICE CODES — Edge Function =====
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://tscddgjkelnmlitzcxyg.supabase.co';
const DEVICE_FN_URL = `${SUPABASE_URL}/functions/v1/device-manage`;
const DEVICE_SECRET = process.env.REACT_APP_DEVICE_SECRET || 'gth-device-secret-2026';

async function callDeviceFn(body) {
  const res = await fetch(DEVICE_FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-secret': DEVICE_SECRET },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) return { error: json.error || `HTTP ${res.status}` };
  return json.data ? { success: true, data: json.data } : { success: true };
}

// ===== DEVICE CODES — READ (anon key OK via RLS SELECT) =====

export async function fetchDeviceCodes(appSource) {
  let q = sb.from('device_codes').select('*').order('created_at', { ascending: false });
  if (appSource) q = q.eq('app_source', appSource);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

/** Verify device code hash — thiết bị gọi khi mở app */
export async function verifyDeviceCode(codeHash, appSource) {
  const { data, error } = await sb.from('device_codes')
    .select('id, status, device_label, code_hash')
    .eq('code_hash', codeHash)
    .eq('app_source', appSource)
    .maybeSingle();
  if (error) return { status: 'error', error: error.message };
  if (!data) return { status: 'invalid' };
  return { status: data.status, id: data.id, device_label: data.device_label };
}

/** Đếm mã available (chưa dùng) */
export async function fetchAvailableCodesCount(appSource) {
  let q = sb.from('device_codes').select('id', { count: 'exact', head: true }).eq('status', 'available');
  if (appSource) q = q.eq('app_source', appSource);
  const { count, error } = await q;
  if (error) return 0;
  return count || 0;
}

// ===== DEVICE CODES — WRITE (qua Edge Function, RLS chặn anon) =====

export async function addDeviceCode(code, codeHash, deviceLabel, appSource) {
  return callDeviceFn({ action: 'add_code', code, codeHash, deviceLabel, appSource });
}

export async function updateDeviceCode(id, code, codeHash, deviceLabel) {
  return callDeviceFn({ action: 'update_code', id, code, codeHash, deviceLabel });
}

export async function revokeDeviceCode(id) {
  return callDeviceFn({ action: 'revoke_code', id });
}

export async function deleteDeviceCode(id) {
  return callDeviceFn({ action: 'delete_code', id });
}

export async function activateDeviceCode(codeHash, appSource, deviceInfo, activatedBy) {
  return callDeviceFn({ action: 'activate_code', codeHash, appSource, deviceInfo, activatedBy });
}

// ===== LOGIN HISTORY =====

export async function fetchLoginHistory(deviceCodeId) {
  const { data, error } = await sb.from('device_login_history')
    .select('*')
    .eq('device_code_id', deviceCodeId)
    .order('logged_in_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return data || [];
}

export async function fetchUserLoginHistory(username, appSource) {
  let q = sb.from('device_login_history').select('*, device_codes(device_label, code)')
    .eq('username', username)
    .order('logged_in_at', { ascending: false })
    .limit(50);
  if (appSource) q = q.eq('app_source', appSource);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

/** Ghi lịch sử đăng nhập (INSERT OK qua RLS) */
export async function logDeviceLogin(deviceCodeId, username, appSource, geo) {
  const { error } = await sb.from('device_login_history').insert({
    device_code_id: deviceCodeId,
    username,
    app_source: appSource,
    ip_address: geo?.ip || '',
    city: geo?.city || '',
    region: geo?.region || '',
    country: geo?.country || '',
    user_agent: navigator?.userAgent || '',
  });
  return error ? { error: error.message } : { success: true };
}

// ===== DEVICE SETTINGS (giữ lại) =====

export async function fetchDeviceSettings() {
  const { data, error } = await sb.from('device_settings').select('*');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return map;
}

export async function saveDeviceSetting(key, value, updatedBy) {
  return callDeviceFn({ action: 'save_setting', key, value, updatedBy });
}
