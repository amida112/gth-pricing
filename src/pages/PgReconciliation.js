import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Dialog from '../components/Dialog';
import useTableSort from '../useTableSort';

const MATCH_STATUSES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'matched', label: 'Đã khớp' },
  { value: 'partial', label: 'Thanh toán 1 phần' },
  { value: 'unmatched', label: 'Chưa khớp' },
  { value: 'overpaid', label: 'Dư tiền' },
  { value: 'manual', label: 'Thủ công' },
  { value: 'ignored', label: 'Bỏ qua' },
  { value: 'pending', label: 'Chờ xử lý' },
];

function statusBadge(status) {
  const map = {
    matched: { color: 'var(--gn)', bg: 'rgba(50,79,39,0.1)', label: 'Đã khớp' },
    partial: { color: '#E67E22', bg: 'rgba(230,126,34,0.1)', label: 'Một phần' },
    unmatched: { color: 'var(--dg)', bg: 'rgba(192,57,43,0.1)', label: 'Chưa khớp' },
    overpaid: { color: '#8E44AD', bg: 'rgba(142,68,173,0.1)', label: 'Dư tiền' },
    manual: { color: '#2980b9', bg: 'rgba(41,128,185,0.1)', label: 'Thủ công' },
    ignored: { color: 'var(--tm)', bg: 'var(--bgs)', label: 'Bỏ qua' },
    pending: { color: '#F39C12', bg: 'rgba(243,156,18,0.1)', label: 'Chờ xử lý' },
  };
  const s = map[status] || map.pending;
  return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
}

function fmtMoney(n) {
  if (n == null) return '—';
  return n.toLocaleString('vi-VN') + 'đ';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ===== Dialog match thủ công =====
function ManualMatchDialog({ txn, onClose, onMatch, notify }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { fetchUnpaidOrders } = await import('../api.js');
      const data = await fetchUnpaidOrders();
      setOrders(data);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o => o.orderCode.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q));
  }, [orders, search]);

  const handleConfirm = async () => {
    if (!selectedId) return;
    setSaving(true);
    onMatch(selectedId);
  };

  return (
    <Dialog open={true} onClose={onClose} title="Đối soát thủ công" width={560} noEnter>
      <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 7, background: 'rgba(41,128,185,0.06)', border: '1px solid rgba(41,128,185,0.2)' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--tm)', marginBottom: 4 }}>Giao dịch</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--br)' }}>{fmtMoney(txn.amount)}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--tm)' }}>{fmtDate(txn.transactionDate)}</span>
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--ts)', marginTop: 4 }}>{txn.content || txn.description || '—'}</div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã đơn hoặc tên khách..."
          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 6 }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)' }}>Không tìm thấy đơn hàng phù hợp</div>
        ) : filtered.map(o => {
          const isSelected = selectedId === o.id;
          const amountMatch = Math.abs(txn.amount - o.remaining) < 1000;
          return (
            <div key={o.id} onClick={() => setSelectedId(o.id)} data-clickable="true"
              style={{ padding: '8px 12px', borderBottom: '1px solid var(--bd)', cursor: 'pointer',
                background: isSelected ? 'rgba(41,128,185,0.1)' : amountMatch ? 'rgba(39,174,96,0.05)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" readOnly checked={isSelected} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--br)' }}>{o.orderCode}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ts)' }}>{o.customerName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: amountMatch ? 'var(--gn)' : 'var(--ts)', fontSize: '0.82rem' }}>
                  Còn {fmtMoney(o.remaining)}
                  {amountMatch && <span style={{ marginLeft: 4, fontSize: '0.62rem', color: 'var(--gn)' }}>khớp</span>}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--tm)' }}>Tổng {fmtMoney(o.totalAmount)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.78rem' }}>Hủy</button>
        <button onClick={handleConfirm} disabled={!selectedId || saving}
          style={{ padding: '7px 20px', borderRadius: 6, border: 'none', background: selectedId ? '#2980b9' : 'var(--bd)', color: '#fff', cursor: selectedId ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.78rem' }}>
          {saving ? 'Đang xử lý...' : 'Xác nhận đối soát'}
        </button>
      </div>
    </Dialog>
  );
}

