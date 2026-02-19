import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import MedicinesPage from "@/pages/inventory/MedicinesPage";
import BatchesPage from "@/pages/inventory/BatchesPage";
import StockAlertsPage from "@/pages/inventory/StockAlertsPage";
import ImportPage from "@/pages/inventory/ImportPage";
import NewSalePage from "@/pages/sales/NewSalePage";
import SalesHistoryPage from "@/pages/sales/SalesHistoryPage";
import CustomersPage from "@/pages/customers/CustomersPage";
import SuppliersPage from "@/pages/suppliers/SuppliersPage";
import SalesReportPage from "@/pages/reports/SalesReportPage";
import StockReportPage from "@/pages/reports/StockReportPage";
import ProfitLossPage from "@/pages/reports/ProfitLossPage";
import ExpiryReportPage from "@/pages/reports/ExpiryReportPage";
import UsersPage from "@/pages/users/UsersPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import LoginPage from "@/pages/auth/LoginPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="inventory/medicines" element={<MedicinesPage />} />
          <Route path="inventory/batches" element={<BatchesPage />} />
          <Route path="inventory/stock-alerts" element={<StockAlertsPage />} />
          <Route path="inventory/import" element={<ImportPage />} />
          <Route path="sales/new" element={<NewSalePage />} />
          <Route path="sales/history" element={<SalesHistoryPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="reports/sales" element={<SalesReportPage />} />
          <Route path="reports/stock" element={<StockReportPage />} />
          <Route path="reports/profit-loss" element={<ProfitLossPage />} />
          <Route path="reports/expiry" element={<ExpiryReportPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

