import { useState, useEffect, useCallback, useRef } from "react";
import { THEME, initWT, initAT, initCFG, genPrices } from "./utils";
import AppHeader from "./components/AppHeader";
import Sidebar from "./components/Sidebar";
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

export default function App() {
  const [pg, setPg] = useState("pricing");
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(true);

  // Data state — khởi tạo bằng data cứng, sau đó ghi đè bằng API
  const [wts, setWts] = useState(initWT);
  const [ats, setAts] = useState(initAT);
  const [cfg, setCfg] = useState(initCFG);
  const [prices, setP] = useState(genPrices);
  const [logs, setLogs] = useState([]);
  const [useAPI, setUseAPI] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = useCallback((text, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, ok });
    toastTimer.current = setTimeout(() => setToast(null), ok ? 2500 : 5000);
  }, []);
  const ce = role === "admin";

  const PAGE_LABELS = { pricing: "📊 Bảng giá", wood_types: "🌳 Loại gỗ", attributes: "📋 Thuộc tính", config: "⚙️ Cấu hình", sku: "🏷️ SKU", suppliers: "🏭 Nhà cung cấp", containers: "📦 Container", warehouse: "🏪 Thủ kho", sales: "🛒 Đơn hàng", customers: "👥 Khách hàng" };

  // Load data từ Supabase khi app khởi động
  useEffect(() => {
    async function loadFromAPI() {
      try {
        const { loadAllData, fetchSuppliers, fetchCustomers, fetchBundles } = await import('./api.js');
        const [data, suppliersData, customersData, bundlesData] = await Promise.all([loadAllData(), fetchSuppliers().catch(() => []), fetchCustomers().catch(() => []), fetchBundles().catch(() => [])]);
        if (suppliersData.length) setSuppliers(suppliersData);
        if (customersData.length) setCustomers(customersData);
        if (bundlesData.length) setBundles(bundlesData);

        // Nếu API trả về data hợp lệ, ghi đè data cứng
        if (data.woodTypes && Array.isArray(data.woodTypes) && data.woodTypes.length > 0) {
          setWts(data.woodTypes);
        }
        if (data.attributes && Array.isArray(data.attributes) && data.attributes.length > 0) {
          setAts(data.attributes);
        }
        if (data.config && typeof data.config === 'object' && Object.keys(data.config).length > 0) {
          // Normalize: loại bỏ giá trị trong config không còn tồn tại trong attribute definition
          const atMap = Object.fromEntries((data.attributes || []).map(a => [a.id, new Set(a.values)]));
          const cleanCfg = {};
          Object.entries(data.config).forEach(([woodId, wc]) => {
            const cleanAV = {};
            Object.entries(wc.attrValues || {}).forEach(([atId, vals]) => {
              cleanAV[atId] = atMap[atId] ? vals.filter(v => atMap[atId].has(v)) : vals;
            });
            cleanCfg[woodId] = { ...wc, attrValues: cleanAV };
          });
          setCfg(cleanCfg);
        }
        if (data.prices && typeof data.prices === 'object' && Object.keys(data.prices).length > 0) {
          setP(data.prices);
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

  const renderPage = () => {
    switch (pg) {
      case "pricing": return <PgPrice wts={wts} ats={ats} cfg={cfg} prices={prices} setP={setP} logs={logs} setLogs={setLogs} ce={ce} useAPI={useAPI} notify={notify} bundles={bundles} />;
      case "wood_types": return <PgWT wts={wts} setWts={setWts} cfg={cfg} ce={ce} useAPI={useAPI} notify={notify} />;
      case "attributes": return <PgAT ats={ats} setAts={setAts} cfg={cfg} prices={prices} ce={ce} useAPI={useAPI} notify={notify} suppliers={suppliers} />;
      case "config": return <PgCFG wts={wts} ats={ats} cfg={cfg} setCfg={setCfg} ce={ce} useAPI={useAPI} notify={notify} />;
      case "sku": return <PgSKU wts={wts} cfg={cfg} prices={prices} />;
      case "suppliers": return <PgNCC suppliers={suppliers} setSuppliers={setSuppliers} ce={ce} useAPI={useAPI} notify={notify} />;
      case "containers": return <PgContainer suppliers={suppliers} wts={wts} cfg={cfg} ce={ce} useAPI={useAPI} notify={notify} />;
      case "warehouse": return <PgWarehouse wts={wts} ats={ats} cfg={cfg} prices={prices} suppliers={suppliers} ce={ce} useAPI={useAPI} notify={notify} setPg={setPg} bundles={bundles} setBundles={setBundles} />;
      case "sales": return <PgSales wts={wts} ats={ats} cfg={cfg} prices={prices} customers={customers} setCustomers={setCustomers} ce={ce} useAPI={useAPI} notify={notify} setPg={setPg} />;
      case "customers": return <PgCustomers customers={customers} setCustomers={setCustomers} wts={wts} ce={ce} useAPI={useAPI} notify={notify} />;
      default: return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Trang "{pg}" đang phát triển</div>;
    }
  };

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
      <Sidebar pg={pg} setPg={setPg} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppHeader role={role} setRole={setRole} pg={pg} useAPI={useAPI} onMobileMenu={() => setMobileMenuOpen(true)} PAGE_LABELS={PAGE_LABELS} notify={notify} />
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
