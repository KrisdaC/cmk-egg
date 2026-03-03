export async function upsertFinishedGood(payload: any) {
  const res = await fetch("/api/finished-goods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error: any = new Error("Failed to save");
    error.response = res; // ✅ manually attach response
    throw error;
  }

  return res.json();
}

export async function getFinishedGoodById(id: number) {
  const res = await fetch(`/api/finished-goods/${id}`);

  if (!res.ok) {
    throw new Error("Failed to fetch finished good");
  }

  return res.json();
}

export async function getFinishedGoods() {
  const res = await fetch("/api/finished-goods");

  if (!res.ok) {
    throw new Error("Failed to fetch finished goods");
  }

  return res.json();
}

export async function deleteFinishedGood(id: number) {
  const res = await fetch(`/api/finished-goods/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    let payload: any = null;

    try {
      payload = await res.json();
    } catch {
      // ignore JSON parse errors (e.g. 204 No Content)
    }

    const error: any = new Error(
      payload?.message || "Failed to delete finished good",
    );

    error.status = res.status;
    error.response = res;

    throw error;
  }

  // backend returns 204 No Content
  return true;
}
