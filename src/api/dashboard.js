import sb from './client';

// ===== DASHBOARD =====

export async function fetchDashboardData() {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowVN = new Date(Date.now() + VN_OFFSET_MS);
  const todayVN = nowVN.toISOString().slice(0, 10);

  const todayStartISO = `${todayVN}T00:00:00+07:00`;

  const twelveMonthsAgoVN = new Date(Date.now() + VN_OFFSET_MS);
  twelveMonthsAgoVN.setMonth(twelveMonthsAgoVN.getMonth() - 11);
  twelveMonthsAgoVN.setDate(1);
  const monthStartISO = `${twelveMonthsAgoVN.toISOString().slice(0, 10)}T00:00:00+07:00`;

  const [inventoryRes, todayRes, ordersRes, pendingExportRes] = await Promise.all([
    sb.from('wood_bundles').select('remaining_volume,wood_id').neq('status', 'Đã bán').range(0, 9999),
    sb.from('orders').select('total_amount')
      .eq('payment_status', 'Đã thanh toán')
      .gte('payment_date', todayStartISO),
    sb.from('orders').select('id,total_amount,payment_date')
      .eq('payment_status', 'Đã thanh toán')
      .gte('payment_date', monthStartISO),
    sb.from('orders').select('id', { count: 'exact', head: true })
      .eq('payment_status', 'Đã thanh toán')
      .eq('export_status', 'Chưa xuất'),
  ]);

  if (inventoryRes.error) throw new Error(inventoryRes.error.message);

  const allOrderIds = (ordersRes.data || []).map(o => o.id);
  let orderItems = [];
  if (allOrderIds.length > 0) {
    const { data: itemData } = await sb.from('order_items')
      .select('order_id,wood_id,volume')
      .in('order_id', allOrderIds);
    orderItems = itemData || [];
  }

  return {
    inventory: inventoryRes.data || [],
    todayRevenue: (todayRes.data || []).reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0),
    allOrders: ordersRes.data || [],
    pendingExportCount: pendingExportRes.count || 0,
    orderItems,
  };
}
