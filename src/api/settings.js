import sb from './client';

// ===== XE SAY CONFIG =====

export async function fetchXeSayConfig() {
  const { data, error } = await sb.from('app_settings').select('value').eq('key', 'xe_say_config').single();
  if (error || !data) return null;
  try { return JSON.parse(data.value); } catch { return null; }
}

export async function saveXeSayConfig(config) {
  const { error } = await sb.from('app_settings').upsert({ key: 'xe_say_config', value: JSON.stringify(config) }, { onConflict: 'key' });
  return error ? { error: error.message } : { success: true };
}

// ===== ROLE PERMISSIONS =====

export async function fetchRolePermissions() {
  const { data, error } = await sb.from('app_settings').select('value').eq('key', 'role_permissions').single();
  if (error || !data) return null;
  try { return JSON.parse(data.value); } catch { return null; }
}

export async function saveRolePermissions(config) {
  const { error } = await sb.from('app_settings').upsert({ key: 'role_permissions', value: JSON.stringify(config) }, { onConflict: 'key' });
  return error ? { error: error.message } : { success: true };
}

// ===== THICKNESS GROUPING =====

export async function fetchThicknessGrouping() {
  const { data, error } = await sb.from('app_settings').select('value').eq('key', 'thickness_grouping').single();
  if (error || !data) return false;
  return data.value === 'true';
}

export async function saveThicknessGrouping(value) {
  const { error } = await sb.from('app_settings').upsert({ key: 'thickness_grouping', value: String(!!value) }, { onConflict: 'key' });
  return error ? { error: error.message } : { success: true };
}

// ===== VAT RATE =====

export async function fetchVatRate() {
  const { data, error } = await sb.from('app_settings').select('value').eq('key', 'vat_rate').single();
  if (error || !data) return 0.08;
  return parseFloat(data.value) || 0.08;
}

// ===== ADMIN SETTINGS =====

export async function fetchAdminSettings() {
  const { data, error } = await sb.from('settings').select('key,value').in('key', ['admin_password', 'session_version']);
  if (error) return null;
  const r = {};
  (data || []).forEach(row => { r[row.key] = row.value; });
  return r;
}

export async function changeAdminPassword(newPassword) {
  const newVersion = Date.now().toString();
  const { error } = await sb.from('settings').upsert([
    { key: 'admin_password', value: newPassword },
    { key: 'session_version', value: newVersion },
  ], { onConflict: 'key' });
  return error ? { error: error.message } : { success: true, version: newVersion };
}

// ===== PRICE NOTES =====

export async function fetchPriceNote(woodId) {
  const key = `price_note_${woodId}`;
  const { data } = await sb.from('settings').select('value').eq('key', key).single();
  return data?.value || '';
}

export async function savePriceNote(woodId, text) {
  const key = `price_note_${woodId}`;
  const { error } = await sb.from('settings').upsert({ key, value: text }, { onConflict: 'key' });
  return error ? { error: error.message } : { success: true };
}

// ===== COMPANY DISPATCH INFO =====

export async function fetchCompanyDispatchInfo() {
  const defaults = { address: 'KCN Quốc Oai, Hà Nội — DT419, Đại lộ Thăng Long', province: 'Hà Nội', contacts: [] };
  const { data, error } = await sb.from('app_settings').select('value').eq('key', 'company_dispatch_info').maybeSingle();
  if (error || !data) return defaults;
  try { const v = JSON.parse(data.value); return { ...defaults, ...v }; } catch { return defaults; }
}

export async function saveCompanyDispatchInfo(info) {
  const { error } = await sb.from('app_settings').upsert({ key: 'company_dispatch_info', value: JSON.stringify(info) }, { onConflict: 'key' });
  return error ? { error: error.message } : { success: true };
}

// ===== BUNDLE IMAGES (Storage) =====

export async function uploadBundleImage(bundleCode, file, type) {
  const ext = file.name.split('.').pop();
  const path = `${bundleCode}/${type}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('bundle-images').upload(path, file, { upsert: true });
  if (error) return { error: error.message };
  const { data } = sb.storage.from('bundle-images').getPublicUrl(path);
  return { success: true, url: data.publicUrl };
}

export async function deleteBundleImages(urls = []) {
  if (!urls.length) return { success: true };
  const { data: { publicUrl: sampleUrl } } = sb.storage.from('bundle-images').getPublicUrl('_');
  const bucketBase = sampleUrl.replace('/_', '/');
  const paths = urls
    .map(url => {
      try { return decodeURIComponent(url.replace(bucketBase, '')); } catch { return null; }
    })
    .filter(Boolean);
  if (!paths.length) return { success: true };
  const { error } = await sb.storage.from('bundle-images').remove(paths);
  return error ? { error: error.message } : { success: true };
}
