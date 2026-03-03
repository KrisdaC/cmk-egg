// Fetch all vehicles
export async function getVehicles() {
  const res = await fetch("/api/vehicles");

  if (!res.ok) {
    throw new Error("Failed to fetch vehicles");
  }

  return res.json();
}

// Fetch a vehicle by ID
export async function getVehicleById(id: string | number) {
  const res = await fetch(`/api/vehicles/${id}`);

  if (!res.ok) {
    throw new Error("Failed to fetch vehicle");
  }

  return res.json();
}

// Upsert (create or update) a vehicle
export async function upsertVehicle(data: any) {
  const payload = {
    ...data,
    capacity:
      data.capacity !== undefined && data.capacity !== null
        ? data.capacity.toString()
        : undefined,
    costPerKm:
      data.costPerKm !== undefined && data.costPerKm !== null
        ? data.costPerKm.toString()
        : undefined,
  };
  const res = await fetch("/api/vehicles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let payload: any = null;

    try {
      payload = await res.json();
    } catch {
      // ignore JSON parse errors
    }

    const error: any = new Error(
      payload?.message || "Failed to upsert vehicle",
    );

    error.status = res.status;
    error.field = payload?.field;
    error.response = res;

    throw error;
  }

  return res.json();
}

// Delete a vehicle by ID
export async function deleteVehicle(id: string | number) {
  const res = await fetch(`/api/vehicles/${id}`, {
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
      payload?.message || "Failed to delete vehicle",
    );

    error.status = res.status;
    error.response = res;

    throw error;
  }

  // backend returns 204 No Content
  return true;
}
