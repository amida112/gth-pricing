/**
 * Tính hoa hồng bán hàng cho 1 kỳ lương.
 */
import { resolvePointsPerM3, resolveContainerCommission, matchSkuPattern } from '../api/commission';

export function calcCommissions({ orders, orderDetails, employees, dynamicUsers, woodRates, skuOverrides, containerTiers, commSettings, wts }) {
  const staffRate = commSettings.staff_rate?.value || 30000;
  const managerRate = commSettings.manager_rate?.value || 10000;
  const rawRetailRate = commSettings.raw_retail_rate?.value || 1;

  // Build username → employeeId map
  const userEmpMap = {};
  dynamicUsers.forEach(u => { if (u.linkedEmployeeId) userEmpMap[u.username] = u.linkedEmployeeId; });

  // Wood type name lookup
  const woodName = (id) => (wts || []).find(w => w.id === id)?.name || id || "—";

  // Resolve hệ số + note cho 1 item
  const resolveRate = (woodTypeId, skuKey) => {
    // Tìm override match nhiều segment nhất
    const matches = skuOverrides
      .filter(o => o.woodTypeId === woodTypeId && matchSkuPattern(skuKey, o.skuPattern))
      .sort((a, b) => b.skuPattern.split('||').length - a.skuPattern.split('||').length);
    if (matches.length) return { rate: matches[0].pointsPerM3, isOverride: true, note: matches[0].note || matches[0].skuPattern };
    const woodRate = woodRates.find(r => r.woodTypeId === woodTypeId && r.category === 'bundle');
    return { rate: woodRate?.pointsPerM3 || 0, isOverride: false, note: "" };
  };

  const result = {};
  const getOrInit = (empId) => {
    if (!result[empId]) result[empId] = { points: 0, containerAmount: 0, bundleDetails: [], containerDetails: [] };
    return result[empId];
  };

  orders.forEach(order => {
    const salesUsername = order.salesBy || order.createdBy;
    const empId = userEmpMap[salesUsername];
    if (!empId) return;

    const emp = employees.find(e => e.id === empId);
    if (!emp || !emp.commissionEligible) return;

    const items = orderDetails[order.id] || [];

    items.forEach(item => {
      if (item.itemType === 'container') {
        const containerComm = resolveContainerCommission(0, containerTiers);
        const r = getOrInit(empId);
        r.containerAmount += containerComm;
        r.containerDetails.push({ orderCode: order.orderCode || order.code, diff: 0, tier: "Đúng giá", amount: containerComm });
      } else {
        const volume = item.volume || 0;
        if (volume <= 0) return;

        let pts, rateInfo;
        if (item.itemType === 'raw_wood' || item.itemType === 'raw_wood_cut') {
          pts = volume * rawRetailRate;
          rateInfo = { rate: rawRetailRate, isOverride: false, note: "Gỗ tròn/hộp lẻ" };
        } else {
          rateInfo = resolveRate(item.woodId, item.skuKey);
          pts = volume * rateInfo.rate;
        }

        const r = getOrInit(empId);
        r.points += pts;
        r.bundleDetails.push({
          orderCode: order.orderCode || order.code,
          woodName: woodName(item.woodId),
          volume: Math.round(volume * 10000) / 10000,
          coefficient: rateInfo.rate,
          points: Math.round(pts * 100) / 100,
          isOverride: rateInfo.isOverride,
          overrideNote: rateInfo.note,
        });
      }
    });
  });

  // Quy tiền + team breakdown
  const final = {};
  Object.entries(result).forEach(([empId, r]) => {
    const emp = employees.find(e => e.id === empId);
    const isManager = emp?.isManager;
    const rate = isManager ? managerRate : staffRate;
    const pointsRounded = Math.round(r.points * 100) / 100;
    const pointsAmount = Math.round(r.points * rate);

    // QL: team breakdown
    let managerTeamAmount = 0;
    const teamBreakdown = [];
    if (isManager) {
      const teamEmps = employees.filter(e => e.managerId === empId && e.id !== empId && e.commissionEligible);
      teamEmps.forEach(te => {
        const teamR = result[te.id];
        const teamPts = teamR ? Math.round(teamR.points * 100) / 100 : 0;
        const teamAmt = Math.round((teamR?.points || 0) * managerRate);
        managerTeamAmount += teamAmt;
        teamBreakdown.push({ empId: te.id, empCode: te.code, empName: te.fullName, points: teamPts, rate: managerRate, amount: teamAmt });
      });
    }

    final[empId] = {
      points: pointsRounded,
      pointsAmount,
      rate,
      containerAmount: r.containerAmount,
      managerTeamAmount,
      totalCommission: pointsAmount + r.containerAmount + managerTeamAmount,
      bundleDetails: r.bundleDetails,
      containerDetails: r.containerDetails,
      teamBreakdown,
      isManager,
    };
  });

  return final;
}
