import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { THEME, initWT, initAT, initCFG, genPrices, DEFAULT_CARRIERS, DEFAULT_XE_SAY_CONFIG, resolveRangeGroup, getConfigIssues, debouncedCallback, bpk, getPriceGroupValues, resolvePriceAttrs } from "./utils";
import { getPerms, saveSession, loadSession, clearSession } from "./auth";
import Login from "./components/Login";
import AppHeader from "./components/AppHeader";
import Sidebar from "./components/Sidebar";

// Lazy load pages — chỉ tải code khi user navigate đến trang đó
const PgDashboard = lazy(() => import("./pages/PgDashboard"));
const PgPrice = lazy(() => import("./pages/PgPrice"));
const PgWT = lazy(() => import("./pages/PgWT"));
const PgSKU = lazy(() => import("./pages/PgSKU"));
const PgAT = lazy(() => import("./pages/PgAT"));
const PgCFG = lazy(() => import("./pages/PgCFG"));
const PgNCC = lazy(() => import("./pages/PgNCC"));
const PgWarehouse = lazy(() => import("./pages/PgWarehouse"));
const PgSales = lazy(() => import("./pages/PgSales"));
const PgCustomers = lazy(() => import("./pages/PgCustomers"));
const PgCarriers = lazy(() => import("./pages/PgCarriers"));
const PgShipment = lazy(() => import("./pages/PgShipment"));
const PgRawWood = lazy(() => import("./pages/PgRawWood"));
const PgKiln = lazy(() => import("./pages/PgKiln"));
const PgEdging = lazy(() => import("./pages/PgEdging"));
const PgSawing = lazy(() => import("./pages/PgSawing"));
const PgUsers = lazy(() => import("./pages/PgUsers"));
const PgReconciliation = lazy(() => import("./pages/PgReconciliation"));
const PgPermGroups = lazy(() => import("./pages/PgPermGroups"));
const PgPermissions = lazy(() => import("./pages/PgPermissions"));
const PgAuditLog = lazy(() => import("./pages/PgAuditLog"));
const PgDevices = lazy(() => import("./pages/PgDevices"));
const PgEmployees = lazy(() => import("./pages/PgEmployees"));
const PgAttendance = lazy(() => import("./pages/PgAttendance"));
const PgPayroll = lazy(() => import("./pages/PgPayroll"));

const PageFallback = () => (
  <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>
    <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Đang tải trang...</div>
  </div>
);

// ── URL routing (hash-based) ───────────────────────────────────────────────
const PAGE_SLUGS = {
  dashboard:  'dashboard',
  pricing:    'pricing',
  wood_types: 'wood-types',
  attributes: 'attributes',
  config:     'config',
  sku:        'sku',
  suppliers:  'suppliers',
  containers: 'containers',
  shipments:  'shipments',
  raw_wood:   'raw-wood',
  kiln:       'kiln',
  edging:     'edging',
  warehouse:  'warehouse',
  sales:      'sales',
  carriers:   'carriers',
  customers:  'customers',
  reconciliation: 'reconciliation',
  employees:  'employees',
  attendance: 'attendance',
  payroll:    'payroll',
  users:      'users',
  sawing:     'sawing',
  perm_groups: 'perm-groups',
  permissions: 'permissions',
  audit_log:  'audit-log',
  devices:    'devices',
};
const SLUG_PAGES = Object.fromEntries(Object.entries(PAGE_SLUGS).map(([k, v]) => [v, k]));
const PAGE_LABELS = { dashboard: "🏠 Tổng quan", pricing: "📊 Bảng giá", wood_types: "🌳 Loại gỗ", attributes: "📋 Thuộc tính", config: "⚙️ Cấu hình", sku: "🏷️ SKU", suppliers: "🏭 Nhà cung cấp", containers: "📦 Container", shipments: "📅 Lịch hàng về", raw_wood: "🪵 Gỗ nguyên liệu", kiln: "🔥 Lò sấy", edging: "📐 Dong cạnh", warehouse: "🪚 Gỗ kiện", sales: "🛒 Đơn hàng", customers: "👥 Khách hàng", carriers: "🚛 Đơn vị vận tải", employees: "👤 Nhân sự", attendance: "📅 Chấm công", payroll: "💰 Bảng lương", users: "👤 Tài khoản", perm_groups: "🔐 Nhóm quyền", permissions: "🛡️ Phân quyền", audit_log: "📋 Nhật ký", devices: "📱 Thiết bị" };

// ── Deep URL parser: #/sales/GTH-0150/edit → { page:'sales', sub:['GTH-0150','edit'] } ──
function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw) return { page: null, sub: [] };
  const parts = raw.split('/');
  const page = SLUG_PAGES[parts[0]] || null;
  const sub = parts.slice(1).filter(Boolean);
  return { page, sub };
}

function buildHash(page, sub = []) {
  const slug = PAGE_SLUGS[page] || page;
  return '#/' + [slug, ...sub].join('/');
}

