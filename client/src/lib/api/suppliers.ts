// Fetch all suppliers
export async function getSuppliers() {
  const res = await fetch("/api/suppliers");
  if (!res.ok) {
    throw new Error("Failed to fetch suppliers");
  }
  return res.json();
}

// Fetch a supplier by ID
export async function getSupplierById(id: string | number) {
  const res = await fetch(`/api/suppliers/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch supplier");
  }
  return res.json();
}

// Upsert (create or update) a supplier
export async function upsertSupplier(data: any) {
  const res = await fetch("/api/suppliers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let payload: any = null;

    try {
      payload = await res.json();
    } catch {
      // ignore JSON parse errors
    }

    const error: any = new Error(
      payload?.message || "Failed to upsert supplier",
    );

    error.status = res.status;
    error.field = payload?.field;
    error.response = res;

    throw error;
  }

  return res.json();
}
// Delete a supplier by ID
export async function deleteSupplier(id: string | number) {
  const res = await fetch(`/api/suppliers/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    let payload: any = null;

    try {
      payload = await res.json();
    } catch {
      // ignore JSON parse errors
    }

    const error: any = new Error(
      payload?.message || "Failed to delete supplier",
    );

    error.status = res.status;
    error.response = res;

    throw error;
  }

  // backend likely returns 204 No Content
  return true;
}
