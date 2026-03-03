// Fetch all drivers
export async function getDrivers() {
  const res = await fetch("/api/drivers");

  if (!res.ok) {
    throw new Error("Failed to fetch drivers");
  }

  return res.json();
}

// Fetch a driver by ID
export async function getDriverById(id: string | number) {
  const res = await fetch(`/api/drivers/${id}`);

  if (!res.ok) {
    throw new Error("Failed to fetch driver");
  }

  return res.json();
}

// Upsert (create or update) a driver
export async function upsertDriver(data: any) {
  const res = await fetch("/api/drivers", {
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

    const error: any = new Error(payload?.message || "Failed to upsert driver");

    error.status = res.status;
    error.field = payload?.field;
    error.response = res;

    throw error;
  }

  return res.json();
}
// Delete a driver by ID
export async function deleteDriver(id: string | number) {
  const res = await fetch(`/api/drivers/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    let payload: any = null;

    try {
      payload = await res.json();
    } catch {
      // ignore JSON parse errors (e.g. 204 No Content)
    }

    const error: any = new Error(payload?.message || "Failed to delete driver");

    error.status = res.status;
    error.response = res;

    throw error;
  }

  // backend returns 204 No Content
  return true;
}
