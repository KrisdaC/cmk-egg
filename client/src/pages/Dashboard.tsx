import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Factory, AlertCircle, Truck, Package, Egg, TrendingUp, Users } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading } = useQuery<{
    orders: { total: number; pending: number; inProduction: number; ready: number };
    production: { pending: number; inProgress: number };
    pendingPriceApprovals: number;
  }>({
    queryKey: ["/api/dashboard/summary"],
  });

  const { data: eggSizes } = useQuery<Array<{ sizeName: string; sizeCode: string; totalQuantity: string }>>({
    queryKey: ["/api/reports/egg-size-counts"],
  });

  const { data: customers } = useQuery<Array<any>>({
    queryKey: ["/api/customers"],
  });

  const { data: products } = useQuery<Array<any>>({
    queryKey: ["/api/products"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your egg grading operations</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/orders">
            <Button data-testid="button-new-order">
              <ShoppingCart className="w-4 h-4 mr-2" />
              New Order
            </Button>
          </Link>
          <Link href="/goods-receiving">
            <Button variant="outline" data-testid="button-receive-goods">
              <Package className="w-4 h-4 mr-2" />
              Receive Goods
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-orders">{summary?.orders.pending || 0}</div>
            <p className="text-xs text-muted-foreground">awaiting production</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">In Production</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-in-production">{summary?.production.inProgress || 0}</div>
            <p className="text-xs text-muted-foreground">orders being processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Ready to Ship</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-ready-ship">{summary?.orders.ready || 0}</div>
            <p className="text-xs text-muted-foreground">awaiting dispatch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Price Approvals</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-price-approvals">{summary?.pendingPriceApprovals || 0}</div>
            <p className="text-xs text-muted-foreground">pending review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Egg className="w-5 h-5" />
              Egg Size Stock Summary
            </CardTitle>
            <CardDescription>Current available graded egg stock by size</CardDescription>
          </CardHeader>
          <CardContent>
            {eggSizes && eggSizes.length > 0 ? (
              <div className="space-y-3">
                {eggSizes.map((size) => (
                  <div key={size.sizeCode} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{size.sizeName}</span>
                      <span className="text-xs text-muted-foreground">({size.sizeCode})</span>
                    </div>
                    <span className="text-lg font-semibold" data-testid={`text-stock-${size.sizeCode}`}>
                      {Number(size.totalQuantity || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No graded egg stock available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Customer Overview
            </CardTitle>
            <CardDescription>Active customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{customers?.length || 0}</div>
            <p className="text-sm text-muted-foreground mt-2">registered customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Products
            </CardTitle>
            <CardDescription>Active product catalog</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{products?.filter((p: any) => p.isActive).length || 0}</div>
            <p className="text-sm text-muted-foreground mt-2">active products</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/production">
            <Button variant="outline" className="w-full justify-start" data-testid="link-production">
              <Factory className="w-4 h-4 mr-2" />
              View Production Requests
            </Button>
          </Link>
          <Link href="/logistics">
            <Button variant="outline" className="w-full justify-start" data-testid="link-logistics">
              <Truck className="w-4 h-4 mr-2" />
              Plan Deliveries
            </Button>
          </Link>
          <Link href="/products">
            <Button variant="outline" className="w-full justify-start" data-testid="link-products">
              <Package className="w-4 h-4 mr-2" />
              Manage Products & Prices
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline" className="w-full justify-start" data-testid="link-reports">
              <Egg className="w-4 h-4 mr-2" />
              View Reports
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
