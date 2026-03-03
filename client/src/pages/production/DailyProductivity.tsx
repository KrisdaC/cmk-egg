import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, ChevronLeft, ChevronRight, TrendingUp, Users, Clock, Target } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const dailySummary = {
  totalOutput: 28500,
  targetOutput: 30000,
  achievement: 95,
  totalHours: 48,
  avgEfficiency: 89,
  workers: 12,
};

const workstationProductivity = [
  { workstation: "Grading A", output: 8500, target: 9000, hours: 8, efficiency: 94, operator: "Worker A" },
  { workstation: "Grading B", output: 7800, target: 9000, hours: 8, efficiency: 87, operator: "Worker B" },
  { workstation: "Grading C", output: 4200, target: 9000, hours: 4, efficiency: 93, operator: "Worker E" },
  { workstation: "Packing 1", output: 4200, target: 4500, hours: 8, efficiency: 93, operator: "Worker C" },
  { workstation: "Packing 2", output: 3800, target: 4500, hours: 8, efficiency: 84, operator: "Worker D" },
];

const workerPerformance = [
  { name: "Worker A", workstation: "Grading A", hours: 8, output: 8500, efficiency: 94, status: "excellent" },
  { name: "Worker B", workstation: "Grading B", hours: 8, output: 7800, efficiency: 87, status: "good" },
  { name: "Worker C", workstation: "Packing 1", hours: 8, output: 4200, efficiency: 93, status: "excellent" },
  { name: "Worker D", workstation: "Packing 2", hours: 8, output: 3800, efficiency: 84, status: "average" },
  { name: "Worker E", workstation: "Grading C", hours: 4, output: 4200, efficiency: 93, status: "excellent" },
];

export default function DailyProductivity() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Daily Productivity</h1>
          <p className="text-muted-foreground">Daily production performance report</p>
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
          <Button variant="outline" data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-total-output">{dailySummary.totalOutput.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Total Output (pcs)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-achievement">{dailySummary.achievement}%</div>
                <p className="text-sm text-muted-foreground">Target Achievement</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-efficiency">{dailySummary.avgEfficiency}%</div>
                <p className="text-sm text-muted-foreground">Avg Efficiency</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-workers">{dailySummary.workers}</div>
                <p className="text-sm text-muted-foreground">Workers Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Workstation</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workstation</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Efficiency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workstationProductivity.map((ws, idx) => (
                  <TableRow key={idx} data-testid={`row-ws-${idx}`}>
                    <TableCell className="font-medium">{ws.workstation}</TableCell>
                    <TableCell className="text-right">{ws.output.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{ws.target.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{ws.hours}h</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={ws.efficiency >= 90 ? "secondary" : "outline"}>
                        {ws.efficiency}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Worker Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Efficiency</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerPerformance.map((worker, idx) => (
                  <TableRow key={idx} data-testid={`row-worker-${idx}`}>
                    <TableCell className="font-medium">{worker.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{worker.workstation}</TableCell>
                    <TableCell className="text-right">{worker.output.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{worker.efficiency}%</TableCell>
                    <TableCell>
                      <Badge 
                        variant={worker.status === "excellent" ? "default" : worker.status === "good" ? "secondary" : "outline"}
                        className="capitalize text-xs"
                      >
                        {worker.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
