import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, Clock, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const realtimeStats = {
  currentRate: 1250,
  targetRate: 1500,
  efficiency: 83,
  uptime: 94,
  lastHourOutput: 1180,
};

const workstationLive = [
  { name: "Grading A", status: "running", rate: 450, target: 500, operator: "Worker A", lastUpdate: "2 min ago" },
  { name: "Grading B", status: "running", rate: 420, target: 500, operator: "Worker B", lastUpdate: "1 min ago" },
  { name: "Grading C", status: "idle", rate: 0, target: 500, operator: "-", lastUpdate: "45 min ago" },
  { name: "Packing 1", status: "running", rate: 200, target: 250, operator: "Worker C", lastUpdate: "3 min ago" },
  { name: "Packing 2", status: "running", rate: 180, target: 250, operator: "Worker D", lastUpdate: "1 min ago" },
];

const hourlyOutput = [
  { hour: "06:00", output: 1450 },
  { hour: "07:00", output: 1520 },
  { hour: "08:00", output: 1480 },
  { hour: "09:00", output: 1380 },
  { hour: "10:00", output: 1250 },
  { hour: "11:00", output: 1180 },
];

export default function ProductionOutput() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Real-time Production Output</h1>
          <p className="text-muted-foreground">Live monitoring of production performance</p>
        </div>
        <Badge variant="default" className="gap-1">
          <Activity className="w-3 h-3 animate-pulse" />
          Live
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-current-rate">{realtimeStats.currentRate}</div>
                <p className="text-sm text-muted-foreground">pcs/hour current</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-efficiency">{realtimeStats.efficiency}%</div>
                <p className="text-sm text-muted-foreground">Efficiency</p>
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
                <div className="text-2xl font-bold" data-testid="text-uptime">{realtimeStats.uptime}%</div>
                <p className="text-sm text-muted-foreground">Uptime</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900">
                <Activity className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-last-hour">{realtimeStats.lastHourOutput}</div>
                <p className="text-sm text-muted-foreground">Last Hour Output</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Workstation Live Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workstationLive.map((ws, idx) => (
                <div key={idx} className="p-3 border rounded-md" data-testid={`card-ws-${idx}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ws.name}</span>
                      <Badge 
                        variant={ws.status === "running" ? "default" : "outline"}
                        className="capitalize text-xs"
                      >
                        {ws.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{ws.lastUpdate}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{ws.rate} pcs/hr</span>
                        <span className="text-muted-foreground">Target: {ws.target}</span>
                      </div>
                      <Progress value={(ws.rate / ws.target) * 100} className="h-2" />
                    </div>
                    <div className="text-sm text-muted-foreground w-20">
                      {ws.operator !== "-" ? ws.operator : "No operator"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hourly Output Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hourlyOutput.map((h, idx) => (
                <div key={idx} className="flex items-center gap-3" data-testid={`row-hour-${idx}`}>
                  <span className="w-14 text-sm text-muted-foreground">{h.hour}</span>
                  <div className="flex-1">
                    <Progress value={(h.output / 1600) * 100} className="h-4" />
                  </div>
                  <span className="w-16 text-sm font-medium text-right">{h.output.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
