import sb from './client';

// ===== BUNDLE MERGES (ĐAN KIỆN) =====

const mapRow = (r) => ({
  id: r.id,
  sourceBundleId: r.source_bundle_id,
  targetBundleId: r.target_bundle_id,
  boards: r.boards,
  volume: parseFloat(r.volume) || 0,
  reason: r.reason,
  autoAdjustmentId: r.auto_adjustment_id,
  mergedBy: r.merged_by,
  createdAt: r.created_at,
});

/** Lấy lịch sử đan kiện liên quan đến 1 bundle (cả cho và nhận) */
export async function fetchMergesByBundle(bundleId) {
  const { data, error } = await sb.from('bundle_merges')
    .select('*')
    .or(`source_bundle_id.eq.${bundleId},target_bundle_id.eq.${bundleId}`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

/**
 * Thực hiện đan kiện: chuyển tấm từ kiện nguồn (A) sang kiện đích (B).
 *
 * Nếu số liệu thực tế (actualBoards, actualVolume) khác với hệ thống
 * → tự tạo phiếu cân kho (approved ngay, không cần duyệt) trước khi đan.
 *
 * @param {object} params
 *  - sourceBundleId: kiện A (cho)
 *  - targetBundleId: kiện B (nhận)
 *  - boards: số tấm đan (thực tế)
 *  - volume: KL đan (thực tế, m³)
 *  - closeSource: boolean — đan hết → đóng kiện A
 *  - actualBoards: số tấm thực tế kiện A trước khi đan (để cân kho nếu lệch)
 *  - actualVolume: KL thực tế kiện A trước khi đan
 *  - mergedBy: username
 */
export async function executeMerge({
  sourceBundleId, targetBundleId, boards, volume,
  closeSource, actualBoards, actualVolume, mergedBy,
}) {
  // 1. Lấy thông tin 2 kiện
  const { data: src, error: e1 } = await sb.from('wood_bundles')
    .select('id, remaining_boards, remaining_volume, board_count, volume, status')
    .eq('id', sourceBundleId).single();
  if (e1 || !src) return { error: 'Không tìm thấy kiện nguồn' };

  const { data: tgt, error: e2 } = await sb.from('wood_bundles')
    .select('id, remaining_boards, remaining_volume, board_count, volume, status')
    .eq('id', targetBundleId).single();
  if (e2 || !tgt) return { error: 'Không tìm thấy kiện đích' };

  const sysBoards = src.remaining_boards;
  const sysVolume = parseFloat(src.remaining_volume);

  // 2. Cân kho tự động nếu số liệu lệch
  let autoAdjId = null;
  if (actualBoards !== sysBoards || Math.abs(actualVolume - sysVolume) > 0.0001) {
    const now = new Date().toISOString();
    const adjRow = {
      bundle_id: sourceBundleId,
      type: 'adjust',
      old_boards: sysBoards,
      new_boards: actualBoards,
      old_volume: sysVolume,
      new_volume: parseFloat(parseFloat(actualVolume).toFixed(4)),
      reason: `Cân kho tự động trước khi đan kiện — chênh lệch ${actualBoards - sysBoards} tấm / ${(actualVolume - sysVolume).toFixed(4)} m³ so với hệ thống`,
      status: 'approved',
      requested_by: mergedBy,
      approved_by: mergedBy,
      approved_at: now,
    };
    const { data: adj, error: adjErr } = await sb.from('inventory_adjustments')
      .insert(adjRow).select().single();
    if (adjErr) return { error: 'Lỗi tạo phiếu cân kho: ' + adjErr.message };
    autoAdjId = adj.id;

    // Cập nhật kiện A theo số thực tế
    await sb.from('wood_bundles').update({
      remaining_boards: actualBoards,
      remaining_volume: parseFloat(actualVolume).toFixed(4),
    }).eq('id', sourceBundleId);
  }

  // 3. Cập nhật kiện nguồn (A): trừ tấm + KL đan
  const srcNewBoards = closeSource ? 0 : Math.max(0, (actualBoards ?? sysBoards) - boards);
  const srcNewVol = closeSource ? 0 : Math.max(0, (actualVolume ?? sysVolume) - volume);
  const srcStatus = (srcNewBoards <= 0 && srcNewVol <= 0.0001) ? 'Đã bán' : 'Kiện lẻ';

  const { error: e3 } = await sb.from('wood_bundles').update({
    remaining_boards: srcNewBoards,
    remaining_volume: parseFloat(srcNewVol.toFixed(4)),
    status: srcStatus,
  }).eq('id', sourceBundleId);
  if (e3) return { error: 'Lỗi cập nhật kiện nguồn: ' + e3.message };

  // 4. Cập nhật kiện đích (B): cộng tấm + KL
  const tgtNewBoards = tgt.remaining_boards + boards;
  const tgtNewBoardCount = tgt.board_count + boards;
  const tgtNewVol = parseFloat(tgt.remaining_volume) + volume;
  const tgtNewVolTotal = parseFloat(tgt.volume) + volume;

  const { error: e4 } = await sb.from('wood_bundles').update({
    remaining_boards: tgtNewBoards,
    board_count: tgtNewBoardCount,
    remaining_volume: parseFloat(tgtNewVol.toFixed(4)),
    volume: parseFloat(tgtNewVolTotal.toFixed(4)),
  }).eq('id', targetBundleId);
  if (e4) return { error: 'Lỗi cập nhật kiện đích: ' + e4.message };

  // 5. Ghi log đan kiện
  const { data: merge, error: e5 } = await sb.from('bundle_merges').insert({
    source_bundle_id: sourceBundleId,
    target_bundle_id: targetBundleId,
    boards,
    volume: parseFloat(volume.toFixed(4)),
    reason: closeSource ? 'Đan hết — đóng kiện nguồn' : 'Đan một phần',
    auto_adjustment_id: autoAdjId,
    merged_by: mergedBy,
  }).select().single();
  if (e5) return { error: 'Lỗi ghi log đan kiện: ' + e5.message };

  return { success: true, merge: mapRow(merge), sourceStatus: srcStatus };
}
