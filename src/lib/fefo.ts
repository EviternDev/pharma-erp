import type { Batch } from "@/types";

export interface FEFOAllocation {
  batchId: number;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
}

/**
 * FEFO (First Expiry First Out) allocation logic.
 *
 * Given a list of available batches (non-expired, qty > 0, sorted by expiry ASC)
 * and a requested quantity, returns an ordered list of batch allocations
 * starting from the earliest-expiring batch.
 *
 * @param batches - Available batches sorted by expiry date ascending.
 *                  Must already be filtered to exclude expired and zero-qty batches.
 * @param requestedQty - Number of units to allocate.
 * @returns Array of allocations, or throws if insufficient stock.
 */
export function allocateFEFO(
  batches: Pick<Batch, "id" | "batchNumber" | "quantity" | "expiryDate">[],
  requestedQty: number
): FEFOAllocation[] {
  if (requestedQty <= 0) {
    throw new Error("Requested quantity must be greater than 0");
  }

  const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
  if (totalAvailable < requestedQty) {
    throw new Error(
      `Insufficient stock: requested ${requestedQty}, available ${totalAvailable}`
    );
  }

  const allocations: FEFOAllocation[] = [];
  let remaining = requestedQty;

  for (const batch of batches) {
    if (remaining <= 0) break;
    if (batch.quantity <= 0) continue;

    const take = Math.min(batch.quantity, remaining);
    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: take,
      expiryDate: batch.expiryDate,
    });
    remaining -= take;
  }

  return allocations;
}

/**
 * Filter out expired batches from a list.
 * A batch is expired if its expiryDate <= today.
 */
export function filterNonExpired(
  batches: Pick<Batch, "expiryDate">[]
): typeof batches {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  return batches.filter((b) => b.expiryDate > todayStr);
}
