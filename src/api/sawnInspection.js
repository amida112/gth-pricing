import sb from './client';

// ===== SAWN WOOD BUNDLE INSPECTION (NGHIỆM THU GỖ KIỆN NK) =====

const mapRow = (r) => ({
  id: r.id,
  containerId: r.container_id,
  containerItemId: r.container_item_id,
  supplierBundleCode: r.supplier_bundle_code,
  supplierBoards: r.supplier_boards,
  supplierVolume: r.supplier_volume != null ? parseFloat(r.supplier_volume) : null,
  supplierLength: r.supplier_length,
  supplierThickness: r.supplier_thickness,
  supplierWidth: r.supplier_width,
  supplierQuality: r.supplier_quality,
  supplierNcc: r.supplier_ncc,
  woodId: r.wood_id,
  inspectedBoards: r.inspected_boards,
  inspectedLength: r.inspected_length,
  inspectionNotes: r.inspection_notes,
  images: r.images || [],
  status: r.status,
  inspectedBy: r.inspected_by,
  inspectedAt: r.inspected_at,
  approvedBy: r.approved_by,
  approvedAt: r.approved_at,
  bundleId: r.bundle_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Lấy tất cả kiện nghiệm thu theo container */
export async function fetchSawnInspections(containerId) {
  const { data, error } = await sb.from('sawn_inspections')
    .select('*')
    .eq('container_id', containerId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

/** Lấy summary nghiệm thu cho nhiều container (lightweight) */
export async function fetchSawnInspectionSummary() {
  const { data, error } = await sb.from('sawn_inspections')
    .select('container_id, status, supplier_boards, supplier_volume, inspected_boards');
  if (error) throw new Error(error.message);
  const map = {};
  for (const r of (data || [])) {
    const cid = r.container_id;
    if (!map[cid]) map[cid] = { total: 0, pending: 0, inspected: 0, approved: 0, hold: 0, imported: 0, supplierBoards: 0, supplierVolume: 0, inspectedBoards: 0 };
    const s = map[cid];
    s.total++;
    if (r.status === 'pending') s.pending++;
    else if (r.status === 'inspected') s.inspected++;
    else if (r.status === 'approved') s.approved++;
    else if (r.status === 'hold') s.hold++;
    else if (r.status === 'imported') s.imported++;
    s.supplierBoards += r.supplier_boards || 0;
    s.supplierVolume += r.supplier_volume ? parseFloat(r.supplier_volume) : 0;
    s.inspectedBoards += r.inspected_boards || 0;
  }
  return map;
}

/** Import packing list NCC — batch insert, validate duplicate */
export async function importSawnPackingList(containerId, rows) {
  if (!rows.length) return { error: 'Không có dữ liệu' };

  // Check duplicate supplier_bundle_code trong batch
  const codes = rows.map(r => r.supplierBundleCode);
  const dupsInBatch = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (dupsInBatch.length) return { error: `Mã kiện trùng trong dữ liệu: ${[...new Set(dupsInBatch)].join(', ')}` };

  // Check duplicate với DB
  const { data: existing } = await sb.from('sawn_inspections')
    .select('supplier_bundle_code')
    .eq('container_id', containerId)
    .in('supplier_bundle_code', codes);
  if (existing?.length) {
    return { error: `Mã kiện đã tồn tại: ${existing.map(r => r.supplier_bundle_code).join(', ')}` };
  }

  const inserts = rows.map(r => ({
    container_id: containerId,
    container_item_id: r.containerItemId || null,
    supplier_bundle_code: r.supplierBundleCode,
    supplier_boards: r.supplierBoards || null,
    supplier_volume: r.supplierVolume || null,
    supplier_length: r.supplierLength || null,
    supplier_thickness: r.supplierThickness || null,
    supplier_width: r.supplierWidth || null,
    supplier_quality: r.supplierQuality || null,
    supplier_ncc: r.supplierNcc || null,
    wood_id: r.woodId || null,
    status: 'pending',
  }));

  const { data, error } = await sb.from('sawn_inspections').insert(inserts).select();
  if (error) return { error: error.message };
  return { success: true, count: data.length, items: data.map(mapRow) };
}

/** Thêm 1 kiện nghiệm thu thủ công */
export async function addSawnInspection(containerId, fields) {
  const { data, error } = await sb.from('sawn_inspections').insert({
    container_id: containerId,
    container_item_id: fields.containerItemId || null,
    supplier_bundle_code: fields.supplierBundleCode,
    supplier_boards: fields.supplierBoards || null,
    supplier_volume: fields.supplierVolume || null,
    supplier_length: fields.supplierLength || null,
    supplier_thickness: fields.supplierThickness || null,
    supplier_width: fields.supplierWidth || null,
    supplier_quality: fields.supplierQuality || null,
    supplier_ncc: fields.supplierNcc || null,
    wood_id: fields.woodId || null,
    status: 'pending',
  }).select().single();
  if (error) return { error: error.message };
  return { success: true, item: mapRow(data) };
}

/** Cập nhật kết quả nghiệm thu 1 kiện */
export async function updateSawnInspection(id, fields) {
  const row = { updated_at: new Date().toISOString() };
  if (fields.containerItemId !== undefined) row.container_item_id = fields.containerItemId || null;
  if (fields.supplierBundleCode !== undefined) row.supplier_bundle_code = fields.supplierBundleCode;
  if (fields.supplierBoards !== undefined) row.supplier_boards = fields.supplierBoards;
  if (fields.supplierVolume !== undefined) row.supplier_volume = fields.supplierVolume;
  if (fields.supplierLength !== undefined) row.supplier_length = fields.supplierLength;
  if (fields.supplierThickness !== undefined) row.supplier_thickness = fields.supplierThickness;
  if (fields.supplierWidth !== undefined) row.supplier_width = fields.supplierWidth;
  if (fields.supplierQuality !== undefined) row.supplier_quality = fields.supplierQuality;
  if (fields.supplierNcc !== undefined) row.supplier_ncc = fields.supplierNcc;
  if (fields.woodId !== undefined) row.wood_id = fields.woodId;
  if (fields.inspectedBoards !== undefined) row.inspected_boards = fields.inspectedBoards;
  if (fields.inspectedLength !== undefined) row.inspected_length = fields.inspectedLength;
  if (fields.inspectionNotes !== undefined) row.inspection_notes = fields.inspectionNotes;
  if (fields.images !== undefined) row.images = fields.images;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.inspectedBy !== undefined) row.inspected_by = fields.inspectedBy;
  if (fields.inspectedAt !== undefined) row.inspected_at = fields.inspectedAt;

  const { error } = await sb.from('sawn_inspections').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

/** Lưu kết quả nghiệm thu (đánh dấu inspected) */
export async function submitSawnInspection(id, fields) {
  const row = {
    inspected_boards: fields.inspectedBoards,
    inspected_length: fields.inspectedLength || null,
    inspection_notes: fields.inspectionNotes || null,
    images: fields.images || [],
    status: 'inspected',
    inspected_by: fields.inspectedBy || null,
    inspected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('sawn_inspections').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

/** Sếp duyệt cả container — chuyển tất cả inspected → approved, trừ kiện hold */
export async function approveSawnInspections(containerId, approvedBy, holdIds = []) {
  const now = new Date().toISOString();

  // Duyệt tất cả inspected (trừ hold)
  let q = sb.from('sawn_inspections')
    .update({ status: 'approved', approved_by: approvedBy, approved_at: now, updated_at: now })
    .eq('container_id', containerId)
    .eq('status', 'inspected');
  if (holdIds.length) q = q.not('id', 'in', `(${holdIds.join(',')})`);
  const { error } = await q;
  if (error) return { error: error.message };

  // Set hold cho các kiện được chọn
  if (holdIds.length) {
    const { error: e2 } = await sb.from('sawn_inspections')
      .update({ status: 'hold', updated_at: now })
      .in('id', holdIds);
    if (e2) return { error: e2.message };
  }

  return { success: true };
}

/** Xóa 1 kiện nghiệm thu */
export async function deleteSawnInspection(id) {
  const { error } = await sb.from('sawn_inspections').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

/** Xóa tất cả kiện nghiệm thu của container */
export async function clearSawnInspections(containerId) {
  const { error } = await sb.from('sawn_inspections').delete().eq('container_id', containerId);
  return error ? { error: error.message } : { success: true };
}

/**
 * Nhập kho hàng loạt từ kiện đã duyệt.
 * bundles: [{ inspectionId, woodId, containerId, attributes, skuKey, boardCount, volume,
 *             supplierBoards, supplierVolume, supplierBundleCode, location, notes, rawMeasurements }]
 */
export async function batchImportToWarehouse(bundles) {
  if (!bundles.length) return { error: 'Không có kiện nào' };

  const results = [];
  const errors = [];

  for (const b of bundles) {
    try {
      // Generate bundle code
      const { data: wt } = await sb.from('wood_types').select('code,id').eq('id', b.woodId).single();
      const prefix = ((wt?.code || b.woodId) + '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const { data: existing } = await sb.from('wood_bundles')
        .select('bundle_code')
        .like('bundle_code', `${prefix}-${date}-%`)
        .order('bundle_code', { ascending: false })
        .limit(1);
      const nextNum = existing?.length ? (parseInt(existing[0].bundle_code.split('-').pop()) || 0) + 1 : 1;
      const bundleCode = `${prefix}-${date}-${String(nextNum).padStart(3, '0')}`;

      const bc = parseInt(b.boardCount) || 0;
      const vol = parseFloat(b.volume) || 0;
      const row = {
        bundle_code: bundleCode,
        wood_id: b.woodId,
        container_id: b.containerId || null,
        sku_key: b.skuKey || '',
        attributes: b.attributes || {},
        board_count: bc,
        remaining_boards: bc,
        volume: vol,
        remaining_volume: vol,
        status: 'Kiện nguyên',
        notes: b.notes || null,
        supplier_bundle_code: b.supplierBundleCode || null,
        location: b.location || null,
        qr_code: bundleCode,
        supplier_boards: b.supplierBoards || null,
        supplier_volume: b.supplierVolume != null ? parseFloat(b.supplierVolume) : null,
        inspection_id: b.inspectionId || null,
        ...(b.rawMeasurements && Object.keys(b.rawMeasurements).length ? { raw_measurements: b.rawMeasurements } : {}),
      };

      const { data: inserted, error: insErr } = await sb.from('wood_bundles').insert(row).select().single();
      if (insErr) { errors.push({ code: b.supplierBundleCode, error: insErr.message }); continue; }

      // Update inspection → imported + link bundle_id
      if (b.inspectionId) {
        await sb.from('sawn_inspections').update({
          status: 'imported',
          bundle_id: inserted.id,
          updated_at: new Date().toISOString(),
        }).eq('id', b.inspectionId);
      }

      results.push({ id: inserted.id, bundleCode, supplierBundleCode: b.supplierBundleCode });
    } catch (e) {
      errors.push({ code: b.supplierBundleCode, error: e.message });
    }
  }

  return { success: true, imported: results.length, failed: errors.length, results, errors };
}
