import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, RefreshCw, X, Check } from "lucide-react";
import type { SiteGroup, Partner, DeliverySite } from "./_shared";

export function SiteGroupManagerDialog({
  open,
  siteGroups,
  partners,
  defaultPartnerId,
  onClose,
  onRefresh,
}: {
  open: boolean;
  siteGroups: SiteGroup[];
  partners: Partner[];
  defaultPartnerId?: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [createMode, setCreateMode] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SiteGroup | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPartnerId, setNewPartnerId] = useState("");
  const [allSites, setAllSites] = useState<DeliverySite[]>([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSitesForPartner = async (partnerId: string) => {
    if (!partnerId) { setAllSites([]); return; }
    const res = await fetch(`/api/pricing/delivery-sites?partnerId=${partnerId}`);
    if (res.ok) setAllSites(await res.json());
  };

  const openCreate = () => {
    setCreateMode(true);
    setEditingGroup(null);
    const pid = defaultPartnerId?.toString() ?? "";
    setNewName("");
    setNewDescription("");
    setNewPartnerId(pid);
    setSelectedSiteIds([]);
    fetchSitesForPartner(pid);
  };

  const openEdit = async (group: SiteGroup) => {
    setEditingGroup(group);
    setCreateMode(false);
    setNewName(group.name);
    setNewDescription(group.description ?? "");
    setNewPartnerId(group.partner?.id.toString() ?? "");
    await fetchSitesForPartner(group.partner?.id.toString() ?? "");
    const res = await fetch(`/api/pricing/site-groups/${group.id}`);
    if (res.ok) {
      const detail: SiteGroup = await res.json();
      setSelectedSiteIds((detail.members ?? []).map((m) => m.deliverySite?.id ?? 0).filter(Boolean));
    }
  };

  const handleSave = async () => {
    if (!newName || (!createMode && !editingGroup)) return;
    setSaving(true);
    try {
      if (createMode) {
        await fetch("/api/pricing/site-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerId: Number(newPartnerId) || defaultPartnerId,
            name: newName,
            description: newDescription || undefined,
            siteIds: selectedSiteIds,
          }),
        });
      } else if (editingGroup) {
        await fetch(`/api/pricing/site-groups/${editingGroup.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName,
            description: newDescription || undefined,
            siteIds: selectedSiteIds,
          }),
        });
      }
      await onRefresh();
      setCreateMode(false);
      setEditingGroup(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this site group?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/pricing/site-groups/${id}`, { method: "DELETE" });
      await onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSite = (id: number) => {
    setSelectedSiteIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const isFormOpen = createMode || !!editingGroup;

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCreateMode(false);
      setEditingGroup(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            กลุ่มจุดส่ง
            {defaultPartnerId && partners.find(p => p.id === defaultPartnerId) && (
              <span className="text-muted-foreground font-normal text-sm">
                · {partners.find(p => p.id === defaultPartnerId)!.nickname}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!isFormOpen ? (
          <div className="space-y-3 py-2">
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> สร้างกลุ่ม
              </Button>
            </div>
            {siteGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                ยังไม่มีกลุ่มจุดส่ง สร้างกลุ่มเพื่อแบ่งราคาตามสาขา
              </p>
            ) : (
              <div className="divide-y border rounded-md">
                {siteGroups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <div className="font-medium text-sm">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.partner?.nickname} · {g.description || "No description"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(g)}>
                        แก้ไข
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        disabled={deletingId === g.id}
                        onClick={() => handleDelete(g.id)}
                      >
                        {deletingId === g.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => { setCreateMode(false); setEditingGroup(null); }}
              >
                ← Back
              </Button>
              <span className="text-sm font-medium">
                {createMode ? "สร้างกลุ่มจุดส่ง" : `แก้ไข: ${editingGroup?.name}`}
              </span>
            </div>

            {createMode && !defaultPartnerId && (
              <div>
                <Label className="text-sm">
                  Partner <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={newPartnerId}
                  onValueChange={(v) => {
                    setNewPartnerId(v);
                    fetchSitesForPartner(v);
                    setSelectedSiteIds([]);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.nickname} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-sm">
                Group Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
                placeholder="e.g. Makro อีสาน"
              />
            </div>

            <div>
              <Label className="text-sm">Description</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="mt-1"
                placeholder="Optional"
              />
            </div>

            <div>
              <Label className="text-sm mb-1 block">
                Delivery Sites ({selectedSiteIds.length} selected)
              </Label>
              {allSites.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {newPartnerId ? "No delivery sites for this partner." : "Select a partner first."}
                </p>
              ) : (
                <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                  {allSites.map((site) => (
                    <label
                      key={site.id}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSiteIds.includes(site.id)}
                        onChange={() => toggleSite(site.id)}
                        className="rounded"
                      />
                      <div>
                        <div className="text-sm font-medium">{site.displayName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {site.siteCode}
                          {site.province ? ` · ${site.province}` : ""}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => { setCreateMode(false); setEditingGroup(null); }}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !newName || (createMode && !defaultPartnerId && !newPartnerId)}
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Check className="w-4 h-4 mr-1" />
                )}
                บันทึก
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
