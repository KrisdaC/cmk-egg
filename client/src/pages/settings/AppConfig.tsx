import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, Globe, Shield, Plus, Edit, Trash2, Factory, CheckCircle2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const roles = [
  { name: "Admin", permissions: "Full access", users: 1 },
  { name: "Manager", permissions: "View all, Edit own department", users: 3 },
  { name: "Supervisor", permissions: "View and edit production", users: 5 },
  { name: "Operator", permissions: "Record transactions", users: 12 },
  { name: "Driver", permissions: "View deliveries only", users: 8 },
];

interface SystemSetting {
  id: number;
  key: string;
  value: string | null;
  label: string | null;
  description: string | null;
  valueType: string | null;
  updatedAt: string | null;
}

export default function AppConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">App Configuration</h1>
        <p className="text-muted-foreground">System settings and user management</p>
      </div>

      <Tabs defaultValue="operations" className="w-full">
        <TabsList>
          <TabsTrigger value="operations" data-testid="tab-operations">
            <Factory className="w-4 h-4 mr-2" />
            Operations
          </TabsTrigger>
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

        <TabsContent value="operations" className="mt-4">
          <OperationsSettings />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
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

// =============================================
// USERS TAB
// =============================================

interface AppUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
}

function UsersTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");

  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, lastName, email }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
        if (password) {
          const r2 = await fetch(`/api/users/${editingUser.id}/password`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          if (!r2.ok) { const e = await r2.json(); throw new Error(e.message); }
        }
        return res.json();
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, lastName, email, password }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
        return res.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      closeDialog();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteUserId(null);
    },
  });

  const openAdd = () => {
    setEditingUser(null);
    setFirstName(""); setLastName(""); setEmail(""); setPassword(""); setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    setFirstName(u.firstName ?? ""); setLastName(u.lastName ?? ""); setEmail(u.email);
    setPassword(""); setFormError("");
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingUser(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!email) { setFormError("กรุณากรอกอีเมล"); return; }
    if (!editingUser && !password) { setFormError("กรุณากรอกรหัสผ่าน"); return; }
    saveMutation.mutate();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">จัดการผู้ใช้งาน</CardTitle>
            <CardDescription>บัญชีผู้ใช้งานระบบทั้งหมด</CardDescription>
          </div>
          <Button onClick={openAdd} data-testid="button-add-user">
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มผู้ใช้งาน
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>อีเมล</TableHead>
                  <TableHead>สร้างเมื่อ</TableHead>
                  <TableHead className="w-[80px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                    <TableCell className="font-medium">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("th-TH") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteUserId(u.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">ยังไม่มีผู้ใช้งาน</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งานใหม่"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "แก้ไขข้อมูลผู้ใช้งาน" : "สร้างบัญชีผู้ใช้งานสำหรับเข้าสู่ระบบ"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>ชื่อ</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="สมชาย" />
              </div>
              <div className="space-y-1.5">
                <Label>นามสกุล</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="ใจดี" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>อีเมล *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>{editingUser ? "รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "รหัสผ่าน *"}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>ยกเลิก</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingUser ? "บันทึก" : "สร้างบัญชี"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteUserId !== null} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบผู้ใช้งาน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งานนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// =============================================
// OPERATIONS SETTINGS TAB
// =============================================

const OPERATION_KEYS = [
  {
    key: "trays_per_m3",
    label: "จำนวนถาด / m³",
    description: "จำนวนถาดที่บรรจุในพื้นที่ 1 ลูกบาศก์เมตร ใช้คำนวณพื้นที่จัดเก็บและโลจิสติกส์",
    unit: "ถาด",
    valueType: "integer",
  },
  {
    key: "num_rounds",
    label: "จำนวนรอบการผลิต",
    description: "จำนวนรอบการผลิตต่อวัน ใช้สำหรับวางแผนการผลิตและจัดสรรทรัพยากร",
    unit: "รอบ / วัน",
    valueType: "integer",
  },
] as const;

function OperationsSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const rows: SystemSetting[] = await res.json();
        const map: Record<string, string> = {};
        rows.forEach((r) => { map[r.key] = r.value ?? ""; });
        setSettings(map);
        setDrafts(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (key: string) => {
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      await fetch(`/api/settings/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: drafts[key] }),
      });
      setSettings((p) => ({ ...p, [key]: drafts[key] }));
      setSaved((p) => ({ ...p, [key]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2000);
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const isDirty = (key: string) => drafts[key] !== settings[key];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">กำลังโหลด…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">การตั้งค่าการผลิต</CardTitle>
          <CardDescription>
            ค่าคงที่ที่ใช้ในการคำนวณการผลิต โลจิสติกส์ และการวางแผน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {OPERATION_KEYS.map(({ key, label, description, unit }) => (
              <div key={key} className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={drafts[key] ?? ""}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [key]: e.target.value }))
                      }
                      className="w-28 text-right tabular-nums pr-1"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 shrink-0">{unit}</span>
                  <Button
                    size="sm"
                    variant={saved[key] ? "outline" : "default"}
                    disabled={saving[key] || !isDirty(key)}
                    onClick={() => handleSave(key)}
                    className="w-20"
                  >
                    {saving[key] ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : saved[key] ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
                        <span className="text-green-600">Saved</span>
                      </>
                    ) : (
                      "บันทึก"
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
