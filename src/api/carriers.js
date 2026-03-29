import sb from './client';

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
