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
  return (data || []).map(r => ({ id: r.id, name: r.name, nameEn: r.name_en, icon: r.icon, code: r.code || "", unit: r.unit || 'm3', thicknessMode: r.thickness_mode || 'fixed' }));
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
    if (!result[r.wood_id]) result[r.wood_id] = { attrs: [], attrValues: {}, defaultHeader: [], rangeGroups: {}, attrPriceGroups: {}, attrAliases: {} };
    result[r.wood_id].attrs.push(r.attr_id);
    result[r.wood_id].attrValues[r.attr_id] = r.selected_values
      ? r.selected_values.split(',').map(v => v.trim()).filter(Boolean)
      : [];
    if (r.is_header) result[r.wood_id].defaultHeader.push(r.attr_id);
    if (r.range_groups) result[r.wood_id].rangeGroups[r.attr_id] = r.range_groups;
    if (r.price_group_config) result[r.wood_id].attrPriceGroups[r.attr_id] = r.price_group_config;
    if (r.attr_aliases) result[r.wood_id].attrAliases[r.attr_id] = r.attr_aliases;
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

export async function addWoodType(id, name, nameEn, icon, code, unit, thicknessMode) {
  const { data: existing } = await sb.from('wood_types').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = existing?.length ? (existing[0].sort_order + 1) : 0;
  const { error } = await sb.from('wood_types').insert({ id, name, name_en: nameEn, icon, code: code || null, sort_order: nextOrder, unit: unit || 'm3', thickness_mode: thicknessMode || 'fixed' });
  return error ? { error: error.message } : { success: true };
}

export async function apiUpdateWoodType(id, name, nameEn, icon, code, thicknessMode) {
  const row = { name, name_en: nameEn, icon, code: code || null };
  if (thicknessMode) row.thickness_mode = thicknessMode;
  const { error } = await sb.from('wood_types').update(row).eq('id', id);
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
    attr_aliases: config.attrAliases?.[attrId] || null,
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

// Copy giá từ key nhóm default (VD supplier:Chung) sang key NCC riêng (VD supplier:Missouri)
// Chỉ copy cho 1 loại gỗ cụ thể, không xóa key cũ (key default có thể vẫn cần cho NCC còn lại)
export async function migratePriceGroupKeys(woodId, attrId, defaultLabel, newSpecials) {
  const oldSeg = `${attrId}:${defaultLabel}`;
  let migrated = 0;

  // Lấy tất cả price rows của loại gỗ này có chứa key default
  const { data: pRows, error: pErr } = await sb.from('prices')
    .select('wood_id,sku_key,price,price2,updated_date,updated_by,cost_price')
    .eq('wood_id', woodId)
    .like('sku_key', `%${oldSeg}%`);
  if (pErr) return { error: pErr.message };

  for (const row of (pRows || [])) {
    const segs = row.sku_key.split('||');
    if (!segs.includes(oldSeg)) continue;
    // Copy sang từng NCC mới
    for (const ncc of newSpecials) {
      const newSeg = `${attrId}:${ncc}`;
      const newSkuKey = segs.map(s => s === oldSeg ? newSeg : s).join('||');
      // Chỉ copy nếu chưa có giá riêng
      const { data: exist } = await sb.from('prices')
        .select('wood_id').eq('wood_id', woodId).eq('sku_key', newSkuKey).limit(1);
      if (exist?.length) continue;
      const { error: ie } = await sb.from('prices').upsert(
        { wood_id: woodId, sku_key: newSkuKey, price: row.price, price2: row.price2 ?? null, updated_date: row.updated_date, updated_by: row.updated_by, cost_price: row.cost_price },
        { onConflict: 'wood_id,sku_key' }
      );
      if (ie) return { error: ie.message };
      migrated++;
    }
  }

  return { success: true, migrated };
}

// Xóa giá orphan của key nhóm default khi không còn NCC nào dùng nhóm default
export async function deletePriceGroupKeys(woodId, attrId, defaultLabel) {
  const oldSeg = `${attrId}:${defaultLabel}`;
  const { data: pRows, error } = await sb.from('prices')
    .select('wood_id,sku_key').eq('wood_id', woodId).like('sku_key', `%${oldSeg}%`);
  if (error) return { error: error.message };
  let deleted = 0;
  for (const row of (pRows || [])) {
    if (!row.sku_key.split('||').includes(oldSeg)) continue;
    await sb.from('prices').delete().eq('wood_id', row.wood_id).eq('sku_key', row.sku_key);
    deleted++;
  }
  return { success: true, deleted };
}

// Xóa hàng loạt giá theo danh sách (woodId, skuKey)
export async function deletePrices(woodId, skuKeys) {
  let deleted = 0;
  for (const sk of skuKeys) {
    const { error } = await sb.from('prices').delete().eq('wood_id', woodId).eq('sku_key', sk);
    if (error) return { error: error.message };
    deleted++;
  }
  return { success: true, deleted };
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

// ===== SHIPMENTS (LÔ HÀNG) =====

export async function fetchShipments() {
  const { data, error } = await sb.from('shipments').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, shipmentCode: r.shipment_code,
    lotType: r.lot_type || 'sawn',
    nccId: r.ncc_id || null,
    eta: r.eta || null,
    arrivalDate: r.arrival_date || null,
    portName: r.port_name || null,
    yardDeadline: r.yard_storage_deadline || null,
    contDeadline: r.container_storage_deadline || null,
    emptyDeadline: r.empty_return_deadline || null,
    carrierId: r.carrier_id ? Number(r.carrier_id) : null,
    carrierName: r.carrier_name || null,
    unitCostUsd: r.unit_cost_usd != null ? parseFloat(r.unit_cost_usd) : null,
    exchangeRate: r.exchange_rate != null ? parseFloat(r.exchange_rate) : null,
    status: r.status || 'Chờ cập cảng',
    notes: r.notes || null,
  }));
}

// fields: { lotType, nccId, eta, arrivalDate, portName, yardDeadline, contDeadline,
//           emptyDeadline, carrierId, carrierName, status, notes }
export async function addShipment(fields = {}) {
  const { data, error } = await sb.from('shipments').insert({
    shipment_code: '',
    lot_type: fields.lotType || 'sawn',
    ncc_id: fields.nccId || null,
    eta: fields.eta || null,
    arrival_date: fields.arrivalDate || null,
    port_name: fields.portName || null,
    yard_storage_deadline: fields.yardDeadline || null,
    container_storage_deadline: fields.contDeadline || null,
    empty_return_deadline: fields.emptyDeadline || null,
    carrier_id: fields.carrierId || null,
    carrier_name: fields.carrierName || null,
    status: fields.status || 'Chờ cập cảng',
    notes: fields.notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, shipmentCode: data.shipment_code };
}

// Nhận object fields — chỉ update các field được truyền vào
export async function updateShipment(id, fields = {}) {
  const row = {};
  if (fields.lotType     !== undefined) row.lot_type                   = fields.lotType || 'sawn';
  if (fields.nccId       !== undefined) row.ncc_id                     = fields.nccId || null;
  if (fields.eta         !== undefined) row.eta                        = fields.eta || null;
  if (fields.arrivalDate !== undefined) row.arrival_date               = fields.arrivalDate || null;
  if (fields.portName    !== undefined) row.port_name                  = fields.portName || null;
  if (fields.yardDeadline  !== undefined) row.yard_storage_deadline    = fields.yardDeadline || null;
  if (fields.contDeadline  !== undefined) row.container_storage_deadline = fields.contDeadline || null;
  if (fields.emptyDeadline !== undefined) row.empty_return_deadline    = fields.emptyDeadline || null;
  if (fields.carrierId   !== undefined) row.carrier_id                 = fields.carrierId || null;
  if (fields.carrierName !== undefined) row.carrier_name               = fields.carrierName || null;
  if (fields.status      !== undefined) row.status                     = fields.status || 'Chờ cập cảng';
  if (fields.notes       !== undefined) row.notes                      = fields.notes || null;
  if (fields.unitCostUsd !== undefined) row.unit_cost_usd              = fields.unitCostUsd || null;
  if (fields.exchangeRate !== undefined) row.exchange_rate             = fields.exchangeRate || null;
  const { error } = await sb.from('shipments').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteShipment(id) {
  const { error } = await sb.from('shipments').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function assignContainerToShipment(containerId, shipmentId) {
  const { error } = await sb.from('containers').update({ shipment_id: shipmentId }).eq('id', containerId);
  return error ? { error: error.message } : { success: true };
}

export async function removeContainerFromShipment(containerId) {
  const { error } = await sb.from('containers').update({ shipment_id: null }).eq('id', containerId);
  return error ? { error: error.message } : { success: true };
}

// ===== CONTAINERS =====

export async function fetchContainers() {
  const { data, error } = await sb.from('containers').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, containerCode: r.container_code, nccId: r.ncc_id,
    arrivalDate: r.arrival_date,
    totalVolume: r.total_volume != null ? parseFloat(r.total_volume) : null,
    remainingVolume: r.remaining_volume != null ? parseFloat(r.remaining_volume) : null,
    status: r.status || 'Tạo mới', notes: r.notes,
    shipmentId: r.shipment_id || null,
    cargoType: r.cargo_type || 'sawn',
    isStandalone: r.is_standalone || false,
    weightUnit: r.weight_unit || 'm3',
    tonToM3Factor: r.ton_to_m3_factor != null ? parseFloat(r.ton_to_m3_factor) : null,
    rawWoodTypeId: r.raw_wood_type_id || null,
  }));
}

