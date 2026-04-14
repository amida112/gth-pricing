import sb from './client';

// ===== ORDERS =====

export async function genOrderCode() {
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
    customerSalutation: r.customers?.salutation || '',
    customerNickname: r.customers?.nickname || '',
    customerType: r.customers?.customer_type || 'individual',
    status: r.status || 'Đã xác nhận',
    paymentStatus: r.payment_status || 'Chưa thanh toán', paymentDate: r.payment_date,
    exportStatus: r.export_status || 'Chưa xuất', exportDate: r.export_date,
    exportImages: r.export_images || [],
    subtotal: parseFloat(r.subtotal) || 0, applyTax: r.apply_tax !== false,
    taxAmount: parseFloat(r.tax_amount) || 0, deposit: parseFloat(r.deposit) || 0,
    debt: parseFloat(r.debt) || 0, totalAmount: parseFloat(r.total_amount) || 0, totalVolume: parseFloat(r.total_volume) || 0,
    shippingType: r.shipping_type || 'Gọi xe cho khách',
    shippingCarrier: r.shipping_carrier || '', shippingFee: parseFloat(r.shipping_fee) || 0,
    driverName: r.driver_name || '', driverPhone: r.driver_phone || '',
    deliveryAddress: r.delivery_address || '', licensePlate: r.license_plate || '',
    estimatedArrival: r.estimated_arrival || '', shippingNotes: r.shipping_notes || '',
    notes: r.notes || '', createdAt: r.created_at,
    paidAmount: parseFloat(r.paid_amount) || 0,
    contactName: r.contact_name || '', contactPhone: r.contact_phone || '',
    createdBy: r.created_by || '', salesBy: r.sales_by || r.created_by || '',
    cancelledAt: r.cancelled_at || null, cancelledBy: r.cancelled_by || null, cancelReason: r.cancel_reason || null,
  };
}

export async function fetchPendingOrdersCount() {
  const { count, error } = await sb.from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'Chờ duyệt giá');
  if (error) return 0;
  return count || 0;
}

export async function fetchOrders() {
  const [{ data, error }, { data: contItems }] = await Promise.all([
    sb.from('orders').select('*, customers(name,address,phone1,salutation,nickname,customer_type)').order('created_at', { ascending: false }),
    sb.from('order_items').select('order_id').eq('item_type', 'container'),
  ]);
  if (error) throw new Error(error.message);
  const contOrderIds = new Set((contItems || []).map(i => i.order_id));
  return (data || []).map(r => ({ ...mapOrder(r), isContainerOrder: contOrderIds.has(r.id) }));
}

export async function fetchOrderDetail(orderId) {
  const [{ data: ord }, { data: items }, { data: services }, { data: payments }] = await Promise.all([
    sb.from('orders').select('*, customers(*)').eq('id', orderId).single(),
    sb.from('order_items').select('*').eq('order_id', orderId).order('id'),
    sb.from('order_services').select('*').eq('order_id', orderId).order('id'),
    sb.from('payment_records').select('*').eq('order_id', orderId).order('paid_at'),
  ]);
  // Lookup rawMeasurements từ wood_bundles cho items có bundle_id
  const bundleIds = (items || []).filter(r => r.bundle_id).map(r => r.bundle_id);
  let rawMeasMap = {};
  if (bundleIds.length) {
    const { data: bundles } = await sb.from('wood_bundles').select('id, raw_measurements').in('id', bundleIds);
    (bundles || []).forEach(b => { if (b.raw_measurements) rawMeasMap[b.id] = b.raw_measurements; });
  }
  return {
    order: ord ? mapOrder(ord) : null,
    customer: ord?.customers || null,
    items: (items || []).map(r => ({ id: r.id, bundleId: r.bundle_id, bundleCode: r.bundle_code, woodId: r.wood_id, skuKey: r.sku_key, attributes: r.attributes || {}, boardCount: r.board_count || 0, volume: parseFloat(r.volume) || 0, unit: r.unit || 'm3', unitPrice: parseFloat(r.unit_price), listPrice: r.list_price != null ? parseFloat(r.list_price) : null, listPrice2: r.list_price2 != null ? parseFloat(r.list_price2) : null, amount: parseFloat(r.amount) || 0, notes: r.notes || '', itemType: r.item_type || 'bundle', inspectionItemId: r.inspection_item_id || null, containerId: r.container_id || null, rawWoodData: r.raw_wood_data || null, saleVolume: r.sale_volume != null ? parseFloat(r.sale_volume) : null, saleUnit: r.sale_unit || null, refVolume: r.ref_volume != null ? parseFloat(r.ref_volume) : null, measurementId: r.measurement_id || null, rawMeasurements: rawMeasMap[r.bundle_id] || {} })),
    services: (services || []).map(r => r.payload?.type ? { id: r.id, ...r.payload, amount: parseFloat(r.amount) || 0 } : { id: r.id, type: 'other', description: r.description || '', amount: parseFloat(r.amount) || 0 }),
    paymentRecords: (payments || []).map(mapPaymentRecord),
  };
}

