import sb from './client';

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
    assignedTo: r.assigned_to || '', createdBy: r.created_by || '',
    customerType: r.customer_type || 'individual', taxCode: r.tax_code || '',
    representative: r.representative || '', email: r.email || '', businessAddress: r.business_address || '',
    contacts: r.contacts || [],
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
    assigned_to: data.assignedTo || null, created_by: data.createdBy || null,
    customer_type: data.customerType || 'individual', tax_code: data.taxCode || null,
    representative: data.representative || null, email: data.email || null, business_address: data.businessAddress || null,
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
    ...(data.assignedTo !== undefined ? { assigned_to: data.assignedTo || null } : {}),
    ...(data.customerType !== undefined ? { customer_type: data.customerType || 'individual' } : {}),
    ...(data.taxCode !== undefined ? { tax_code: data.taxCode || null } : {}),
    ...(data.representative !== undefined ? { representative: data.representative || null } : {}),
    ...(data.email !== undefined ? { email: data.email || null } : {}),
    ...(data.businessAddress !== undefined ? { business_address: data.businessAddress || null } : {}),
    ...(data.contacts !== undefined ? { contacts: data.contacts || [] } : {}),
  }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function updateCustomerContacts(id, contacts) {
  const { error } = await sb.from('customers').update({ contacts }).eq('id', id);
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
    const toPay = parseFloat(o.total_amount) - (parseFloat(o.debt) || 0);
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
    const toPay = parseFloat(o.total_amount) - (parseFloat(o.debt) || 0);
    return s + Math.max(0, toPay - (paidMap[o.id] || 0));
  }, 0);
}

// Chi tiết công nợ theo từng đơn hàng của khách
export async function fetchCustomerDebtDetail(customerId) {
  const { data: orders, error } = await sb.from('orders')
    .select('id, order_code, created_at, total_amount, debt, payment_status')
    .eq('customer_id', customerId)
    .in('payment_status', ['Chưa thanh toán', 'Đã đặt cọc', 'Còn nợ'])
    .neq('status', 'Đã hủy')
    .order('created_at', { ascending: true });
  if (error || !orders?.length) return [];
  const orderIds = orders.map(o => o.id);
  const { data: payments } = await sb.from('payment_records')
    .select('order_id, amount, discount, discount_status')
    .in('order_id', orderIds);
  const paidMap = {};
  (payments || []).forEach(p => {
    const disc = ['auto', 'approved'].includes(p.discount_status) ? parseFloat(p.discount || 0) : 0;
    paidMap[p.order_id] = (paidMap[p.order_id] || 0) + parseFloat(p.amount) + disc;
  });
  const now = new Date();
  return orders.map(o => {
    const toPay = parseFloat(o.total_amount) - (parseFloat(o.debt) || 0);
    const totalPaid = paidMap[o.id] || 0;
    const outstanding = Math.max(0, toPay - totalPaid);
    const created = new Date(o.created_at);
    const daysSince = Math.floor((now - created) / 86400000);
    return { orderId: o.id, orderCode: o.order_code, createdAt: o.created_at, totalAmount: parseFloat(o.total_amount), debt: parseFloat(o.debt) || 0, totalPaid, outstanding, daysSince, paymentStatus: o.payment_status };
  }).filter(o => o.outstanding > 0);
}

export async function checkCustomerHasOrders(customerId) {
  const { count, error } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', customerId);
  if (error) return false;
  return count > 0;
}
