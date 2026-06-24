import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Loader2,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Factory,
  Box,
  Users,
  Truck,
  FileText,
  LogOut,
  Egg,
  Warehouse,
  ClipboardList,
  Building2,
  CarFront,
  UserCircle,
  Database,
  Receipt,
  RotateCcw,
  Tags,
  DollarSign,
  CheckCircle,
  Boxes,
  QrCode,
  MapPin,
  BookOpen,
  Calendar,
  Route as RouteIcon,
  HeadphonesIcon,
  AlertCircle,
  BarChart3,
  Settings,
  Globe,
  ChevronDown,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import Dashboard from "@/pages/Dashboard";
import FinishedGoods from "@/pages/database/FinishedGoods";
import Items from "@/pages/database/Items";
import RawMaterials from "@/pages/database/RawMaterials";
import Customers from "@/pages/database/Customers";
import Contacts from "@/pages/database/Contacts";
import Suppliers from "@/pages/database/Suppliers";
import Eggs from "@/pages/database/Eggs";
import Packaging from "@/pages/database/Packaging";
import Drivers from "@/pages/database/Drivers";
import Vehicles from "@/pages/database/Vehicles";
import OrderInput from "@/pages/orders/OrderInput";
import DailyOrderSummary from "@/pages/orders/DailyOrderSummary";
import GlobalAssumptions from "@/pages/orders/pricing/GlobalAssumptions";
import ReferencePrice from "@/pages/orders/pricing/ReferencePrice";
import Proposals from "@/pages/orders/pricing/Proposals";
import NewProposal from "@/pages/orders/pricing/NewProposal";
import ActivePrices from "@/pages/orders/pricing/ActivePrices";
import Invoices from "@/pages/orders/Invoices";
import Returns from "@/pages/orders/Returns";
import PlannedProduction from "@/pages/production/PlannedProduction";
import SkuTransformation from "@/pages/production/SkuTransformation";
import OrderPicking from "@/pages/production/OrderPicking";
import MaterialRequirements from "@/pages/production/MaterialRequirements";
import ProductionOutput from "@/pages/production/ProductionOutput";
import DailyProductivity from "@/pages/production/DailyProductivity";
import GoodsReceive from "@/pages/inventory/GoodsReceive";
import StockLocations from "@/pages/inventory/StockLocations";
import StockCards from "@/pages/inventory/StockCards";
import StockByCategory from "@/pages/inventory/StockByCategory";
import DeliveryPlanning from "@/pages/logistics/DeliveryPlanning";
import DeliveryTracking from "@/pages/logistics/DeliveryTracking";
import ClaimCases from "@/pages/support/ClaimCases";
import ReportsDashboard from "@/pages/reports/ReportsDashboard";
import AppConfig from "@/pages/settings/AppConfig";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import { useMe } from "./hooks/useAuth";
import OrderFormPage from "./pages/orders/OrderFormPage";
import OrderUploadPage from "./pages/orders/OrderUploadPage";
import POIntake from "./pages/orders/POIntake";
import POUploadReview from "./pages/orders/POUploadReview";
import OrdersGrid from "./pages/orders/OrdersGrid";
import DailyPlan from "./pages/orders/DailyPlan";
import MaterialCosts from "./pages/orders/pricing/MaterialCosts";

