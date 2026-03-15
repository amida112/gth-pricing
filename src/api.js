/**
 * GTH Pricing — API kết nối Google Sheet
 *
 * HƯỚNG DẪN: Thay URL bên dưới bằng URL deployment Apps Script của bạn
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbxNGbPEb_8EBl_dkA8ZhbPP-xIpeozw8XZ1mCc9r9RYiT-RjSMFpILZQd7fSNGJy-s5/exec';

// ===== GET requests =====

export async function fetchWoodTypes() {
  const res = await fetch(API_URL + '?action=getWoodTypes');
  return await res.json();
}

export async function fetchAttributes() {
  const res = await fetch(API_URL + '?action=getAttributes');
  return await res.json();
}

export async function fetchAllConfig() {
  const res = await fetch(API_URL + '?action=getAllConfig');
  return await res.json();
}

export async function fetchPrices(woodId) {
  const url = woodId
    ? API_URL + '?action=getPrices&woodId=' + encodeURIComponent(woodId)
    : API_URL + '?action=getAllPrices';
  const res = await fetch(url);
  return await res.json();
}

export async function fetchChangeLogs(woodId, limit) {
  let url = API_URL + '?action=getChangeLogs';
  if (woodId) url += '&woodId=' + encodeURIComponent(woodId);
  if (limit) url += '&limit=' + limit;
  const res = await fetch(url);
  return await res.json();
}

// ===== POST requests =====

async function postAPI(data) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(data),
  });
  return await res.json();
}

export async function updatePrice(woodId, skuKey, newPrice, oldPrice, reason, changedBy) {
  return await postAPI({
    action: 'updatePrice',
    woodId,
    skuKey,
    newPrice,
    oldPrice,
    reason,
    changedBy: changedBy || 'admin',
  });
}

// wood_types schema: id | name | name_en | icon
export async function addWoodType(id, name, nameEn, icon) {
  return await postAPI({ action: 'addWoodType', id, name, nameEn: nameEn, icon });
}

export async function apiUpdateWoodType(id, name, nameEn, icon) {
  return await postAPI({ action: 'updateWoodType', id, name, nameEn: nameEn, icon });
}

export async function deleteWoodType(id) {
  return await postAPI({ action: 'deleteWoodType', id });
}

// Lưu thứ tự loại gỗ: ids = ["walnut", "ash", ...]
export async function updateWoodOrder(ids) {
  return await postAPI({ action: 'updateWoodOrder', ids });
}

// wood_config schema: wood_id | attr_id | selected_values | is_header
// config = { attrs:[], attrValues:{}, defaultHeader:[] }
export async function saveWoodConfig(woodId, config) {
  return await postAPI({ action: 'saveWoodConfig', woodId, config });
}

// attributes schema: id | name | groupable | values
export async function saveAttribute(id, name, groupable, values) {
  return await postAPI({ action: 'saveAttribute', id, name, groupable, values });
}

export async function deleteAttribute(id) {
  return await postAPI({ action: 'deleteAttribute', id });
}

// ===== Load tất cả data 1 lần =====

export async function loadAllData() {
  const [woodTypes, attributes, config, prices] = await Promise.all([
    fetchWoodTypes(),
    fetchAttributes(),
    fetchAllConfig(),
    fetchPrices(),
  ]);
  return { woodTypes, attributes, config, prices };
}
