import { useState, useEffect, useCallback, useRef } from "react";
import { THEME, initWT, initAT, initCFG, genPrices, DEFAULT_CARRIERS, DEFAULT_XE_SAY_CONFIG, resolveRangeGroup } from "./utils";
import { getPerms, saveSession, loadSession, clearSession } from "./auth";
import Login from "./components/Login";
import AppHeader from "./components/AppHeader";
import Sidebar from "./components/Sidebar";
import PgDashboard from "./pages/PgDashboard";
import PgPrice from "./pages/PgPrice";
import PgWT from "./pages/PgWT";
import PgSKU from "./pages/PgSKU";
import PgAT from "./pages/PgAT";
import PgCFG from "./pages/PgCFG";
import PgNCC from "./pages/PgNCC";
import PgContainer from "./pages/PgContainer";
import PgWarehouse from "./pages/PgWarehouse";
import PgSales from "./pages/PgSales";
import PgCustomers from "./pages/PgCustomers";
import PgCarriers from "./pages/PgCarriers";
import PgShipment from "./pages/PgShipment";
import PgRawWood from "./pages/PgRawWood";
import PgKiln from "./pages/PgKiln";
import PgUsers from "./pages/PgUsers";

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
  warehouse:  'warehouse',
  sales:      'sales',
  carriers:   'carriers',
  customers:  'customers',
  users:      'users',
};
const SLUG_PAGES = Object.fromEntries(Object.entries(PAGE_SLUGS).map(([k, v]) => [v, k]));
function pageFromHash() {
  const slug = window.location.hash.replace(/^#\/?/, '');
  return SLUG_PAGES[slug] || null;
}

export default function App() {
  const [pg, setPgRaw] = useState(() => {
    const fromHash = pageFromHash();
    if (fromHash) return fromHash;
    const s = loadSession();
    return s ? 'dashboard' : 'pricing';
  });
  const [user, setUser] = useState(() => loadSession()); // { username, role, label }
  const [loading, setLoading] = useState(true);

  // URL-aware navigate — cập nhật state + hash
  const setPg = useCallback((page) => {
    setPgRaw(page);
    const slug = PAGE_SLUGS[page] || page;
    const newHash = '#/' + slug;
    if (window.location.hash !== newHash) window.location.hash = '/' + slug;
  }, []);

  // Đồng bộ hash → page khi user bấm back/forward
  useEffect(() => {
    const onHashChange = () => {
      const page = pageFromHash();
      if (page) setPgRaw(p => p === page ? p : page);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Ghi hash ban đầu nếu URL chưa có hash
  useEffect(() => {
    if (!window.location.hash) {
      const slug = PAGE_SLUGS[pg] || pg;
      window.location.replace('#/' + slug);
    }
  }, []); // eslint-disable-line

  // Data state — khởi tạo bằng data cứng, sau đó ghi đè bằng API
  const [wts, setWts] = useState(initWT);
  const [ats, setAts] = useState(initAT);
  const [cfg, setCfg] = useState(initCFG);
  const [prices, setP] = useState(genPrices);
  const [logs, setLogs] = useState([]);
  const [useAPI, setUseAPI] = useState(false);
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
  const [ugPersist, setUgPersist] = useState(false); // toggle gộp dày — persist toàn hệ thống
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = useCallback((text, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, ok });
    toastTimer.current = setTimeout(() => setToast(null), ok ? 2500 : 5000);
  }, []);
  const perms = getPerms(user?.role, rolePermsConfig);
  const ce = perms.ce;

  const handleLogin = (u) => {
    saveSession(u);
    setUser(u);
    const rp = getPerms(u.role, rolePermsConfig);
    setPg(rp.defaultPage ?? rp.pages?.[0] ?? 'pricing');
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setPg('pricing');
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
      let changed = false;
      Object.entries(renames).forEach(([oldVal, newVal]) => {
        if (attrs[attrId] === oldVal) {
          attrs = { ...attrs, [attrId]: newVal };
          skuKey = skuKey.split('||').map(s => s === seg(oldVal) ? seg(newVal) : s).join('||');
          changed = true;
        }
      });
      return changed ? { ...b, attributes: attrs, skuKey } : b;
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
      let changed = false;
      Object.entries(renames).forEach(([oldVal, newVal]) => {
        if (attrs[atId] === oldVal) {
          attrs = { ...attrs, [atId]: newVal };
          skuKey = skuKey?.split('||').map(s => s === seg(oldVal) ? seg(newVal) : s).join('||');
          changed = true;
        }
      });
      return changed ? { ...b, attributes: attrs, skuKey } : b;
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

  const PAGE_LABELS = { dashboard: "🏠 Tổng quan", pricing: "📊 Bảng giá", wood_types: "🌳 Loại gỗ", attributes: "📋 Thuộc tính", config: "⚙️ Cấu hình", sku: "🏷️ SKU", suppliers: "🏭 Nhà cung cấp", containers: "📦 Container", shipments: "📅 Lịch hàng về", raw_wood: "🪵 Gỗ nguyên liệu", kiln: "🔥 Lò sấy", warehouse: "🪚 Gỗ kiện", sales: "🛒 Đơn hàng", customers: "👥 Khách hàng", carriers: "🚛 Đơn vị vận tải", users: "👤 Tài khoản" };

  // Load data từ Supabase khi app khởi động
  useEffect(() => {
    async function loadFromAPI() {
      try {
        const { loadAllData, fetchSuppliers, fetchCustomers, fetchBundles, fetchPendingOrdersCount, fetchContainers, fetchSupplierWoodAssignments } = await import('./api.js');
        const { fetchCarriers, fetchXeSayConfig, fetchUsers, fetchRolePermissions, fetchThicknessGrouping } = await import('./api.js');
        const [data, suppliersData, customersData, bundlesData, pendingCount, containersData, swaData, carriersData, xeSayCfg, usersData, rolePermsData, ugData] = await Promise.all([loadAllData(), fetchSuppliers().catch(() => []), fetchCustomers().catch(() => []), fetchBundles().catch(() => []), fetchPendingOrdersCount().catch(() => 0), fetchContainers().catch(() => []), fetchSupplierWoodAssignments().catch(() => []), fetchCarriers().catch(() => []), fetchXeSayConfig().catch(() => null), fetchUsers().catch(() => []), fetchRolePermissions().catch(() => null), fetchThicknessGrouping().catch(() => false)]);
        if (containersData.length) setAllContainers(containersData);
        if (carriersData.length) setCarriers(carriersData);
        if (xeSayCfg) setXeSayConfig(xeSayCfg);
        if (usersData.length) setDynamicUsers(usersData);
        if (rolePermsData) setRolePermsConfig(rolePermsData);
        setUgPersist(!!ugData);
        if (suppliersData.length) setSuppliers(suppliersData);
        if (swaData.length) setSupplierAssignments(swaData);
        if (customersData.length) setCustomers(customersData);
        if (bundlesData.length) setBundles(bundlesData);
        setPendingOrdersCount(pendingCount);

        // Nếu API trả về data hợp lệ, ghi đè data cứng
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
            // Thu thập tất cả thickness thực từ bundles
            const uniqueT = new Set();
            (bundlesData || []).forEach(b => {
              if ((b.woodId || b.wood_id) !== woodId) return;
              const t = b.attributes?.thickness;
              if (t) uniqueT.add(t);
            });
            // Tách price keys nhóm → keys riêng
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
            // Cập nhật attrValues.thickness từ bundles thực tế + xóa rangeGroups.thickness
            const sorted = [...uniqueT].sort((a, b) => parseFloat(a) - parseFloat(b));
            const newRg = { ...(wc.rangeGroups || {}) };
            delete newRg.thickness;
            migratedCfg[woodId] = { ...wc, attrValues: { ...wc.attrValues, ...(sorted.length ? { thickness: sorted } : {}) }, rangeGroups: Object.keys(newRg).length ? newRg : {} };
            thicknessMigrated = true;
          });
          setCfg(migratedCfg);
          if (thicknessMigrated) {
            console.log('[Migration] Đã xóa rangeGroups.thickness, tách price keys nhóm → riêng');
            import('./api.js').then(api => {
              Object.entries(migratedCfg).forEach(([wid, wc]) => api.saveWoodConfig(wid, wc).catch(() => {}));
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
        setUseAPI(true);
        setLoading(false);
      } catch (err) {
        console.warn('API không khả dụng, dùng data mẫu:', err.message);
        setLoading(false);
        // Vẫn dùng data cứng đã khởi tạo, app hoạt động bình thường
      }
    }
    loadFromAPI();
  }, []);

  // Refresh pending count khi rời trang sales (đơn hàng có thể đã được duyệt)
  useEffect(() => {
    if (useAPI && perms.ce) {
      import('./api.js').then(({ fetchPendingOrdersCount }) =>
        fetchPendingOrdersCount().then(setPendingOrdersCount).catch(() => {})
      );
    }
  }, [pg, useAPI, perms.ce]);

  const renderPage = () => {
    // Kiểm tra quyền truy cập trang
    if (perms.pages && !perms.pages.includes(pg)) {
      const fp = perms.pages[0] || 'pricing';
      return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Bạn không có quyền truy cập trang này.</div>;
    }
    switch (pg) {
      case "dashboard":  return <PgDashboard wts={wts} bundles={bundles} role={user?.role} useAPI={useAPI} notify={notify} onNavigate={setPg} />;
      case "pricing":    return <PgPrice wts={wts} ats={ats} cfg={cfg} prices={prices} setP={setP} logs={logs} setLogs={setLogs} ce={ce} seeCostPrice={perms.seeCostPrice} useAPI={useAPI} notify={notify} bundles={bundles} setBundles={setBundles} ugPersist={ugPersist} onToggleUg={handleToggleUg} />;
      case "wood_types": return <PgWT wts={wts} setWts={setWts} cfg={cfg} ce={ce} useAPI={useAPI} notify={notify} bundles={bundles} />;
      case "attributes": return <PgAT ats={ats} setAts={setAts} cfg={cfg} prices={prices} ce={ce} useAPI={useAPI} notify={notify} suppliers={suppliers} onRenameAttrVal={handleRenameAttrVal} bundles={bundles} />;
      case "config":     return <PgCFG wts={wts} ats={ats} cfg={cfg} setCfg={setCfg} prices={prices} setP={setP} ce={ce} useAPI={useAPI} notify={notify} bundles={bundles} setBundles={setBundles} onRenameAttrValForWood={handleRenameAttrValForWood} onMigratePriceGroup={handleMigratePriceGroup} />;
      case "sku":        return <PgSKU wts={wts} cfg={cfg} prices={prices} bundles={bundles} ugPersist={ugPersist} />;
      case "suppliers":  return <PgNCC suppliers={suppliers} setSuppliers={setSuppliers} ce={perms.ce || perms.addOnlyNCC} addOnly={perms.addOnlyNCC} useAPI={useAPI} notify={notify} bundles={bundles} wts={wts} supplierAssignments={supplierAssignments} setSupplierAssignments={setSupplierAssignments} />;
      case "containers": return <PgContainer suppliers={suppliers} wts={wts} cfg={cfg} ce={perms.ce || perms.addOnlyContainer} addOnly={perms.addOnlyContainer} useAPI={useAPI} notify={notify} bundles={bundles} allContainers={allContainers} setAllContainers={setAllContainers} />;
      case "shipments":  return <PgShipment containers={allContainers} setContainers={setAllContainers} suppliers={suppliers} wts={wts} cfg={cfg} ce={perms.ce || perms.ceWarehouse} useAPI={useAPI} notify={notify} />;
      case "raw_wood":   return <PgRawWood suppliers={suppliers} customers={customers} supplierAssignments={supplierAssignments} ce={perms.ceWarehouse} useAPI={useAPI} notify={notify} />;
      case "kiln":       return <PgKiln wts={wts} ats={ats} cfg={cfg} bundles={bundles} setBundles={setBundles} ce={perms.ceWarehouse} isAdmin={perms.ce} user={user} useAPI={useAPI} notify={notify} />;
      case "warehouse":  return <PgWarehouse wts={wts} ats={ats} cfg={cfg} prices={prices} suppliers={suppliers} ce={perms.ceWarehouse} cePrice={perms.ce} useAPI={useAPI} notify={notify} setPg={setPg} bundles={bundles} setBundles={setBundles} ugPersist={ugPersist} onAutoAddChip={handleAutoAddThicknessChip} />;
      case "sales":      return <PgSales wts={wts} ats={ats} cfg={cfg} prices={prices} customers={customers} setCustomers={setCustomers} carriers={carriers} xeSayConfig={xeSayConfig} setXeSayConfig={setXeSayConfig} ce={perms.ceSales} useAPI={useAPI} notify={notify} setPg={setPg} />;
      case "carriers":   return <PgCarriers carriers={carriers} setCarriers={setCarriers} useAPI={useAPI} notify={notify} />;
      case "customers":  return <PgCustomers customers={customers} setCustomers={setCustomers} wts={wts} productCatalog={productCatalog} setProductCatalog={setProductCatalog} preferenceCatalog={preferenceCatalog} setPreferenceCatalog={setPreferenceCatalog} ce={perms.ceSales} useAPI={useAPI} notify={notify} />;
      case "users":      return <PgUsers dynamicUsers={dynamicUsers} setDynamicUsers={setDynamicUsers} rolePermsConfig={rolePermsConfig} setRolePermsConfig={setRolePermsConfig} useAPI={useAPI} notify={notify} currentUser={user} />;
      default: return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Trang "{pg}" đang phát triển</div>;
    }
  };

  // Chưa đăng nhập → hiện màn hình Login
  if (!user) return <Login onLogin={handleLogin} dynamicUsers={dynamicUsers} />;

  return (
    <div style={{ ...THEME, display: "flex", minHeight: "100vh", background: "var(--bg)", fontFamily: "'DM Sans', sans-serif", color: "var(--tp)" }}>
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
      <Sidebar pg={pg} setPg={setPg} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} allowedPages={perms.pages} manageUsers={perms.manageUsers} badges={perms.ce ? { sales: pendingOrdersCount } : {}} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppHeader user={user} onLogout={handleLogout} pg={pg} useAPI={useAPI} onMobileMenu={() => setMobileMenuOpen(true)} PAGE_LABELS={PAGE_LABELS} notify={notify} />
        <main className="app-main" style={{ flex: 1, padding: "24px 28px", maxWidth: 1400, minWidth: 0 }}>
          {loading && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--br)", marginBottom: 8 }}>Đang tải dữ liệu...</div>
              <div style={{ fontSize: "0.8rem", color: "var(--tm)" }}>Kết nối Supabase</div>
            </div>
          )}
          {!loading && renderPage()}
        </main>
      </div>
    </div>
  );
}
