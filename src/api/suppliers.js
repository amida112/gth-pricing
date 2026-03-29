import sb from './client';

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

// ===== SUPPLIER WOOD ASSIGNMENTS =====

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
  await sb.from('supplier_wood_assignments').delete().eq('supplier_ncc_id', supplierNccId);
  if (!assignments.length) return { success: true };
  const rows = assignments.map(a => ({
    supplier_ncc_id: supplierNccId, product_type: a.productType,
    raw_wood_type_id: a.rawWoodTypeId || null, sawn_wood_id: a.sawnWoodId || null,
  }));
  const { error } = await sb.from('supplier_wood_assignments').insert(rows);
  return error ? { error: error.message } : { success: true };
}
