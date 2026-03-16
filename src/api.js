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
  return (data || []).map(r => ({ id: r.id, name: r.name, nameEn: r.name_en, icon: r.icon, code: r.code || "" }));
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
      price: r.price != null ? parseFloat(r.price) : null,
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

export async function addWoodType(id, name, nameEn, icon, code) {
  const { data: existing } = await sb.from('wood_types').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = existing?.length ? (existing[0].sort_order + 1) : 0;
  const { error } = await sb.from('wood_types').insert({ id, name, name_en: nameEn, icon, code: code || null, sort_order: nextOrder });
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

export async function saveAttribute(id, name, groupable, values) {
  const valuesStr = Array.isArray(values) ? values.join(', ') : (values || '');
  const { error } = await sb.from('attributes').upsert({ id, name, groupable, values: valuesStr }, { onConflict: 'id' });
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
    createdAt: r.created_at,
  };
}

export async function fetchBundles() {
  const { data, error } = await sb.from('wood_bundles').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapBundleRow);
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

export async function addBundle({ woodId, containerId, skuKey, attributes, boardCount, volume, notes, supplierBundleCode, location }) {
  const bundleCode = await genBundleCode(woodId);
  const row = {
    bundle_code: bundleCode,
    wood_id: woodId,
    container_id: containerId || null,
    sku_key: skuKey,
    attributes,
    board_count: parseInt(boardCount) || 0,
    remaining_boards: parseInt(boardCount) || 0,
    volume: parseFloat(volume) || 0,
    remaining_volume: parseFloat(volume) || 0,
    status: 'Kiện nguyên',
    notes: notes || null,
    supplier_bundle_code: supplierBundleCode || null,
    location: location || null,
    qr_code: bundleCode,
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

// ===== CUSTOMERS =====

function genCustCode(name, address, phone) {
  const n = name.replace(/^(anh|chị|ông|bà|ms|mr)\s+/i, '').trim().split(/\s+/).pop();
  const namePart = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'KH';
  const addrWords = address.split(/[,\/]/).pop()?.trim().split(/\s+/) || [];
  const addrPart = (addrWords[addrWords.length - 1] || 'XX').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'XX';
  const phonePart = (phone || '').replace(/\D/g, '').slice(-3) || '000';
  return `${namePart}-${addrPart}-${phonePart}`;
}

export async function fetchCustomers() {
  const { data, error } = await sb.from('customers').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, customerCode: r.customer_code, name: r.name, address: r.address,
    deliveryAddress: r.delivery_address || '', phone1: r.phone1, phone2: r.phone2 || '',
    companyName: r.company_name || '', interestedWoodTypes: r.interested_wood_types || [],
    productDescription: r.product_description || '', debtLimit: r.debt_limit || 0,
    debtDays: r.debt_days || 30, notes: r.notes || '', createdAt: r.created_at,
  }));
}

export async function addCustomer(data) {
  const customerCode = genCustCode(data.name, data.address, data.phone1);
  const { error } = await sb.from('customers').insert({
    customer_code: customerCode, name: data.name, address: data.address,
    delivery_address: data.deliveryAddress || null, phone1: data.phone1,
    phone2: data.phone2 || null, company_name: data.companyName || null,
    interested_wood_types: data.interestedWoodTypes || [],
    product_description: data.productDescription || null,
    debt_limit: parseFloat(data.debtLimit) || 0, debt_days: parseInt(data.debtDays) || 30,
    notes: data.notes || null,
  });
  return error ? { error: error.message } : { success: true, customerCode };
}