const navigationGroups = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "Database",
    icon: Database,
    items: [
      // { title: "Eggs", url: "/database/eggs", icon: Egg },
      // { title: "Packaging", url: "/database/packaging", icon: Package },
      { title: "Items", url: "/database/items", icon: Boxes },
      // { title: "Raw Materials", url: "/database/raw-materials", icon: Box },
      { title: "Customers", url: "/database/customers", icon: Users },
      { title: "Suppliers", url: "/database/suppliers", icon: Building2 },
      { title: "Drivers", url: "/database/drivers", icon: UserCircle },
      { title: "Vehicles", url: "/database/vehicles", icon: CarFront },
    ],
  },
  {
    label: "Price Adjustments",
    icon: Tags,
    items: [
      { title: "Price Assumptions", url: "/orders/pricing/assumptions", icon: Tags },
      { title: "Reference Price", url: "/orders/pricing/reference", icon: DollarSign },
      { title: "Price Proposals", url: "/orders/pricing/proposals", icon: FileText },
      { title: "Active Prices", url: "/orders/pricing/active-prices", icon: CheckCircle },
      { title: "Material Costs", url: "/orders/pricing/material-costs", icon: FileUp },
    ],
  },
  {
    label: "Order Management",
    icon: ShoppingCart,
    items: [
      { title: "Order Intake", url: "/orders/input", icon: ClipboardList },
      { title: "Daily Plan", url: "/orders/daily-plan", icon: Calendar },

      { title: "Daily Summary", url: "/orders/daily-summary", icon: Calendar },
      { title: "Invoices", url: "/orders/invoices", icon: Receipt },
      { title: "Returns", url: "/orders/returns", icon: RotateCcw },
    ],
  },
  {
    label: "Productions",
    icon: Factory,
    items: [
      {
        title: "Planned Production",
        url: "/production/planned",
        icon: ClipboardList,
      },
      {
        title: "SKU Transformation",
        url: "/production/transformation",
        icon: Boxes,
      },
      { title: "Order Picking", url: "/production/picking", icon: Package },
      {
        title: "Material Requirements",
        url: "/production/materials",
        icon: Box,
      },
      { title: "Real-time Output", url: "/production/output", icon: BarChart3 },
      {
        title: "Daily Productivity",
        url: "/production/productivity",
        icon: FileText,
      },
    ],
  },
  {
    label: "Inventory",
    icon: Warehouse,
    items: [
      {
        title: "Goods Receive",
        url: "/inventory/receive",
        icon: ClipboardList,
      },
      { title: "Stock Locations", url: "/inventory/locations", icon: MapPin },
      { title: "Stock Cards", url: "/inventory/cards", icon: BookOpen },
      { title: "Stock by Category", url: "/inventory/category", icon: Egg },
    ],
  },
  {
    label: "Logistics",
    icon: Truck,
    items: [
      {
        title: "Delivery Planning",
        url: "/logistics/planning",
        icon: RouteIcon,
      },
      { title: "Delivery Tracking", url: "/logistics/tracking", icon: MapPin },
    ],
  },
  {
    label: "Customer Support",
    icon: HeadphonesIcon,
    items: [
      { title: "Claim Cases", url: "/support/claims", icon: AlertCircle },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    items: [{ title: "Reports & Dashboard", url: "/reports", icon: FileText }],
  },
  {
    label: "Settings",
    icon: Settings,
    items: [{ title: "App Config", url: "/settings/config", icon: Settings }],
  },
];

