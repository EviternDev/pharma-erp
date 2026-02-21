import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/inventory/medicines": "Medicines",
  "/inventory/batches": "Batches",
  "/inventory/stock-alerts": "Stock Alerts",
  "/inventory/import": "Import",
  "/inventory/expiry": "Expiry Dashboard",
  "/sales/new": "New Sale",
  "/sales/history": "Sales History",
  "/customers": "Customers",
  "/suppliers": "Suppliers",
  "/reports/sales": "Sales Report",
  "/reports/stock": "Stock Report",
  "/reports/profit-loss": "Profit & Loss",
  "/reports/expiry": "Expiry Report",
  "/users": "Users",
  "/settings": "Settings",
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const pageName = PAGE_TITLES[location.pathname] || "Page";
    document.title = `PharmaCare ERP \u2014 ${pageName}`;
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        navigate("/sales/new");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