export async function approveOrderPrice(orderId) {
  const { error } = await sb.from('orders')
    .update({ status: 'Đã xác nhận' })
    .eq('id', orderId)
    .eq('status', 'Chờ duyệt giá');
  return error ? { error: error.message } : { success: true };
}

export async function createOrder(orderData, items, services) {
  const targetStatus = orderData.targetStatus || 'Chưa thanh toán';
  // Tách order_status (vòng đời) và payment_status (thanh toán)
  const isNhap = targetStatus === 'Nháp';
  const isPriceApproval = targetStatus === 'Chờ duyệt';
  const isDirectPay = targetStatus === 'Đã thanh toán';
  const orderStatus = isNhap ? 'Nháp' : isPriceApproval ? 'Chờ duyệt giá' : 'Đã xác nhận';
  let paymentStatus = isNhap ? 'Chưa thanh toán' : isDirectPay ? 'Đã thanh toán' : 'Chưa thanh toán';
  if (paymentStatus === 'Chưa thanh toán' && parseFloat(orderData.deposit) > 0) paymentStatus = 'Đã đặt cọc';
  // order_code: dùng pre-generated nếu có, không thì DB trigger tự sinh
  const { data: ord, error: oe } = await sb.from('orders').insert({
    ...(orderData.orderCode ? { order_code: orderData.orderCode } : {}),
    customer_id: orderData.customerId,
    status: orderStatus, payment_status: paymentStatus,
    payment_date: isDirectPay ? new Date().toISOString() : null,
    export_status: 'Chưa xuất',
    subtotal: orderData.subtotal, apply_tax: orderData.applyTax, tax_amount: orderData.taxAmount,
    deposit: orderData.deposit || 0, debt: orderData.debt || 0, total_amount: orderData.totalAmount, total_volume: orderData.totalVolume || 0,
    shipping_type: orderData.shippingType, shipping_carrier: orderData.shippingCarrier || null,
    shipping_fee: orderData.shippingFee || 0, driver_name: orderData.driverName || null,
    driver_phone: orderData.driverPhone || null, delivery_address: orderData.deliveryAddress || null,
    license_plate: orderData.licensePlate || null, estimated_arrival: orderData.estimatedArrival || null,
    shipping_notes: orderData.shippingNotes || null, notes: orderData.notes || null,
    contact_name: orderData.contactName || null, contact_phone: orderData.contactPhone || null,
    created_by: orderData.createdBy || null, sales_by: orderData.salesBy || orderData.createdBy || null,
  }).select().single();
  if (oe) return { error: oe.message };

  // Insert items và services song song (không phụ thuộc nhau)
  const itemRows = items.map(it => ({ order_id: ord.id, bundle_id: it.bundleId || null, bundle_code: it.bundleCode, wood_id: it.woodId, sku_key: it.skuKey, attributes: it.attributes, board_count: it.boardCount, volume: it.volume, unit: it.unit, unit_price: it.unitPrice, list_price: it.listPrice ?? null, list_price2: it.listPrice2 ?? null, amount: it.amount, notes: it.notes || null, item_type: it.itemType || 'bundle', inspection_item_id: it.inspectionItemId || null, container_id: it.containerId || null, raw_wood_data: it.rawWoodData || null, sale_volume: it.saleVolume ?? it.volume ?? null, sale_unit: it.saleUnit || it.unit || null, ref_volume: it.refVolume ?? null, measurement_id: it.measurementId || null }));
  const svcRows = services.filter(s => s.amount > 0).map(s => ({ order_id: ord.id, description: s.description || '', amount: s.amount, payload: s }));
  const inserts = [];
  if (itemRows.length) inserts.push(sb.from('order_items').insert(itemRows));
  if (svcRows.length) inserts.push(sb.from('order_services').insert(svcRows));
  if (inserts.length) {
    const results = await Promise.all(inserts);
    const err = results.find(r => r.error);
    if (err) return { error: err.error.message };
  }

  // Hold hàng hóa ngay khi tạo/lưu đơn (kể cả Nháp) — tránh bán trùng
  {
    await holdItemsForOrder(ord.id);
  }

  return { success: true, id: ord.id, orderCode: ord.order_code };
}