// fields: { containerCode, nccId, arrivalDate, totalVolume, status, notes, cargoType, shipmentId, isStandalone }
export async function addContainer(fields = {}) {
  const { data, error } = await sb.from('containers').insert({
    container_code: fields.containerCode,
    ncc_id: fields.nccId || null,
    arrival_date: fields.arrivalDate || null,
    total_volume: fields.totalVolume || null,
    status: fields.status || 'Tạo mới',
    notes: fields.notes || null,
    cargo_type: fields.cargoType || 'sawn',
    shipment_id: fields.shipmentId || null,
    is_standalone: fields.isStandalone || false,
    weight_unit: fields.weightUnit || 'm3',
    ton_to_m3_factor: fields.tonToM3Factor || null,
    remaining_volume: fields.totalVolume || null,
    raw_wood_type_id: fields.rawWoodTypeId || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateContainer(id, fields = {}) {
  const row = {};
  if (fields.containerCode !== undefined) row.container_code = fields.containerCode;
  if (fields.nccId         !== undefined) row.ncc_id         = fields.nccId || null;
  if (fields.arrivalDate   !== undefined) row.arrival_date   = fields.arrivalDate || null;
  if (fields.totalVolume   !== undefined) row.total_volume   = fields.totalVolume || null;
  if (fields.status        !== undefined) row.status         = fields.status || 'Tạo mới';
  if (fields.notes         !== undefined) row.notes          = fields.notes || null;
  if (fields.cargoType     !== undefined) row.cargo_type     = fields.cargoType || 'sawn';
  if (fields.shipmentId    !== undefined) row.shipment_id    = fields.shipmentId || null;
  if (fields.isStandalone  !== undefined) row.is_standalone  = fields.isStandalone;
  if (fields.weightUnit      !== undefined) row.weight_unit      = fields.weightUnit || 'm3';
  if (fields.tonToM3Factor   !== undefined) row.ton_to_m3_factor = fields.tonToM3Factor || null;
  if (fields.remainingVolume !== undefined) row.remaining_volume = fields.remainingVolume;
  if (fields.rawWoodTypeId   !== undefined) row.raw_wood_type_id = fields.rawWoodTypeId || null;
  const { error } = await sb.from('containers').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteContainer(id) {
  const { error } = await sb.from('containers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

function mapContainerItem(r) {
  return {
    id: r.id,
    itemType: r.item_type || 'sawn',
    woodId: r.wood_id || null,
    rawWoodTypeId: r.raw_wood_type_id || null,
    thickness: r.thickness || null,
    pieceCount: r.piece_count || null,
    quality: r.quality || null,
    volume: r.volume != null ? parseFloat(r.volume) : null,
    notes: r.notes || null,
  };
}

export async function fetchAllContainerItems() {
  const { data, error } = await sb.from('container_items').select('*').order('container_id').order('id');
  if (error) throw new Error(error.message);
  const result = {};
  (data || []).forEach(r => {
    if (!result[r.container_id]) result[r.container_id] = [];
    result[r.container_id].push(mapContainerItem(r));
  });
  return result;
}

export async function fetchContainerItems(containerId) {
  const { data, error } = await sb.from('container_items').select('*').eq('container_id', containerId).order('id');
  if (error) throw new Error(error.message);
  return (data || []).map(r => mapContainerItem(r));
}

// item: { itemType, woodId, rawWoodTypeId, thickness, pieceCount, quality, volume, notes }
export async function addContainerItem(containerId, item = {}) {
  const { data, error } = await sb.from('container_items').insert({
    container_id:    containerId,
    item_type:       item.itemType       || 'sawn',
    wood_id:         item.woodId         || null,
    raw_wood_type_id:item.rawWoodTypeId  || null,
    thickness:       item.thickness      || null,
    piece_count:     item.pieceCount     || null,
    quality:         item.quality        || null,
    volume:          item.volume         || null,
    notes:           item.notes          || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateContainerItem(id, item = {}) {
  const row = {};
  if (item.itemType       !== undefined) row.item_type        = item.itemType || 'sawn';
  if (item.woodId         !== undefined) row.wood_id          = item.woodId || null;
  if (item.rawWoodTypeId  !== undefined) row.raw_wood_type_id = item.rawWoodTypeId || null;
  if (item.thickness      !== undefined) row.thickness        = item.thickness || null;
  if (item.pieceCount     !== undefined) row.piece_count      = item.pieceCount || null;
  if (item.quality        !== undefined) row.quality          = item.quality || null;
  if (item.volume         !== undefined) row.volume           = item.volume || null;
  if (item.notes          !== undefined) row.notes            = item.notes || null;
  const { error } = await sb.from('container_items').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteContainerItem(id) {
  const { error } = await sb.from('container_items').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== SUPPLIER WOOD ASSIGNMENTS (NCC ↔ Loại hàng hóa + Loại gỗ) =====

export async function fetchSupplierWoodAssignments() {
  const { data, error } = await sb.from('supplier_wood_assignments').select('*').order('supplier_ncc_id');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, supplierNccId: r.supplier_ncc_id, productType: r.product_type,
    rawWoodTypeId: r.raw_wood_type_id, sawnWoodId: r.sawn_wood_id,
  }));
}

export async function addSupplierWoodAssignment(supplierNccId, productType, rawWoodTypeId, sawnWoodId) {
  const { data, error } = await sb.from('supplier_wood_assignments').insert({
    supplier_ncc_id: supplierNccId, product_type: productType,
    raw_wood_type_id: rawWoodTypeId || null, sawn_wood_id: sawnWoodId || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function deleteSupplierWoodAssignment(id) {
  const { error } = await sb.from('supplier_wood_assignments').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function setSupplierWoodAssignments(supplierNccId, assignments) {
  // Replace all assignments for a supplier
  await sb.from('supplier_wood_assignments').delete().eq('supplier_ncc_id', supplierNccId);
  if (!assignments.length) return { success: true };
  const rows = assignments.map(a => ({
    supplier_ncc_id: supplierNccId, product_type: a.productType,
    raw_wood_type_id: a.rawWoodTypeId || null, sawn_wood_id: a.sawnWoodId || null,
  }));
  const { error } = await sb.from('supplier_wood_assignments').insert(rows);
  return error ? { error: error.message } : { success: true };
}

// ===== RAW WOOD (GỖ TRÒN / GỖ HỘP) =====

// ===== FORMULA CONFIG =====

export async function fetchRawWoodFormulas() {
  const { data, error } = await sb.from('raw_wood_formulas').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, name: r.name, label: r.label,
    measurement: r.measurement,
    coeff: r.coeff != null ? parseFloat(r.coeff) : null,
    exponent: r.exponent,
    lengthAdjust: r.length_adjust || false,
    rounding: r.rounding || 'ROUND',
    decimals: r.decimals || 3,
    description: r.description || '',
    sortOrder: r.sort_order || 0,
  }));
}

// ===== RAW WOOD TYPES (GỖ TRÒN / GỖ HỘP) =====

export async function fetchRawWoodTypes(woodForm) {
  const q = sb.from('raw_wood_types').select('*').order('sort_order');
  if (woodForm) q.eq('wood_form', woodForm);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, name: r.name, woodForm: r.wood_form, icon: r.icon || '',
    sortOrder: r.sort_order,
    supplierFormulaId: r.supplier_formula_id || null,
    inspectionFormulaId: r.inspection_formula_id || null,
    unitType: r.unit_type || 'volume',
    saleUnit: r.sale_unit || 'volume',
  }));
}

// fields: { name, icon, supplierFormulaId, inspectionFormulaId, unitType, saleUnit }
export async function addRawWoodType(name, woodForm, icon, fields = {}) {
  const { data, error } = await sb.from('raw_wood_types').insert({
    name, wood_form: woodForm, icon: icon || '🪵',
    supplier_formula_id:   fields.supplierFormulaId   || null,
    inspection_formula_id: fields.inspectionFormulaId || null,
    unit_type:             fields.unitType             || 'volume',
    sale_unit:             fields.saleUnit             || 'volume',
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateRawWoodType(id, name, icon, fields = {}) {
  const row = { name, icon: icon || '🪵' };
  if (fields.supplierFormulaId   !== undefined) row.supplier_formula_id   = fields.supplierFormulaId || null;
  if (fields.inspectionFormulaId !== undefined) row.inspection_formula_id = fields.inspectionFormulaId || null;
  if (fields.unitType            !== undefined) row.unit_type             = fields.unitType || 'volume';
  if (fields.saleUnit            !== undefined) row.sale_unit             = fields.saleUnit || 'volume';
  const { error } = await sb.from('raw_wood_types').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteRawWoodType(id) {
  const { error } = await sb.from('raw_wood_types').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== PACKING LIST NCC (từng cây/hộp theo NCC) =====

function mapPiece(r) {
  return {
    id: r.id,
    containerItemId: r.container_item_id || null,
    pieceCode: r.piece_code || null,
    lengthM: r.length_m != null ? parseFloat(r.length_m) : null,
    diameterCm: r.diameter_cm != null ? parseFloat(r.diameter_cm) : null,
    circumferenceCm: r.circumference_cm != null ? parseFloat(r.circumference_cm) : null,
    widthCm: r.width_cm != null ? parseFloat(r.width_cm) : null,
    thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : null,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : null,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : null,
    quality: r.quality || null,
    sortOrder: r.sort_order || 0,
    notes: r.notes || null,
    sawingBatchId: r.sawing_batch_id || null,
    sawnDate: r.sawn_date || null,
  };
}

export async function fetchRawWoodPackingList(containerId) {
  const { data, error } = await sb.from('raw_wood_packing_list')
    .select('*').eq('container_id', containerId).order('sort_order').order('id');
  if (error) throw new Error(error.message);
  return (data || []).map(mapPiece);
}

// Fetch nhẹ: chỉ lấy logs đã được chọn cho 1 batch cụ thể (sawing_batch_id = batchId)
export async function fetchSelectedLogsForBatch(batchId) {
  if (!batchId) return [];
  const { data, error } = await sb.from('raw_wood_packing_list')
    .select('id, container_id, piece_code, volume_m3, quality, sawing_batch_id, sawn_date')
    .eq('sawing_batch_id', batchId)
    .order('container_id')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    containerId: r.container_id,
    pieceCode: r.piece_code || null,
    volumeM3: parseFloat(r.volume_m3) || 0,
    quality: r.quality || null,
    sawingBatchId: r.sawing_batch_id || null,
    sawnDate: r.sawn_date || null,
  }));
}

// Chọn nhiều cây cho mẻ xẻ (bulk select)
export async function selectLogsForSawing(logIds, sawingBatchId, sawnDate) {
  if (!logIds.length) return { success: true };
  const { error } = await sb.from('raw_wood_packing_list')
    .update({ sawing_batch_id: sawingBatchId, sawn_date: sawnDate || new Date().toISOString().slice(0, 10) })
    .in('id', logIds);
  return error ? { error: error.message } : { success: true, count: logIds.length };
}

// Bỏ chọn nhiều cây (deselect)
export async function deselectLogsFromSawing(logIds) {
  if (!logIds.length) return { success: true };
  const { error } = await sb.from('raw_wood_packing_list')
    .update({ sawing_batch_id: null, sawn_date: null })
    .in('id', logIds);
  return error ? { error: error.message } : { success: true };
}

// Bỏ chọn tất cả cây của 1 mẻ xẻ
export async function deselectAllLogsFromBatch(sawingBatchId) {
  const { error } = await sb.from('raw_wood_packing_list')
    .update({ sawing_batch_id: null, sawn_date: null })
    .eq('sawing_batch_id', sawingBatchId);
  return error ? { error: error.message } : { success: true };
}

export async function addRawWoodPackingListBatch(containerId, pieces) {
  const rows = pieces.map((p, i) => ({
    container_id: containerId,
    container_item_id: p.containerItemId || null,
    piece_code: p.pieceCode || null,
    length_m: p.lengthM || null,
    diameter_cm: p.diameterCm || null,
    circumference_cm: p.circumferenceCm || null,
    width_cm: p.widthCm || null,
    thickness_cm: p.thicknessCm || null,
    volume_m3: p.volumeM3 || null,
    weight_kg: p.weightKg || null,
    quality: p.quality || null,
    sort_order: p.sortOrder ?? i,
    notes: p.notes || null,
  }));
  const { data, error } = await sb.from('raw_wood_packing_list').insert(rows).select();
  return error ? { error: error.message } : { success: true, count: data.length, items: data.map(mapPiece) };
}

export async function deleteRawWoodPackingListItem(id) {
  const { error } = await sb.from('raw_wood_packing_list').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== NGHIỆM THU THỰC TẾ =====

function mapInspectionPiece(r) {
  return {
    id: r.id,
    containerItemId: r.container_item_id || null,
    packingListId: r.packing_list_id || null,
    pieceCode: r.piece_code || null,
    lengthM: r.length_m != null ? parseFloat(r.length_m) : null,
    diameterCm: r.diameter_cm != null ? parseFloat(r.diameter_cm) : null,
    circumferenceCm: r.circumference_cm != null ? parseFloat(r.circumference_cm) : null,
    widthCm: r.width_cm != null ? parseFloat(r.width_cm) : null,
    thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : null,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : null,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : null,
    quality: r.quality || null,
    isMissing: r.is_missing || false,
    isDamaged: r.is_damaged || false,
    isStandalone: r.is_standalone || false,
    status: r.status || 'available',
    sawmillBatchId: r.sawmill_batch_id || null,
    sawingBatchId: r.sawing_batch_id || null,
    saleOrderId: r.sale_order_id || null,
    sortOrder: r.sort_order || 0,
    notes: r.notes || null,
    inspectionDate: r.inspection_date || null,
    inspector: r.inspector || null,
  };
}

export async function fetchRawWoodInspection(containerId) {
  const { data, error } = await sb.from('raw_wood_inspection')
    .select('*').eq('container_id', containerId).order('sort_order').order('id');
  if (error) throw new Error(error.message);
  return (data || []).map(mapInspectionPiece);
}

// Lightweight: fetch inspection summary (counts + volumes) cho tất cả containers
// Trả về map: { [containerId]: { total, available, sawn, sold, totalVol, availVol } }
export async function fetchInspectionSummaryAll() {
  const { data, error } = await sb
    .from('raw_wood_inspection')
    .select('container_id, status, volume_m3, is_missing');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach(r => {
    const cid = r.container_id;
    if (!map[cid]) map[cid] = { total: 0, available: 0, sawn: 0, sold: 0, missing: 0, totalVol: 0, availVol: 0 };
    if (r.is_missing) { map[cid].missing++; return; } // Cây thiếu không tính vào tồn kho
    map[cid].total++;
    map[cid].totalVol += parseFloat(r.volume_m3) || 0;
    if (r.status === 'available') { map[cid].available++; map[cid].availVol += parseFloat(r.volume_m3) || 0; }
    if (r.status === 'sawn')      map[cid].sawn++;
    if (r.status === 'sold')      map[cid].sold++;
  });
  return map;
}

export async function addRawWoodInspectionBatch(containerId, pieces) {
  const rows = pieces.map((p, i) => ({
    container_id: containerId,
    container_item_id: p.containerItemId || null,
    packing_list_id: p.packingListId || null,
    piece_code: p.pieceCode || null,
    length_m: p.lengthM || null,
    diameter_cm: p.diameterCm || null,
    circumference_cm: p.circumferenceCm || null,
    width_cm: p.widthCm || null,
    thickness_cm: p.thicknessCm || null,
    volume_m3: p.volumeM3 || null,
    weight_kg: p.weightKg || null,
    quality: p.quality || null,
    is_missing: p.isMissing || false,
    is_damaged: p.isDamaged || false,
    sort_order: p.sortOrder ?? i,
    notes: p.notes || null,
    inspection_date: p.inspectionDate || null,
    inspector: p.inspector || null,
  }));
  const { data, error } = await sb.from('raw_wood_inspection').insert(rows).select();
  return error ? { error: error.message } : { success: true, count: data.length, items: data.map(mapInspectionPiece) };
}

export async function updateRawWoodInspectionItem(id, fields) {
  const row = {};
  if (fields.status        !== undefined) row.status        = fields.status;
  if (fields.isMissing     !== undefined) row.is_missing    = fields.isMissing;
  if (fields.isDamaged     !== undefined) row.is_damaged    = fields.isDamaged;
  if (fields.volumeM3      !== undefined) row.volume_m3     = fields.volumeM3;
  if (fields.quality       !== undefined) row.quality       = fields.quality;
  if (fields.notes         !== undefined) row.notes         = fields.notes;
  if (fields.sawmillBatchId  !== undefined) row.sawmill_batch_id = fields.sawmillBatchId;
  if (fields.sawingBatchId   !== undefined) row.sawing_batch_id  = fields.sawingBatchId;
  const { error } = await sb.from('raw_wood_inspection').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteRawWoodInspectionItem(id) {
  const { error } = await sb.from('raw_wood_inspection').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function clearRawWoodInspection(containerId) {
  const { error } = await sb.from('raw_wood_inspection').delete().eq('container_id', containerId);
  return error ? { error: error.message } : { success: true };
}

// ── Sawing: Inspection-based selection ──────────────────────

// Fetch containers raw_round/raw_box có ít nhất 1 bản ghi nghiệm thu (available inventory)
export async function fetchRawContainersWithInspection() {
  // Lấy containers gỗ nguyên liệu
  const { data: conts, error: ce } = await sb
    .from('containers')
    .select('id,container_code,cargo_type,total_volume,remaining_volume,weight_unit,ton_to_m3_factor,raw_wood_type_id,ncc_id,arrival_date,status,notes')
    .in('cargo_type', ['raw_round', 'raw_box'])
    .order('arrival_date', { ascending: false });
  if (ce) throw new Error(ce.message);
  if (!conts?.length) return [];

  // Lấy summary nghiệm thu per container
  const cids = conts.map(c => c.id);
  const { data: summary } = await sb
    .from('raw_wood_inspection')
    .select('container_id, status, volume_m3, is_missing')
    .in('container_id', cids);

  // Gom summary — cây thiếu (is_missing) không tính vào tồn kho
  const sumMap = {};
  (summary || []).forEach(r => {
    const cid = r.container_id;
    if (!sumMap[cid]) sumMap[cid] = { total: 0, available: 0, sawn: 0, sold: 0, missing: 0, totalVol: 0, availVol: 0 };
    if (r.is_missing) { sumMap[cid].missing++; return; }
    sumMap[cid].total++;
    sumMap[cid].totalVol += parseFloat(r.volume_m3) || 0;
    if (r.status === 'available') { sumMap[cid].available++; sumMap[cid].availVol += parseFloat(r.volume_m3) || 0; }
    if (r.status === 'sawn') sumMap[cid].sawn++;
    if (r.status === 'sold') sumMap[cid].sold++;
  });

  return conts.map(r => ({
    id: r.id, containerCode: r.container_code, cargoType: r.cargo_type,
    totalVolume: parseFloat(r.total_volume) || 0,
    remainingVolume: r.remaining_volume != null ? parseFloat(r.remaining_volume) : null,
    weightUnit: r.weight_unit || 'm3',
    tonToM3Factor: r.ton_to_m3_factor != null ? parseFloat(r.ton_to_m3_factor) : null,
    rawWoodTypeId: r.raw_wood_type_id || null,
    nccId: r.ncc_id, arrivalDate: r.arrival_date, status: r.status, notes: r.notes,
    inspection: sumMap[r.id] || null,   // null = chưa có nghiệm thu
  })).filter(c => c.inspection !== null); // chỉ hiện cont đã có nghiệm thu
}

// Fetch inspection pieces đã chọn cho 1 sawing batch (nhẹ — chỉ fields cần thiết)
export async function fetchSelectedInspLogsForBatch(batchId) {
  if (!batchId) return [];
  const { data, error } = await sb.from('raw_wood_inspection')
    .select('id,container_id,piece_code,volume_m3,quality,status,sawing_batch_id,inspection_date')
    .eq('sawing_batch_id', batchId)
    .order('container_id').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, containerId: r.container_id, pieceCode: r.piece_code || null,
    volumeM3: parseFloat(r.volume_m3) || 0, quality: r.quality || null,
    status: r.status || 'available', sawingBatchId: r.sawing_batch_id || null,
    inspectionDate: r.inspection_date || null,
  }));
}

// Chọn inspection pieces vào mẻ xẻ → status = 'sawn', sawing_batch_id = batchId
export async function selectInspLogsForSawing(ids, batchId) {
  if (!ids.length) return { success: true };
  // Thử update cả status + sawing_batch_id
  const { error } = await sb.from('raw_wood_inspection')
    .update({ status: 'sawn', sawing_batch_id: batchId })
    .in('id', ids);
  if (error) {
    // Fallback: column sawing_batch_id chưa tồn tại → chỉ update status
    if (error.message?.includes('sawing_batch_id') || error.code === '42703') {
      const { error: e2 } = await sb.from('raw_wood_inspection')
        .update({ status: 'sawn' })
        .in('id', ids);
      return e2 ? { error: e2.message } : { success: true, count: ids.length, needsMigration: true };
    }
    return { error: error.message };
  }
  return { success: true, count: ids.length };
}

// Bỏ chọn → status = 'available', sawing_batch_id = NULL
export async function deselectInspLogsFromSawing(ids) {
  if (!ids.length) return { success: true };
  const { error } = await sb.from('raw_wood_inspection')
    .update({ status: 'available', sawing_batch_id: null })
    .in('id', ids);
  if (error) {
    // Fallback khi column chưa có
    if (error.message?.includes('sawing_batch_id') || error.code === '42703') {
      const { error: e2 } = await sb.from('raw_wood_inspection')
        .update({ status: 'available' })
        .in('id', ids);
      return e2 ? { error: e2.message } : { success: true, needsMigration: true };
    }
    return { error: error.message };
  }
  return { success: true };
}

function mapLotRow(r) {
  return {
    id: r.id, lotCode: r.lot_code, woodForm: r.wood_form,
    containerId: r.container_id, shipmentId: r.shipment_id,
    woodTypeId: r.wood_type_id, supplierId: r.supplier_id, quality: r.quality,
    totalPieces: r.total_pieces || 0, totalVolume: r.total_volume != null ? parseFloat(r.total_volume) : 0,
    disposition: r.disposition || 'pending', customerId: r.customer_id,
    status: r.status || 'Mới nhập', notes: r.notes, createdAt: r.created_at,
  };
}

function mapItemRow(r) {
  return {
    id: r.id, lotId: r.lot_id, itemCode: r.item_code,
    woodTypeId: r.wood_type_id, quality: r.quality,
    length: r.length != null ? parseFloat(r.length) : null,
    diameter: r.diameter != null ? parseFloat(r.diameter) : null,
    circumference: r.circumference != null ? parseFloat(r.circumference) : null,
    width: r.width != null ? parseFloat(r.width) : null,
    thickness: r.thickness != null ? parseFloat(r.thickness) : null,
    volume: r.volume != null ? parseFloat(r.volume) : null,
    status: r.status || 'Trong kho',
    soldToCustomerId: r.sold_to_customer_id, soldOrderId: r.sold_order_id,
    sawingBatchId: r.sawing_batch_id, sawingDate: r.sawing_date,
    notes: r.notes,
  };
}

export async function fetchRawWoodLots(woodForm) {
  const q = sb.from('raw_wood_lots').select('*').order('created_at', { ascending: false });
  if (woodForm) q.eq('wood_form', woodForm);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapLotRow);
}

export async function addRawWoodLot(woodForm, woodTypeId, supplierId, quality, containerId, shipmentId, notes) {
  const { data, error } = await sb.from('raw_wood_lots').insert({
    lot_code: '', wood_form: woodForm, wood_type_id: woodTypeId || null,
    supplier_id: supplierId || null, quality: quality || null,
    container_id: containerId || null, shipment_id: shipmentId || null,
    notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, lotCode: data.lot_code };
}

export async function updateRawWoodLot(id, fields) {
  const row = {};
  if (fields.woodTypeId !== undefined) row.wood_type_id = fields.woodTypeId || null;
  if (fields.supplierId !== undefined) row.supplier_id = fields.supplierId || null;
  if (fields.quality !== undefined) row.quality = fields.quality || null;
  if (fields.containerId !== undefined) row.container_id = fields.containerId || null;
  if (fields.totalPieces !== undefined) row.total_pieces = fields.totalPieces;
  if (fields.totalVolume !== undefined) row.total_volume = fields.totalVolume;
  if (fields.disposition !== undefined) row.disposition = fields.disposition;
  if (fields.customerId !== undefined) row.customer_id = fields.customerId || null;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('raw_wood_lots').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteRawWoodLot(id) {
  const { error } = await sb.from('raw_wood_lots').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function fetchRawWoodItems(lotId) {
  const { data, error } = await sb.from('raw_wood_items').select('*').eq('lot_id', lotId).order('item_code');
  if (error) throw new Error(error.message);
  return (data || []).map(mapItemRow);
}

export async function addRawWoodItem(lotId, item) {
  const { data, error } = await sb.from('raw_wood_items').insert({
    lot_id: lotId, item_code: item.itemCode || null,
    wood_type_id: item.woodTypeId || null, quality: item.quality || null,
    length: item.length || null, diameter: item.diameter || null,
    circumference: item.circumference || null,
    width: item.width || null, thickness: item.thickness || null,
    volume: item.volume || null, status: 'Trong kho', notes: item.notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function addRawWoodItemsBatch(lotId, items) {
  const rows = items.map(item => ({
    lot_id: lotId, item_code: item.itemCode || null,
    wood_type_id: item.woodTypeId || null, quality: item.quality || null,
    length: item.length || null, diameter: item.diameter || null,
    circumference: item.circumference || null,
    width: item.width || null, thickness: item.thickness || null,
    volume: item.volume || null, status: 'Trong kho', notes: item.notes || null,
  }));
  const { data, error } = await sb.from('raw_wood_items').insert(rows).select();
  return error ? { error: error.message } : { success: true, count: data.length };
}

export async function updateRawWoodItem(id, fields) {
  const row = {};
  if (fields.itemCode !== undefined) row.item_code = fields.itemCode;
  if (fields.woodTypeId !== undefined) row.wood_type_id = fields.woodTypeId;
  if (fields.quality !== undefined) row.quality = fields.quality;
  if (fields.length !== undefined) row.length = fields.length;
  if (fields.diameter !== undefined) row.diameter = fields.diameter;
  if (fields.circumference !== undefined) row.circumference = fields.circumference;
  if (fields.width !== undefined) row.width = fields.width;
  if (fields.thickness !== undefined) row.thickness = fields.thickness;
  if (fields.volume !== undefined) row.volume = fields.volume;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.soldToCustomerId !== undefined) row.sold_to_customer_id = fields.soldToCustomerId;
  if (fields.sawingBatchId !== undefined) row.sawing_batch_id = fields.sawingBatchId;
  if (fields.sawingDate !== undefined) row.sawing_date = fields.sawingDate;
  if (fields.notes !== undefined) row.notes = fields.notes;
  const { error } = await sb.from('raw_wood_items').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function updateRawWoodItemsBatch(ids, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.soldToCustomerId !== undefined) row.sold_to_customer_id = fields.soldToCustomerId;
  if (fields.sawingBatchId !== undefined) row.sawing_batch_id = fields.sawingBatchId;
  if (fields.sawingDate !== undefined) row.sawing_date = fields.sawingDate;
  const { error } = await sb.from('raw_wood_items').update(row).in('id', ids);
  return error ? { error: error.message } : { success: true };
}

export async function deleteRawWoodItem(id) {
  const { error } = await sb.from('raw_wood_items').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== WOOD BUNDLES (GỖ KIỆN) =====

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
    priceAdjustment: r.price_adjustment || null, // { type: 'percent'|'absolute', value: number, reason: string }
    volumeAdjustment: r.volume_adjustment != null ? parseFloat(r.volume_adjustment) : null,
    packingSessionId: r.packing_session_id || null,
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

export async function addBundle({ woodId, containerId, packingSessionId, skuKey, attributes, boardCount, remainingBoards, volume, remainingVolume, notes, supplierBundleCode, location, rawMeasurements, manualGroupAssignment, unit_price, volumeAdjustment }) {
  const bundleCode = await genBundleCode(woodId);
  const bc = parseInt(boardCount) || 0;
  const rb = remainingBoards != null ? (parseInt(remainingBoards) ?? bc) : bc;
  const vol = parseFloat(volume) || 0;
  const rv = remainingVolume != null ? (parseFloat(remainingVolume) ?? vol) : vol;
  const isClosed = rb <= 0;
  const row = {
    bundle_code: bundleCode,
    wood_id: woodId,
    container_id: containerId || null,
    sku_key: skuKey,
    attributes,
    board_count: bc,
    remaining_boards: rb,
    volume: vol,
    remaining_volume: isClosed ? 0 : rv,
    status: isClosed ? 'Đã bán' : rb < bc ? 'Kiện lẻ' : 'Kiện nguyên',
    notes: notes || null,
    supplier_bundle_code: supplierBundleCode || null,
    location: location || null,
    qr_code: bundleCode,
    ...(rawMeasurements && Object.keys(rawMeasurements).length ? { raw_measurements: rawMeasurements } : {}),
    ...(manualGroupAssignment ? { manual_group_assignment: true } : {}),
    ...(unit_price != null && !isNaN(parseFloat(unit_price)) ? { unit_price: parseFloat(unit_price) } : {}),
    ...(isClosed && volumeAdjustment != null ? { volume_adjustment: parseFloat(volumeAdjustment) } : {}),
    ...(packingSessionId ? { packing_session_id: packingSessionId } : {}),
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

// Toggle gộp dày — lưu toàn hệ thống
export async function fetchThicknessGrouping() {
  const { data, error } = await sb.from('app_settings').select('value').eq('key', 'thickness_grouping').single();
  if (error || !data) return false;
  return data.value === 'true';
}

export async function saveThicknessGrouping(value) {
  const { error } = await sb.from('app_settings').upsert({ key: 'thickness_grouping', value: String(!!value) }, { onConflict: 'key' });
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
    cancelledAt: r.cancelled_at || null, cancelledBy: r.cancelled_by || null, cancelReason: r.cancel_reason || null,
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
    const rawNewVol = parseFloat(b.remaining_volume || 0) - parseFloat(it.volume || 0);
    const isClosed = newBoards <= 0;
    await sb.from('wood_bundles').update({ remaining_boards: newBoards, remaining_volume: isClosed ? 0 : parseFloat(rawNewVol.toFixed(4)), status: isClosed ? 'Đã bán' : 'Kiện lẻ', ...(isClosed ? { volume_adjustment: parseFloat(rawNewVol.toFixed(4)) } : {}) }).eq('id', it.bundle_id);
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
    const rawNewVol = parseFloat(b.remaining_volume || 0) - parseFloat(it.volume || 0);
    const isClosed = newBoards <= 0;
    await sb.from('wood_bundles').update({ remaining_boards: newBoards, remaining_volume: isClosed ? 0 : parseFloat(rawNewVol.toFixed(4)), status: isClosed ? 'Đã bán' : 'Kiện lẻ', ...(isClosed ? { volume_adjustment: parseFloat(rawNewVol.toFixed(4)) } : {}) }).eq('id', it.bundle_id);
  }
  return { success: true };
}

export async function deductBundlesForOrder(items) {
  for (const it of items) {
    if (!it.bundleId) continue;
    const { data: b } = await sb.from('wood_bundles').select('remaining_boards,remaining_volume').eq('id', it.bundleId).single();
    if (!b) continue;
    const newBoards = Math.max(0, (b.remaining_boards || 0) - (parseInt(it.boardCount) || 0));
    const rawNewVol = parseFloat(b.remaining_volume || 0) - parseFloat(it.volume || 0);
    const isClosed = newBoards <= 0;
    await sb.from('wood_bundles').update({ remaining_boards: newBoards, remaining_volume: isClosed ? 0 : parseFloat(rawNewVol.toFixed(4)), status: isClosed ? 'Đã bán' : 'Kiện lẻ', ...(isClosed ? { volume_adjustment: parseFloat(rawNewVol.toFixed(4)) } : {}) }).eq('id', it.bundleId);
  }
  return { success: true };
}

export async function updateOrderExport(id, images) {
  const { error } = await sb.from('orders').update({ export_status: 'Đã xuất', export_date: new Date().toISOString(), export_images: images || [], status: 'Đã xuất' }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteOrder(id) {
  // Xóa cứng — chỉ dùng cho đơn Nháp
  await Promise.all([
    sb.from('order_items').delete().eq('order_id', id),
    sb.from('order_services').delete().eq('order_id', id),
  ]);
  const { error } = await sb.from('orders').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

/**
 * Hủy đơn hàng — soft cancel, hoàn trả bundle nếu đã deduct, ghi credit nếu đã thu tiền.
 * Credit chỉ tính phần tiền HÀNG đã thu (không bao gồm dịch vụ).
 */
export async function cancelOrder(orderId, reason, cancelledBy) {
  // 1. Fetch order + items + payments
  const [{ data: order, error: oe }, { data: items }, { data: payments }, { data: services }] = await Promise.all([
    sb.from('orders').select('*, customers(name)').eq('id', orderId).single(),
    sb.from('order_items').select('*').eq('order_id', orderId),
    sb.from('payment_records').select('*').eq('order_id', orderId),
    sb.from('order_services').select('*').eq('order_id', orderId),
  ]);
  if (oe || !order) return { error: oe?.message || 'Không tìm thấy đơn hàng' };
  if (order.payment_status === 'Đã hủy') return { error: 'Đơn đã hủy rồi' };

  // 2. Hoàn trả bundles nếu đã deduct (kiểm tra từng bundle xem remaining < board_count)
  let bundlesRestored = 0;
  const restoredDetails = [];
  for (const it of (items || [])) {
    if (!it.bundle_id) continue;
    const { data: b } = await sb.from('wood_bundles')
      .select('id, board_count, remaining_boards, volume, remaining_volume')
      .eq('id', it.bundle_id).single();
    if (!b) continue;
    // Chỉ hoàn trả nếu bundle thực sự đã bị trừ (remaining < original hoặc status đã đổi)
    const newBoards = (b.remaining_boards || 0) + (it.board_count || 0);
    const newVol = parseFloat(b.remaining_volume || 0) + parseFloat(it.volume || 0);
    const cappedBoards = Math.min(newBoards, b.board_count || newBoards);
    const cappedVol = Math.min(parseFloat(newVol.toFixed(4)), parseFloat(b.volume || newVol));
    const newStatus = cappedBoards >= (b.board_count || 0) ? 'Kiện nguyên' : 'Kiện lẻ';
    await sb.from('wood_bundles').update({
      remaining_boards: cappedBoards,
      remaining_volume: parseFloat(cappedVol.toFixed(4)),
      status: newStatus,
    }).eq('id', it.bundle_id);
    bundlesRestored++;
    restoredDetails.push({ bundleCode: it.bundle_code, boards: it.board_count, volume: parseFloat(it.volume || 0), newStatus });
  }

  // 3. Tính credit: chỉ phần tiền HÀNG (itemsTotal), không tính dịch vụ
  const totalPaid = (payments || []).filter(p => !p.voided).reduce((s, p) => {
    const disc = ['auto', 'approved'].includes(p.discount_status) ? parseFloat(p.discount || 0) : 0;
    return s + parseFloat(p.amount || 0) + disc;
  }, 0);

  let creditAmount = 0;
  if (totalPaid > 0) {
    // Tính tổng tiền hàng (items) trong đơn — không bao gồm dịch vụ
    const itemsTotal = (items || []).reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
    const svcTotal = (services || []).reduce((s, sv) => s + (parseFloat(sv.amount) || 0), 0);
    const totalOrder = parseFloat(order.total_amount) || 0;
    const deposit = parseFloat(order.deposit) || 0;
    const debt = parseFloat(order.debt) || 0;
    const toPay = totalOrder - deposit - debt;

    // Tỷ lệ tiền hàng trên tổng (loại trừ dịch vụ)
    // Credit = min(totalPaid, itemsTotal) — không hoàn phần dịch vụ
    // Nếu đã thanh toán đủ: credit = itemsTotal (đã tính cả VAT trên hàng nếu có)
    // Nếu thanh toán 1 phần: credit = min(totalPaid, tỷ lệ tiền hàng)
    if (toPay > 0 && totalOrder > 0) {
      const itemsRatio = (itemsTotal + (order.apply_tax ? Math.round(itemsTotal * 0.08) : 0)) / totalOrder;
      creditAmount = Math.min(totalPaid, Math.round(toPay * itemsRatio));
    } else {
      creditAmount = 0;
    }

    if (creditAmount > 0) {
      const dateStr = new Date().toLocaleDateString('vi-VN');
      await sb.from('customer_credits').insert({
        customer_id: order.customer_id,
        amount: creditAmount,
        remaining: creditAmount,
        source_order_id: orderId,
        reason: `Hủy đơn ${order.order_code} ngày ${dateStr}`,
      });
    }
  }

  // 4. Void payment records
  if ((payments || []).length > 0) {
    await sb.from('payment_records').update({ voided: true }).eq('order_id', orderId);
  }

  // 5. Update order status
  const { error: ue } = await sb.from('orders').update({
    status: 'Đã hủy',
    payment_status: 'Đã hủy',
    cancelled_at: new Date().toISOString(),
    cancelled_by: cancelledBy || 'admin',
    cancel_reason: reason || '',
  }).eq('id', orderId);
  if (ue) return { error: ue.message };

  return { success: true, bundlesRestored, restoredDetails, creditAmount, orderCode: order.order_code };
}

// ===== CUSTOMER CREDITS =====

export async function fetchCustomerCredits(customerId) {
  const { data, error } = await sb.from('customer_credits')
    .select('*')
    .eq('customer_id', customerId)
    .gt('remaining', 0)
    .order('created_at');
  if (error) return [];
  return (data || []).map(r => ({
    id: r.id, amount: parseFloat(r.amount), remaining: parseFloat(r.remaining),
    sourceOrderId: r.source_order_id, reason: r.reason || '',
    createdAt: r.created_at, usedByOrders: r.used_by_orders || [],
  }));
}

export async function useCustomerCredit(creditId, orderId, amount) {
  const { data: cr, error: fe } = await sb.from('customer_credits')
    .select('remaining, used_by_orders').eq('id', creditId).single();
  if (fe || !cr) return { error: 'Không tìm thấy credit' };
  if (parseFloat(cr.remaining) < amount) return { error: 'Credit không đủ' };
  const newRemaining = parseFloat(cr.remaining) - amount;
  const usedBy = [...(cr.used_by_orders || []), { order_id: orderId, amount, date: new Date().toISOString() }];
  const { error } = await sb.from('customer_credits').update({ remaining: parseFloat(newRemaining.toFixed(0)), used_by_orders: usedBy }).eq('id', creditId);
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
    // Tồn kho (chỉ lấy 2 field cần thiết) — dùng range để bypass giới hạn 1000 row mặc định
    sb.from('wood_bundles').select('remaining_volume,wood_id').neq('status', 'Đã bán').range(0, 9999),
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

// ===== USERS (dynamic) =====

export async function fetchUsers() {
  const { data, error } = await sb.from('users').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    role: r.role,
    label: r.label,
    active: r.active !== false,
    createdAt: r.created_at,
    createdBy: r.created_by,
  }));
}

export async function saveUser(id, username, passwordHash, role, label, active, createdBy) {
  if (id) {
    // Update
    const updates = { username, role, label, active };
    if (passwordHash) updates.password_hash = passwordHash;
    const { error } = await sb.from('users').update(updates).eq('id', id);
    return error ? { error: error.message } : { success: true };
  }
  // Insert
  const { error } = await sb.from('users').insert({
    username, password_hash: passwordHash, role, label, active: active !== false, created_by: createdBy,
  });
  return error ? { error: error.message } : { success: true };
}

export async function deleteUser(id) {
  const { error } = await sb.from('users').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== KILN v2 (LÒ SẤY) =====

function mapKilnBatch(r) {
  return {
    id: r.id, batchCode: r.batch_code, kilnNumber: r.kiln_number,
    entryDate: r.entry_date, expectedExitDate: r.expected_exit_date,
    actualExitDate: r.actual_exit_date, status: r.status || 'Đang sấy',
    notes: r.notes, createdAt: r.created_at,
  };
}

function mapKilnItem(r) {
  return {
    id: r.id, batchId: r.batch_id, itemCode: r.item_code,
    woodTypeId: r.wood_type_id, thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : 0,
    ownerType: r.owner_type || 'company', ownerName: r.owner_name,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : 0,
    conversionRate: r.conversion_rate != null ? parseFloat(r.conversion_rate) : null,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : 0,
    notes: r.notes, createdAt: r.created_at,
  };
}

function mapUnsorted(r) {
  return {
    id: r.id, bundleCode: r.bundle_code, kilnItemId: r.kiln_item_id,
    woodTypeId: r.wood_type_id, thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : 0,
    ownerType: r.owner_type || 'company', ownerName: r.owner_name,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : 0,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : 0,
    status: r.status || 'Chưa xếp', packingSessionId: r.packing_session_id,
    notes: r.notes, createdAt: r.created_at,
  };
}

function mapPackingSession(r) {
  return {
    id: r.id, sessionCode: r.session_code, packingDate: r.packing_date,
    woodTypeId: r.wood_type_id, thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : 0,
    totalInputKg: r.total_input_kg != null ? parseFloat(r.total_input_kg) : 0,
    totalInputM3: r.total_input_m3 != null ? parseFloat(r.total_input_m3) : 0,
    status: r.status || 'Đang xếp', notes: r.notes, createdAt: r.created_at,
  };
}

function mapLeftover(r) {
  return {
    id: r.id, leftoverCode: r.leftover_code, sourceSessionId: r.source_session_id,
    woodTypeId: r.wood_type_id, thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : 0,
    quality: r.quality, weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : 0,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : 0,
    status: r.status || 'Chưa xếp', usedInSessionId: r.used_in_session_id,
    notes: r.notes, createdAt: r.created_at,
  };
}

// ── Kiln Batches ──

export async function fetchKilnBatches() {
  const { data, error } = await sb.from('kiln_batches').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapKilnBatch);
}

export async function addKilnBatch(kilnNumber, entryDate, expectedExitDate, notes) {
  const { data, error } = await sb.from('kiln_batches').insert({
    batch_code: '', kiln_number: kilnNumber,
    entry_date: entryDate, expected_exit_date: expectedExitDate || null, notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, batchCode: data.batch_code };
}

export async function updateKilnBatch(id, fields) {
  const row = {};
  if (fields.entryDate !== undefined) row.entry_date = fields.entryDate;
  if (fields.expectedExitDate !== undefined) row.expected_exit_date = fields.expectedExitDate || null;
  if (fields.actualExitDate !== undefined) row.actual_exit_date = fields.actualExitDate || null;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('kiln_batches').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteKilnBatch(id) {
  const { error } = await sb.from('kiln_batches').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Kiln Items (Mã gỗ sấy) ──

export async function fetchKilnItems(batchId) {
  const q = sb.from('kiln_items').select('*').order('created_at');
  if (batchId) q.eq('batch_id', batchId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapKilnItem);
}

export async function fetchAllKilnItems() {
  const { data, error } = await sb.from('kiln_items').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapKilnItem);
}

export async function addKilnItem(batchId, item) {
  const vol = (item.weightKg && item.conversionRate) ? item.weightKg / item.conversionRate : (item.volumeM3 || 0);
  const { data, error } = await sb.from('kiln_items').insert({
    batch_id: batchId, item_code: '',
    wood_type_id: item.woodTypeId || null, thickness_cm: item.thicknessCm,
    owner_type: item.ownerType || 'company', owner_name: item.ownerName || null,
    weight_kg: item.weightKg || 0, conversion_rate: item.conversionRate || null,
    volume_m3: vol, notes: item.notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, itemCode: data.item_code };
}

export async function updateKilnItem(id, fields) {
  const row = {};
  if (fields.woodTypeId !== undefined) row.wood_type_id = fields.woodTypeId || null;
  if (fields.thicknessCm !== undefined) row.thickness_cm = fields.thicknessCm;
  if (fields.ownerType !== undefined) row.owner_type = fields.ownerType;
  if (fields.ownerName !== undefined) row.owner_name = fields.ownerName || null;
  if (fields.weightKg !== undefined) row.weight_kg = fields.weightKg;
  if (fields.conversionRate !== undefined) row.conversion_rate = fields.conversionRate;
  if (fields.volumeM3 !== undefined) row.volume_m3 = fields.volumeM3;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('kiln_items').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteKilnItem(id) {
  const { error } = await sb.from('kiln_items').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Kiln Edit Log (Audit) ──

export async function addKilnEditLog(kilnItemId, action, changedBy, oldValues, newValues) {
  await sb.from('kiln_edit_log').insert({
    kiln_item_id: kilnItemId, action, changed_by: changedBy || null,
    old_values: oldValues || null, new_values: newValues || null,
  });
}

export async function fetchKilnEditLog(kilnItemId) {
  const q = sb.from('kiln_edit_log').select('*').order('created_at', { ascending: false });
  if (kilnItemId) q.eq('kiln_item_id', kilnItemId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, kilnItemId: r.kiln_item_id, action: r.action,
    changedBy: r.changed_by, oldValues: r.old_values, newValues: r.new_values,
    createdAt: r.created_at,
  }));
}

// ── Unsorted Bundles (Kiện chưa xếp) ──

export async function fetchUnsortedBundles() {
  const { data, error } = await sb.from('unsorted_bundles').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapUnsorted);
}

export async function addUnsortedBundle(kilnItemId, weightKg, volumeM3, woodTypeId, thicknessCm, ownerType, ownerName, notes) {
  const { data, error } = await sb.from('unsorted_bundles').insert({
    bundle_code: '', kiln_item_id: kilnItemId,
    wood_type_id: woodTypeId || null, thickness_cm: thicknessCm,
    owner_type: ownerType || 'company', owner_name: ownerName || null,
    weight_kg: weightKg, volume_m3: volumeM3, notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, bundleCode: data.bundle_code };
}

export async function addUnsortedBundlesBatch(items) {
  const rows = items.map(it => ({
    bundle_code: '', kiln_item_id: it.kilnItemId,
    wood_type_id: it.woodTypeId || null, thickness_cm: it.thicknessCm,
    owner_type: it.ownerType || 'company', owner_name: it.ownerName || null,
    weight_kg: it.weightKg, volume_m3: it.volumeM3, notes: it.notes || null,
  }));
  const { data, error } = await sb.from('unsorted_bundles').insert(rows).select();
  return error ? { error: error.message } : { success: true, items: (data || []).map(mapUnsorted) };
}

export async function updateUnsortedBundle(id, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.packingSessionId !== undefined) row.packing_session_id = fields.packingSessionId || null;
  if (fields.weightKg !== undefined) row.weight_kg = fields.weightKg;
  if (fields.volumeM3 !== undefined) row.volume_m3 = fields.volumeM3;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('unsorted_bundles').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function updateUnsortedBundlesBatch(ids, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.packingSessionId !== undefined) row.packing_session_id = fields.packingSessionId || null;
  const { error } = await sb.from('unsorted_bundles').update(row).in('id', ids);
  return error ? { error: error.message } : { success: true };
}

export async function deleteUnsortedBundle(id) {
  const { error } = await sb.from('unsorted_bundles').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Import kiện chưa xếp (không qua lò)
export async function importUnsortedBundles(items) {
  const rows = items.map(it => ({
    bundle_code: '', kiln_item_id: null,
    wood_type_id: it.woodTypeId || null, thickness_cm: it.thicknessCm,
    owner_type: it.ownerType || 'company', owner_name: it.ownerName || null,
    weight_kg: it.weightKg || 0, volume_m3: it.volumeM3 || 0, notes: it.notes || null,
  }));
  const { data, error } = await sb.from('unsorted_bundles').insert(rows).select();
  return error ? { error: error.message } : { success: true, count: (data || []).length };
}

// ── Packing Sessions (Mẻ xếp) ──

export async function fetchPackingSessions() {
  const { data, error } = await sb.from('packing_sessions').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapPackingSession);
}

export async function addPackingSession(packingDate, woodTypeId, thicknessCm, totalInputKg, totalInputM3, notes) {
  const { data, error } = await sb.from('packing_sessions').insert({
    session_code: '', packing_date: packingDate,
    wood_type_id: woodTypeId, thickness_cm: thicknessCm,
    total_input_kg: totalInputKg, total_input_m3: totalInputM3, notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, sessionCode: data.session_code };
}

export async function updatePackingSession(id, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.totalInputKg !== undefined) row.total_input_kg = fields.totalInputKg;
  if (fields.totalInputM3 !== undefined) row.total_input_m3 = fields.totalInputM3;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('packing_sessions').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deletePackingSession(id) {
  const { error } = await sb.from('packing_sessions').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Packing Leftovers (Kiện bỏ lại) ──

export async function fetchPackingLeftovers() {
  const { data, error } = await sb.from('packing_leftovers').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapLeftover);
}

export async function addPackingLeftover(sourceSessionId, woodTypeId, thicknessCm, quality, weightKg, volumeM3, notes) {
  const { data, error } = await sb.from('packing_leftovers').insert({
    leftover_code: '', source_session_id: sourceSessionId,
    wood_type_id: woodTypeId, thickness_cm: thicknessCm,
    quality: quality || null, weight_kg: weightKg, volume_m3: volumeM3, notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, leftoverCode: data.leftover_code };
}

export async function updatePackingLeftover(id, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.usedInSessionId !== undefined) row.used_in_session_id = fields.usedInSessionId || null;
  if (fields.quality !== undefined) row.quality = fields.quality || null;
  if (fields.weightKg !== undefined) row.weight_kg = fields.weightKg;
  if (fields.volumeM3 !== undefined) row.volume_m3 = fields.volumeM3;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('packing_leftovers').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deletePackingLeftover(id) {
  const { error } = await sb.from('packing_leftovers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== WOOD CONVERSION RATES (BẢNG QUY ĐỔI kg/m³) =====

export async function fetchConversionRates() {
  const { data, error } = await sb.from('wood_conversion_rates').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, woodTypeId: r.wood_type_id || null, name: r.name,
    rate: r.rate != null ? parseFloat(r.rate) : 0,
    thicknessMin: r.thickness_min || null,
    notes: r.notes, sortOrder: r.sort_order || 0, updatedAt: r.updated_at,
  }));
}

export async function addConversionRate(woodTypeId, name, rate, thicknessMin, notes) {
  const { data: maxRow } = await sb.from('wood_conversion_rates').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = maxRow?.length ? (maxRow[0].sort_order + 1) : 0;
  const { data, error } = await sb.from('wood_conversion_rates').insert({
    wood_type_id: woodTypeId || null, name, rate, thickness_min: thicknessMin || null, notes: notes || null, sort_order: nextOrder,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateConversionRate(id, woodTypeId, name, rate, thicknessMin, notes) {
  const { error } = await sb.from('wood_conversion_rates').update({
    wood_type_id: woodTypeId || null, name, rate, thickness_min: thicknessMin || null, notes: notes || null, updated_at: new Date().toISOString(),
  }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteConversionRate(id) {
  const { error } = await sb.from('wood_conversion_rates').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Recalc volume_m3 cho kiln_items theo conversion rates mới
// conversionRates: [{ name, rate, thicknessMin }]
export async function recalcKilnItemVolumes(conversionRates) {
  const { data: activeBatches } = await sb.from('kiln_batches').select('id').neq('status', 'Đã ra hết');
  if (!activeBatches?.length) return { updated: 0 };
  const batchIds = activeBatches.map(b => b.id);
  const { data: items, error } = await sb.from('kiln_items').select('id,wood_type_id,thickness_cm,weight_kg').in('batch_id', batchIds);
  if (error || !items?.length) return { updated: 0 };

  let updated = 0;
  for (const item of items) {
    if (!item.wood_type_id) continue;
    const thickNum = item.thickness_cm != null ? parseFloat(item.thickness_cm) : NaN;
    // Match bằng wood_type_id
    const matches = conversionRates.filter(cr => cr.woodTypeId === item.wood_type_id);
    if (!matches.length) continue;
    let best = matches.find(cr => !cr.thicknessMin);
    if (!isNaN(thickNum)) {
      const thickMatch = matches.find(cr => { if (!cr.thicknessMin) return false; const min = parseFloat(String(cr.thicknessMin).replace(/[^\d.]/g, '')); return !isNaN(min) && thickNum >= min; });
      if (thickMatch) best = thickMatch;
    }
    if (!best) best = matches[0];
    const rate = best.rate;
    const vol = rate > 0 ? (parseFloat(item.weight_kg) || 0) / rate : 0;
    await sb.from('kiln_items').update({ conversion_rate: rate, volume_m3: vol }).eq('id', item.id);
    updated++;
  }
  return { updated };
}

// ══════════════════════════════════════════════════════════════
// SAWING MODULE — Mẻ xẻ gỗ
// ══════════════════════════════════════════════════════════════

function mapSawingBatch(r) {
  return {
    id: r.id, batchCode: r.batch_code, woodId: r.wood_id,
    batchDate: r.batch_date, status: r.status, note: r.notes || r.note || null,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapSawingItem(r) {
  return {
    id: r.id, batchId: r.batch_id, thickness: r.thickness, quality: r.quality,
    targetVolume: parseFloat(r.target_volume) || 0,
    doneVolume: parseFloat(r.done_volume) || 0,
    note: r.note || null, priority: r.priority || 'normal',
    sortOrder: r.sort_order || 0, createdAt: r.created_at,
  };
}
function mapSawingLog(r) {
  return {
    id: r.id, sawingItemId: r.sawing_item_id, logDate: r.log_date,
    addedVolume: parseFloat(r.added_volume) || 0,
    loggedBy: r.logged_by, note: r.note, createdAt: r.created_at,
  };
}
function mapSawingRoundInput(r) {
  return {
    id: r.id, batchId: r.batch_id, inputDate: r.input_date,
    containerId: r.container_id, logCount: r.log_count || 0,
    volumeM3: parseFloat(r.volume_m3) || 0,
    roundQuality: r.round_quality, note: r.note,
    createdBy: r.created_by, createdAt: r.created_at,
  };
}

// ── Sawing Batches ──

export async function fetchSawingBatches() {
  const { data, error } = await sb.from('sawing_batches').select('*').order('batch_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapSawingBatch);
}

export async function addSawingBatch(fields) {
  const { data, error } = await sb.from('sawing_batches').insert({
    wood_id: fields.woodId, batch_date: fields.batchDate,
    status: 'sawing', note: fields.note || null, created_by: fields.createdBy || null,
  }).select().single();
  if (error) return { error: error.message };
  return mapSawingBatch(data);
}

export async function updateSawingBatch(id, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.note !== undefined) row.note = fields.note;
  row.updated_at = new Date().toISOString();
  const { error } = await sb.from('sawing_batches').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteSawingBatch(id) {
  // 1. Lấy danh sách sawing_items của batch để cleanup
  const { data: sItems } = await sb.from('sawing_items').select('id').eq('batch_id', id);
  const sItemIds = (sItems || []).map(i => i.id);

  // 2. Clear kiln_items.sawing_item_id (tránh FK violation nếu chưa có ON DELETE SET NULL)
  if (sItemIds.length) {
    await sb.from('kiln_items').update({ sawing_item_id: null }).in('sawing_item_id', sItemIds);
  }

  // 3. Clear raw_wood_packing_list.sawing_batch_id (reset về chưa chọn)
  await sb.from('raw_wood_packing_list')
    .update({ sawing_batch_id: null, sawn_date: null })
    .eq('sawing_batch_id', id);

  // 4. Xóa batch (cascade xóa sawing_items, sawing_daily_logs, sawing_round_inputs)
  const { error } = await sb.from('sawing_batches').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Lấy kiln_items liên kết đến các sawing_items của 1 batch (để cảnh báo trước khi xóa)
export async function fetchKilnItemsLinkedToBatch(batchId) {
  const { data: sItems } = await sb.from('sawing_items').select('id,thickness,quality').eq('batch_id', batchId);
  if (!sItems?.length) return [];
  const sItemIds = sItems.map(i => i.id);
  const sItemMap = Object.fromEntries(sItems.map(i => [i.id, i]));
  const { data: kItems } = await sb.from('kiln_items')
    .select('id,item_code,batch_id,wood_type_id,thickness_cm,volume_m3,sawing_item_id')
    .in('sawing_item_id', sItemIds);
  return (kItems || []).map(k => ({
    ...k,
    sawingThickness: sItemMap[k.sawing_item_id]?.thickness,
    sawingQuality: sItemMap[k.sawing_item_id]?.quality,
  }));
}

// ── Sawing Items ──

export async function fetchSawingItems(batchId) {
  const q = sb.from('sawing_items').select('*').order('sort_order').order('created_at');
  if (batchId) q.eq('batch_id', batchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapSawingItem);
}

export async function addSawingItem(batchId, item) {
  const { data, error } = await sb.from('sawing_items').insert({
    batch_id: batchId, thickness: item.thickness, quality: item.quality,
    target_volume: item.targetVolume || 0, note: item.note || null,
    priority: item.priority || 'normal', sort_order: item.sortOrder || 0,
  }).select().single();
  if (error) return { error: error.message };
  return mapSawingItem(data);
}

export async function updateSawingItem(id, fields) {
  const row = {};
  if (fields.thickness !== undefined) row.thickness = fields.thickness;
  if (fields.quality !== undefined) row.quality = fields.quality;
  if (fields.targetVolume !== undefined) row.target_volume = fields.targetVolume;
  if (fields.note !== undefined) row.note = fields.note;
  if (fields.priority !== undefined) row.priority = fields.priority;
  if (fields.sortOrder !== undefined) row.sort_order = fields.sortOrder;
  const { error } = await sb.from('sawing_items').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteSawingItem(id) {
  const { error } = await sb.from('sawing_items').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Sawing Daily Logs ──

export async function fetchSawingDailyLogs(sawingItemId) {
  const q = sb.from('sawing_daily_logs').select('*').order('log_date', { ascending: false }).order('created_at', { ascending: false });
  if (sawingItemId) q.eq('sawing_item_id', sawingItemId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapSawingLog);
}

export async function fetchSawingDailyLogsByBatch(batchId) {
  // Fetch all logs for all items of a batch
  const { data: items } = await sb.from('sawing_items').select('id').eq('batch_id', batchId);
  if (!items?.length) return [];
  const itemIds = items.map(i => i.id);
  const { data, error } = await sb.from('sawing_daily_logs').select('*')
    .in('sawing_item_id', itemIds).order('log_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapSawingLog);
}

export async function addSawingDailyLog(sawingItemId, addedVolume, logDate, loggedBy, note) {
  const { data, error } = await sb.from('sawing_daily_logs').insert({
    sawing_item_id: sawingItemId,
    added_volume: addedVolume,
    log_date: logDate || new Date().toISOString().slice(0, 10),
    logged_by: loggedBy || null,
    note: note || null,
  }).select().single();
  if (error) return { error: error.message };
  return mapSawingLog(data);
}

export async function deleteSawingDailyLog(id) {
  const { error } = await sb.from('sawing_daily_logs').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Sawing Round Inputs (Gỗ tròn đầu vào) ──

export async function fetchSawingRoundInputs(batchId) {
  const q = sb.from('sawing_round_inputs').select('*').order('input_date', { ascending: false });
  if (batchId) q.eq('batch_id', batchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapSawingRoundInput);
}

export async function addSawingRoundInput(batchId, fields) {
  const { data, error } = await sb.from('sawing_round_inputs').insert({
    batch_id: batchId,
    input_date: fields.inputDate || new Date().toISOString().slice(0, 10),
    container_id: fields.containerId || null,
    log_count: fields.logCount || 0,
    volume_m3: fields.volumeM3 || 0,
    round_quality: fields.roundQuality || null,
    note: fields.note || null,
    created_by: fields.createdBy || null,
  }).select().single();
  if (error) return { error: error.message };
  // Trừ remaining_volume của container
  if (fields.containerId && fields.volumeM3) {
    await sb.rpc('decrement_container_remaining', {
      cid: fields.containerId, vol: fields.volumeM3,
    }).catch(() => {});
  }
  return mapSawingRoundInput(data);
}

export async function deleteSawingRoundInput(id) {
  const { data: row } = await sb.from('sawing_round_inputs').select('container_id,volume_m3').eq('id', id).single();
  const { error } = await sb.from('sawing_round_inputs').delete().eq('id', id);
  if (error) return { error: error.message };
  // Hoàn lại remaining_volume
  if (row?.container_id && row?.volume_m3) {
    await sb.rpc('increment_container_remaining', {
      cid: row.container_id, vol: row.volume_m3,
    }).catch(() => {});
  }
  return { success: true };
}

// Fetch raw_wood containers còn tồn kho (cargo_type = 'raw_round')
export async function fetchRawWoodStock() {
  const { data, error } = await sb
    .from('containers')
    .select('id,container_code,cargo_type,total_volume,remaining_volume,weight_unit,ton_to_m3_factor,raw_wood_type_id,ncc_id,arrival_date,status,notes')
    .eq('cargo_type', 'raw_round')
    .order('arrival_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, containerCode: r.container_code, cargoType: r.cargo_type,
    totalVolume: parseFloat(r.total_volume) || 0,
    remainingVolume: r.remaining_volume != null ? parseFloat(r.remaining_volume) : null,
    weightUnit: r.weight_unit || 'm3',
    tonToM3Factor: r.ton_to_m3_factor ? parseFloat(r.ton_to_m3_factor) : null,
    rawWoodTypeId: r.raw_wood_type_id || null,
    nccId: r.ncc_id, arrivalDate: r.arrival_date, status: r.status, notes: r.notes,
  }));
}

// Lấy sawing items có thể đưa vào lò: done_volume > 0, kèm volume đã dùng trong kiln
export async function fetchSawingItemsForKiln() {
  // Fetch active sawing items
  const { data: batches } = await sb.from('sawing_batches').select('id,wood_id,batch_code,batch_date').eq('status', 'sawing');
  if (!batches?.length) return [];
  const batchIds = batches.map(b => b.id);
  const { data: sitems } = await sb.from('sawing_items').select('*').in('batch_id', batchIds);
  if (!sitems?.length) return [];
  // Tính volume đã nạp vào kiln
  const sitemIds = sitems.map(i => i.id);
  const { data: kilnUsage } = await sb.from('kiln_items').select('sawing_item_id,volume_m3').in('sawing_item_id', sitemIds);
  const usedMap = {};
  (kilnUsage || []).forEach(k => {
    usedMap[k.sawing_item_id] = (usedMap[k.sawing_item_id] || 0) + (parseFloat(k.volume_m3) || 0);
  });
  const batchMap = Object.fromEntries(batches.map(b => [b.id, b]));
  return sitems.map(r => {
    const b = batchMap[r.batch_id] || {};
    const done = parseFloat(r.done_volume) || 0;
    const used = usedMap[r.id] || 0;
    const available = Math.max(0, done - used);
    return {
      id: r.id, batchId: r.batch_id, batchCode: b.batch_code, batchDate: b.batch_date,
      woodId: b.wood_id, thickness: r.thickness, quality: r.quality,
      targetVolume: parseFloat(r.target_volume) || 0,
      doneVolume: done, usedInKiln: used, available,
      priority: r.priority || 'normal', note: r.note,
    };
  }).filter(i => i.doneVolume > 0); // chỉ hiện item đã xẻ được
}

// Note: fetchRawWoodPackingList is defined above at line ~722
