/**
 * Audit logging helper — fire-and-forget ghi nhật ký hệ thống.
 * Import và gọi ở bất kỳ đâu cần ghi log.
 *
 * Usage:
 *   audit('admin', 'sales', 'create', 'Tạo đơn hàng DH-20260330-001', { entityType: 'order', entityId: '123' });
 */

export function audit(username, module, action, description, extra = {}) {
  import('../api/auditLogs.js').then(({ createAuditLog }) => {
    createAuditLog({ username, module, action, description, ...extra }).catch(() => {});
  }).catch(() => {});
}