export async function updateOrder(id, orderData, items, services) {
  const update = {
    customer_id: orderData.customerId, subtotal: orderData.subtotal,
    apply_tax: orderData.applyTax, tax_amount: orderData.taxAmount,
    deposit: orderData.deposit || 0, debt: orderData.debt || 0, total_amount: orderData.totalAmount, total_volume: orderData.totalVolume || 0,
    shipping_type: orderData.shippingType, shipping_carrier: orderData.shippingCarrier || null,
    shipping_fee: orderData.shippingFee || 0, driver_name: orderData.driverName || null,
    driver_phone: orderData.driverPhone || null, delivery_address: orderData.deliveryAddress || null,
    license_plate: orderData.licensePlate || null, estimated_arrival: orderData.estimatedArrival || null,
    shipping_notes: orderData.shippingNotes || null, notes: orderData.notes || null,
    contact_name: orderData.contactName || null, contact_phone: orderData.contactPhone || null,
    ...(orderData.salesBy !== undefined ? { sales_by: orderData.salesBy || null } : {}),
    updated_by: orderData.updatedBy || null,
  };
  if (orderData.targetStatus) {
    const ts = orderData.targetStatus;
    const isNhap = ts === 'Nháp';
    const isPriceApproval = ts === 'Chờ duyệt';
    const isDirectPay = ts === 'Đã thanh toán';
    update.status = isNhap ? 'Nháp' : isPriceApproval ? 'Chờ duyệt giá' : 'Đã xác nhận';
    update.payment_status = isDirectPay ? 'Đã thanh toán' : 'Chưa thanh toán';
    if (update.payment_status === 'Chưa thanh toán' && parseFloat(orderData.deposit) > 0) update.payment_status = 'Đã đặt cọc';
    if (isDirectPay) update.payment_date = new Date().toISOString();
  }
  const { error: oe } = await sb.from('orders').update(update).eq('id', id);
  if (oe) return { error: oe.message };

  // So sánh items cũ vs mới → revert hold cho items bị xóa
  const { data: oldItems } = await sb.from('order_items').select('bundle_id,item_type,inspection_item_id,container_id,raw_wood_data,measurement_id').eq('order_id', id);
  const newBundleIds = new Set(items.filter(i => i.bundleId).map(i => i.bundleId));
  const newContainerIds = new Set(items.filter(i => i.containerId).map(i => String(i.containerId)));
  const newInspIds = new Set(items.filter(i => i.inspectionItemId).map(i => i.inspectionItemId));

  for (const old of (oldItems || [])) {
    const t = old.item_type || 'bundle';
    if (t === 'bundle' && old.bundle_id && !newBundleIds.has(old.bundle_id)) {
      // Bundle bị xóa khỏi đơn → revert hold
      const { data: b } = await sb.from('wood_bundles').select('status,board_count,remaining_boards').eq('id', old.bundle_id).single();
      if (b?.status === 'Chưa được bán' && b.remaining_boards >= b.board_count) {
        await sb.from('wood_bundles').update({ status: 'Kiện nguyên' }).eq('id', old.bundle_id);
      }
      // Unlink measurement nếu có (kiện lẻ)
      if (old.measurement_id) {
        await sb.from('bundle_measurements').update({ order_id: null, bundle_id: null, status: 'chờ gán', updated_at: new Date().toISOString() }).eq('id', old.measurement_id);
      }
    } else if (t === 'container' && old.container_id && !newContainerIds.has(String(old.container_id))) {
      // Container bị xóa → revert
      await sb.from('containers').update({ status: 'Đã về' }).eq('id', old.container_id).in('status', ['Đang lên đơn']);
      await sb.from('raw_wood_inspection').update({ status: 'available', sale_order_id: null }).eq('container_id', old.container_id).eq('status', 'on_order');
    } else if (t === 'raw_wood' && old.inspection_item_id && !newInspIds.has(old.inspection_item_id)) {
      // Gỗ lẻ bị xóa → revert
      await sb.from('raw_wood_inspection').update({ status: 'available', sale_order_id: null }).eq('id', old.inspection_item_id).eq('status', 'on_order');
    } else if (t === 'raw_wood_weight' && old.raw_wood_data?.containerId) {
      // Weight item bị xóa → xóa withdrawal
      const newHasWeight = items.some(i => i.itemType === 'raw_wood_weight' && (i.containerId === old.container_id || i.rawWoodData?.containerId === old.raw_wood_data.containerId));
      if (!newHasWeight) {
        await sb.from('raw_wood_withdrawals').delete().eq('order_id', id).eq('container_id', old.raw_wood_data.containerId);
      }
    }
  }

  // Hold items mới chưa có trong cũ
  const oldBundleIds = new Set((oldItems || []).filter(i => i.bundle_id).map(i => i.bundle_id));
  const oldContainerIds = new Set((oldItems || []).filter(i => i.container_id).map(i => String(i.container_id)));
  const oldInspIds = new Set((oldItems || []).filter(i => i.inspection_item_id).map(i => i.inspection_item_id));

  for (const ni of items) {
    const t = ni.itemType || 'bundle';
    if (t === 'bundle' && ni.bundleId && !oldBundleIds.has(ni.bundleId)) {
      if (ni.measurementId) {
        // Lấy lẻ mới: trừ remaining ngay
        const { data: b } = await sb.from('wood_bundles')
          .select('remaining_boards, remaining_volume, board_count')
          .eq('id', ni.bundleId).single();
        if (b) {
          const newBoards = Math.max(0, (b.remaining_boards || 0) - (ni.boardCount || 0));
          const newVol = Math.max(0, parseFloat(b.remaining_volume || 0) - parseFloat(ni.volume || 0));
          await sb.from('wood_bundles').update({
            remaining_boards: newBoards,
            remaining_volume: parseFloat(newVol.toFixed(4)),
            status: newBoards <= 0 ? 'Đã bán' : 'Kiện lẻ',
          }).eq('id', ni.bundleId);
        }
      } else {
        // Lấy nguyên: hold (đã hold từ form, idempotent)
        await sb.from('wood_bundles').update({ status: 'Chưa được bán' }).eq('id', ni.bundleId);
      }
    } else if (t === 'container' && ni.containerId && !oldContainerIds.has(String(ni.containerId))) {
      await sb.from('containers').update({ status: 'Đang lên đơn' }).eq('id', ni.containerId);
      await sb.from('raw_wood_inspection').update({ status: 'on_order', sale_order_id: id }).eq('container_id', ni.containerId).eq('status', 'available');
    } else if (t === 'raw_wood' && ni.inspectionItemId && !oldInspIds.has(ni.inspectionItemId)) {
      await sb.from('raw_wood_inspection').update({ status: 'on_order', sale_order_id: id }).eq('id', ni.inspectionItemId);
    }
  }

  // Delete + re-insert items/services
  await Promise.all([sb.from('order_items').delete().eq('order_id', id), sb.from('order_services').delete().eq('order_id', id)]);
  const itemRows = items.map(it => ({ order_id: id, bundle_id: it.bundleId || null, bundle_code: it.bundleCode, wood_id: it.woodId, sku_key: it.skuKey, attributes: it.attributes, board_count: it.boardCount, volume: it.volume, unit: it.unit, unit_price: it.unitPrice, list_price: it.listPrice ?? null, list_price2: it.listPrice2 ?? null, amount: it.amount, notes: it.notes || null, item_type: it.itemType || 'bundle', inspection_item_id: it.inspectionItemId || null, container_id: it.containerId || null, raw_wood_data: it.rawWoodData || null, sale_volume: it.saleVolume ?? it.volume ?? null, sale_unit: it.saleUnit || it.unit || null, ref_volume: it.refVolume ?? null, measurement_id: it.measurementId || null }));
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

// Hold hàng hóa khi tạo đơn (chưa thanh toán) — tránh bán trùng
// Bundle → status 'Chưa được bán' (hold)
// Inspection → status 'on_order'
// Container → status 'Đang lên đơn'
// Withdrawal → tạo withdrawal ngay (trừ remaining)
async function holdItemsForOrder(orderId) {
  const { data: items, error: fetchErr } = await sb.from('order_items').select('bundle_id,board_count,volume,item_type,inspection_item_id,container_id,raw_wood_data,measurement_id').eq('order_id', orderId);
  if (fetchErr) { console.error('holdItemsForOrder fetch error:', fetchErr.message); return; }
  const errors = [];
  for (const it of (items || [])) {
    const itemType = it.item_type || 'bundle';
    if (itemType === 'bundle' && it.bundle_id) {
      if (it.measurement_id) {
        // Lấy lẻ: trừ remaining ngay, trả pool với phần còn lại
        const { data: b } = await sb.from('wood_bundles')
          .select('remaining_boards, remaining_volume, board_count')
          .eq('id', it.bundle_id).single();
        if (b) {
          const newBoards = Math.max(0, (b.remaining_boards || 0) - (it.board_count || 0));
          const newVol = Math.max(0, parseFloat(b.remaining_volume || 0) - parseFloat(it.volume || 0));
          const { error } = await sb.from('wood_bundles').update({
            remaining_boards: newBoards,
            remaining_volume: parseFloat(newVol.toFixed(4)),
            status: newBoards <= 0 ? 'Đã bán' : 'Kiện lẻ',
          }).eq('id', it.bundle_id);
          if (error) errors.push(`bundle ${it.bundle_id}: ${error.message}`);
        }
      } else {
        // Lấy nguyên: hold toàn bộ
        const { error } = await sb.from('wood_bundles').update({ status: 'Chưa được bán' }).eq('id', it.bundle_id);
        if (error) errors.push(`bundle hold ${it.bundle_id}: ${error.message}`);
      }
    } else if (itemType === 'raw_wood' && it.inspection_item_id) {
      const { error } = await sb.from('raw_wood_inspection').update({ status: 'on_order', sale_order_id: orderId }).eq('id', it.inspection_item_id);
      if (error) errors.push(`inspection ${it.inspection_item_id}: ${error.message}`);
    } else if (itemType === 'container' && it.container_id) {
      const { error: e1 } = await sb.from('containers').update({ status: 'Đang lên đơn' }).eq('id', it.container_id);
      if (e1) errors.push(`container ${it.container_id}: ${e1.message}`);
      const { error: e2 } = await sb.from('raw_wood_inspection').update({ status: 'on_order', sale_order_id: orderId }).eq('container_id', it.container_id).eq('status', 'available');
      if (e2) errors.push(`container insp ${it.container_id}: ${e2.message}`);
    } else if (itemType === 'raw_wood_weight' && it.raw_wood_data?.containerId) {
      const wd = it.raw_wood_data;
      const { error: e1 } = await sb.from('raw_wood_withdrawals').insert({
        container_id: wd.containerId, type: 'sale',
        piece_count: wd.pieceCount || it.board_count || 0,
        weight_kg: wd.weightKg || 0,
        unit: it.unit || 'ton',
        order_id: orderId, notes: 'Hold — đang lên đơn',
      });
      if (e1) errors.push(`withdrawal ${wd.containerId}: ${e1.message}`);
      const { data: c } = await sb.from('containers').select('remaining_volume,remaining_pieces,total_volume').eq('id', wd.containerId).single();
      if (c) {
        const curVol = c.remaining_volume != null ? parseFloat(c.remaining_volume) : parseFloat(c.total_volume) || 0;
        const deltaTon = (wd.weightKg || 0) / 1000;
        const newVol = Math.max(0, parseFloat((curVol - deltaTon).toFixed(4)));
        const newPcs = c.remaining_pieces != null ? Math.max(0, c.remaining_pieces - (wd.pieceCount || 0)) : null;
        const updates = { remaining_volume: newVol };
        if (newPcs != null) updates.remaining_pieces = newPcs;
        if (newVol <= 0 && (newPcs == null || newPcs <= 0)) updates.status = 'Đã hết';
        const { error: e2 } = await sb.from('containers').update(updates).eq('id', wd.containerId);
        if (e2) errors.push(`container vol ${wd.containerId}: ${e2.message}`);
      }
    }
  }
  if (errors.length) console.error('holdItemsForOrder errors:', errors);
}

// Finalize: chuyển từ hold → sold khi thanh toán đủ
// Bundle: trừ remaining (hold chỉ đổi status, chưa trừ số)
// Inspection: on_order → sold
// Container: Đang lên đơn → Đã bán
// Withdrawal: đã tạo lúc hold → chỉ update notes
async function deductBundlesForOrderId(orderId) {
  const { data: items } = await sb.from('order_items').select('bundle_id,board_count,volume,item_type,inspection_item_id,container_id,raw_wood_data,measurement_id').eq('order_id', orderId);
  for (const it of (items || [])) {
    const itemType = it.item_type || 'bundle';
    if (itemType === 'bundle' && it.bundle_id) {
      // Lấy lẻ (measurement): đã trừ remaining lúc holdItemsForOrder → skip
      if (it.measurement_id) continue;
      const { data: b } = await sb.from('wood_bundles').select('remaining_boards,remaining_volume').eq('id', it.bundle_id).single();
      if (!b) continue;
      const newBoards = Math.max(0, (b.remaining_boards || 0) - (it.board_count || 0));
      const rawNewVol = parseFloat(b.remaining_volume || 0) - parseFloat(it.volume || 0);
      const isClosed = newBoards <= 0;
      await sb.from('wood_bundles').update({ remaining_boards: newBoards, remaining_volume: isClosed ? 0 : parseFloat(rawNewVol.toFixed(4)), status: isClosed ? 'Đã bán' : 'Kiện lẻ', ...(isClosed ? { volume_adjustment: parseFloat(rawNewVol.toFixed(4)) } : {}) }).eq('id', it.bundle_id);
    } else if (itemType === 'raw_wood' && it.inspection_item_id) {
      await sb.from('raw_wood_inspection').update({ status: 'sold', sale_order_id: orderId }).eq('id', it.inspection_item_id);
    } else if (itemType === 'container' && it.container_id) {
      // Mark container đã bán + trừ remaining
      await sb.from('containers').update({ status: 'Đã bán', remaining_volume: 0 }).eq('id', it.container_id);
      // Update inspection items nếu có
      await sb.from('raw_wood_inspection').update({ status: 'sold', sale_order_id: orderId }).eq('container_id', it.container_id).in('status', ['available', 'on_order']);
    } else if (itemType === 'raw_wood_weight' && it.raw_wood_data?.containerId) {
      // Withdrawal đã tạo lúc hold → chỉ update amount/price
      const wd = it.raw_wood_data;
      const unitPrice = it.unit_price ? parseFloat(it.unit_price) / 1000000 : 0;
      const amount = it.volume ? parseFloat(it.volume) * unitPrice : 0;
      await sb.from('raw_wood_withdrawals').update({
        unit_price: unitPrice, amount, notes: 'Đã thanh toán',
      }).eq('order_id', orderId).eq('container_id', wd.containerId);
    }
  }
}

export async function recordPayment(orderId, { amount, method, note, paidBy, discount, discountNote }) {
  const { data: order, error: oe } = await sb.from('orders')
    .select('customer_id, total_amount, deposit, debt')
    .eq('id', orderId).single();
  if (oe || !order) return { error: oe?.message || 'Không tìm thấy đơn hàng' };

  const discountAmt = parseFloat(discount) || 0;
  // Tổng gia hàng tích lũy: đã có + lần này → check ngưỡng
  const { data: existingRecs } = await sb.from('payment_records').select('discount, discount_status').eq('order_id', orderId).neq('discount_status', 'rejected');
  const existingDiscount = (existingRecs || []).reduce((s, r) => s + (parseFloat(r.discount) || 0), 0);
  const totalDiscount = existingDiscount + discountAmt;
  const discountStatus = discountAmt <= 0 ? 'none'
    : totalDiscount < DISCOUNT_AUTO_LIMIT ? 'auto'
    : 'pending'; // tổng tích lũy >= 200k cần admin duyệt

  const { error: pe } = await sb.from('payment_records').insert({
    order_id: orderId, customer_id: order.customer_id,
    amount: parseFloat(amount), method: method || 'Tiền mặt',
    discount: discountAmt, discount_note: discountNote || null,
    discount_status: discountStatus,
    paid_at: new Date().toISOString(), note: note || null, paid_by: paidBy || null,
  });
  if (pe) return { error: pe.message };

  const deposit = parseFloat(order.deposit) || 0;
  const toPay = parseFloat(order.total_amount) - (parseFloat(order.debt) || 0);
  const { data: allRec } = await sb.from('payment_records').select('*').eq('order_id', orderId);
  const records = (allRec || []).map(mapPaymentRecord);
  const totalPaid = records.reduce((s, r) => {
    const dc = r.discountStatus === 'auto' || r.discountStatus === 'approved';
    return s + (r.amount || 0) + (dc ? (r.discount || 0) : 0);
  }, 0);
  const outstanding = Math.max(0, toPay - totalPaid);

  const fullyPaid = outstanding <= 0;
  const hasPendingDiscount = records.some(r => r.discountStatus === 'pending');
  const newPaymentStatus = fullyPaid ? 'Đã thanh toán' : (deposit > 0 && totalPaid <= deposit) ? 'Đã đặt cọc' : 'Còn nợ';
  const updates = { payment_status: newPaymentStatus, paid_amount: totalPaid };
  if (fullyPaid) updates.payment_date = new Date().toISOString();

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
  const deposit = parseFloat(order.deposit) || 0;
  const toPay = parseFloat(order.total_amount) - (parseFloat(order.debt) || 0);
  const { data: allRec } = await sb.from('payment_records').select('*').eq('order_id', orderId);
  const records = (allRec || []).map(mapPaymentRecord);
  const totalPaid = records.reduce((s, r) => {
    const dc = r.discountStatus === 'auto' || r.discountStatus === 'approved';
    return s + (r.amount || 0) + (dc ? (r.discount || 0) : 0);
  }, 0);
  const outstanding = Math.max(0, toPay - totalPaid);

  if (approve && outstanding <= 0) {
    await sb.from('orders').update({ payment_status: 'Đã thanh toán', payment_date: new Date().toISOString(), paid_amount: totalPaid }).eq('id', orderId);
    await deductBundlesForOrderId(orderId);
    return { success: true, paymentStatus: 'Đã thanh toán', outstanding: 0 };
  }
  const ps = outstanding <= 0 ? 'Đã thanh toán' : (deposit > 0 && totalPaid <= deposit) ? 'Đã đặt cọc' : 'Còn nợ';
  await sb.from('orders').update({ payment_status: ps, paid_amount: totalPaid }).eq('id', orderId);
  return { success: true, paymentStatus: ps, outstanding };
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
  const { error } = await sb.from('orders').update({ export_status: 'Đã xuất', export_date: new Date().toISOString(), export_images: images || [] }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Auto xuất kho khi điều cont về khách — tìm đơn hàng nguyên cont chưa xuất
export async function autoExportByContainerDispatch(containerIds) {
  const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
  const results = [];
  for (const cid of ids) {
    const { data: items } = await sb.from('order_items').select('order_id').eq('container_id', cid).eq('item_type', 'container');
    if (!items?.length) continue;
    for (const it of items) {
      const { data: order } = await sb.from('orders').select('id,export_status,payment_status').eq('id', it.order_id).single();
      if (order && order.export_status !== 'Đã xuất' && order.payment_status !== 'Đã hủy') {
        await sb.from('orders').update({ export_status: 'Đã xuất', export_date: new Date().toISOString() }).eq('id', order.id);
        results.push(order.id);
      }
    }
  }
  return { success: true, exportedOrderIds: results };
}

// Hủy xuất kho khi hủy điều cont — rollback đơn hàng nguyên cont
export async function rollbackExportByContainerDispatch(containerIds) {
  const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
  for (const cid of ids) {
    const { data: items } = await sb.from('order_items').select('order_id').eq('container_id', cid).eq('item_type', 'container');
    if (!items?.length) continue;
    for (const it of items) {
      await sb.from('orders').update({ export_status: 'Chưa xuất', export_date: null }).eq('id', it.order_id).eq('export_status', 'Đã xuất');
    }
  }
  return { success: true };
}

export async function deleteOrder(id) {
  // Xóa cứng — đơn Nháp hoặc đơn Đã hủy (superadmin)
  // Revert hold trước khi xóa
  const { data: items } = await sb.from('order_items').select('bundle_id,item_type,inspection_item_id,container_id').eq('order_id', id);
  for (const it of (items || [])) {
    const t = it.item_type || 'bundle';
    if (t === 'bundle' && it.bundle_id) {
      const { data: b } = await sb.from('wood_bundles').select('status,board_count,remaining_boards').eq('id', it.bundle_id).single();
      if (b?.status === 'Chưa được bán' && b.remaining_boards >= b.board_count) await sb.from('wood_bundles').update({ status: 'Kiện nguyên' }).eq('id', it.bundle_id);
    } else if (t === 'container' && it.container_id) {
      await sb.from('containers').update({ status: 'Đã về' }).eq('id', it.container_id).in('status', ['Đang lên đơn']);
      await sb.from('raw_wood_inspection').update({ status: 'available', sale_order_id: null }).eq('container_id', it.container_id).eq('status', 'on_order');
    } else if (t === 'raw_wood' && it.inspection_item_id) {
      await sb.from('raw_wood_inspection').update({ status: 'available', sale_order_id: null }).eq('id', it.inspection_item_id).eq('status', 'on_order');
    }
  }
  // Xóa tất cả dữ liệu liên quan
  await Promise.all([
    sb.from('raw_wood_withdrawals').delete().eq('order_id', id),
    sb.from('payment_records').delete().eq('order_id', id),
    sb.from('order_items').delete().eq('order_id', id),
    sb.from('order_services').delete().eq('order_id', id),
    // customer_credits source_order_id — set null thay vì xóa (credit vẫn valid)
    sb.from('customer_credits').update({ source_order_id: null }).eq('source_order_id', id),
    // Gỡ liên kết kiện lẻ — trả về DS chờ gán
    sb.from('bundle_measurements').update({ order_id: null, status: 'chờ gán', updated_at: new Date().toISOString() }).eq('order_id', id),
  ]);
  // bank_transactions matched_order_id — set null
  await sb.from('bank_transactions').update({ matched_order_id: null, match_status: 'unmatched', match_note: 'Đơn hàng đã bị xóa' }).eq('matched_order_id', id);
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
  if (order.status === 'Đã hủy') return { error: 'Đơn đã hủy rồi' };

  // 2. Hoàn trả bundles nếu đã deduct (kiểm tra từng bundle xem remaining < board_count)
  let bundlesRestored = 0;
  const restoredDetails = [];
  const cancelErrors = [];
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
    const { error: re } = await sb.from('wood_bundles').update({
      remaining_boards: cappedBoards,
      remaining_volume: parseFloat(cappedVol.toFixed(4)),
      status: newStatus,
    }).eq('id', it.bundle_id);
    if (re) cancelErrors.push(`restore bundle ${it.bundle_id}: ${re.message}`);
    bundlesRestored++;
    restoredDetails.push({ bundleCode: it.bundle_code, boards: it.board_count, volume: parseFloat(it.volume || 0), newStatus });
  }

  // 2b. Hoàn trả gỗ nguyên liệu + container (cả sold và on_order)
  for (const it of (items || [])) {
    const itemType = it.item_type || 'bundle';
    if (itemType === 'raw_wood' && it.inspection_item_id) {
      const { error: re } = await sb.from('raw_wood_inspection').update({ status: 'available', sale_order_id: null }).eq('id', it.inspection_item_id);
      if (re) cancelErrors.push(`revert insp ${it.inspection_item_id}: ${re.message}`);
    } else if (itemType === 'container' && it.container_id) {
      // Revert container status: Đang lên đơn/Đã bán → Đã về
      const { data: cont } = await sb.from('containers').select('status, remaining_volume, total_volume').eq('id', it.container_id).single();
      if (cont && (cont.status === 'Đang lên đơn' || cont.status === 'Đã bán')) {
        const { error: ce } = await sb.from('containers').update({ status: 'Đã về', remaining_volume: cont.total_volume }).eq('id', it.container_id);
        if (ce) cancelErrors.push(`revert cont ${it.container_id}: ${ce.message}`);
      }
      const { error: ie } = await sb.from('raw_wood_inspection').update({ status: 'available', sale_order_id: null }).eq('container_id', it.container_id).in('status', ['sold', 'on_order']);
      if (ie) cancelErrors.push(`revert cont insp ${it.container_id}: ${ie.message}`);
    }
  }
  // Hoàn bundle hold: Chưa được bán → Kiện nguyên (nếu chưa trừ remaining)
  for (const it of (items || [])) {
    if ((it.item_type || 'bundle') === 'bundle' && it.bundle_id) {
      const { data: b } = await sb.from('wood_bundles').select('status,board_count,remaining_boards').eq('id', it.bundle_id).single();
      if (b && b.status === 'Chưa được bán' && b.remaining_boards >= b.board_count) {
        await sb.from('wood_bundles').update({ status: 'Kiện nguyên' }).eq('id', it.bundle_id);
      }
    }
  }

  // 2c. Hoàn trả withdrawals (bán theo cân)
  const { data: ws } = await sb.from('raw_wood_withdrawals').select('*').eq('order_id', orderId);
  for (const w of (ws || [])) {
    const deltaTon = (parseFloat(w.weight_kg) || 0) / 1000;
    const { data: c } = await sb.from('containers').select('remaining_volume,remaining_pieces,total_volume').eq('id', w.container_id).single();
    if (c) {
      const curVol = c.remaining_volume != null ? parseFloat(c.remaining_volume) : parseFloat(c.total_volume) || 0;
      const newVol = parseFloat((curVol + deltaTon).toFixed(4));
      const updates = { remaining_volume: newVol };
      if (c.remaining_pieces != null && w.piece_count) updates.remaining_pieces = c.remaining_pieces + w.piece_count;
      // Reset status nếu đang 'Đã hết' và giờ có remaining
      if (newVol > 0) {
        const { data: cStatus } = await sb.from('containers').select('status').eq('id', w.container_id).single();
        if (cStatus?.status === 'Đã hết') updates.status = 'Đã về';
      }
      await sb.from('containers').update(updates).eq('id', w.container_id);
    }
  }
  if (ws?.length) await sb.from('raw_wood_withdrawals').delete().eq('order_id', orderId);

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
    const debt = parseFloat(order.debt) || 0;
    const toPay = totalOrder - debt;

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

  // 5. Unlink bank transactions
  await sb.from('bank_transactions').update({
    matched_order_id: null, match_status: 'unmatched',
    match_note: `Đơn ${order.order_code} đã hủy`,
  }).eq('matched_order_id', orderId);

  // 6. Gỡ liên kết kiện lẻ (bundle_measurements) — trả về DS kiện lẻ chờ gán
  await sb.from('bundle_measurements')
    .update({ order_id: null, status: 'chờ gán', updated_at: new Date().toISOString() })
    .eq('order_id', orderId);

  // 7. Update order status — giữ nguyên payment_status để biết đã TT hay chưa
  const { error: ue } = await sb.from('orders').update({
    status: 'Đã hủy',
    cancelled_at: new Date().toISOString(),
    cancelled_by: cancelledBy || 'admin',
    cancel_reason: reason || '',
  }).eq('id', orderId);
  if (ue) return { error: ue.message };
  if (cancelErrors.length) console.error('cancelOrder partial errors:', cancelErrors);

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

// ── Container order map: container nào đang trên đơn hàng ──
// Trả về: { [containerId]: { orderId, orderCode, orderStatus, exported, deposit, totalPaid } }
export function subscribeOrders(callback) {
  return sb.channel('orders_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback)
    .subscribe();
}

export function subscribePaymentRecords(callback, orderId) {
  const ch = orderId ? `payment_records_${orderId}` : 'payment_records_all';
  const opts = { event: '*', schema: 'public', table: 'payment_records' };
  if (orderId) opts.filter = `order_id=eq.${orderId}`;
  return sb.channel(ch).on('postgres_changes', opts, callback).subscribe();
}

export function subscribeCustomerCredits(callback, customerId) {
  const opts = { event: '*', schema: 'public', table: 'customer_credits' };
  if (customerId) opts.filter = `customer_id=eq.${customerId}`;
  return sb.channel(`customer_credits_${customerId || 'all'}`)
    .on('postgres_changes', opts, callback).subscribe();
}

export async function fetchContainerOrderMap() {
  const { data, error } = await sb
    .from('order_items')
    .select('container_id, order_id, orders(order_code, status, export_status, deposit, paid_amount, total_amount)')
    .eq('item_type', 'container')
    .not('container_id', 'is', null);
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach(r => {
    if (!r.container_id) return;
    const o = r.orders;
    if (!o || o.status === 'Đã hủy') return; // bỏ đơn đã hủy
    map[r.container_id] = {
      orderId: r.order_id,
      orderCode: o.order_code || '',
      orderStatus: o.status || '',
      exported: o.export_status === 'Đã xuất',
      hasDeposit: parseFloat(o.deposit || 0) > 0,
      fullyPaid: parseFloat(o.paid_amount || 0) >= parseFloat(o.total_amount || 1),
    };
  });
  return map;
}