function AppSidebar() {
  const [location] = useLocation();
  const { data: user } = useMe();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 border-b border-[#d6d8dc]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center shrink-0">
            <Egg className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-[15px] text-[#1a1a1a] leading-tight">ไชยมงคล</h1>
            <p className="text-[11px] text-[#888]">EggGrade OMS</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="overflow-y-auto">
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {group.items.length === 1 && group.label === "Overview" ? (
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                      >
                        <Link
                          href={item.url}
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            ) : (
              <Collapsible
                defaultOpen={group.items.some((item) =>
                  location.startsWith(
                    item.url.split("/").slice(0, 2).join("/"),
                  ),
                )}
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.4px] text-[#888] hover:text-[#1a1a1a] transition-colors">
                  <div className="flex items-center gap-1.5">
                    {group.icon && <group.icon className="w-3.5 h-3.5" />}
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={location === item.url}
                          >
                            <Link
                              href={item.url}
                              data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                            >
                              <item.icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="px-4 py-3 border-t border-[#d6d8dc]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
            {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#1a1a1a] truncate">
              {user?.firstName || user?.email}
            </p>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              window.location.href = "/login";
            }}
            className="text-[#888] hover:text-[#791F1F] transition-colors p-0.5"
            data-testid="button-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="flex h-11 shrink-0 items-center gap-2 px-4 border-b border-[#d6d8dc] bg-white">
            <SidebarTrigger className="text-[#888] hover:text-[#1a1a1a]" data-testid="button-sidebar-toggle" />
          </header>
          <div className="flex-1 overflow-auto bg-[#fafbfc] p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  console.log(user);
  return (
    <MainLayout>
      <Component />
    </MainLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route
        path="/"
        component={() => <ProtectedRoute component={Dashboard} />}
      />

      {/* Database */}
      <Route
        path="/database/eggs"
        component={() => <ProtectedRoute component={Eggs} />}
      />
      <Route
        path="/database/packaging"
        component={() => <ProtectedRoute component={Packaging} />}
      />
      <Route
        path="/database/finished-goods"
        component={() => <ProtectedRoute component={FinishedGoods} />}
      />
      <Route
        path="/database/items"
        component={() => <ProtectedRoute component={Items} />}
      />
      <Route
        path="/database/raw-materials"
        component={() => <ProtectedRoute component={RawMaterials} />}
      />
      <Route
        path="/database/customers"
        component={() => <ProtectedRoute component={Customers} />}
      />
      <Route
        path="/database/contacts"
        component={() => <ProtectedRoute component={Contacts} />}
      />
      <Route
        path="/database/suppliers"
        component={() => <ProtectedRoute component={Suppliers} />}
      />
      <Route
        path="/database/drivers"
        component={() => <ProtectedRoute component={Drivers} />}
      />
      <Route
        path="/database/vehicles"
        component={() => <ProtectedRoute component={Vehicles} />}
      />

      {/* Order Management */}
      <Route
        path="/orders/po-intake/upload-review"
        component={() => <ProtectedRoute component={POUploadReview} />}
      />
      <Route
        path="/orders/po-intake"
        component={() => <ProtectedRoute component={POIntake} />}
      />
      <Route
        path="/orders/input"
        component={() => <ProtectedRoute component={OrdersGrid} />}
      />
      <Route
        path="/orders/daily-plan"
        component={() => <ProtectedRoute component={DailyPlan} />}
      />
      <Route
        path="/orders/daily-summary"
        component={() => <ProtectedRoute component={DailyOrderSummary} />}
      />
      <Route
        path="/orders/pricing/assumptions"
        component={() => <ProtectedRoute component={GlobalAssumptions} />}
      />
      <Route
        path="/orders/pricing/reference"
        component={() => <ProtectedRoute component={ReferencePrice} />}
      />
      <Route
        path="/orders/pricing/proposals/new"
        component={() => <ProtectedRoute component={NewProposal} />}
      />
      <Route
        path="/orders/pricing/proposals"
        component={() => <ProtectedRoute component={Proposals} />}
      />
      <Route
        path="/orders/pricing/active-prices"
        component={() => <ProtectedRoute component={ActivePrices} />}
      />
      <Route
        path="/orders/pricing/material-costs"
        component={() => <ProtectedRoute component={MaterialCosts} />}
      />
      <Route
        path="/orders/invoices"
        component={() => <ProtectedRoute component={Invoices} />}
      />
      <Route
        path="/orders/returns"
        component={() => <ProtectedRoute component={Returns} />}
      />
      <Route
        path="/orders/new"
        component={() => <ProtectedRoute component={OrderFormPage} />}
      />

      <Route
        path="/orders/upload"
        component={() => <ProtectedRoute component={OrderUploadPage} />}
      />

      <Route
        path="/orders/:id"
        component={() => <ProtectedRoute component={OrderFormPage} />}
      />

      <Route
        path="/orders/:id/edit"
        component={() => <ProtectedRoute component={OrderFormPage} />}
      />

      {/* Productions */}
      <Route
        path="/production/planned"
        component={() => <ProtectedRoute component={PlannedProduction} />}
      />
      <Route
        path="/production/transformation"
        component={() => <ProtectedRoute component={SkuTransformation} />}
      />
      <Route
        path="/production/picking"
        component={() => <ProtectedRoute component={OrderPicking} />}
      />
      <Route
        path="/production/materials"
        component={() => <ProtectedRoute component={MaterialRequirements} />}
      />
      <Route
        path="/production/output"
        component={() => <ProtectedRoute component={ProductionOutput} />}
      />
      <Route
        path="/production/productivity"
        component={() => <ProtectedRoute component={DailyProductivity} />}
      />

      {/* Inventory */}
      <Route
        path="/inventory/receive"
        component={() => <ProtectedRoute component={GoodsReceive} />}
      />
      <Route
        path="/inventory/locations"
        component={() => <ProtectedRoute component={StockLocations} />}
      />
      <Route
        path="/inventory/cards"
        component={() => <ProtectedRoute component={StockCards} />}
      />
      <Route
        path="/inventory/category"
        component={() => <ProtectedRoute component={StockByCategory} />}
      />

      {/* Logistics */}
      <Route
        path="/logistics/planning"
        component={() => <ProtectedRoute component={DeliveryPlanning} />}
      />
      <Route
        path="/logistics/tracking"
        component={() => <ProtectedRoute component={DeliveryTracking} />}
      />

      {/* Customer Support */}
      <Route
        path="/support/claims"
        component={() => <ProtectedRoute component={ClaimCases} />}
      />

      {/* Reports */}
      <Route
        path="/reports"
        component={() => <ProtectedRoute component={ReportsDashboard} />}
      />

      {/* Settings */}
      <Route
        path="/settings/config"
        component={() => <ProtectedRoute component={AppConfig} />}
      />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
