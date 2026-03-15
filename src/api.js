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
  return (data || []).map(r => ({ id: r.id, name: r.name, nameEn: r.name_en, icon: r.icon }));
}

export async function fetchAttributes() {
  const { data, error } = await sb.from('attributes').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    groupable: r.groupable,
    values: r.values ? r.values.split(',').map(v => v.trim()).filter(Boolean) : [],
  }));
}

export async function fetchAllConfig() {
  const { data, error } = await sb.from('wood_config').select('*');
  if (error) throw new Error(error.message);
  const result = {};
  (data || []).forEach(r => {
    if (!result[r.wood_id]) result[r.wood_id] = { attrs: [], attrValues: {}, defaultHeader: [] };
    result[r.wood_id].attrs.push(r.attr_id);
    result[r.wood_id].attrValues[r.attr_id] = r.selected_values
      ? r.selected_values.split(',').map(v => v.trim()).filter(Boolean)
      : [];
    if (r.is_header) result[r.wood_id].defaultHeader.push(r.attr_id);
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
      price: r.price != null ? parseFloat(r.price) : undefined,
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

export async function addWoodType(id, name, nameEn, icon) {
  const { data: existing } = await sb.from('wood_types').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = existing?.length ? (existing[0].sort_order + 1) : 0;
  const { error } = await sb.from('wood_types').insert({ id, name, name_en: nameEn, icon, sort_order: nextOrder });
  return error ? { error: error.message } : { success: true };
}

export async function apiUpdateWoodType(id, name, nameEn, icon) {
  const { error } = await sb.from('wood_types').update({ name, name_en: nameEn, icon }).eq('id', id);
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

export async function saveAttribute(id, name, groupable, values) {
  const valuesStr = Array.isArray(values) ? values.join(', ') : (values || '');
  const { error } = await sb.from('attributes').upsert({ id, name, groupable, values: valuesStr });
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
  }));
  if (rows.length > 0) {
    const { error } = await sb.from('wood_config').insert(rows);
    if (error) return { error: error.message };
  }
  return { success: true };
}

// ===== PRICES =====

export async function updatePrice(woodId, skuKey, newPrice, oldPrice, reason, changedBy, costPrice) {
  const row = {
    wood_id: woodId,
    sku_key: skuKey,
    price: newPrice,
    updated_date: new Date().toISOString().slice(0, 10),
    updated_by: changedBy || 'admin',
    ...(costPrice != null && { cost_price: costPrice }),
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

// ===== LOAD ALL =====

export async function loadAllData() {
  const [woodTypes, attributes, config, prices] = await Promise.all([
    fetchWoodTypes(),
    fetchAttributes(),
    fetchAllConfig(),
    fetchPrices(),
  ]);
  return { woodTypes, attributes, config, prices };
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
