import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Egg, Package, AlertTriangle, TrendingDown, Plus, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";

interface GradingLot {
  id: number;
  lotNumber: number;
  billNumber?: string;
  receivingDate: string;
  vehiclePlate?: string;
  driverName?: string;
  weightKg?: string;
  purchasePrice?: string;
  inputQuantity: number;
  gradedTotal: number;
  size0Jumbo: number;
  size1: number;
  size2: number;
  size3: number;
  size4: number;
  size5: number;
  size6: number;
  undergradeDirty: number;
  undergradeThin: number;
  undergradeDented: number;
  undergradeCracked: number;
  undergradeBag: number;
  lossUnrecoverable: number;
  qcColorValue?: string;
  qcFreshness?: string;
  status: string;
}

export default function SkuTransformation() {
  const { data: gradingLots, isLoading } = useQuery<GradingLot[]>({
    queryKey: ['/api/grading-lots']
  });

  const totals = gradingLots?.reduce((acc, lot) => ({
    input: acc.input + (lot.inputQuantity || 0),
    graded: acc.graded + (lot.gradedTotal || 0),
    undergrade: acc.undergrade + (lot.undergradeDirty || 0) + (lot.undergradeThin || 0) + 
                (lot.undergradeDented || 0) + (lot.undergradeCracked || 0) + (lot.undergradeBag || 0),
    loss: acc.loss + (lot.lossUnrecoverable || 0)
  }), { input: 0, graded: 0, undergrade: 0, loss: 0 }) || { input: 0, graded: 0, undergrade: 0, loss: 0 };

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">SKU Transformation</h1>
          <p className="text-muted-foreground">Track product transformations: grading, packing, labeling</p>
        </div>
        <Button data-testid="button-new-transformation">
          <Plus className="w-4 h-4 mr-2" />
          Record Transformation
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                <Egg className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-input-today">{formatNumber(totals.input)}</div>
                <p className="text-sm text-muted-foreground">Total Input (pcs)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-output-today">{formatNumber(totals.graded)}</div>
                <p className="text-sm text-muted-foreground">Graded Output (pcs)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-100 dark:bg-yellow-900">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-undergrade">{formatNumber(totals.undergrade)}</div>
                <p className="text-sm text-muted-foreground">Undergrade (pcs)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-100 dark:bg-red-900">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-loss">{formatNumber(totals.loss)}</div>
                <p className="text-sm text-muted-foreground">Loss (pcs)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="grading" className="w-full">
        <TabsList>
          <TabsTrigger value="grading" data-testid="tab-grading">Grading Lots</TabsTrigger>
          <TabsTrigger value="packing" data-testid="tab-packing">Packing</TabsTrigger>
          <TabsTrigger value="labeling" data-testid="tab-labeling">Labeling</TabsTrigger>
        </TabsList>

        <TabsContent value="grading" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Egg className="w-5 h-5" />
                Raw Eggs
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                Graded by Size (0-6) + Undergrade + Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lot #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead className="text-right">Input</TableHead>
                        <TableHead className="text-right">No.0</TableHead>
                        <TableHead className="text-right">No.1</TableHead>
                        <TableHead className="text-right">No.2</TableHead>
                        <TableHead className="text-right">No.3</TableHead>
                        <TableHead className="text-right">No.4</TableHead>
                        <TableHead className="text-right">No.5</TableHead>
                        <TableHead className="text-right">Undergrade</TableHead>
                        <TableHead className="text-right">Loss</TableHead>
                        <TableHead>Yield</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gradingLots?.map((lot) => {
                        const totalUndergrade = (lot.undergradeDirty || 0) + (lot.undergradeThin || 0) + 
                          (lot.undergradeDented || 0) + (lot.undergradeCracked || 0) + (lot.undergradeBag || 0);
                        const yieldPercent = lot.inputQuantity > 0 
                          ? ((lot.gradedTotal / lot.inputQuantity) * 100).toFixed(1) 
                          : '0';
                        return (
                          <TableRow key={lot.id} data-testid={`row-lot-${lot.lotNumber}`}>
                            <TableCell className="font-mono font-medium">{lot.lotNumber}</TableCell>
                            <TableCell>{lot.receivingDate}</TableCell>
                            <TableCell>{lot.vehiclePlate || '-'}</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(lot.inputQuantity)}</TableCell>
                            <TableCell className="text-right">{formatNumber(lot.size0Jumbo)}</TableCell>
                            <TableCell className="text-right">{formatNumber(lot.size1)}</TableCell>
                            <TableCell className="text-right">{formatNumber(lot.size2)}</TableCell>
                            <TableCell className="text-right">{formatNumber(lot.size3)}</TableCell>
                            <TableCell className="text-right">{formatNumber(lot.size4)}</TableCell>
                            <TableCell className="text-right">{formatNumber(lot.size5)}</TableCell>
                            <TableCell className="text-right text-yellow-600">{formatNumber(totalUndergrade)}</TableCell>
                            <TableCell className="text-right text-red-600">{formatNumber(lot.lossUnrecoverable)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={parseFloat(yieldPercent)} className="w-16 h-2" />
                                <span className="text-sm">{yieldPercent}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!gradingLots || gradingLots.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                            No grading lots found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Graded Eggs
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                Packed Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Packing transformation data will be displayed here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labeling" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Packed Products
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                Labeled Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Labeling transformation data will be displayed here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
