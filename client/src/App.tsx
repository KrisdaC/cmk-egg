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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import PriceAdjustment from "@/pages/orders/PriceAdjustment";
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
    label: "Order Management",
    icon: ShoppingCart,
    items: [
      { title: "Order Input", url: "/orders/input", icon: ClipboardList },
      { title: "Daily Summary", url: "/orders/daily-summary", icon: Calendar },
      {
        title: "Price Adjustment",
        url: "/orders/price-adjustment",
        icon: Tags,
      },
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
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Egg className="w-8 h-8 text-primary" />
          <div>
            <h1 className="font-bold text-lg">EggGrade Pro</h1>
            <p className="text-xs text-muted-foreground">ERP System</p>
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
                <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <div className="flex items-center gap-2">
                    {group.icon && <group.icon className="w-4 h-4" />}
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
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
      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName || user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
              });
              window.location.href = "/login";
            }}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <div className="flex-1 overflow-auto p-6">{children}</div>
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
        path="/orders/input"
        component={() => <ProtectedRoute component={OrderInput} />}
      />
      <Route
        path="/orders/daily-summary"
        component={() => <ProtectedRoute component={DailyOrderSummary} />}
      />
      <Route
        path="/orders/price-adjustment"
        component={() => <ProtectedRoute component={PriceAdjustment} />}
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
