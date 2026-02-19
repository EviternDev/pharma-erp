import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import LoginPage from "@/features/auth/LoginPage";
import FirstLaunchWizard from "@/features/auth/FirstLaunchWizard";
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

function ProtectedApp() {
  const { user, isLoading, isFirstLaunch } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (isFirstLaunch) {
    return <FirstLaunchWizard />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />

        <Route element={<ProtectedRoute permission="inventory:view" />}>
          <Route path="inventory/medicines" element={<MedicinesPage />} />
          <Route path="inventory/batches" element={<BatchesPage />} />
          <Route path="inventory/stock-alerts" element={<StockAlertsPage />} />
          <Route path="inventory/import" element={<ImportPage />} />
        </Route>

        <Route element={<ProtectedRoute permission="sales:view" />}>
          <Route path="sales/new" element={<NewSalePage />} />
          <Route path="sales/history" element={<SalesHistoryPage />} />
        </Route>

        <Route element={<ProtectedRoute permission="customers:view" />}>
          <Route path="customers" element={<CustomersPage />} />
        </Route>

        <Route element={<ProtectedRoute permission="suppliers:view" />}>
          <Route path="suppliers" element={<SuppliersPage />} />
        </Route>

        <Route element={<ProtectedRoute permission="reports:view" />}>
          <Route path="reports/sales" element={<SalesReportPage />} />
          <Route path="reports/stock" element={<StockReportPage />} />
          <Route path="reports/profit-loss" element={<ProfitLossPage />} />
          <Route path="reports/expiry" element={<ExpiryReportPage />} />
        </Route>

        <Route element={<ProtectedRoute permission="users:manage" />}>
          <Route path="users" element={<UsersPage />} />
        </Route>

        <Route element={<ProtectedRoute permission="settings:manage" />}>
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
