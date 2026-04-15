import sb from './client';

// ===== DEVICE EDGE FUNCTION =====
// Admin actions (approve, block, delete, settings) gọi qua Edge Function
// vì RLS chặn UPDATE/DELETE từ anon key

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
  return { success: true };
}

// ===== DEVICE WHITELIST =====

export async function fetchDevices() {
  const { data, error } = await sb.from('device_whitelist').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Kiểm tra thiết bị — ưu tiên device_token (ổn định), fallback fingerprint.
 * Trả về: { status, id, device_token }
 */
export async function checkDevice(username, fingerprint, deviceToken) {
  // Ưu tiên 1: kiểm tra bằng device_token (persistent, ổn định hơn fingerprint)
  if (deviceToken) {
    const { data, error } = await sb.from('device_whitelist')
      .select('id, status, device_token, fingerprint')
      .eq('username', username)
      .eq('device_token', deviceToken)
      .maybeSingle();
    if (!error && data) {
      // Nếu fingerprint thay đổi (browser update) → cập nhật qua Edge Function
      if (fingerprint && data.fingerprint !== fingerprint) {
        callDeviceFn({ action: 'update_fingerprint', id: data.id, fingerprint }).catch(() => {});
      }
      return { status: data.status, id: data.id, device_token: data.device_token };
    }
  }

  // Ưu tiên 2: kiểm tra bằng fingerprint
  const { data, error } = await sb.from('device_whitelist')
    .select('id, status, device_token')
    .eq('username', username)
    .eq('fingerprint', fingerprint)
    .maybeSingle();
  if (error) return { status: 'error', error: error.message };
  if (!data) return { status: 'unknown' };
  return { status: data.status, id: data.id, device_token: data.device_token };
}

/**
 * Đăng ký thiết bị mới — INSERT cho phép qua anon key (RLS allows INSERT).
 * @param {object} geo — { ip, city, region, country, lat, lon }
 */
export async function registerDevice(username, fingerprint, userAgent, geo, userId, deviceToken) {
  // Ưu tiên 1: tìm bằng device_token (ổn định hơn fingerprint)
  if (deviceToken) {
    const { data: byToken } = await sb.from('device_whitelist')
      .select('id, device_token, fingerprint').eq('username', username).eq('device_token', deviceToken).maybeSingle();
    if (byToken) {
      // Cùng thiết bị — cập nhật fingerprint + geo, không tạo dòng mới
      if (fingerprint && byToken.fingerprint !== fingerprint) {
        callDeviceFn({ action: 'update_fingerprint', id: byToken.id, fingerprint }).catch(() => {});
      }
      callDeviceFn({ action: 'update_last_seen', id: byToken.id, ip: geo?.ip, city: geo?.city, region: geo?.region, country: geo?.country, lat: geo?.lat, lon: geo?.lon }).catch(() => {});
      return { success: true, device_token: byToken.device_token };
    }
  }
  // Ưu tiên 2: tìm bằng fingerprint
  const { data: byFp } = await sb.from('device_whitelist')
    .select('id, device_token').eq('username', username).eq('fingerprint', fingerprint).maybeSingle();
  if (byFp) {
    callDeviceFn({ action: 'update_last_seen', id: byFp.id, ip: geo?.ip, city: geo?.city, region: geo?.region, country: geo?.country, lat: geo?.lat, lon: geo?.lon }).catch(() => {});
    return { success: true, device_token: byFp.device_token };
  }
  // Không tìm thấy → insert mới
  const insert = {
    username, fingerprint,
    user_agent: userAgent || '',
    ip_address: geo?.ip || '', city: geo?.city || '', region: geo?.region || '', country: geo?.country || '',
    lat: geo?.lat || null, lon: geo?.lon || null,
    status: 'pending', app_source: 'gth-pricing',
  };
  if (userId) insert.user_id = userId;
  const { data, error } = await sb.from('device_whitelist')
    .insert(insert).select('device_token').single();
  if (error) return { error: error.message };
  return { success: true, device_token: data?.device_token };
}

// ===== ADMIN ACTIONS — qua Edge Function =====

export async function approveDevice(id, approvedBy) {
  return callDeviceFn({ action: 'approve', id, approvedBy });
}

export async function approveDevicesBatch(ids, approvedBy) {
  return callDeviceFn({ action: 'approve_batch', ids, approvedBy });
}

export async function blockDevice(id) {
  return callDeviceFn({ action: 'block', id });
}

export async function deleteDevice(id) {
  return callDeviceFn({ action: 'delete', id });
}

export async function updateDeviceName(id, deviceName) {
  return callDeviceFn({ action: 'update_name', id, deviceName });
}

export async function updateDeviceLastSeen(id, ip, geo) {
  // last_seen_at update cần qua Edge Function vì RLS chặn UPDATE
  return callDeviceFn({
    action: 'update_last_seen', id, ip,
    city: geo?.city, region: geo?.region, country: geo?.country,
    lat: geo?.lat, lon: geo?.lon,
  });
}

/** Đếm số thiết bị pending (SELECT — anon key OK) */
export async function fetchPendingDevicesCount() {
  const { count, error } = await sb.from('device_whitelist')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return 0;
  return count || 0;
}

// ===== DEVICE SETTINGS =====

export async function fetchDeviceSettings() {
  const { data, error } = await sb.from('device_settings').select('*');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return map;
}

export async function saveDeviceSetting(key, value, updatedBy) {
  // UPDATE qua Edge Function (RLS chặn anon key)
  return callDeviceFn({ action: 'save_setting', key, value, updatedBy });
}
