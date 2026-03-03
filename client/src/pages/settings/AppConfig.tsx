import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, Globe, Shield, Plus, Edit, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const users = [
  { id: 1, name: "Admin User", email: "admin@egggrade.com", role: "Admin", department: "IT", status: "active" },
  { id: 2, name: "Sales Manager", email: "sales@egggrade.com", role: "Manager", department: "Sales", status: "active" },
  { id: 3, name: "Production Lead", email: "production@egggrade.com", role: "Supervisor", department: "Production", status: "active" },
  { id: 4, name: "Warehouse Staff", email: "warehouse@egggrade.com", role: "Operator", department: "Inventory", status: "active" },
  { id: 5, name: "Driver 1", email: "driver1@egggrade.com", role: "Driver", department: "Logistics", status: "inactive" },
];

const roles = [
  { name: "Admin", permissions: "Full access", users: 1 },
  { name: "Manager", permissions: "View all, Edit own department", users: 3 },
  { name: "Supervisor", permissions: "View and edit production", users: 5 },
  { name: "Operator", permissions: "Record transactions", users: 12 },
  { name: "Driver", permissions: "View deliveries only", users: 8 },
];

export default function AppConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">App Configuration</h1>
        <p className="text-muted-foreground">System settings and user management</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles">
            <Shield className="w-4 h-4 mr-2" />
            Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="general" data-testid="tab-general">
            <Settings className="w-4 h-4 mr-2" />
            General Settings
          </TabsTrigger>
          <TabsTrigger value="language" data-testid="tab-language">
            <Globe className="w-4 h-4 mr-2" />
            Language
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">User Management</CardTitle>
                <CardDescription>Manage user accounts and access</CardDescription>
              </div>
              <Button data-testid="button-add-user">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "secondary" : "outline"} className="capitalize">
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" data-testid={`button-edit-${user.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" data-testid={`button-delete-${user.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Roles & Permissions</CardTitle>
                <CardDescription>Define access levels for different user roles</CardDescription>
              </div>
              <Button variant="outline" data-testid="button-add-role">
                <Plus className="w-4 h-4 mr-2" />
                Add Role
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role, idx) => (
                    <TableRow key={idx} data-testid={`row-role-${idx}`}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{role.permissions}</TableCell>
                      <TableCell className="text-right">{role.users}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" data-testid={`button-edit-role-${idx}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Company Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input defaultValue="EggGrade Pro" data-testid="input-company-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select defaultValue="asia-bangkok">
                      <SelectTrigger data-testid="select-timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asia-bangkok">Asia/Bangkok (GMT+7)</SelectItem>
                        <SelectItem value="asia-singapore">Asia/Singapore (GMT+8)</SelectItem>
                        <SelectItem value="utc">UTC (GMT+0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive email alerts for important events</p>
                  </div>
                  <Switch data-testid="switch-email" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-generate Invoice Numbers</Label>
                    <p className="text-sm text-muted-foreground">Automatically create sequential invoice numbers</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-invoice" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Production Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Shift Start Time</Label>
                    <Input type="time" defaultValue="06:00" data-testid="input-shift-start" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Shift End Time</Label>
                    <Input type="time" defaultValue="18:00" data-testid="input-shift-end" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>FIFO Enforcement</Label>
                    <p className="text-sm text-muted-foreground">Require oldest stock to be picked first</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-fifo" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="language" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Language Settings</CardTitle>
              <CardDescription>Choose your preferred language for the application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Display Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger className="w-[250px]" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="th">Thai</SelectItem>
                    <SelectItem value="zh">Chinese (Simplified)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select defaultValue="yyyy-mm-dd">
                  <SelectTrigger className="w-[250px]" data-testid="select-date-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                    <SelectItem value="dd-mm-yyyy">DD-MM-YYYY</SelectItem>
                    <SelectItem value="mm-dd-yyyy">MM-DD-YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Number Format</Label>
                <Select defaultValue="1000.00">
                  <SelectTrigger className="w-[250px]" data-testid="select-number-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000.00">1,000.00</SelectItem>
                    <SelectItem value="1000,00">1.000,00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="mt-4" data-testid="button-save-language">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
