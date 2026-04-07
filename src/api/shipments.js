import sb from './client';

// ===== SHIPMENTS (LÔ HÀNG) =====

export async function fetchShipments() {
  const { data, error } = await sb.from('shipments').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, shipmentCode: r.shipment_code, name: r.name || '',
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
    woodTypeId: r.wood_type_id || null,
    rawWoodTypeId: r.raw_wood_type_id || null,
    retailOnly: !!r.retail_only,
  }));
}

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
    name: fields.name || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, shipmentCode: data.shipment_code, name: data.name || '' };
}

export async function updateShipment(id, fields = {}) {
  const row = {};
  if (fields.lotType !== undefined) row.lot_type = fields.lotType || 'sawn';
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
  if (fields.unitCostUsd    !== undefined) row.unit_cost_usd  = fields.unitCostUsd || null;
  if (fields.exchangeRate   !== undefined) row.exchange_rate  = fields.exchangeRate || null;
  if (fields.woodTypeId     !== undefined) row.wood_type_id   = fields.woodTypeId || null;
  if (fields.rawWoodTypeId  !== undefined) row.raw_wood_type_id = fields.rawWoodTypeId || null;
  if (fields.name           !== undefined) row.name             = fields.name || null;
  if (fields.retailOnly     !== undefined) row.retail_only      = !!fields.retailOnly;
  let { error } = await sb.from('shipments').update(row).eq('id', id);
  if (error?.message?.includes('lot_type_check') && row.lot_type) {
    row.lot_type = row.lot_type.startsWith('raw') ? 'raw' : row.lot_type;
    ({ error } = await sb.from('shipments').update(row).eq('id', id));
  }
  return error ? { error: error.message } : { success: true };
}

export async function deleteShipment(id) {
  const { error } = await sb.from('shipments').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function assignContainerToShipment(containerId, shipmentId) {
  // Sync raw_wood_type_id từ lô nếu container chưa có
  const [{ data: sh }, { data: cont }] = await Promise.all([
    sb.from('shipments').select('raw_wood_type_id').eq('id', shipmentId).single(),
    sb.from('containers').select('raw_wood_type_id').eq('id', containerId).single(),
  ]);
  const update = { shipment_id: shipmentId };
  if (!cont?.raw_wood_type_id && sh?.raw_wood_type_id) update.raw_wood_type_id = sh.raw_wood_type_id;
  const { error } = await sb.from('containers').update(update).eq('id', containerId);
  return error ? { error: error.message } : { success: true };
}

export async function removeContainerFromShipment(containerId) {
  const { error } = await sb.from('containers').update({ shipment_id: null }).eq('id', containerId);
  return error ? { error: error.message } : { success: true };
}
