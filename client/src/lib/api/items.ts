export async function getItems() {
  const res = await fetch("/api/items");
  if (!res.ok) throw new Error("Failed to fetch items");
  return res.json();
}

export async function getItemById(id: number) {
  const res = await fetch(`/api/items/${id}`);
  if (!res.ok) throw new Error("Failed to fetch item");
  return res.json();
}

export async function upsertItem(payload: any) {
  const res = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error: any = new Error("Failed to save");
    error.response = res;
    throw error;
  }
  return res.json();
}

export async function updateItemPartners(itemId: number, partnerIds: number[]) {
  const res = await fetch(`/api/items/${itemId}/partners`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner_ids: partnerIds }),
  });
  if (!res.ok) throw new Error("Failed to update item partners");
  return res.json();
}

export async function deleteItem(id: number) {
  const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch {}
    const error: any = new Error(payload?.message || "Failed to delete item");
    error.status = res.status;
    throw error;
  }
  return true;
}
