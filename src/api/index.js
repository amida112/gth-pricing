/**
 * GTH Pricing — API barrel file
 * Re-export tất cả API functions từ các module con.
 */

export { fetchWoodTypes, addWoodType, apiUpdateWoodType, deleteWoodType, updateWoodOrder } from './woodTypes';
export { fetchAttributes, saveAttribute, deleteAttribute } from './attributes';
export { fetchAllConfig, saveWoodConfig } from './woodConfig';
export { fetchPrices, fetchChangeLogs, updatePrice, renameAttrValue, migratePriceGroupKeys, deletePriceGroupKeys, deletePrices } from './prices';
export { fetchProductCatalog, upsertProductCatalogItem, deleteProductCatalogItem, fetchPreferenceCatalog, upsertPreferenceCatalogItem, deletePreferenceCatalogItem } from './catalog';
export { fetchSuppliers, addSupplier, updateSupplier, deleteSupplier, fetchSupplierWoodAssignments, addSupplierWoodAssignment, deleteSupplierWoodAssignment, setSupplierWoodAssignments } from './suppliers';
export { fetchCarriers, addCarrier, updateCarrier, deleteCarrier } from './carriers';
export { fetchShipments, addShipment, updateShipment, deleteShipment, assignContainerToShipment, removeContainerFromShipment } from './shipments';
export { fetchContainers, addContainer, updateContainer, deleteContainer, deleteContainersByShipment, fetchAllContainerItems, fetchContainerItems, addContainerItem, updateContainerItem, deleteContainerItem } from './containers';
export { fetchRawWoodFormulas, fetchRawWoodTypes, addRawWoodType, updateRawWoodType, deleteRawWoodType, fetchRawWoodPackingList, fetchSelectedLogsForBatch, deselectAllLogsFromBatch, addRawWoodPackingListBatch, deleteRawWoodPackingListItem, fetchRawWoodInspection, fetchInspectionSummaryAll, addRawWoodInspectionBatch, updateRawWoodInspectionItem, deleteRawWoodInspectionItem, clearRawWoodInspection, fetchRawContainersWithInspection, fetchSelectedInspLogsForBatch, selectInspLogsForSawing, deselectInspLogsFromSawing, fetchRawWoodLots, addRawWoodLot, updateRawWoodLot, deleteRawWoodLot, fetchRawWoodItems, addRawWoodItem, addRawWoodItemsBatch, updateRawWoodItem, updateRawWoodItemsBatch, deleteRawWoodItem } from './rawWood';
export { lockBundle, unlockBundle, migrateBundleGroupValue, fetchBundles, addBundle, updateBundle, deleteBundle, checkBundleInOrders } from './bundles';
export { fetchCustomers, addCustomer, updateCustomer, updateCustomerContacts, deleteCustomer, fetchCustomersSummary, fetchCustomerUnpaidDebt, checkCustomerHasOrders } from './customers';
export { fetchPendingOrdersCount, fetchOrders, fetchOrderDetail, approveOrderPrice, createOrder, updateOrder, recordPayment, approvePaymentDiscount, fetchPaymentRecords, updateOrderPayment, deductBundlesForOrder, updateOrderExport, deleteOrder, cancelOrder, fetchCustomerCredits, useCustomerCredit, genOrderCode, autoExportByContainerDispatch, rollbackExportByContainerDispatch } from './orders';
export { fetchDashboardData, fetchShipmentDashboardData } from './dashboard';
export { fetchXeSayConfig, saveXeSayConfig, fetchRolePermissions, saveRolePermissions, fetchThicknessGrouping, saveThicknessGrouping, fetchVatRate, fetchAdminSettings, changeAdminPassword, fetchPriceNote, savePriceNote, uploadBundleImage, deleteBundleImages, fetchCompanyDispatchInfo, saveCompanyDispatchInfo } from './settings';
export { fetchUsers, saveUser, deleteUser, updateUserLogin } from './users';
export { fetchKilnBatches, addKilnBatch, updateKilnBatch, deleteKilnBatch, fetchKilnItems, fetchAllKilnItems, addKilnItem, updateKilnItem, deleteKilnItem, addKilnEditLog, fetchKilnEditLog, fetchUnsortedBundles, addUnsortedBundle, addUnsortedBundlesBatch, updateUnsortedBundle, updateUnsortedBundlesBatch, deleteUnsortedBundle, importUnsortedBundles, fetchPackingSessions, addPackingSession, updatePackingSession, deletePackingSession, fetchPackingLeftovers, addPackingLeftover, updatePackingLeftover, deletePackingLeftover } from './kiln';
export { fetchSawingBatches, addSawingBatch, updateSawingBatch, deleteSawingBatch, fetchKilnItemsLinkedToBatch, fetchSawingItems, addSawingItem, updateSawingItem, deleteSawingItem, fetchSawingDailyLogs, fetchSawingDailyLogsByBatch, addSawingDailyLog, deleteSawingDailyLog, fetchSawingRoundInputs, addSawingRoundInput, deleteSawingRoundInput, fetchRawWoodStock, fetchSawingItemsForKiln } from './sawing';
export { fetchConversionRates, addConversionRate, updateConversionRate, deleteConversionRate, recalcKilnItemVolumes } from './conversionRates';
export { fetchBankAccounts, addBankAccount, updateBankAccount, deleteBankAccount } from './bankAccounts';
export { fetchAvailableRawWood, fetchRawContainersForSale, markRawWoodSold, revertRawWoodSold, markContainerSold, revertContainerSold } from './rawWoodSales';
export { fetchRawWoodPricing, addRawWoodPricingRule, updateRawWoodPricingRule, deleteRawWoodPricingRule, resolveRawWoodPrice, resolveFormulaPrice, updateContainerSalePrice, updatePieceSalePrice, applyFormulaPricesToContainer, fetchRawWoodPriceConfigs, upsertRawWoodPriceConfig, deleteRawWoodPriceConfig } from './rawWoodPricing';
export { fetchBankTransactions, fetchTransactionStats, manualMatchTransaction, ignoreTransaction, refundCredit, fetchUnpaidOrders } from './bankTransactions';
export { fetchWithdrawals, createSaleWithdrawal, createSawingWithdrawal, revertWithdrawal, revertOrderWithdrawals, fetchContainersForWeightSale } from './rawWoodWithdrawals';
export { fetchPermissionGroups, addPermissionGroup, updatePermissionGroup, deletePermissionGroup, fetchGroupPermissions, fetchAllGroupPermissions, saveGroupPermissions } from './permissionGroups';
export { fetchBundleMeasurements, fetchMeasurementsByOrderId, assignMeasurementToOrder, unlinkMeasurement, unlinkMeasurementsFromOrder, softDeleteMeasurement, softDeleteMeasurements, restoreMeasurement, subscribeBundleMeasurements } from './bundleMeasurements';
export { fetchAuditLogs, createAuditLog, logAction, fetchAuditLogModules, fetchAuditLogUsernames } from './auditLogs';
export { fetchPendingRefunds, fetchRefundsByOrder, requestRefund, approveRefund, rejectRefund, fetchPendingRefundsCount } from './creditRefunds';
export { fetchDepartments, addDepartment, updateDepartment, deleteDepartment, fetchEmployees, fetchNextEmployeeCode, addEmployee, updateEmployee, deleteEmployee, fetchAllowanceTypes, addAllowanceType, updateAllowanceType, deleteAllowanceType, fetchEmployeeAllowances, saveEmployeeAllowance, deleteEmployeeAllowance, fetchEmployeeChangeLog, addEmployeeChangeLog, assignAllowanceToAllActive, bulkUpdateAllowanceAmount } from './employees';
export { fetchAttendance, upsertAttendance, upsertAttendanceBatch, deleteAttendance, deleteAttendanceByPeriod, fetchPayrollSettings, savePayrollSetting, fetchWorkShifts, addWorkShift, updateWorkShift, fetchBhxhMonthly, upsertBhxhMonthly, generateBhxhMonthly } from './attendance';
export { fetchCampaigns, upsertCampaign, fetchLeaveRequests, addLeaveRequest, deleteLeaveRequest } from './leaves';
export { fetchCommissionWoodRates, upsertCommissionWoodRate, deleteCommissionWoodRate, fetchCommissionSkuOverrides, addCommissionSkuOverride, updateCommissionSkuOverride, deleteCommissionSkuOverride, fetchCommissionContainerTiers, saveContainerTier, deleteCommissionContainerTier, fetchCommissionSettings, saveCommissionSetting, matchSkuPattern, resolvePointsPerM3, resolveContainerCommission } from './commission';
export { fetchExtraWorkTypes, addExtraWorkType, updateExtraWorkType, deleteExtraWorkType, fetchExtraWorkRecords, upsertExtraWorkRecord, deleteExtraWorkRecord, fetchExtraWorkAssignments, toggleExtraWorkAssignment, fetchMonthlyOt, upsertMonthlyOt } from './extraWork';
export { fetchSalaryAdvances, addSalaryAdvance, updateSalaryAdvance, deleteSalaryAdvance, deductAdvances, fetchPayrolls, fetchPayrollByPeriod, createPayroll, updatePayrollStatus, deletePayroll, fetchPayrollDetails, savePayrollDetails, updatePayrollDetail } from './payroll';
export { fetchSawnInspections, fetchSawnInspectionSummary, importSawnPackingList, addSawnInspection, updateSawnInspection, submitSawnInspection, approveSawnInspections, deleteSawnInspection, clearSawnInspections, batchImportToWarehouse } from './sawnInspection';
export { fetchInventoryAdjustments, fetchAdjustmentsByBundle, fetchPendingAdjustmentsCount, requestAdjustment, approveAdjustment, rejectAdjustment, deleteAdjustment, fetchWeeklyClosedBundles, fetchBundleSalesHistory } from './inventoryAdjustment';

// ===== LOAD ALL =====

import { fetchWoodTypes } from './woodTypes';
import { fetchAttributes } from './attributes';
import { fetchAllConfig } from './woodConfig';
import { fetchPrices } from './prices';
import { fetchProductCatalog, fetchPreferenceCatalog } from './catalog';

export async function loadAllData() {
  const [woodTypes, attributes, config, prices, productCatalog, preferenceCatalog] = await Promise.all([
    fetchWoodTypes(),
    fetchAttributes(),
    fetchAllConfig(),
    fetchPrices(),
    fetchProductCatalog(),
    fetchPreferenceCatalog(),
  ]);
  return { woodTypes, attributes, config, prices, productCatalog, preferenceCatalog };
}
