/**
 * GTH Pricing — API kết nối Supabase
 *
 * HƯỚNG DẪN:
 * 1. Vào Supabase dashboard → Project Settings → API
 * 2. Thay SUPABASE_URL bằng "Project URL"
 * 3. Thay SUPABASE_KEY bằng key "anon / public"
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tscddgjkelnmlitzcxyg.supabase.co';  // ← thay ở đây
const SUPABASE_KEY = 'sb_publishable_MjQvtQAGbVFsAVZRQ3kmig_XnHKHuEc';                 // ← thay ở đây

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== GET =====

export async function fetchWoodTypes() {
  const { data, error } = await sb.from('wood_types').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, name: r.name, nameEn: r.name_en, icon: r.icon, code: r.code || "", unit: r.unit || 'm3' }));
}

export async function fetchAttributes() {
  const { data, error } = await sb.from('attributes').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    groupable: r.groupable,
    values: r.values ? r.values.split(',').map(v => v.trim()).filter(Boolean) : [],
    rangeGroups: r.range_groups || null,
  }));
}

export async function fetchAllConfig() {
  const { data, error } = await sb.from('wood_config').select('*');
  if (error) throw new Error(error.message);
  const result = {};
  (data || []).forEach(r => {
    if (!result[r.wood_id]) result[r.wood_id] = { attrs: [], attrValues: {}, defaultHeader: [], rangeGroups: {}, attrPriceGroups: {} };
    result[r.wood_id].attrs.push(r.attr_id);
    result[r.wood_id].attrValues[r.attr_id] = r.selected_values
      ? r.selected_values.split(',').map(v => v.trim()).filter(Boolean)
      : [];
    if (r.is_header) result[r.wood_id].defaultHeader.push(r.attr_id);
    if (r.range_groups) result[r.wood_id].rangeGroups[r.attr_id] = r.range_groups;
    if (r.price_group_config) result[r.wood_id].attrPriceGroups[r.attr_id] = r.price_group_config;
  });
  return result;
}

export async function fetchPrices(woodId) {
  let query = sb.from('prices').select('*');
  if (woodId) query = query.eq('wood_id', woodId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const result = {};
  (data || []).forEach(r => {
    const key = r.wood_id + '||' + r.sku_key;
    result[key] = {
      price: r.price != null ? parseFloat(r.price) : null,
      price2: r.price2 != null ? parseFloat(r.price2) : undefined,
      updated: r.updated_date ? String(r.updated_date).slice(0, 10) : '',
      updatedBy: r.updated_by,
      costPrice: r.cost_price != null ? parseFloat(r.cost_price) : undefined,
    };
  });
  return result;
}

export async function fetchChangeLogs(woodId, limit = 50) {
  let query = sb.from('change_log').select('*').order('timestamp', { ascending: false }).limit(limit);
  if (woodId) query = query.eq('wood_id', woodId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// ===== WOOD TYPES =====

export async function addWoodType(id, name, nameEn, icon, code, unit) {
  const { data: existing } = await sb.from('wood_types').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = existing?.length ? (existing[0].sort_order + 1) : 0;
  const { error } = await sb.from('wood_types').insert({ id, name, name_en: nameEn, icon, code: code || null, sort_order: nextOrder, unit: unit || 'm3' });
  return error ? { error: error.message } : { success: true };
}

export async function apiUpdateWoodType(id, name, nameEn, icon, code) {
  const { error } = await sb.from('wood_types').update({ name, name_en: nameEn, icon, code: code || null }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteWoodType(id) {
  const { error } = await sb.from('wood_types').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function updateWoodOrder(ids) {
  const updates = ids.map((id, i) => sb.from('wood_types').update({ sort_order: i }).eq('id', id));
  await Promise.all(updates);
  return { success: true };
}

// ===== ATTRIBUTES =====

export async function saveAttribute(id, name, groupable, values, rangeGroups) {
  const valuesStr = Array.isArray(values) ? values.join(', ') : (values || '');
  const row = { id, name, groupable, values: valuesStr };
  if (rangeGroups !== undefined) row.range_groups = rangeGroups || null;
  const { error } = await sb.from('attributes').upsert(row, { onConflict: 'id' });
  return error ? { error: error.message } : { success: true };
}

export async function deleteAttribute(id) {
  const { error } = await sb.from('attributes').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== WOOD CONFIG =====

export async function saveWoodConfig(woodId, config) {
  await sb.from('wood_config').delete().eq('wood_id', woodId);
  const rows = (config.attrs || []).map(attrId => ({
    wood_id: woodId,
    attr_id: attrId,
    selected_values: (config.attrValues[attrId] || []).join(', '),
    is_header: (config.defaultHeader || []).includes(attrId),
    range_groups: config.rangeGroups?.[attrId] || null,
    price_group_config: config.attrPriceGroups?.[attrId] || null,
  }));
  if (rows.length > 0) {
    const { error } = await sb.from('wood_config').insert(rows);
    if (error) return { error: error.message };
  }
  return { success: true };
}

// ===== PRICES =====

export async function updatePrice(woodId, skuKey, newPrice, oldPrice, reason, changedBy, costPrice, price2) {
  const row = {
    wood_id: woodId,
    sku_key: skuKey,
    price: newPrice,
    updated_date: new Date().toISOString().slice(0, 10),
    updated_by: changedBy || 'admin',
    ...(costPrice != null && { cost_price: costPrice }),
    ...(price2 != null && { price2: price2 }),
  };
  const { error } = await sb.from('prices').upsert(row, { onConflict: 'wood_id,sku_key' });
  if (error) return { error: error.message };

  await sb.from('change_log').insert({
    wood_id: woodId, sku_key: skuKey,
    old_price: oldPrice ?? null,
    new_price: newPrice ?? null,
    reason: reason || '',
    changed_by: changedBy || 'admin',
  });
  return { ok: true };
}

export async function renameAttrValue(attrId, oldVal, newVal) {
  const seg = `${attrId}:${oldVal}`;
  const newSeg = `${attrId}:${newVal}`;
  let pricesMigrated = 0, bundlesMigrated = 0, logsMigrated = 0;

  // 1. Prices: fetch → insert new key → delete old key
  const { data: pRows, error: pErr } = await sb.from('prices')
    .select('wood_id,sku_key,price,price2,updated_date,updated_by,cost_price')
    .like('sku_key', `%${seg}%`);
  if (pErr) return { error: pErr.message };
  for (const row of (pRows || [])) {
    const segs = row.sku_key.split('||');
    if (!segs.includes(seg)) continue;
    const newSkuKey = segs.map(s => s === seg ? newSeg : s).join('||');
    const { error: ie } = await sb.from('prices').upsert(
      { wood_id: row.wood_id, sku_key: newSkuKey, price: row.price, price2: row.price2 ?? null, updated_date: row.updated_date, updated_by: row.updated_by, cost_price: row.cost_price },
      { onConflict: 'wood_id,sku_key' }
    );
    if (ie) return { error: ie.message };
    await sb.from('prices').delete().eq('wood_id', row.wood_id).eq('sku_key', row.sku_key);
    pricesMigrated++;
  }

  // 2. Bundles: update sku_key + attributes jsonb
  const { data: bRows, error: bErr } = await sb.from('wood_bundles')
    .select('id,sku_key,attributes')
    .contains('attributes', { [attrId]: oldVal });
  if (bErr) return { error: bErr.message };
  for (const row of (bRows || [])) {
    const newAttrs = { ...row.attributes, [attrId]: newVal };
    const newSkuKey = (row.sku_key || '').split('||').map(s => s === seg ? newSeg : s).join('||');
    const { error: ue } = await sb.from('wood_bundles').update({ sku_key: newSkuKey, attributes: newAttrs }).eq('id', row.id);
    if (ue) return { error: ue.message };
    bundlesMigrated++;
  }

  // 3. Change log (lịch sử bảng giá)
  const { data: cRows, error: cErr } = await sb.from('change_log')
    .select('id,sku_key')
    .like('sku_key', `%${seg}%`);
  if (cErr) return { error: cErr.message };
  for (const row of (cRows || [])) {
    const segs = row.sku_key.split('||');
    if (!segs.includes(seg)) continue;
    const newSkuKey = segs.map(s => s === seg ? newSeg : s).join('||');
    await sb.from('change_log').update({ sku_key: newSkuKey }).eq('id', row.id);
    logsMigrated++;
  }

  return { success: true, pricesMigrated, bundlesMigrated, logsMigrated };
}

// ===== PRODUCT CATALOG =====

export async function fetchProductCatalog() {
  const { data, error } = await sb.from('product_catalog').select('*').order('sort_order');
  if (error) return [];
  return (data || []).map(r => ({ id: r.id, name: r.name, sortOrder: r.sort_order ?? 0 }));
}

export async function upsertProductCatalogItem(id, name, sortOrder) {
  const { error } = await sb.from('product_catalog').upsert({ id, name, sort_order: sortOrder ?? 0 }, { onConflict: 'id' });
  return error ? { error: error.message } : { success: true };
}

export async function deleteProductCatalogItem(id) {
  const { error } = await sb.from('product_catalog').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== PREFERENCE CATALOG =====

export async function fetchPreferenceCatalog() {
  const { data, error } = await sb.from('preference_catalog').select('*').order('sort_order');
  if (error) return [];
  return (data || []).map(r => ({ id: r.id, name: r.name, sortOrder: r.sort_order ?? 0 }));
}

export async function upsertPreferenceCatalogItem(id, name, sortOrder) {
  const { error } = await sb.from('preference_catalog').upsert({ id, name, sort_order: sortOrder ?? 0 }, { onConflict: 'id' });
  return error ? { error: error.message } : { success: true };
}

export async function deletePreferenceCatalogItem(id) {
  const { error } = await sb.from('preference_catalog').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== LOAD ALL =====

export async function loadAllData() {
  const [woodTypes, attributes, config, prices, productCatalog, preferenceCatalog] = await Promise.all([
    fetchWoodTypes(),
    fetchAttributes(),
    fetchAllConfig(),
    fetchPrices(),
    fetchProductCatalog(),
    fetchPreferenceCatalog(),
  ]);
  return { woodTypes, attributes, config, prices, productCatalog, preferenceCatalog };
}

// ===== SUPPLIERS =====

export async function fetchSuppliers() {
  const { data, error } = await sb.from('suppliers').select('*').order('id');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, nccId: r.ncc_id, name: r.name, code: r.code, description: r.description, configurable: r.configurable ?? false }));
}

export async function addSupplier(nccId, name, code, description, configurable) {
  const { error } = await sb.from('suppliers').insert({ ncc_id: nccId, name, code: code || null, description: description || null, configurable: !!configurable });
  return error ? { error: error.message } : { success: true };
}

export async function updateSupplier(id, nccId, name, code, description, configurable) {
  const { error } = await sb.from('suppliers').update({ ncc_id: nccId, name, code: code || null, description: description || null, configurable: !!configurable }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteSupplier(id) {
  const { error } = await sb.from('suppliers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== CARRIERS =====

export async function fetchCarriers() {
  const { data, error } = await sb.from('carriers').select('*').order('priority').order('id');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, name: r.name, phone: r.phone || '', active: r.active ?? true,
    serviceType: r.service_type || 'chi_van_chuyen',
    priority: r.priority ?? 1,
    vehicles: r.vehicles || [],
  }));
}

export async function addCarrier(name, phone, serviceType, priority, vehicles) {
  const { data, error } = await sb.from('carriers').insert({
    name, phone: phone || null, active: true,
    service_type: serviceType || 'chi_van_chuyen',
    priority: priority ?? 1,
    vehicles: vehicles || [],
  }).select().single();
  return error ? { error: error.message } : { id: data.id };
}

export async function updateCarrier(id, name, phone, active, serviceType, priority, vehicles) {
  const { error } = await sb.from('carriers').update({
    name, phone: phone || null, active,
    service_type: serviceType || 'chi_van_chuyen',
    priority: priority ?? 1,
    vehicles: vehicles || [],
  }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteCarrier(id) {
  const { error } = await sb.from('carriers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== CONTAINERS =====

export async function fetchContainers() {
  const { data, error } = await sb.from('containers').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, containerCode: r.container_code, nccId: r.ncc_id,
    arrivalDate: r.arrival_date, totalVolume: r.total_volume != null ? parseFloat(r.total_volume) : null,
    status: r.status || 'Tạo mới', notes: r.notes,
  }));
}

export async function addContainer(containerCode, nccId, arrivalDate, totalVolume, status, notes) {
  const { data, error } = await sb.from('containers').insert({
    container_code: containerCode, ncc_id: nccId || null,
    arrival_date: arrivalDate || null, total_volume: totalVolume || null,
    status: status || 'Tạo mới', notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateContainer(id, containerCode, nccId, arrivalDate, totalVolume, status, notes) {
  const { error } = await sb.from('containers').update({
    container_code: containerCode, ncc_id: nccId || null,
    arrival_date: arrivalDate || null, total_volume: totalVolume || null,
    status: status || 'Tạo mới', notes: notes || null,
  }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteContainer(id) {
  const { error } = await sb.from('containers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function fetchAllContainerItems() {
  const { data, error } = await sb.from('container_items').select('*').order('container_id').order('id');
  if (error) throw new Error(error.message);
  const result = {};
  (data || []).forEach(r => {
    if (!result[r.container_id]) result[r.container_id] = [];
    result[r.container_id].push({ id: r.id, woodId: r.wood_id, thickness: r.thickness, quality: r.quality, volume: r.volume != null ? parseFloat(r.volume) : null, notes: r.notes });
  });
  return result;
}

export async function fetchContainerItems(containerId) {
  const { data, error } = await sb.from('container_items').select('*').eq('container_id', containerId).order('id');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, woodId: r.wood_id, thickness: r.thickness, quality: r.quality,
    volume: r.volume != null ? parseFloat(r.volume) : null, notes: r.notes,
  }));
}

export async function addContainerItem(containerId, woodId, thickness, quality, volume, notes) {
  const { data, error } = await sb.from('container_items').insert({
    container_id: containerId, wood_id: woodId, thickness: thickness || null,
    quality: quality || null, volume: volume || null, notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateContainerItem(id, woodId, thickness, quality, volume, notes) {
  const { error } = await sb.from('container_items').update({
    wood_id: woodId, thickness: thickness || null, quality: quality || null,
    volume: volume || null, notes: notes || null,
  }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteContainerItem(id) {
  const { error } = await sb.from('container_items').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== WOOD BUNDLES (THỦ KHO) =====

function mapBundleRow(r) {
  return {
    id: r.id,
    bundleCode: r.bundle_code,
    woodId: r.wood_id,
    containerId: r.container_id,
    skuKey: r.sku_key,
    attributes: r.attributes || {},
    boardCount: r.board_count || 0,
    remainingBoards: r.remaining_boards != null ? r.remaining_boards : (r.board_count || 0),
    volume: r.volume != null ? parseFloat(r.volume) : 0,
    remainingVolume: r.remaining_volume != null ? parseFloat(r.remaining_volume) : 0,
    status: r.status || 'Kiện nguyên',
    notes: r.notes || '',
    supplierBundleCode: r.supplier_bundle_code || '',
    location: r.location || '',
    qrCode: r.qr_code || r.bundle_code,
    images: r.images || [],
    itemListImages: r.item_list_images || [],
    rawMeasurements: r.raw_measurements || {},
    manualGroupAssignment: r.manual_group_assignment || false,
    createdAt: r.created_at,
    lockedBy: r.locked_by || null,
    lockedAt: r.locked_at || null,
    unitPrice: r.unit_price != null ? parseFloat(r.unit_price) : null,
  };
}

// V-21: Bundle soft lock để tránh bán trùng
export async function lockBundle(bundleId, lockedBy) {
  const { error } = await sb.from('wood_bundles')
    .update({ locked_by: lockedBy, locked_at: new Date().toISOString() })
    .eq('id', bundleId);
  return error ? { error: error.message } : { success: true };
}

export async function unlockBundle(bundleId) {
  const { error } = await sb.from('wood_bundles')
    .update({ locked_by: null, locked_at: null })
    .eq('id', bundleId);
  return error ? { error: error.message } : { success: true };
}

// Migrate kiện gỗ: đổi giá trị một thuộc tính từ oldVal → newVal cho wood_id nhất định
export async function migrateBundleGroupValue(woodId, attrId, fromVal, toVal) {
  const { data, error } = await sb.from('wood_bundles')
    .select('id, attributes, sku_key')
    .eq('wood_id', woodId);
  if (error) return { error: error.message };
  const affected = (data || []).filter(r => r.attributes?.[attrId] === fromVal);
  if (!affected.length) return { count: 0, failed: 0 };
  let updated = 0, failed = 0;
  for (const row of affected) {
    const newAttrs = { ...row.attributes, [attrId]: toVal };
    const newSkuKey = (row.sku_key || '').replace(`${attrId}:${fromVal}`, `${attrId}:${toVal}`);
    const { error: ue } = await sb.from('wood_bundles')
      .update({ attributes: newAttrs, sku_key: newSkuKey })
      .eq('id', row.id);
    if (ue) failed++; else updated++;
  }
  return { count: updated, failed };
}

export async function fetchBundles() {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await sb.from('wood_bundles').select('*').order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all.map(mapBundleRow);
}

async function genBundleCode(woodId) {
  const { data: wt } = await sb.from('wood_types').select('code,id').eq('id', woodId).single();
  const prefix = ((wt?.code || woodId) + '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { data: existing } = await sb.from('wood_bundles')
    .select('bundle_code')
    .like('bundle_code', `${prefix}-${date}-%`)
    .order('bundle_code', { ascending: false })
    .limit(1);
  const nextNum = existing?.length ? (parseInt(existing[0].bundle_code.split('-').pop()) || 0) + 1 : 1;
  return `${prefix}-${date}-${String(nextNum).padStart(3, '0')}`;
}

export async function addBundle({ woodId, containerId, skuKey, attributes, boardCount, remainingBoards, volume, remainingVolume, notes, supplierBundleCode, location, rawMeasurements, manualGroupAssignment, unit_price }) {
  const bundleCode = await genBundleCode(woodId);
  const bc = parseInt(boardCount) || 0;
  const rb = remainingBoards != null ? (parseInt(remainingBoards) ?? bc) : bc;
  const vol = parseFloat(volume) || 0;
  const rv = remainingVolume != null ? (parseFloat(remainingVolume) ?? vol) : vol;
  const row = {
    bundle_code: bundleCode,
    wood_id: woodId,
    container_id: containerId || null,
    sku_key: skuKey,
    attributes,
    board_count: bc,
    remaining_boards: rb,
    volume: vol,
    remaining_volume: rv,
    status: rb < bc ? 'Kiện lẻ' : 'Kiện nguyên',
    notes: notes || null,
    supplier_bundle_code: supplierBundleCode || null,
    location: location || null,
    qr_code: bundleCode,
    ...(rawMeasurements && Object.keys(rawMeasurements).length ? { raw_measurements: rawMeasurements } : {}),
    ...(manualGroupAssignment ? { manual_group_assignment: true } : {}),
    ...(unit_price != null && !isNaN(parseFloat(unit_price)) ? { unit_price: parseFloat(unit_price) } : {}),
  };
  const { data, error } = await sb.from('wood_bundles').insert(row).select().single();
  if (error) return { error: error.message };
  const { data: priceData } = await sb.from('prices').select('id').eq('wood_id', woodId).eq('sku_key', skuKey).limit(1);
  return { success: true, id: data.id, bundleCode, unpricedSku: !(priceData && priceData.length > 0) };
}

export async function updateBundle(id, updates) {
  const { error } = await sb.from('wood_bundles').update(updates).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteBundle(id) {
  const { error } = await sb.from('wood_bundles').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// V-20: kiểm tra bundle có đang trong order_items không
export async function checkBundleInOrders(bundleId) {
  const { count, error } = await sb.from('order_items').select('id', { count: 'exact', head: true }).eq('bundle_id', bundleId);
  if (error) return true; // nếu lỗi, chặn xóa để an toàn
  return count > 0;
}

// ===== CUSTOMERS =====

function genCustCode(name, address, phone) {
  const n = name.replace(/^(anh|chị|ông|bà|ms|mr)\s+/i, '').trim().split(/\s+/).pop();
  const namePart = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'KH';
  const addrWords = (address || '').split(/[,\/]/).pop()?.trim().split(/\s+/) || [];
  const addrPart = (addrWords[addrWords.length - 1] || 'XX').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'XX';
  const phonePart = (phone || '').replace(/\D/g, '').slice(-3) || '000';
  return `${namePart}-${addrPart}-${phonePart}`;
}

export async function fetchCustomers() {
  const { data, error } = await sb.from('customers').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, customerCode: r.customer_code, salutation: r.salutation || '', name: r.name,
    nickname: r.nickname || '',
    dob: r.dob || '', address: r.address || '',
    commune: r.commune || '', streetAddress: r.street_address || '',
    workshopLat: r.workshop_lat ?? '', workshopLng: r.workshop_lng ?? '',
    phone1: r.phone1, phone2: r.phone2 || '',
    companyName: r.company_name || '', department: r.department || '', position: r.position || '',
    products: r.products || [],
    preferences: r.preferences || [],
    productDescription: r.product_description || '', debtLimit: r.debt_limit || 0,
    debtDays: r.debt_days || 30, notes: r.notes || '', createdAt: r.created_at,
  }));
}

export async function addCustomer(data) {
  const customerCode = data.customerCode || genCustCode(data.name, data.address, data.phone1);
  const { error } = await sb.from('customers').insert({
    customer_code: customerCode, salutation: data.salutation || null, name: data.name,
    nickname: data.nickname || null,
    dob: data.dob || null, address: data.address || '',
    commune: data.commune || null, street_address: data.streetAddress || null,
    workshop_lat: data.workshopLat !== '' && data.workshopLat != null ? parseFloat(data.workshopLat) : null,
    workshop_lng: data.workshopLng !== '' && data.workshopLng != null ? parseFloat(data.workshopLng) : null,
    phone1: data.phone1 || '',
    phone2: data.phone2 || null, company_name: data.companyName || null,
    department: data.department || null, position: data.position || null,
    products: data.products || [],
    preferences: data.preferences || [],
    product_description: data.productDescription || null,
    debt_limit: parseFloat(data.debtLimit) || 0, debt_days: parseInt(data.debtDays) || 30,
    notes: data.notes || null,
  });
  return error ? { error: error.message } : { success: true, customerCode };
}

export async function updateCustomer(id, data) {
  const { error } = await sb.from('customers').update({
    customer_code: data.customerCode || null, salutation: data.salutation || null, name: data.name,
    nickname: data.nickname || null,
    dob: data.dob || null, address: data.address || '',
    commune: data.commune || null, street_address: data.streetAddress || null,
    workshop_lat: data.workshopLat !== '' && data.workshopLat != null ? parseFloat(data.workshopLat) : null,
    workshop_lng: data.workshopLng !== '' && data.workshopLng != null ? parseFloat(data.workshopLng) : null,
    phone1: data.phone1 || '', phone2: data.phone2 || null, company_name: data.companyName || null,
    department: data.department || null, position: data.position || null,
    products: data.products || [],
    preferences: data.preferences || [],
    product_description: data.productDescription || null,
    debt_limit: parseFloat(data.debtLimit) || 0, debt_days: parseInt(data.debtDays) || 30,
    notes: data.notes || null,
  }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteCustomer(id) {
  const { error } = await sb.from('customers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Batch summary cho danh sách khách hàng: công nợ thực tế + ngày mua gần nhất
export async function fetchCustomersSummary() {
  // Song song: đơn chưa/còn nợ + tất cả đơn (để lấy ngày gần nhất)
  const [{ data: unpaidOrders }, { data: allOrders }] = await Promise.all([
    sb.from('orders').select('id, customer_id, total_amount, deposit, debt')
      .in('payment_status', ['Chưa thanh toán', 'Còn nợ']),
    sb.from('orders').select('customer_id, created_at')
      .order('created_at', { ascending: false }),
  ]);

  // Ngày mua gần nhất (lấy phần tử đầu tiên per customer do đã sort desc)
  const lastOrderMap = {};
  (allOrders || []).forEach(o => {
    if (!lastOrderMap[o.customer_id]) lastOrderMap[o.customer_id] = o.created_at;
  });

  // Payment records của đơn chưa thanh toán
  const unpaidIds = (unpaidOrders || []).map(o => o.id);
  let paidMap = {};
  if (unpaidIds.length) {
    const { data: payments } = await sb.from('payment_records')
      .select('order_id, amount, discount, discount_status')
      .in('order_id', unpaidIds);
    (payments || []).forEach(p => {
      const disc = ['auto', 'approved'].includes(p.discount_status) ? parseFloat(p.discount || 0) : 0;
      paidMap[p.order_id] = (paidMap[p.order_id] || 0) + parseFloat(p.amount) + disc;
    });
  }

  // Công nợ thực tế per customer
  const debtMap = {};
  (unpaidOrders || []).forEach(o => {
    const toPay = parseFloat(o.total_amount) - (parseFloat(o.deposit) || 0) - (parseFloat(o.debt) || 0);
    const outstanding = Math.max(0, toPay - (paidMap[o.id] || 0));
    if (outstanding > 0) debtMap[o.customer_id] = (debtMap[o.customer_id] || 0) + outstanding;
  });

  return { debtMap, lastOrderMap };
}

// V-25: tổng công nợ chưa thanh toán của khách hàng (bao gồm đơn Còn nợ)
export async function fetchCustomerUnpaidDebt(customerId) {
  const { data: orders, error } = await sb.from('orders')
    .select('id, total_amount, deposit, debt')
    .eq('customer_id', customerId)
    .in('payment_status', ['Chưa thanh toán', 'Còn nợ']);
  if (error || !orders?.length) return 0;
  const orderIds = orders.map(o => o.id);
  const { data: payments } = await sb.from('payment_records')
    .select('order_id, amount').in('order_id', orderIds);
  const paidMap = {};
  (payments || []).forEach(p => { paidMap[p.order_id] = (paidMap[p.order_id] || 0) + parseFloat(p.amount); });
  return orders.reduce((s, o) => {
    const toPay = parseFloat(o.total_amount) - (parseFloat(o.deposit) || 0) - (parseFloat(o.debt) || 0);
    return s + Math.max(0, toPay - (paidMap[o.id] || 0));
  }, 0);
}

export async function fetchXeSayConfig() {
  const { data, error } = await sb.from('app_settings').select('value').eq('key', 'xe_say_config').single();
  if (error || !data) return null;
  try { return JSON.parse(data.value); } catch { return null; }
}

export async function saveXeSayConfig(config) {
  const { error } = await sb.from('app_settings').upsert({ key: 'xe_say_config', value: JSON.stringify(config) }, { onConflict: 'key' });
  return error ? { error: error.message } : { success: true };
}

// V-26: lấy tỷ lệ VAT từ app_settings
export async function fetchVatRate() {
  const { data, error } = await sb.from('app_settings').select('value').eq('key', 'vat_rate').single();
  if (error || !data) return 0.08;
  return parseFloat(data.value) || 0.08;
}

// V-29: kiểm tra khách hàng có đơn hàng không
export async function checkCustomerHasOrders(customerId) {
  const { count, error } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', customerId);
  if (error) return false;
  return count > 0;
}

// ===== ORDERS =====

async function genOrderCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { data } = await sb.from('orders').select('order_code').like('order_code', `DH-${date}-%`).order('order_code', { ascending: false }).limit(1);
  const next = data?.length ? (parseInt(data[0].order_code.split('-').pop()) || 0) + 1 : 1;
  return `DH-${date}-${String(next).padStart(3, '0')}`;
}

function mapOrder(r) {
  return {
    id: r.id, orderCode: r.order_code, customerId: r.customer_id,
    customerName: r.customers?.name || '', customerAddress: r.customers?.address || '',
    customerPhone: r.customers?.phone1 || '',
    status: r.status || 'Đơn hàng mới',
    paymentStatus: r.payment_status || 'Chưa thanh toán', paymentDate: r.payment_date,
    exportStatus: r.export_status || 'Chưa xuất', exportDate: r.export_date,
    exportImages: r.export_images || [],
    subtotal: parseFloat(r.subtotal) || 0, applyTax: r.apply_tax !== false,
    taxAmount: parseFloat(r.tax_amount) || 0, deposit: parseFloat(r.deposit) || 0,
    debt: parseFloat(r.debt) || 0, totalAmount: parseFloat(r.total_amount) || 0,
    shippingType: r.shipping_type || 'Gọi xe cho khách',
    shippingCarrier: r.shipping_carrier || '', shippingFee: parseFloat(r.shipping_fee) || 0,
    driverName: r.driver_name || '', driverPhone: r.driver_phone || '',
    deliveryAddress: r.delivery_address || '', licensePlate: r.license_plate || '',
    estimatedArrival: r.estimated_arrival || '', shippingNotes: r.shipping_notes || '',
    notes: r.notes || '', createdAt: r.created_at,
  };
}

export async function fetchPendingOrdersCount() {
  const { count, error } = await sb.from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('payment_status', 'Chờ duyệt');
  if (error) return 0;
  return count || 0;
}

export async function fetchOrders() {
  const { data, error } = await sb.from('orders').select('*, customers(name,address,phone1)').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapOrder);
}

export async function fetchOrderDetail(orderId) {
  const [{ data: ord }, { data: items }, { data: services }, { data: payments }] = await Promise.all([
    sb.from('orders').select('*, customers(*)').eq('id', orderId).single(),
    sb.from('order_items').select('*').eq('order_id', orderId).order('id'),
    sb.from('order_services').select('*').eq('order_id', orderId).order('id'),
    sb.from('payment_records').select('*').eq('order_id', orderId).order('paid_at'),
  ]);
  return {
    order: ord ? mapOrder(ord) : null,
    customer: ord?.customers || null,
    items: (items || []).map(r => ({ id: r.id, bundleId: r.bundle_id, bundleCode: r.bundle_code, supplierBundleCode: r.supplier_bundle_code || '', woodId: r.wood_id, skuKey: r.sku_key, attributes: r.attributes || {}, boardCount: r.board_count || 0, volume: parseFloat(r.volume) || 0, unit: r.unit || 'm3', unitPrice: parseFloat(r.unit_price), listPrice: r.list_price != null ? parseFloat(r.list_price) : null, listPrice2: r.list_price2 != null ? parseFloat(r.list_price2) : null, amount: parseFloat(r.amount) || 0, notes: r.notes || '' })),
    services: (services || []).map(r => r.payload?.type ? { id: r.id, ...r.payload, amount: parseFloat(r.amount) || 0 } : { id: r.id, type: 'other', description: r.description || '', amount: parseFloat(r.amount) || 0 }),
    paymentRecords: (payments || []).map(mapPaymentRecord),
  };
}

export async function approveOrderPrice(orderId) {
  const { error } = await sb.from('orders')
    .update({ payment_status: 'Chưa thanh toán', status: 'Chưa thanh toán' })
    .eq('id', orderId)
    .eq('payment_status', 'Chờ duyệt');
  return error ? { error: error.message } : { success: true };
}

export async function createOrder(orderData, items, services) {
  const targetStatus = orderData.targetStatus || 'Chưa thanh toán';
  const MAPPED = { 'Đã thanh toán': 'Đã thanh toán', 'Nháp': 'Nháp', 'Chờ duyệt': 'Chờ duyệt' };
  const paymentStatus = MAPPED[targetStatus] || 'Chưa thanh toán';
  // order_code được DB trigger tự sinh — không cần query riêng
  const { data: ord, error: oe } = await sb.from('orders').insert({
    customer_id: orderData.customerId,
    status: targetStatus, payment_status: paymentStatus,
    payment_date: targetStatus === 'Đã thanh toán' ? new Date().toISOString() : null,
    export_status: 'Chưa xuất',
    subtotal: orderData.subtotal, apply_tax: orderData.applyTax, tax_amount: orderData.taxAmount,
    deposit: orderData.deposit || 0, debt: orderData.debt || 0, total_amount: orderData.totalAmount,
    shipping_type: orderData.shippingType, shipping_carrier: orderData.shippingCarrier || null,
    shipping_fee: orderData.shippingFee || 0, driver_name: orderData.driverName || null,
    driver_phone: orderData.driverPhone || null, delivery_address: orderData.deliveryAddress || null,
    license_plate: orderData.licensePlate || null, estimated_arrival: orderData.estimatedArrival || null,
    shipping_notes: orderData.shippingNotes || null, notes: orderData.notes || null,
  }).select().single();
  if (oe) return { error: oe.message };

  // Insert items và services song song (không phụ thuộc nhau)
  const itemRows = items.map(it => ({ order_id: ord.id, bundle_id: it.bundleId || null, bundle_code: it.bundleCode, supplier_bundle_code: it.supplierBundleCode || null, wood_id: it.woodId, sku_key: it.skuKey, attributes: it.attributes, board_count: it.boardCount, volume: it.volume, unit: it.unit, unit_price: it.unitPrice, list_price: it.listPrice ?? null, list_price2: it.listPrice2 ?? null, amount: it.amount, notes: it.notes || null }));
  const svcRows = services.filter(s => s.amount > 0).map(s => ({ order_id: ord.id, description: s.description || '', amount: s.amount, payload: s }));
  const inserts = [];
  if (itemRows.length) inserts.push(sb.from('order_items').insert(itemRows));
  if (svcRows.length) inserts.push(sb.from('order_services').insert(svcRows));
  if (inserts.length) {
    const results = await Promise.all(inserts);
    const err = results.find(r => r.error);
    if (err) return { error: err.error.message };
  }
  return { success: true, id: ord.id, orderCode: ord.order_code };
}

export async function updateOrder(id, orderData, items, services) {
  const update = {
    customer_id: orderData.customerId, subtotal: orderData.subtotal,
    apply_tax: orderData.applyTax, tax_amount: orderData.taxAmount,
    deposit: orderData.deposit || 0, debt: orderData.debt || 0, total_amount: orderData.totalAmount,
    shipping_type: orderData.shippingType, shipping_carrier: orderData.shippingCarrier || null,
    shipping_fee: orderData.shippingFee || 0, driver_name: orderData.driverName || null,
    driver_phone: orderData.driverPhone || null, delivery_address: orderData.deliveryAddress || null,
    license_plate: orderData.licensePlate || null, estimated_arrival: orderData.estimatedArrival || null,
    shipping_notes: orderData.shippingNotes || null, notes: orderData.notes || null,
  };
  if (orderData.targetStatus) {
    const MAPPED2 = { 'Đã thanh toán': 'Đã thanh toán', 'Nháp': 'Nháp', 'Chờ duyệt': 'Chờ duyệt' };
    update.status = orderData.targetStatus;
    update.payment_status = MAPPED2[orderData.targetStatus] || 'Chưa thanh toán';
    if (orderData.targetStatus === 'Đã thanh toán') update.payment_date = new Date().toISOString();
  }
  const { error: oe } = await sb.from('orders').update(update).eq('id', id);
  if (oe) return { error: oe.message };
  await Promise.all([sb.from('order_items').delete().eq('order_id', id), sb.from('order_services').delete().eq('order_id', id)]);
  const itemRows = items.map(it => ({ order_id: id, bundle_id: it.bundleId || null, bundle_code: it.bundleCode, supplier_bundle_code: it.supplierBundleCode || null, wood_id: it.woodId, sku_key: it.skuKey, attributes: it.attributes, board_count: it.boardCount, volume: it.volume, unit: it.unit, unit_price: it.unitPrice, list_price: it.listPrice ?? null, list_price2: it.listPrice2 ?? null, amount: it.amount, notes: it.notes || null }));
  const svcRows = services.filter(s => s.amount > 0).map(s => ({ order_id: id, description: s.description || '', amount: s.amount, payload: s }));
  const inserts = [];
  if (itemRows.length) inserts.push(sb.from('order_items').insert(itemRows));
  if (svcRows.length) inserts.push(sb.from('order_services').insert(svcRows));
  if (inserts.length) await Promise.all(inserts);
  return { success: true };
}

// ===== PAYMENT RECORDS =====

const DISCOUNT_AUTO_LIMIT = 200000; // < 200k: tự duyệt; >= 200k: cần admin duyệt

function mapPaymentRecord(r) {
  return {
    id: r.id,
    amount: parseFloat(r.amount),
    method: r.method || 'Tiền mặt',
    discount: parseFloat(r.discount) || 0,
    discountNote: r.discount_note || '',
    discountStatus: r.discount_status || 'none',
    paidAt: r.paid_at,
    note: r.note || '',
    paidBy: r.paid_by || '',
  };
}

// Tính outstanding từ danh sách payment_records (chỉ tính discount đã duyệt)
function calcOutstanding(toPay, records) {
  return records.reduce((rem, r) => {
    const discountCounts = r.discountStatus === 'auto' || r.discountStatus === 'approved';
    return rem - (r.amount || 0) - (discountCounts ? (r.discount || 0) : 0);
  }, toPay);
}

async function deductBundlesForOrderId(orderId) {
  const { data: items } = await sb.from('order_items').select('bundle_id,board_count,volume').eq('order_id', orderId);
  for (const it of (items || [])) {
    if (!it.bundle_id) continue;
    const { data: b } = await sb.from('wood_bundles').select('remaining_boards,remaining_volume').eq('id', it.bundle_id).single();
    if (!b) continue;
    const newBoards = Math.max(0, (b.remaining_boards || 0) - (it.board_count || 0));
    const newVol = Math.max(0, parseFloat(b.remaining_volume || 0) - parseFloat(it.volume || 0));
    await sb.from('wood_bundles').update({ remaining_boards: newBoards, remaining_volume: parseFloat(newVol.toFixed(4)), status: newBoards <= 0 ? 'Đã bán' : 'Kiện lẻ' }).eq('id', it.bundle_id);
  }
}

export async function recordPayment(orderId, { amount, method, note, paidBy, discount, discountNote }) {
  const { data: order, error: oe } = await sb.from('orders')
    .select('customer_id, total_amount, deposit, debt')
    .eq('id', orderId).single();
  if (oe || !order) return { error: oe?.message || 'Không tìm thấy đơn hàng' };

  const discountAmt = parseFloat(discount) || 0;
  const discountStatus = discountAmt <= 0 ? 'none'
    : discountAmt < DISCOUNT_AUTO_LIMIT ? 'auto'
    : 'pending'; // >= 200k cần admin duyệt

  const { error: pe } = await sb.from('payment_records').insert({
    order_id: orderId, customer_id: order.customer_id,
    amount: parseFloat(amount), method: method || 'Tiền mặt',
    discount: discountAmt, discount_note: discountNote || null,
    discount_status: discountStatus,
    paid_at: new Date().toISOString(), note: note || null, paid_by: paidBy || null,
  });
  if (pe) return { error: pe.message };

  const toPay = parseFloat(order.total_amount) - (parseFloat(order.deposit) || 0) - (parseFloat(order.debt) || 0);
  const { data: allRec } = await sb.from('payment_records').select('*').eq('order_id', orderId);
  const records = (allRec || []).map(mapPaymentRecord);
  const outstanding = Math.max(0, calcOutstanding(toPay, records));

  const fullyPaid = outstanding <= 0;
  const hasPendingDiscount = records.some(r => r.discountStatus === 'pending');
  const newPaymentStatus = fullyPaid ? 'Đã thanh toán' : 'Còn nợ';
  const updates = fullyPaid
    ? { payment_status: 'Đã thanh toán', payment_date: new Date().toISOString(), status: 'Đã thanh toán' }
    : { payment_status: 'Còn nợ' };

  const { error: ue } = await sb.from('orders').update(updates).eq('id', orderId);
  if (ue) return { error: ue.message };

  if (fullyPaid) await deductBundlesForOrderId(orderId);

  return { success: true, paymentStatus: newPaymentStatus, outstanding, hasPendingDiscount, discountStatus };
}

// Admin duyệt hoặc từ chối gia hàng
export async function approvePaymentDiscount(recordId, approve) {
  const newStatus = approve ? 'approved' : 'rejected';
  const { data: rec, error: re } = await sb.from('payment_records')
    .update({ discount_status: newStatus }).eq('id', recordId).select('order_id').single();
  if (re) return { error: re.message };

  // Sau duyệt, kiểm tra lại outstanding của đơn
  const orderId = rec.order_id;
  const { data: order } = await sb.from('orders').select('total_amount, deposit, debt').eq('id', orderId).single();
  const toPay = parseFloat(order.total_amount) - (parseFloat(order.deposit) || 0) - (parseFloat(order.debt) || 0);
  const { data: allRec } = await sb.from('payment_records').select('*').eq('order_id', orderId);
  const records = (allRec || []).map(mapPaymentRecord);
  const outstanding = Math.max(0, calcOutstanding(toPay, records));

  if (approve && outstanding <= 0) {
    await sb.from('orders').update({ payment_status: 'Đã thanh toán', payment_date: new Date().toISOString(), status: 'Đã thanh toán' }).eq('id', orderId);
    await deductBundlesForOrderId(orderId);
    return { success: true, paymentStatus: 'Đã thanh toán', outstanding: 0 };
  }
  return { success: true, paymentStatus: outstanding <= 0 ? 'Đã thanh toán' : 'Còn nợ', outstanding };
}

export async function fetchPaymentRecords(orderId) {
  const { data, error } = await sb.from('payment_records').select('*').eq('order_id', orderId).order('paid_at');
  if (error) return [];
  return (data || []).map(mapPaymentRecord);
}

export async function updateOrderPayment(id) {
  const { error } = await sb.from('orders').update({ payment_status: 'Đã thanh toán', payment_date: new Date().toISOString(), status: 'Đã thanh toán' }).eq('id', id);
  if (error) return { error: error.message };
  const { data: items } = await sb.from('order_items').select('bundle_id,board_count,volume').eq('order_id', id);
  for (const it of (items || [])) {
    if (!it.bundle_id) continue;
    const { data: b } = await sb.from('wood_bundles').select('remaining_boards,remaining_volume').eq('id', it.bundle_id).single();
    if (!b) continue;
    const newBoards = Math.max(0, (b.remaining_boards || 0) - (it.board_count || 0));
    const newVol = Math.max(0, parseFloat(b.remaining_volume || 0) - parseFloat(it.volume || 0));
    await sb.from('wood_bundles').update({ remaining_boards: newBoards, remaining_volume: parseFloat(newVol.toFixed(4)), status: newBoards <= 0 ? 'Đã bán' : 'Kiện lẻ' }).eq('id', it.bundle_id);
  }
  return { success: true };
}

export async function deductBundlesForOrder(items) {
  for (const it of items) {
    if (!it.bundleId) continue;
    const { data: b } = await sb.from('wood_bundles').select('remaining_boards,remaining_volume').eq('id', it.bundleId).single();
    if (!b) continue;
    const newBoards = Math.max(0, (b.remaining_boards || 0) - (parseInt(it.boardCount) || 0));
    const newVol = Math.max(0, parseFloat(b.remaining_volume || 0) - parseFloat(it.volume || 0));
    await sb.from('wood_bundles').update({ remaining_boards: newBoards, remaining_volume: parseFloat(newVol.toFixed(4)), status: newBoards <= 0 ? 'Đã bán' : 'Kiện lẻ' }).eq('id', it.bundleId);
  }
  return { success: true };
}

export async function updateOrderExport(id, images) {
  const { error } = await sb.from('orders').update({ export_status: 'Đã xuất', export_date: new Date().toISOString(), export_images: images || [], status: 'Đã xuất' }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteOrder(id) {
  const { error } = await sb.from('orders').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== DASHBOARD =====

export async function fetchDashboardData() {
  // ── Tính ngày theo giờ Việt Nam (UTC+7) ──────────────────────────────────
  // Supabase lưu timestamptz dạng UTC; cần truyền ISO với offset +07:00
  // để PostgreSQL so sánh đúng múi giờ VN.
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowVN = new Date(Date.now() + VN_OFFSET_MS);
  const todayVN = nowVN.toISOString().slice(0, 10); // YYYY-MM-DD theo giờ VN

  // Đầu ngày hôm nay giờ VN → filter đơn thanh toán hôm nay
  const todayStartISO = `${todayVN}T00:00:00+07:00`;

  // Đầu tháng 12 tháng trước (tính theo giờ VN)
  const twelveMonthsAgoVN = new Date(Date.now() + VN_OFFSET_MS);
  twelveMonthsAgoVN.setMonth(twelveMonthsAgoVN.getMonth() - 11);
  twelveMonthsAgoVN.setDate(1);
  const monthStartISO = `${twelveMonthsAgoVN.toISOString().slice(0, 10)}T00:00:00+07:00`;

  // ── 4 queries song song ───────────────────────────────────────────────────
  const [inventoryRes, todayRes, ordersRes, pendingExportRes] = await Promise.all([
    // Tồn kho (chỉ lấy 2 field cần thiết)
    sb.from('wood_bundles').select('remaining_volume,wood_id').neq('status', 'Đã bán'),
    // Doanh thu hôm nay (giờ VN)
    sb.from('orders').select('total_amount')
      .eq('payment_status', 'Đã thanh toán')
      .gte('payment_date', todayStartISO),
    // Tất cả đơn đã thanh toán trong 12 tháng (dùng cho cả 30-ngày và theo-tháng)
    sb.from('orders').select('id,total_amount,payment_date')
      .eq('payment_status', 'Đã thanh toán')
      .gte('payment_date', monthStartISO),
    // Đếm đơn đã thanh toán nhưng chưa xuất hàng
    sb.from('orders').select('id', { count: 'exact', head: true })
      .eq('payment_status', 'Đã thanh toán')
      .eq('export_status', 'Chưa xuất'),
  ]);

  if (inventoryRes.error) throw new Error(inventoryRes.error.message);

  // ── Lấy order_items cho tất cả đơn 12 tháng ──────────────────────────────
  const allOrderIds = (ordersRes.data || []).map(o => o.id);
  let orderItems = [];
  if (allOrderIds.length > 0) {
    const { data: itemData } = await sb.from('order_items')
      .select('order_id,wood_id,volume')
      .in('order_id', allOrderIds);
    orderItems = itemData || [];
  }

  return {
    inventory: inventoryRes.data || [],
    todayRevenue: (todayRes.data || []).reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0),
    allOrders: ordersRes.data || [],      // 12 tháng — dùng client-side để lọc X ngày & theo tháng
    pendingExportCount: pendingExportRes.count || 0,
    orderItems,
  };
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

export async function uploadBundleImage(bundleCode, file, type) {
  const ext = file.name.split('.').pop();
  const path = `${bundleCode}/${type}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('bundle-images').upload(path, file, { upsert: true });
  if (error) return { error: error.message };
  const { data } = sb.storage.from('bundle-images').getPublicUrl(path);
  return { success: true, url: data.publicUrl };
}

// Xóa các file ảnh trong Storage theo danh sách public URL
export async function deleteBundleImages(urls = []) {
  if (!urls.length) return { success: true };
  // Lấy base URL của bucket để trích path tương đối
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
