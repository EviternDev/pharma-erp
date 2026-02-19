import { describe, it, expect } from "vitest";
import { allocateFEFO, filterNonExpired } from "../fefo";

describe("allocateFEFO", () => {
  it("allocates from a single batch with enough stock", () => {
    const batches = [
      { id: 1, batchNumber: "BN001", quantity: 100, expiryDate: "2027-06-01" },
    ];
    const result = allocateFEFO(batches, 10);
    expect(result).toEqual([
      { batchId: 1, batchNumber: "BN001", quantity: 10, expiryDate: "2027-06-01" },
    ]);
  });

  it("picks earliest expiry first when multiple batches available", () => {
    const batches = [
      { id: 1, batchNumber: "BN001", quantity: 50, expiryDate: "2026-03-01" },
      { id: 2, batchNumber: "BN002", quantity: 50, expiryDate: "2027-06-01" },
      { id: 3, batchNumber: "BN003", quantity: 50, expiryDate: "2028-01-01" },
    ];
    const result = allocateFEFO(batches, 30);
    expect(result).toEqual([
      { batchId: 1, batchNumber: "BN001", quantity: 30, expiryDate: "2026-03-01" },
    ]);
  });

  it("splits across batches when first batch has insufficient stock", () => {
    const batches = [
      { id: 1, batchNumber: "BN001", quantity: 5, expiryDate: "2026-03-01" },
      { id: 2, batchNumber: "BN002", quantity: 20, expiryDate: "2027-06-01" },
    ];
    const result = allocateFEFO(batches, 10);
    expect(result).toEqual([
      { batchId: 1, batchNumber: "BN001", quantity: 5, expiryDate: "2026-03-01" },
      { batchId: 2, batchNumber: "BN002", quantity: 5, expiryDate: "2027-06-01" },
    ]);
  });

  it("skips batches with zero quantity", () => {
    const batches = [
      { id: 1, batchNumber: "BN001", quantity: 0, expiryDate: "2026-03-01" },
      { id: 2, batchNumber: "BN002", quantity: 10, expiryDate: "2027-06-01" },
    ];
    const result = allocateFEFO(batches, 5);
    expect(result).toEqual([
      { batchId: 2, batchNumber: "BN002", quantity: 5, expiryDate: "2027-06-01" },
    ]);
  });

  it("throws when total stock is insufficient", () => {
    const batches = [
      { id: 1, batchNumber: "BN001", quantity: 3, expiryDate: "2026-03-01" },
      { id: 2, batchNumber: "BN002", quantity: 2, expiryDate: "2027-06-01" },
    ];
    expect(() => allocateFEFO(batches, 10)).toThrow(
      "Insufficient stock: requested 10, available 5"
    );
  });

  it("throws when requested quantity is zero or negative", () => {
    const batches = [
      { id: 1, batchNumber: "BN001", quantity: 50, expiryDate: "2027-06-01" },
    ];
    expect(() => allocateFEFO(batches, 0)).toThrow(
      "Requested quantity must be greater than 0"
    );
    expect(() => allocateFEFO(batches, -5)).toThrow(
      "Requested quantity must be greater than 0"
    );
  });

  it("takes exactly the full batch when requested equals available", () => {
    const batches = [
      { id: 1, batchNumber: "BN001", quantity: 25, expiryDate: "2026-12-31" },
    ];
    const result = allocateFEFO(batches, 25);
    expect(result).toEqual([
      { batchId: 1, batchNumber: "BN001", quantity: 25, expiryDate: "2026-12-31" },
    ]);
  });

  it("allocates across all batches when all are needed", () => {
    const batches = [
      { id: 1, batchNumber: "BN001", quantity: 3, expiryDate: "2026-01-01" },
      { id: 2, batchNumber: "BN002", quantity: 4, expiryDate: "2026-06-01" },
      { id: 3, batchNumber: "BN003", quantity: 3, expiryDate: "2027-01-01" },
    ];
    const result = allocateFEFO(batches, 10);
    expect(result).toEqual([
      { batchId: 1, batchNumber: "BN001", quantity: 3, expiryDate: "2026-01-01" },
      { batchId: 2, batchNumber: "BN002", quantity: 4, expiryDate: "2026-06-01" },
      { batchId: 3, batchNumber: "BN003", quantity: 3, expiryDate: "2027-01-01" },
    ]);
  });
});

describe("filterNonExpired", () => {
  it("filters out batches with past expiry dates", () => {
    const batches = [
      { expiryDate: "2020-01-01" },
      { expiryDate: "2099-12-31" },
    ];
    const result = filterNonExpired(batches);
    expect(result).toHaveLength(1);
    expect(result[0].expiryDate).toBe("2099-12-31");
  });

  it("returns all batches when none are expired", () => {
    const batches = [
      { expiryDate: "2099-01-01" },
      { expiryDate: "2099-06-01" },
    ];
    const result = filterNonExpired(batches);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when all are expired", () => {
    const batches = [
      { expiryDate: "2020-01-01" },
      { expiryDate: "2021-06-01" },
    ];
    const result = filterNonExpired(batches);
    expect(result).toHaveLength(0);
  });
});