// ===== Bank Account Settings =====
function BankAccountSettings({ notify }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | account object
  const [form, setForm] = useState({ bankName: '', accountNumber: '', accountName: '', bin: '', isDefault: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { fetchBankAccounts } = await import('../api.js');
    setAccounts(await fetchBankAccounts());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountName.trim() || !form.bin.trim()) return;
    setSaving(true);
    const api = await import('../api.js');
    if (editing === 'new') {
      const r = await api.addBankAccount(form);
      if (r.error) { notify(r.error, false); setSaving(false); return; }
      notify('Đã thêm tài khoản');
    } else {
      const r = await api.updateBankAccount(editing.id, form);
      if (r.error) { notify(r.error, false); setSaving(false); return; }
      notify('Đã cập nhật');
    }
    setSaving(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (acc) => {
    if (!window.confirm(`Xóa tài khoản ${acc.bankName} ${acc.accountNumber}?`)) return;
    const { deleteBankAccount } = await import('../api.js');
    const r = await deleteBankAccount(acc.id);
    if (r.error) { notify(r.error, false); return; }
    notify('Đã xóa');
    load();
  };

  const openEdit = (acc) => {
    setForm({ bankName: acc.bankName, accountNumber: acc.accountNumber, accountName: acc.accountName, bin: acc.bin, isDefault: acc.isDefault });
    setEditing(acc);
  };

  const openNew = () => {
    setForm({ bankName: '', accountNumber: '', accountName: '', bin: '', isDefault: accounts.length === 0 });
    setEditing('new');
  };

  const ths = { padding: '6px 10px', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap', textAlign: 'left' };
  const tds = { padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontSize: '0.8rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--br)' }}>Tài khoản ngân hàng</h3>
        <button onClick={openNew} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#2980b9', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>+ Thêm TK</button>
      </div>

      {loading ? <div style={{ color: 'var(--tm)' }}>Đang tải...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Ngân hàng', 'Số TK', 'Chủ TK', 'BIN', 'Mặc định', ''].map(h => <th key={h} style={ths}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id}>
                <td style={tds}>{a.bankName}</td>
                <td style={{ ...tds, fontFamily: 'monospace', fontWeight: 700 }}>{a.accountNumber}</td>
                <td style={tds}>{a.accountName}</td>
                <td style={{ ...tds, fontFamily: 'monospace' }}>{a.bin}</td>
                <td style={tds}>{a.isDefault ? '✓' : ''}</td>
                <td style={{ ...tds, whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(a)} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--ac)', background: 'transparent', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.7rem', marginRight: 4 }}>Sửa</button>
                  <button onClick={() => handleDelete(a)} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.7rem' }}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <Dialog open={true} onClose={() => setEditing(null)} onOk={handleSave} title={editing === 'new' ? 'Thêm tài khoản' : 'Sửa tài khoản'} width={420}>
          {[
            { label: 'Ngân hàng', key: 'bankName', placeholder: 'VD: VPBank' },
            { label: 'Số tài khoản', key: 'accountNumber', placeholder: '1234567890' },
            { label: 'Chủ tài khoản', key: 'accountName', placeholder: 'CONG TY GTH' },
            { label: 'Mã BIN (VietQR)', key: 'bin', placeholder: 'VD: 970432' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brl)', marginBottom: 3 }}>{f.label}</label>
              <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} />
            Tài khoản mặc định (dùng cho QR)
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setEditing(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={handleSave} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}

      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--br)', marginBottom: 8 }}>Webhook Sepay</h3>
        <div style={{ padding: '10px 14px', borderRadius: 7, background: 'var(--bgs)', border: '1px solid var(--bd)', fontSize: '0.78rem' }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--tm)', fontSize: '0.68rem' }}>Webhook URL:</span>
            <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--ts)', wordBreak: 'break-all' }}>
              {`${process.env.REACT_APP_SUPABASE_URL || 'https://tscddgjkelnmlitzcxyg.supabase.co'}/functions/v1/sepay-webhook`}
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>
            Dán URL này vào Sepay → WebHooks → Thêm webhook. Chọn Authentication: API Key.
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== MAIN PAGE =====
function PgReconciliation({ user, notify, cePayment, isAdmin }) {
  const [tab, setTab] = useState('transactions');
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState('all');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo, setFDateTo] = useState('');
  const [matchTxn, setMatchTxn] = useState(null); // txn for manual match dialog
  const [stats, setStats] = useState(null);
  const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort('transactionDate', 'desc');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { fetchBankTransactions, fetchTransactionStats } = await import('../api.js');
      const [data, st] = await Promise.all([
        fetchBankTransactions({ from: fDateFrom || undefined, to: fDateTo || undefined, status: fStatus }),
        fetchTransactionStats(
          fDateFrom || new Date(Date.now() - 30 * 86400000).toISOString(),
          fDateTo || new Date().toISOString()
        ),
      ]);
      setTxns(data);
      setStats(st);
    } catch (e) {
      notify('Lỗi tải dữ liệu: ' + e.message, false);
    }
    setLoading(false);
  }, [fStatus, fDateFrom, fDateTo, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  const sorted = useMemo(() => {
    return applySort([...txns], (a, b, field, dir) => {
      const m = dir === 'asc' ? 1 : -1;
      if (field === 'amount') return (a.amount - b.amount) * m;
      if (field === 'transactionDate') return ((a.transactionDate || '') > (b.transactionDate || '') ? 1 : -1) * m;
      return 0;
    });
  }, [txns, applySort]);

  const handleManualMatch = async (orderId) => {
    if (!matchTxn) return;
    const { manualMatchTransaction } = await import('../api.js');
    const r = await manualMatchTransaction(matchTxn.id, orderId, user?.username || 'unknown');
    if (r.error) { notify('Lỗi: ' + r.error, false); return; }
    notify(r.fullyPaid ? 'Đã đối soát — đơn hoàn tất thanh toán' : 'Đã đối soát — đơn còn nợ');
    setMatchTxn(null);
    loadData();
  };

  const handleIgnore = async (txn) => {
    const note = window.prompt('Lý do bỏ qua giao dịch này:');
    if (note === null) return;
    const { ignoreTransaction } = await import('../api.js');
    const r = await ignoreTransaction(txn.id, note, user?.username);
    if (r.error) { notify(r.error, false); return; }
    notify('Đã bỏ qua giao dịch');
    loadData();
  };

  const ths = { padding: '6px 8px', background: 'var(--bgh)', color: 'var(--brl)', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid var(--bds)', whiteSpace: 'nowrap', textAlign: 'left' };
  const tds = { padding: '6px 8px', borderBottom: '1px solid var(--bd)', fontSize: '0.76rem', whiteSpace: 'nowrap' };
  const tabSt = (t) => ({
    padding: '8px 18px', borderRadius: '8px 8px 0 0', border: tab === t ? '1.5px solid var(--bd)' : '1.5px solid transparent',
    borderBottom: tab === t ? '1.5px solid var(--bg)' : 'none', marginBottom: -1,
    background: tab === t ? 'var(--bg)' : 'transparent', color: tab === t ? 'var(--br)' : 'var(--tm)',
    fontWeight: tab === t ? 800 : 500, fontSize: '0.82rem', cursor: 'pointer',
  });

  return (
    <div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--br)', marginBottom: 14 }}>Đối soát chuyển khoản</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1.5px solid var(--bd)', marginBottom: 16 }}>
        <button onClick={() => setTab('transactions')} style={tabSt('transactions')}>Giao dịch ngân hàng</button>
        <button onClick={() => setTab('summary')} style={tabSt('summary')}>Tổng hợp</button>
        {isAdmin && <button onClick={() => setTab('settings')} style={tabSt('settings')}>Cài đặt</button>}
      </div>

      {/* Tab 1: Giao dịch */}
      {tab === 'transactions' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', outline: 'none' }}>
              {MATCH_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', outline: 'none' }} />
            <span style={{ color: 'var(--tm)', fontSize: '0.78rem' }}>→</span>
            <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', outline: 'none' }} />
            <button onClick={loadData} style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #2980b9', background: 'rgba(41,128,185,0.08)', color: '#2980b9', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>Tải lại</button>
            <span style={{ fontSize: '0.72rem', color: 'var(--tm)', marginLeft: 'auto' }}>{txns.length} giao dịch</span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--bd)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th onClick={() => toggleSort('transactionDate')} style={{ ...ths, cursor: 'pointer' }}>Thời gian{sortIcon('transactionDate')}</th>
                  <th onClick={() => toggleSort('amount')} style={{ ...ths, cursor: 'pointer', textAlign: 'right' }}>Số tiền{sortIcon('amount')}</th>
                  <th style={ths}>Nội dung CK</th>
                  <th style={ths}>Mã đơn</th>
                  <th style={ths}>Khách hàng</th>
                  <th style={ths}>Trạng thái</th>
                  <th style={ths}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>Đang tải...</td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--tm)' }}>Không có giao dịch nào</td></tr>
                ) : sorted.map((t, i) => (
                  <tr key={t.id} style={{ background: i % 2 ? 'var(--bgs)' : '#fff' }}>
                    <td style={tds}>{fmtDate(t.transactionDate)}</td>
                    <td style={{ ...tds, textAlign: 'right', fontWeight: 700, color: 'var(--br)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(t.amount)}</td>
                    <td title={t.content || t.description} style={{ ...tds, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.content || t.description || '—'}</td>
                    <td style={{ ...tds, fontFamily: 'monospace', fontWeight: 700, color: t.parsedOrderCode ? 'var(--br)' : 'var(--tm)' }}>{t.parsedOrderCode || t.orderCode || '—'}</td>
                    <td style={tds}>{t.customerName || '—'}</td>
                    <td style={tds}>{statusBadge(t.matchStatus)}</td>
                    <td style={{ ...tds, whiteSpace: 'nowrap' }}>
                      {t.matchStatus === 'unmatched' && cePayment && (
                        <>
                          <button onClick={() => setMatchTxn(t)} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #2980b9', background: 'transparent', color: '#2980b9', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600, marginRight: 4 }}>Gán đơn</button>
                          <button onClick={() => handleIgnore(t)} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--tm)', background: 'transparent', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.68rem' }}>Bỏ qua</button>
                        </>
                      )}
                      {t.matchStatus === 'pending' && cePayment && (
                        <>
                          <button onClick={() => setMatchTxn(t)} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #2980b9', background: 'transparent', color: '#2980b9', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600, marginRight: 4 }}>Gán đơn</button>
                          <button onClick={() => handleIgnore(t)} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--tm)', background: 'transparent', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.68rem' }}>Bỏ qua</button>
                        </>
                      )}
                      {(t.matchStatus === 'matched' || t.matchStatus === 'partial' || t.matchStatus === 'manual') && t.parsedOrderCode && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--gn)' }}>✓</span>
                      )}
                      {t.matchStatus === 'overpaid' && (
                        <span style={{ fontSize: '0.68rem', color: '#8E44AD' }} title={t.matchNote}>{t.matchNote || 'Dư tiền'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Tổng hợp */}
      {tab === 'summary' && (
        <div>
          {stats ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Tổng GD', value: stats.total, color: 'var(--br)' },
                { label: 'Đã khớp', value: stats.matched, color: 'var(--gn)' },
                { label: 'Chưa khớp', value: stats.unmatched, color: 'var(--dg)' },
                { label: 'Dư tiền', value: stats.overpaid, color: '#8E44AD' },
                { label: 'Tổng tiền', value: fmtMoney(stats.totalAmount), color: 'var(--br)', big: true },
              ].map(c => (
                <div key={c.label} style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--bgc)', border: '1px solid var(--bd)' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--tm)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: c.big ? '1rem' : '1.3rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--tm)', padding: 20 }}>Đang tải...</div>
          )}
        </div>
      )}

      {/* Tab 3: Cài đặt */}
      {tab === 'settings' && isAdmin && <BankAccountSettings notify={notify} />}

      {/* Manual match dialog */}
      {matchTxn && (
        <ManualMatchDialog txn={matchTxn} onClose={() => setMatchTxn(null)} onMatch={handleManualMatch} notify={notify} />
      )}
    </div>
  );
}

export default React.memo(PgReconciliation);
