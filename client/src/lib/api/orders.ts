// Create Order API
export async function createOrder(data: any) {
  const res = await fetch("/api/orders", {
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
      // ignore
    }

    const error: any = new Error(payload?.message || "Failed to create order");
    error.status = res.status;
    error.field = payload?.field;
    throw error;
  }

  return res.json();
}

// Update order status
export async function updateOrderStatus(orderNumber: string, status: string) {
  const res = await fetch(`/api/orders/${orderNumber}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    let payload: any = null;

    try {
      payload = await res.json();
    } catch {}

    const error: any = new Error(
      payload?.message || "Failed to update order status",
    );

    error.status = res.status;
    throw error;
  }

  return res.json();
}
