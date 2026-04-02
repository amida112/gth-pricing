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
export { fetchCustomers, addCustomer, updateCustomer, deleteCustomer, fetchCustomersSummary, fetchCustomerUnpaidDebt, checkCustomerHasOrders } from './customers';
export { fetchPendingOrdersCount, fetchOrders, fetchOrderDetail, approveOrderPrice, createOrder, updateOrder, recordPayment, approvePaymentDiscount, fetchPaymentRecords, updateOrderPayment, deductBundlesForOrder, updateOrderExport, deleteOrder, cancelOrder, fetchCustomerCredits, useCustomerCredit, genOrderCode } from './orders';
export { fetchDashboardData } from './dashboard';
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
export { fetchAuditLogs, createAuditLog, logAction, fetchAuditLogModules, fetchAuditLogUsernames } from './auditLogs';

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
