import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Factory, ChevronLeft, ChevronRight, Play, Pause, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const productionRequests = [
  { id: "PRD-001", orderRef: "ORD-20260102-001", sku: "EGG-L-30", requiredQty: 150, plannedQty: 160, workstation: "Grading A", startTime: "06:00", status: "in_progress", progress: 65 },
  { id: "PRD-002", orderRef: "ORD-20260102-002", sku: "EGG-M-30", requiredQty: 90, plannedQty: 100, workstation: "Grading B", startTime: "06:30", status: "in_progress", progress: 40 },
  { id: "PRD-003", orderRef: "ORD-20260102-003", sku: "EGG-S-30", requiredQty: 60, plannedQty: 60, workstation: "Grading A", startTime: "08:00", status: "pending", progress: 0 },
  { id: "PRD-004", orderRef: "ORD-20260102-001", sku: "EGG-XL-12", requiredQty: 40, plannedQty: 45, workstation: "Packing 1", startTime: "09:00", status: "pending", progress: 0 },
  { id: "PRD-005", orderRef: "Multiple", sku: "EGG-L-30", requiredQty: 200, plannedQty: 200, workstation: "Packing 2", startTime: "10:00", status: "completed", progress: 100 },
];

const workstationStatus = [
  { name: "Grading A", status: "running", currentJob: "PRD-001", operator: "Worker A", efficiency: 92 },
  { name: "Grading B", status: "running", currentJob: "PRD-002", operator: "Worker B", efficiency: 88 },
  { name: "Grading C", status: "idle", currentJob: "-", operator: "-", efficiency: 0 },
  { name: "Packing 1", status: "idle", currentJob: "-", operator: "Worker C", efficiency: 0 },
  { name: "Packing 2", status: "completed", currentJob: "PRD-005", operator: "Worker D", efficiency: 95 },
];

export default function PlannedProduction() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Planned Production</h1>
          <p className="text-muted-foreground">Production requests from orders with material requirements</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" data-testid="button-prev-day">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input type="date" defaultValue="2026-01-02" className="border-0 p-0 h-auto w-[130px]" data-testid="input-date" />
          </div>
          <Button variant="outline" size="icon" data-testid="button-next-day">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {workstationStatus.map((ws) => (
          <Card key={ws.name}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{ws.name}</span>
                <Badge 
                  variant={ws.status === "running" ? "default" : ws.status === "completed" ? "secondary" : "outline"}
                  className="capitalize text-xs"
                >
                  {ws.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {ws.currentJob !== "-" ? (
                  <>Job: {ws.currentJob}<br/>Operator: {ws.operator}</>
                ) : (
                  "No active job"
                )}
              </div>
              {ws.efficiency > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Efficiency</span>
                    <span>{ws.efficiency}%</span>
                  </div>
                  <Progress value={ws.efficiency} className="h-1" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Production Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Order Ref</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Required</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead>Workstation</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productionRequests.map((job) => (
                <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <Factory className="w-4 h-4 text-muted-foreground" />
                      {job.id}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{job.orderRef}</TableCell>
                  <TableCell className="font-mono text-xs">{job.sku}</TableCell>
                  <TableCell className="text-right">{job.requiredQty}</TableCell>
                  <TableCell className="text-right font-medium">{job.plannedQty}</TableCell>
                  <TableCell>{job.workstation}</TableCell>
                  <TableCell>{job.startTime}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Progress value={job.progress} className="h-2 flex-1" />
                      <span className="text-xs w-8">{job.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={job.status === "in_progress" ? "default" : job.status === "completed" ? "secondary" : "outline"}
                      className="capitalize text-xs"
                    >
                      {job.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {job.status === "pending" && (
                        <Button variant="ghost" size="icon" data-testid={`button-start-${job.id}`}>
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      {job.status === "in_progress" && (
                        <>
                          <Button variant="ghost" size="icon" data-testid={`button-pause-${job.id}`}>
                            <Pause className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" data-testid={`button-complete-${job.id}`}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
