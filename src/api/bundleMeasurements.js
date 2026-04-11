import sb from './client';

// ===== BUNDLE MEASUREMENTS (kiện lẻ đo từ app) =====

export async function fetchBundleMeasurements(measurementType) {
  // Shared Pool: chỉ SELECT thuần, không có side effect
  // Pool = status='chờ gán'. Gán = rời pool, gỡ = trả pool.
  const q = sb
    .from('bundle_measurements')
    .select('*')
    .eq('deleted', false)
    .eq('status', 'chờ gán')
    .order('created_at', { ascending: false });
  if (measurementType) q.eq('measurement_type', measurementType);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchMeasurementsByOrderId(orderId) {
  const { data, error } = await sb
    .from('bundle_measurements')
    .select('*')
    .eq('order_id', orderId)
    .eq('deleted', false);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function assignMeasurementToOrder(measurementId, orderId, bundleId, correctedData) {
  const updates = {
    status: 'đã gán',
    updated_at: new Date().toISOString(),
  };
  if (orderId) updates.order_id = orderId;
  if (bundleId) updates.bundle_id = bundleId;
  if (correctedData) {
    if (correctedData.bundle_code) updates.bundle_code = correctedData.bundle_code;
    if (correctedData.wood_type) updates.wood_type = correctedData.wood_type;
    if (correctedData.thickness != null) updates.thickness = correctedData.thickness;
    if (correctedData.quality) updates.quality = correctedData.quality;
  }
  const { error } = await sb
    .from('bundle_measurements')
    .update(updates)
    .eq('id', measurementId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function unlinkMeasurement(measurementId) {
  const { error } = await sb
    .from('bundle_measurements')
    .update({ order_id: null, bundle_id: null, status: 'chờ gán', updated_at: new Date().toISOString() })
    .eq('id', measurementId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function unlinkMeasurementsFromOrder(orderId) {
  const { error } = await sb
    .from('bundle_measurements')
    .update({ order_id: null, bundle_id: null, status: 'chờ gán', updated_at: new Date().toISOString() })
    .eq('order_id', orderId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function softDeleteMeasurement(id) {
  const { error } = await sb
    .from('bundle_measurements')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function softDeleteMeasurements(ids) {
  const { error } = await sb
    .from('bundle_measurements')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) return { error: error.message };
  return { success: true };
}

export async function restoreMeasurement(id) {
  const { error } = await sb
    .from('bundle_measurements')
    .update({ deleted: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

export function subscribeBundleMeasurements(callback) {
  return sb.channel('bundle_measurements_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bundle_measurements' }, callback)
    .subscribe();
}
