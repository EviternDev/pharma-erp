import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Pill,
  Layers,
  AlertTriangle,
  Upload,
  ShoppingCart,
  Receipt,
  Users,
  Truck,
  TrendingUp,
  Package,
  IndianRupee,
  Clock,
  UserCog,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const navigation: NavEntry[] = [
  { label: "Dashboard", path: "/", icon: <LayoutDashboard size={20} /> },
  {
    label: "Inventory",
    icon: <Package size={20} />,
    children: [
      { label: "Medicines", path: "/inventory/medicines", icon: <Pill size={18} /> },
      { label: "Batches", path: "/inventory/batches", icon: <Layers size={18} /> },
      { label: "Stock Alerts", path: "/inventory/stock-alerts", icon: <AlertTriangle size={18} /> },
      { label: "Import", path: "/inventory/import", icon: <Upload size={18} /> },
    ],
  },
  {
    label: "Sales",
    icon: <ShoppingCart size={20} />,
    children: [
      { label: "New Sale", path: "/sales/new", icon: <ShoppingCart size={18} /> },
      { label: "Sales History", path: "/sales/history", icon: <Receipt size={18} /> },
    ],
  },
  { label: "Customers", path: "/customers", icon: <Users size={20} /> },
  { label: "Suppliers", path: "/suppliers", icon: <Truck size={20} /> },
  {
    label: "Reports",
    icon: <TrendingUp size={20} />,
    children: [
      { label: "Sales Report", path: "/reports/sales", icon: <TrendingUp size={18} /> },
      { label: "Stock Report", path: "/reports/stock", icon: <Package size={18} /> },
      { label: "Profit & Loss", path: "/reports/profit-loss", icon: <IndianRupee size={18} /> },
      { label: "Expiry Report", path: "/reports/expiry", icon: <Clock size={18} /> },
    ],
  },
  { label: "Users", path: "/users", icon: <UserCog size={20} /> },
  { label: "Settings", path: "/settings", icon: <Settings size={20} /> },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["Inventory", "Sales", "Reports"]));
  const location = useLocation();

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  function isActive(path: string) {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  }

  function isGroupActive(group: NavGroup) {
    return group.children.some((child) => isActive(child.path));
  }

  return (
    <aside
      className={cn(
        "no-print flex flex-col h-screen bg-white border-r border-slate-200 transition-all duration-200",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-slate-200">
        {!collapsed && (
          <span className="text-lg font-bold text-primary truncate">PharmaCare</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navigation.map((entry) => {
          if (isGroup(entry)) {
            const groupActive = isGroupActive(entry);
            const groupOpen = openGroups.has(entry.label);

            return (
              <div key={entry.label} className="mb-1">
                <button
                  onClick={() => !collapsed && toggleGroup(entry.label)}
                  className={cn(
                    "flex items-center w-full gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    groupActive
                      ? "text-primary"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                  title={collapsed ? entry.label : undefined}
                >
                  <span className="flex-shrink-0">{entry.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left truncate">{entry.label}</span>
                      <ChevronDown
                        size={14}
                        className={cn(
                          "transition-transform",
                          groupOpen ? "rotate-0" : "-rotate-90"
                        )}
                      />
                    </>
                  )}
                </button>
                {!collapsed && groupOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {entry.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
                          isActive(child.path)
                            ? "bg-primary text-white"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <span className="flex-shrink-0">{child.icon}</span>
                        <span className="truncate">{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={entry.path}
              to={entry.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-1",
                isActive(entry.path)
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              title={collapsed ? entry.label : undefined}
            >
              <span className="flex-shrink-0">{entry.icon}</span>
              {!collapsed && <span className="truncate">{entry.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-3">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">Administrator</p>
              <p className="text-xs text-slate-500 truncate">admin</p>
            </div>
            <button
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            className="w-full flex justify-center p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}