export async function updateCustomer(id, data) {
  const { error } = await sb.from('customers').update({
    name: data.name, address: data.address, delivery_address: data.deliveryAddress || null,
    phone1: data.phone1, phone2: data.phone2 || null, company_name: data.companyName || null,
    interested_wood_types: data.interestedWoodTypes || [],
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

export async function fetchOrders() {
  const { data, error } = await sb.from('orders').select('*, customers(name,address,phone1)').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapOrder);
}

export async function fetchOrderDetail(orderId) {
  const [{ data: ord }, { data: items }, { data: services }] = await Promise.all([
    sb.from('orders').select('*, customers(*)').eq('id', orderId).single(),
    sb.from('order_items').select('*').eq('order_id', orderId).order('id'),
    sb.from('order_services').select('*').eq('order_id', orderId).order('id'),
  ]);
  return {
    order: ord ? mapOrder(ord) : null,
    customer: ord?.customers || null,
    items: (items || []).map(r => ({ id: r.id, bundleId: r.bundle_id, bundleCode: r.bundle_code, woodId: r.wood_id, skuKey: r.sku_key, attributes: r.attributes || {}, boardCount: r.board_count || 0, volume: parseFloat(r.volume) || 0, unit: r.unit || 'm3', unitPrice: parseFloat(r.unit_price), listPrice: parseFloat(r.list_price), amount: parseFloat(r.amount) || 0, notes: r.notes || '' })),
    services: (services || []).map(r => ({ id: r.id, description: r.description || '', amount: parseFloat(r.amount) || 0 })),
  };
}

export async function createOrder(orderData, items, services) {
  const targetStatus = orderData.targetStatus || 'Chưa thanh toán';
  const orderCode = await genOrderCode();
  const paymentStatus = targetStatus === 'Đã thanh toán' ? 'Đã thanh toán' : (targetStatus === 'Nháp' ? 'Nháp' : 'Chưa thanh toán');
  const { data: ord, error: oe } = await sb.from('orders').insert({
    order_code: orderCode, customer_id: orderData.customerId,
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
  const itemRows = items.map(it => ({ order_id: ord.id, bundle_id: it.bundleId || null, bundle_code: it.bundleCode, wood_id: it.woodId, sku_key: it.skuKey, attributes: it.attributes, board_count: it.boardCount, volume: it.volume, unit: it.unit, unit_price: it.unitPrice, list_price: it.listPrice, amount: it.amount, notes: it.notes || null }));
  if (itemRows.length) { const { error: ie } = await sb.from('order_items').insert(itemRows); if (ie) return { error: ie.message }; }
  const svcRows = services.filter(s => s.description || s.amount > 0).map(s => ({ order_id: ord.id, description: s.description, amount: s.amount }));
  if (svcRows.length) { const { error: se } = await sb.from('order_services').insert(svcRows); if (se) return { error: se.message }; }
  return { success: true, id: ord.id, orderCode };
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
    update.status = orderData.targetStatus;
    update.payment_status = orderData.targetStatus === 'Đã thanh toán' ? 'Đã thanh toán' : (orderData.targetStatus === 'Nháp' ? 'Nháp' : 'Chưa thanh toán');
    if (orderData.targetStatus === 'Đã thanh toán') update.payment_date = new Date().toISOString();
  }
  const { error: oe } = await sb.from('orders').update(update).eq('id', id);
  if (oe) return { error: oe.message };
  await Promise.all([sb.from('order_items').delete().eq('order_id', id), sb.from('order_services').delete().eq('order_id', id)]);
  const itemRows = items.map(it => ({ order_id: id, bundle_id: it.bundleId || null, bundle_code: it.bundleCode, wood_id: it.woodId, sku_key: it.skuKey, attributes: it.attributes, board_count: it.boardCount, volume: it.volume, unit: it.unit, unit_price: it.unitPrice, list_price: it.listPrice, amount: it.amount, notes: it.notes || null }));
  if (itemRows.length) await sb.from('order_items').insert(itemRows);
  const svcRows = services.filter(s => s.description || s.amount > 0).map(s => ({ order_id: id, description: s.description, amount: s.amount }));
  if (svcRows.length) await sb.from('order_services').insert(svcRows);
  return { success: true };
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