export default function App() {
  const initHash = parseHash();
  const [pg, setPgRaw] = useState(() => {
    if (initHash.page) return initHash.page;
    const s = loadSession();
    return s ? 'dashboard' : 'pricing';
  });
  const [subPath, setSubPathRaw] = useState(initHash.sub);
  const [user, setUser] = useState(() => loadSession()); // { username, role, label }
  const [loading, setLoading] = useState(true);
  // connStatus: 'connecting' | 'online' | 'offline'
  const [connStatus, setConnStatus] = useState('connecting');

  // Guard: chặn chuyển trang khi có thay đổi chưa lưu (VD: form tạo đơn)
  // unsavedGuardRef.current = (onProceed) => bool — true = blocked (hiện dialog), false = cho đi
  const unsavedGuardRef = useRef(null);

  // Helper navigate — dùng chung cho setPg và hashchange
  const doNavigate = useCallback((page, sub = []) => {
    setPgRaw(page);
    setSubPathRaw(sub);
    const newHash = buildHash(page, sub);
    if (window.location.hash !== newHash) window.location.hash = newHash.replace('#', '');
  }, []);

  // URL-aware navigate — cập nhật state + hash
  const setPg = useCallback((page) => {
    if (unsavedGuardRef.current) {
      const blocked = unsavedGuardRef.current(() => doNavigate(page));
      if (blocked) return;
    }
    doNavigate(page);
  }, [doNavigate]);

  // setSubPath — cho page components cập nhật sub-path mà không đổi page
  const setSubPath = useCallback((sub) => {
    const arr = Array.isArray(sub) ? sub : (sub ? [sub] : []);
    setSubPathRaw(arr);
    const newHash = buildHash(pg, arr);
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  }, [pg]);

  // Đồng bộ hash → page khi user bấm back/forward (+ guard check)
  useEffect(() => {
    const onHashChange = () => {
      const { page, sub } = parseHash();
      if (!page) return;
      if (unsavedGuardRef.current) {
        const blocked = unsavedGuardRef.current(() => { setPgRaw(p => p === page ? p : page); setSubPathRaw(sub); });
        if (blocked) {
          // Revert hash
          window.location.hash = buildHash(pg, subPath).replace('#', '');
          return;
        }
      }
      setPgRaw(p => p === page ? p : page);
      setSubPathRaw(sub);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []); // eslint-disable-line

  // Scroll về đầu trang khi chuyển page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pg]);

  // Ghi hash ban đầu nếu URL chưa có hash
  useEffect(() => {
    if (!window.location.hash) {
      const h = buildHash(pg, subPath);
      window.location.replace(h);
    }
  }, []); // eslint-disable-line

  // ── Kiểm tra thiết bị khi restore session (F5 / mở lại tab) ──
  // 1. Chống copy localStorage sang máy khác (fingerprint mismatch)
  // 2. Chặn nếu device restriction bật mà thiết bị chưa approved
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { checkDevice, fetchDeviceSettings } = await import('./api/devices.js');
        const { getDeviceFingerprint: getFp, getDeviceToken: getToken, clearDeviceToken: clearToken } = await import('./utils/deviceFingerprint.js');

        const [currentFp, settings] = await Promise.all([
          getFp().catch(() => null),
          fetchDeviceSettings().catch(() => ({})),
        ]);
        if (cancelled) return;

        // Check 1: fingerprint mismatch → force logout (copy session)
        if (currentFp && user.deviceFingerprint && currentFp !== user.deviceFingerprint) {
          console.warn('[Security] Fingerprint mismatch — force logout');
          clearSession(); clearToken(); setUser(null); setPgRaw('pricing');
          return;
        }

        // Check 2: device restriction enabled → kiểm tra status
        const restrictionOn = settings.restriction_gth_pricing === true || settings.restriction_gth_pricing === 'true';
        if (restrictionOn && user.role !== 'superadmin') {
          if (!currentFp) {
            // Restriction ON nhưng không lấy được fingerprint → force logout
            console.warn('[Security] Cannot get fingerprint while restriction ON — force logout');
            clearSession(); setUser(null); setPgRaw('pricing');
            return;
          }
          const token = getToken();
          const result = await checkDevice(user.username, currentFp, token);
          if (cancelled) return;
          if (result.status !== 'approved') {
            console.warn('[Security] Device not approved — force logout');
            clearSession(); setUser(null); setPgRaw('pricing');
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // Data state — khởi tạo bằng data cứng, sau đó ghi đè bằng API
  const [wts, setWts] = useState(initWT);
  const [ats, setAts] = useState(initAT);
  const [cfg, setCfg] = useState(initCFG);
  const [prices, setP] = useState(genPrices);
  const [logs, setLogs] = useState([]);
  const [useAPI, setUseAPI] = useState(false);
  const [woodSpecies, setWoodSpecies] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierAssignments, setSupplierAssignments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [productCatalog, setProductCatalog] = useState([]);
  const [preferenceCatalog, setPreferenceCatalog] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [allContainers, setAllContainers] = useState([]);
  const [carriers, setCarriers] = useState(DEFAULT_CARRIERS);
  const [xeSayConfig, setXeSayConfig] = useState(DEFAULT_XE_SAY_CONFIG);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [dynamicUsers, setDynamicUsers] = useState([]);
  const [rolePermsConfig, setRolePermsConfig] = useState(null); // custom role perms từ DB
  const [permGroups, setPermGroups] = useState([]); // nhóm quyền
  const [groupPermsMap, setGroupPermsMap] = useState({}); // { groupId: ['sales.create', ...] }
  const [ugPersist, setUgPersist] = useState(false); // toggle gộp dày — persist toàn hệ thống
  const [empDepartments, setEmpDepartments] = useState([]);
  const [empEmployees, setEmpEmployees] = useState([]);
  const [empAllowanceTypes, setEmpAllowanceTypes] = useState([]);
  const [workShifts, setWorkShifts] = useState([]);
  const [deviceSettings, setDeviceSettings] = useState({});
  const [pendingDevicesCount, setPendingDevicesCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const configIssues = useMemo(() => getConfigIssues(cfg, bundles, wts, ats), [cfg, bundles, wts, ats]);
  const configIssueCount = useMemo(() => Object.keys(configIssues).length, [configIssues]);

  // Đếm SKU có hàng tồn nhưng chưa định giá (dùng cho notification bell)
  const unpricedTotal = useMemo(() => {
    if (!bundles.length || !wts.length) return 0;
    // Tính inventoryMap: price key → remainingBoards
    const invMap = {};
    bundles.forEach(b => {
      if (b.status === 'Đã bán' || b.status === 'Chưa được bán') return;
      const key = bpk(b.woodId, resolvePriceAttrs(b.woodId, b.attributes, cfg));
      invMap[key] = (invMap[key] || 0) + (b.remainingBoards || 0);
    });
    let total = 0;
    wts.forEach(w => {
      if (w.pricingMode === 'perBundle') return;
      const wc = cfg[w.id];
      if (!wc) return;
      let combos = [{}];
      (wc.attrs || []).forEach(atId => {
        const vals = getPriceGroupValues(atId, wc);
        const isOptional = atId === 'width';
        if (!vals.length && !isOptional) return;
        const next = [];
        combos.forEach(c => {
          if (isOptional) next.push({ ...c });
          vals.forEach(v => next.push({ ...c, [atId]: v }));
        });
        combos = next;
      });
      combos.forEach(combo => {
        const key = bpk(w.id, combo);
        if ((invMap[key] || 0) > 0 && (prices[key] === undefined || prices[key]?.price == null)) total++;
      });
    });
    return total;
  }, [wts, cfg, prices, bundles]);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = useCallback((text, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, ok });
    toastTimer.current = setTimeout(() => setToast(null), ok ? 2500 : 5000);
  }, []);
  // Resolve permissionGroupId cho user hiện tại (dynamic user có thể có nhóm quyền riêng)
  const currentUserGroupId = useMemo(() => user ? (dynamicUsers.find(du => du.username === user.username)?.permissionGroupId || null) : null, [user, dynamicUsers]);
  const perms = useMemo(() => getPerms(user?.role, rolePermsConfig, { groupPermsMap, permissionGroupId: currentUserGroupId }), [user?.role, rolePermsConfig, groupPermsMap, currentUserGroupId]);
  const ce = perms.ce;

  // Stable callbacks cho Sidebar/AppHeader — tránh re-render con khi App render lại
  const handleMobileClose = useCallback(() => setMobileMenuOpen(false), []);
  const handleMobileOpen = useCallback(() => setMobileMenuOpen(true), []);
  const sidebarBadges = useMemo(() => perms.ce ? { sales: pendingOrdersCount, config: configIssueCount, devices: pendingDevicesCount, pricing: unpricedTotal } : {}, [perms.ce, pendingOrdersCount, configIssueCount, pendingDevicesCount, unpricedTotal]);

  const handleLogin = (u) => {
    // Lưu session kèm fingerprint để kiểm tra khi restore
    const sessionData = { ...u };
    if (u.deviceFingerprint) sessionData.deviceFingerprint = u.deviceFingerprint;
    saveSession(sessionData);
    setUser(u);
    const loginGroupId = dynamicUsers.find(du => du.username === u.username)?.permissionGroupId || null;
    const rp = getPerms(u.role, rolePermsConfig, { groupPermsMap, permissionGroupId: loginGroupId });
    setPg(rp.defaultPage ?? rp.pages?.[0] ?? 'pricing');
    // Audit log: đăng nhập
    import('./utils/auditHelper.js').then(({ audit }) => {
      audit(u.username, 'auth', 'login', `${u.username} đăng nhập (${u.role})`);
    }).catch(() => {});
  };

  const handleLogout = () => {
    const uname = user?.username;
    clearSession();
    setUser(null);
    setPg('pricing');
    // Audit log: đăng xuất
    if (uname) {
      import('./utils/auditHelper.js').then(({ audit }) => {
        audit(uname, 'auth', 'logout', `${uname} đăng xuất`);
      }).catch(() => {});
    }
  };

  // Migrate toàn bộ giá, kho, lịch sử khi đổi tên giá trị thuộc tính
  // renames: { [oldVal]: newVal, ... }
  const handleRenameAttrVal = useCallback((attrId, renames) => {
    const seg = (v) => `${attrId}:${v}`;
    setP(prev => {
      const next = { ...prev };
      Object.entries(renames).forEach(([oldVal, newVal]) => {
        Object.keys(next).forEach(key => {
          if (key.split('||').includes(seg(oldVal))) {
            const newKey = key.split('||').map(s => s === seg(oldVal) ? seg(newVal) : s).join('||');
            next[newKey] = next[key];
            delete next[key];
          }
        });
      });
      return next;
    });
    setBundles(prev => prev.map(b => {
      let attrs = { ...b.attributes };
      let skuKey = b.skuKey;
      let ovr = b.priceAttrsOverride ? { ...b.priceAttrsOverride } : null;
      let changed = false;
      Object.entries(renames).forEach(([oldVal, newVal]) => {
        if (attrs[attrId] === oldVal) {
          attrs = { ...attrs, [attrId]: newVal };
          skuKey = skuKey.split('||').map(s => s === seg(oldVal) ? seg(newVal) : s).join('||');
          changed = true;
        }
        if (ovr && ovr[attrId] === oldVal) {
          ovr = { ...ovr, [attrId]: newVal };
          changed = true;
        }
      });
      return changed ? { ...b, attributes: attrs, skuKey, priceAttrsOverride: ovr } : b;
    }));
    setCfg(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(woodId => {
        const wc = next[woodId];
        if (!wc.attrValues?.[attrId]) return;
        let changed = false;
        const newVals = wc.attrValues[attrId].map(v => {
          if (renames[v] !== undefined) { changed = true; return renames[v]; }
          return v;
        });
        if (changed) next[woodId] = { ...wc, attrValues: { ...wc.attrValues, [attrId]: newVals } };
      });
      return next;
    });
    if (useAPI) {
      import('./api.js').then(api => {
        Object.entries(renames).forEach(([oldVal, newVal]) => {
          api.renameAttrValue(attrId, oldVal, newVal)
            .then(r => {
              if (r?.error) notify('Lỗi migrate "' + oldVal + '": ' + r.error, false);
              else notify(`Đổi "${oldVal}" → "${newVal}": ${r.pricesMigrated} giá, ${r.bundlesMigrated} kiện, ${r.logsMigrated} lịch sử`);
            })
            .catch(e => notify('Lỗi kết nối: ' + e.message, false));
        });
      });
    }
  }, [setP, setBundles, setCfg, useAPI, notify]);

  // Migrate giá + kho khi đổi tên giá trị thuộc tính TRONG MỘT loại gỗ cụ thể (per-wood rename từ PgCFG)
  const handleRenameAttrValForWood = useCallback((woodId, atId, renames) => {
    const seg = (v) => `${atId}:${v}`;
    setP(prev => {
      const next = { ...prev };
      Object.entries(renames).forEach(([oldVal, newVal]) => {
        Object.keys(next).filter(k => k.startsWith(woodId + '||')).forEach(key => {
          if (key.split('||').includes(seg(oldVal))) {
            const newKey = key.split('||').map(s => s === seg(oldVal) ? seg(newVal) : s).join('||');
            next[newKey] = next[key];
            delete next[key];
          }
        });
      });
      return next;
    });
    setBundles(prev => prev.map(b => {
      if ((b.woodId || b.wood_id) !== woodId) return b;
      let attrs = { ...b.attributes };
      let skuKey = b.skuKey;
      let ovr = b.priceAttrsOverride ? { ...b.priceAttrsOverride } : null;
      let changed = false;
      Object.entries(renames).forEach(([oldVal, newVal]) => {
        if (attrs[atId] === oldVal) {
          attrs = { ...attrs, [atId]: newVal };
          skuKey = skuKey?.split('||').map(s => s === seg(oldVal) ? seg(newVal) : s).join('||');
          changed = true;
        }
        if (ovr && ovr[atId] === oldVal) {
          ovr = { ...ovr, [atId]: newVal };
          changed = true;
        }
      });
      return changed ? { ...b, attributes: attrs, skuKey, priceAttrsOverride: ovr } : b;
    }));
  }, [setP, setBundles]);

  // Migrate giá khi thay đổi attrPriceGroups (NCC chuyển từ nhóm default → special)
  // newSpecials: NCC mới thêm vào special (trước đó nằm trong default group)
  // allNowSpecial: nếu true → tất cả NCC đều special, xóa luôn key default orphan
  const handleMigratePriceGroup = useCallback((woodId, attrId, defaultLabel, newSpecials, allNowSpecial) => {
    if (!newSpecials.length) return;
    const oldSeg = `${attrId}:${defaultLabel}`;

    // Migrate local state: copy giá từ key default sang key từng NCC mới
    setP(prev => {
      const next = { ...prev };
      const woodKeys = Object.keys(next).filter(k => k.startsWith(woodId + '||') && k.split('||').includes(oldSeg));
      woodKeys.forEach(key => {
        const segs = key.split('||');
        newSpecials.forEach(ncc => {
          const newSeg = `${attrId}:${ncc}`;
          const newKey = segs.map(s => s === oldSeg ? newSeg : s).join('||');
          if (!next[newKey]) next[newKey] = { ...next[key] }; // chỉ copy nếu chưa có giá riêng
        });
        if (allNowSpecial) delete next[key]; // xóa key default nếu không còn NCC nào dùng
      });
      return next;
    });

    // Migrate DB
    if (useAPI) {
      import('./api.js').then(api => {
        api.migratePriceGroupKeys(woodId, attrId, defaultLabel, newSpecials)
          .then(r => {
            if (r?.error) notify('Lỗi migrate giá: ' + r.error, false);
            else {
              notify(`Đã copy giá nhóm "${defaultLabel}" → ${newSpecials.join(', ')}: ${r.migrated} bản ghi`);
              // Xóa key default orphan nếu tất cả đều special
              if (allNowSpecial) api.deletePriceGroupKeys(woodId, attrId, defaultLabel).catch(() => {});
            }
          })
          .catch(e => notify('Lỗi kết nối: ' + e.message, false));
      });
    }
  }, [setP, useAPI, notify]);

  // Toggle gộp dày — persist toàn hệ thống qua app_settings
  const handleToggleUg = useCallback((value) => {
    setUgPersist(value);
    if (useAPI) {
      import('./api.js').then(api => api.saveThicknessGrouping(value));
    }
  }, [useAPI]);

  // Auto-add thickness chip khi nhập kiện gỗ xẻ sấy (thicknessMode=auto)
  const handleAutoAddThicknessChip = useCallback((woodId, newThicknessValues) => {
    setCfg(prev => {
      const wc = prev[woodId];
      if (!wc) return prev;
      const existing = new Set(wc.attrValues?.thickness || []);
      const toAdd = newThicknessValues.filter(v => !existing.has(v));
      if (!toAdd.length) return prev;
      const merged = [...(wc.attrValues?.thickness || []), ...toAdd].sort((a, b) => parseFloat(a) - parseFloat(b));
      const newWc = { ...wc, attrValues: { ...wc.attrValues, thickness: merged } };
      if (useAPI) {
        import('./api.js').then(api => api.saveWoodConfig(woodId, newWc));
      }
      return { ...prev, [woodId]: newWc };
    });
  }, [setCfg, useAPI]);


  // ── Progressive loading: Tier 0 (auth) → hiện UI → Tier 1 (data) → Tier 2 (secondary) ──
  useEffect(() => {
    let cancelled = false;
    async function loadFromAPI() {
      try {
        const api = await import('./api.js');

        // ── TIER 0: Auth & perms — nhẹ, chờ xong rồi hiện UI ngay ──
        const [usersData, rolePermsData, permGroupsData, groupPermsData, devSettings] = await Promise.all([
          api.fetchUsers().catch(() => []),
          api.fetchRolePermissions().catch(() => null),
          api.fetchPermissionGroups().catch(() => []),
          api.fetchAllGroupPermissions().catch(() => []),
          api.fetchDeviceSettings().catch(() => ({})),
        ]);
        if (cancelled) return;

        // Set auth state
        if (usersData.length) setDynamicUsers(usersData);
        if (rolePermsData) setRolePermsConfig(rolePermsData);
        if (permGroupsData.length) setPermGroups(permGroupsData);
        if (groupPermsData.length) {
          const map = {};
          groupPermsData.forEach(gp => {
            if (!map[gp.groupId]) map[gp.groupId] = [];
            if (gp.granted) map[gp.groupId].push(gp.permissionKey);
          });
          setGroupPermsMap(map);
        }
        if (devSettings && Object.keys(devSettings).length) setDeviceSettings(devSettings);

        // Tier 0 xong → hiện UI ngay (Sidebar + Header + page skeleton)
        setConnStatus('online');
        setLoading(false);

        // ── TIER 1: Core data — tải ngầm, swap vào khi xong ──
        const [data, suppliersData, swaData, bundlesData, ugData] = await Promise.all([
          api.loadAllData(),
          api.fetchSuppliers().catch(() => []),
          api.fetchSupplierWoodAssignments().catch(() => []),
          api.fetchBundles().catch(() => []),
          api.fetchThicknessGrouping().catch(() => false),
        ]);
        if (cancelled) return;

        setUgPersist(!!ugData);
        if (suppliersData.length) setSuppliers(suppliersData);
        if (swaData.length) setSupplierAssignments(swaData);
        if (bundlesData.length) setBundles(bundlesData);

        // Nếu API trả về data hợp lệ, ghi đè data cứng
        if (data.woodSpecies && Array.isArray(data.woodSpecies)) setWoodSpecies(data.woodSpecies);
        if (data.woodTypes && Array.isArray(data.woodTypes) && data.woodTypes.length > 0) {
          const initMap = Object.fromEntries(initWT().map(w => [w.id, w]));
          setWts(data.woodTypes.map(w => ({ pricingMode: initMap[w.id]?.pricingMode, ...w })));
        }
        if (data.attributes && Array.isArray(data.attributes) && data.attributes.length > 0) {
          setAts(data.attributes);
        }
        let thicknessMigrated = false;
        let migratedPrices = data.prices || {};
        if (data.config && typeof data.config === 'object' && Object.keys(data.config).length > 0) {
          // Backward-compat: nếu cfg chưa có rangeGroups nhưng ats cũ còn lưu → migrate sang per-wood
          const atRangeGroups = {};
          (data.attributes || []).forEach(a => { if (a.rangeGroups?.length) atRangeGroups[a.id] = a.rangeGroups; });
          const migratedCfg = { ...data.config };
          if (Object.keys(atRangeGroups).length) {
            Object.entries(migratedCfg).forEach(([woodId, wc]) => {
              if (!wc.rangeGroups) {
                const rg = {};
                (wc.attrs || []).forEach(atId => { if (atRangeGroups[atId]) rg[atId] = atRangeGroups[atId]; });
                if (Object.keys(rg).length) migratedCfg[woodId] = { ...wc, rangeGroups: rg };
              }
            });
          }
          // Migration: xóa rangeGroups.thickness khỏi cfg, tách price keys nhóm → riêng
          Object.entries(migratedCfg).forEach(([woodId, wc]) => {
            const thRg = wc.rangeGroups?.thickness;
            if (!thRg?.length) return;
            const uniqueT = new Set();
            (bundlesData || []).forEach(b => {
              if ((b.woodId || b.wood_id) !== woodId) return;
              const t = b.attributes?.thickness;
              if (t) uniqueT.add(t);
            });
            if (typeof migratedPrices === 'object') {
              const newP = { ...migratedPrices };
              Object.keys(newP).filter(k => k.startsWith(woodId + '||')).forEach(key => {
                const segs = key.split('||');
                const thSeg = segs.find(s => s.startsWith('thickness:'));
                if (!thSeg) return;
                const thLabel = thSeg.split(':')[1];
                const isGroupLabel = thRg.some(g => g.label === thLabel);
                if (!isGroupLabel) return;
                const members = [...uniqueT].filter(t => resolveRangeGroup(String(t), thRg) === thLabel);
                members.forEach(m => {
                  const newKey = segs.map(s => s === thSeg ? `thickness:${m}` : s).join('||');
                  if (!newP[newKey]) newP[newKey] = { ...newP[key] };
                });
                delete newP[key];
              });
              migratedPrices = newP;
            }
            const sorted = [...uniqueT].sort((a, b) => parseFloat(a) - parseFloat(b));
            const newRg = { ...(wc.rangeGroups || {}) };
            delete newRg.thickness;
            migratedCfg[woodId] = { ...wc, attrValues: { ...wc.attrValues, ...(sorted.length ? { thickness: sorted } : {}) }, rangeGroups: Object.keys(newRg).length ? newRg : {} };
            thicknessMigrated = true;
          });
          setCfg(migratedCfg);
          if (thicknessMigrated) {
            console.log('[Migration] Đã xóa rangeGroups.thickness, tách price keys nhóm → riêng');
            import('./api.js').then(a => {
              Object.entries(migratedCfg).forEach(([wid, wc]) => a.saveWoodConfig(wid, wc).catch(() => {}));
            });
          }
        }
        if (data.prices && typeof data.prices === 'object' && Object.keys(data.prices).length > 0) {
          setP(thicknessMigrated ? migratedPrices : data.prices);
        } else if (thicknessMigrated) {
          setP(migratedPrices);
        }
        if (data.productCatalog && Array.isArray(data.productCatalog)) {
          setProductCatalog(data.productCatalog);
        }
        if (data.preferenceCatalog && Array.isArray(data.preferenceCatalog)) {
          setPreferenceCatalog(data.preferenceCatalog);
        }

        // Tier 1 xong → bật useAPI cho các page fetch data riêng
        setUseAPI(true);

        // ── TIER 2: Secondary data — tải ngầm sau khi UI đã hiện ──
        // customers, containers, carriers, xeSayConfig, pendingCount, nhân sự
        const tier2 = await Promise.all([
          api.fetchCustomers().catch(() => []),
          api.fetchContainers().catch(() => []),
          api.fetchPendingOrdersCount().catch(() => 0),
          api.fetchCarriers().catch(() => []),
          api.fetchXeSayConfig().catch(() => null),
          api.fetchDepartments().catch(() => []),
          api.fetchEmployees().catch(() => []),
          api.fetchAllowanceTypes().catch(() => []),
          api.fetchWorkShifts().catch(() => []),
          api.fetchPendingDevicesCount().catch(() => 0),
        ]);
        if (cancelled) return;
        const [customersData, containersData, pendingCount, carriersData, xeSayCfg, deptsData, empsData, alTypesData, shiftsData, pendingDevCount] = tier2;
        if (customersData.length) setCustomers(customersData);
        if (containersData.length) setAllContainers(containersData);
        setPendingOrdersCount(pendingCount);
        if (carriersData.length) setCarriers(carriersData);
        if (xeSayCfg) setXeSayConfig(xeSayCfg);
        if (deptsData.length) setEmpDepartments(deptsData);
        if (empsData.length) setEmpEmployees(empsData);
        if (alTypesData.length) setEmpAllowanceTypes(alTypesData);
        if (shiftsData.length) setWorkShifts(shiftsData);
        if (pendingDevCount) setPendingDevicesCount(pendingDevCount);
      } catch (err) {
        console.warn('API không khả dụng, dùng data mẫu:', err.message);
        if (!cancelled) { setConnStatus('offline'); setLoading(false); }
        // Vẫn dùng data cứng đã khởi tạo, app hoạt động bình thường
      }
    }
    loadFromAPI();
    return () => { cancelled = true; };
  }, []);

  // Refresh pending count khi rời trang sales (đơn hàng có thể đã được duyệt)
  useEffect(() => {
    if (useAPI && perms.ce) {
      import('./api.js').then(({ fetchPendingOrdersCount }) =>
        fetchPendingOrdersCount().then(setPendingOrdersCount).catch(() => {})
      );
    }
  }, [pg, useAPI, perms.ce]);

  // ── Realtime: wood_bundles — patch single row ──
  useEffect(() => {
    if (!useAPI) return;
    let channel;
    import('./api.js').then(({ subscribeWoodBundles, mapBundleRow }) => {
      channel = subscribeWoodBundles((payload) => {
        try {
          if (payload.eventType === 'DELETE') {
            const id = payload.old?.id;
            if (id) setBundles(prev => prev.filter(b => b.id !== id));
          } else if (payload.new) {
            const mapped = mapBundleRow(payload.new);
            setBundles(prev => {
              const idx = prev.findIndex(b => b.id === mapped.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = mapped;
                return next;
              }
              return payload.eventType === 'INSERT' ? [mapped, ...prev] : prev;
            });
          }
        } catch { /* fallback: ignore malformed payload */ }
      });
    }).catch(() => {});
    return () => { if (channel) channel.unsubscribe(); };
  }, [useAPI]);

  // ── Realtime: containers — patch single row ──
  useEffect(() => {
    if (!useAPI) return;
    let channel;
    import('./api.js').then(({ subscribeContainers, mapContainerRow }) => {
      channel = subscribeContainers((payload) => {
        try {
          if (payload.eventType === 'DELETE') {
            const id = payload.old?.id;
            if (id) setAllContainers(prev => prev.filter(c => c.id !== id));
          } else if (payload.new) {
            const mapped = mapContainerRow(payload.new);
            setAllContainers(prev => {
              const idx = prev.findIndex(c => c.id === mapped.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = mapped;
                return next;
              }
              return payload.eventType === 'INSERT' ? [mapped, ...prev] : prev;
            });
          }
        } catch { /* fallback: ignore malformed payload */ }
      });
    }).catch(() => {});
    return () => { if (channel) channel.unsubscribe(); };
  }, [useAPI]);

  // ── Realtime: orders (pending count for sidebar badge) ──
  useEffect(() => {
    if (!useAPI) return;
    let channel;
    import('./api.js').then(({ subscribeOrders, fetchPendingOrdersCount }) => {
      const refresh = debouncedCallback(() => {
        fetchPendingOrdersCount().then(setPendingOrdersCount).catch(() => {});
      }, 500);
      channel = subscribeOrders(refresh);
    }).catch(() => {});
    return () => { if (channel) channel.unsubscribe(); };
  }, [useAPI]);

  const renderPage = () => {
    // Kiểm tra quyền truy cập trang
    if (perms.pages && !perms.pages.includes(pg)) {
      const fp = perms.pages[0] || 'pricing';
      return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Bạn không có quyền truy cập trang này.</div>;
    }
    switch (pg) {
      case "dashboard":  return <PgDashboard wts={wts} bundles={bundles} allContainers={allContainers} suppliers={suppliers} role={user?.role} useAPI={useAPI} notify={notify} onNavigate={setPg} />;
      case "pricing":    return <PgPrice wts={wts} ats={ats} cfg={cfg} prices={prices} setP={setP} logs={logs} setLogs={setLogs} ce={ce} seeCostPrice={perms.seeCostPrice} useAPI={useAPI} notify={notify} bundles={bundles} setBundles={setBundles} ugPersist={ugPersist} onToggleUg={handleToggleUg} user={user} />;
      case "wood_types": return <PgWT wts={wts} setWts={setWts} cfg={cfg} ce={ce} useAPI={useAPI} notify={notify} bundles={bundles} woodSpecies={woodSpecies} setWoodSpecies={setWoodSpecies} />;
      case "attributes": return <PgAT ats={ats} setAts={setAts} cfg={cfg} prices={prices} ce={ce} useAPI={useAPI} notify={notify} suppliers={suppliers} onRenameAttrVal={handleRenameAttrVal} bundles={bundles} />;
      case "config":     return <PgCFG wts={wts} ats={ats} cfg={cfg} setCfg={setCfg} prices={prices} setP={setP} ce={ce} useAPI={useAPI} notify={notify} bundles={bundles} setBundles={setBundles} onRenameAttrValForWood={handleRenameAttrValForWood} onMigratePriceGroup={handleMigratePriceGroup} configIssues={configIssues} />;
      case "sku":        return <PgSKU wts={wts} cfg={cfg} prices={prices} bundles={bundles} ugPersist={ugPersist} />;
      case "suppliers":  return <PgNCC suppliers={suppliers} setSuppliers={setSuppliers} ce={perms.ce || perms.addOnlyNCC} addOnly={perms.addOnlyNCC} useAPI={useAPI} notify={notify} bundles={bundles} wts={wts} supplierAssignments={supplierAssignments} setSupplierAssignments={setSupplierAssignments} />;
      // case "containers" removed — merged into PgShipment
      case "containers": // fallthrough to shipments
      case "shipments":  return <PgShipment containers={allContainers} setContainers={setAllContainers} suppliers={suppliers} wts={wts} cfg={cfg} user={user} ce={perms.ce || perms.ceWarehouse} useAPI={useAPI} notify={notify} />;
      case "raw_wood":   return <PgRawWood allContainers={allContainers} wts={wts} cfg={cfg} suppliers={suppliers} user={user} ce={perms.ceWarehouse} isAdmin={perms.ce} useAPI={useAPI} notify={notify} />;
      case "kiln":       return <PgKiln wts={wts} ats={ats} cfg={cfg} bundles={bundles} setBundles={setBundles} ce={perms.ceWarehouse} isAdmin={perms.ce} user={user} useAPI={useAPI} notify={notify} subPath={subPath} setSubPath={setSubPath} />;
      case "edging":     return <PgEdging wts={wts} ats={ats} cfg={cfg} bundles={bundles} setBundles={setBundles} ce={perms.ceWarehouse} isAdmin={perms.ce} user={user} useAPI={useAPI} notify={notify} subPath={subPath} setSubPath={setSubPath} />;
      case "sawing":     return <PgSawing wts={wts} useAPI={useAPI} notify={notify} user={user} subPath={subPath} setSubPath={setSubPath} />;
      case "warehouse":  return <PgWarehouse wts={wts} ats={ats} cfg={cfg} prices={prices} suppliers={suppliers} ce={perms.ceWarehouse} cePrice={perms.ce} useAPI={useAPI} notify={notify} setPg={setPg} bundles={bundles} setBundles={setBundles} ugPersist={ugPersist} onAutoAddChip={handleAutoAddThicknessChip} user={user} subPath={subPath} setSubPath={setSubPath} />;
      case "sales":      return <PgSales wts={wts} ats={ats} cfg={cfg} prices={prices} bundles={bundles} customers={customers} setCustomers={setCustomers} carriers={carriers} xeSayConfig={xeSayConfig} setXeSayConfig={setXeSayConfig} ce={perms.ceSales} ceExport={perms.ceExport} isSuperAdmin={user?.role === 'superadmin'} user={user} useAPI={useAPI} notify={notify} setPg={setPg} unsavedGuardRef={unsavedGuardRef} subPath={subPath} setSubPath={setSubPath} />;
      case "carriers":   return <PgCarriers carriers={carriers} setCarriers={setCarriers} useAPI={useAPI} notify={notify} />;
      case "customers":  return <PgCustomers customers={customers} setCustomers={setCustomers} wts={wts} productCatalog={productCatalog} setProductCatalog={setProductCatalog} preferenceCatalog={preferenceCatalog} setPreferenceCatalog={setPreferenceCatalog} ce={perms.ceSales} isAdmin={perms.ce} user={user} useAPI={useAPI} notify={notify} subPath={subPath} setSubPath={setSubPath} />;
      case "reconciliation": return <PgReconciliation user={user} notify={notify} cePayment={perms.cePayment || perms.ce} isAdmin={perms.ce} subPath={subPath} setSubPath={setSubPath} />;
      case "employees":  return <PgEmployees departments={empDepartments} setDepartments={setEmpDepartments} employees={empEmployees} setEmployees={setEmpEmployees} allowanceTypes={empAllowanceTypes} setAllowanceTypes={setEmpAllowanceTypes} workShifts={workShifts} useAPI={useAPI} notify={notify} user={user} isAdmin={perms.ce} />;
      case "attendance": return <PgAttendance employees={empEmployees} departments={empDepartments} workShifts={workShifts} useAPI={useAPI} notify={notify} user={user} isAdmin={perms.ce} />;
      case "payroll":    return <PgPayroll employees={empEmployees} departments={empDepartments} allowanceTypes={empAllowanceTypes} wts={wts} ats={ats} cfg={cfg} useAPI={useAPI} notify={notify} user={user} isAdmin={perms.ce} subPath={subPath} setSubPath={setSubPath} />;
      case "users":      return <PgUsers dynamicUsers={dynamicUsers} setDynamicUsers={setDynamicUsers} permGroups={permGroups} employees={empEmployees} useAPI={useAPI} notify={notify} currentUser={user} />;
      case "perm_groups": return <PgPermGroups permGroups={permGroups} setPermGroups={setPermGroups} dynamicUsers={dynamicUsers} useAPI={useAPI} notify={notify} />;
      case "permissions": return <PgPermissions permGroups={permGroups} groupPermsMap={groupPermsMap} setGroupPermsMap={setGroupPermsMap} useAPI={useAPI} notify={notify} />;
      case "audit_log":  return <PgAuditLog useAPI={useAPI} notify={notify} />;
      case "devices":    return <PgDevices deviceSettings={deviceSettings} setDeviceSettings={setDeviceSettings} useAPI={useAPI} notify={notify} currentUser={user} />;
      default: return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Trang "{pg}" đang phát triển</div>;
    }
  };

  // Chưa đăng nhập → hiện màn hình Login
  const deviceRestrictionEnabled = deviceSettings.restriction_gth_pricing === true || deviceSettings.restriction_gth_pricing === 'true';
  if (!user) return <Login onLogin={handleLogin} dynamicUsers={dynamicUsers} deviceRestrictionEnabled={deviceRestrictionEnabled} />;

  return (
    <div style={{ ...THEME, display: "flex", minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', sans-serif", color: "var(--tp)" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "10px 20px", borderRadius: 8, background: toast.ok ? "#324F27" : "#C0392B", color: "#fff", fontSize: "0.82rem", fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.22)", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center" }}>
          {toast.ok ? "✓ " : "✕ "}{toast.text}
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .pcell:hover { background: var(--hv) !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: var(--bds); border-radius: 3px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }

        /* Mobile: ẩn logo trong header, ẩn hamburger trên desktop */
        .mobile-menu-btn { display: none !important; }
        .header-logo { display: flex; }

        /* ===== RESPONSIVE MOBILE ===== */
        @media (max-width: 767px) {
          /* Hiện hamburger, ẩn logo (sidebar ẩn) */
          .mobile-menu-btn { display: flex !important; }
          .header-logo { display: none !important; }

          /* Sidebar thành drawer trượt từ trái */
          .sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0; z-index: 400;
            width: 220px !important;
            transform: translateX(-100%);
            transition: transform 0.25s ease !important;
            box-shadow: 4px 0 24px rgba(0,0,0,0.35);
            overflow-y: auto;
          }
          .sidebar.mob-open { transform: translateX(0); }

          /* Ẩn nút collapse/expand desktop trong drawer */
          .sb-collapse-btn { display: none !important; }
          .sb-expand-btn { display: none !important; }
          /* Hiện nút ✕ đóng drawer */
          .sb-close-btn { display: block !important; }

          /* Overlay mờ phía sau drawer */
          .mob-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 399;
          }

          /* Main content: giảm padding */
          .app-main { padding: 20px 14px 24px !important; }

          /* Touch targets tối thiểu 44px */
          .pcell { min-height: 44px !important; }

          /* WoodPicker buttons lớn hơn trên mobile */
          .wood-picker-btn { padding: 8px 14px !important; font-size: 0.82rem !important; }
        }

        @media (min-width: 768px) {
          .mob-overlay { display: none !important; }
          .sb-close-btn { display: none !important; }
        }
      `}</style>
      <Sidebar pg={pg} setPg={setPg} mobileOpen={mobileMenuOpen} onMobileClose={handleMobileClose} allowedPages={perms.pages} manageUsers={perms.manageUsers} badges={sidebarBadges} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppHeader user={user} onLogout={handleLogout} pg={pg} setPg={setPg} connStatus={connStatus} useAPI={useAPI} onMobileMenu={handleMobileOpen} PAGE_LABELS={PAGE_LABELS} notify={notify} badges={sidebarBadges} isAdmin={perms.ce} />
        <main className="app-main" style={{ flex: 1, padding: "24px 28px", maxWidth: 1400, minWidth: 0 }}>
          {loading && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--br)", marginBottom: 8 }}>Đang tải dữ liệu...</div>
              <div style={{ fontSize: "0.8rem", color: "var(--tm)" }}>Kết nối Supabase</div>
            </div>
          )}
          {!loading && (
            <Suspense fallback={<PageFallback />}>
              {renderPage()}
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}
