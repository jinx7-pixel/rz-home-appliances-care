import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { CreateRepairRequestBody, CreateRepairRequestResponse } from "@workspace/api-zod";
import { db, repairRequestsTable } from "@workspace/db";

const router: IRouter = Router();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestAttempts = new Map<string, number[]>();

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const recentAttempts = (requestAttempts.get(clientKey) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recentAttempts.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestAttempts.set(clientKey, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  requestAttempts.set(clientKey, recentAttempts);
  return false;
}

function createPublicRequestId(): string {
  return `RZ-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

router.post("/repair-requests", async (req, res): Promise<void> => {
  const clientKey = req.ip ?? req.socket.remoteAddress ?? "unknown";

  if (isRateLimited(clientKey)) {
    res.status(429).json({
      error: "Too many repair requests. Please wait a few minutes and try again.",
    });
    return;
  }

  const parsed = CreateRepairRequestBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { validationIssueCount: parsed.error.issues.length },
      "Rejected invalid repair request",
    );
    res.status(400).json({
      error: parsed.error.issues.some((issue) => issue.path[0] === "phone")
        ? "Please enter a valid 10-digit phone number."
        : "Please check the form details and try again.",
    });
    return;
  }

  const input = parsed.data;
  const requestId = createPublicRequestId();
  const submittedAt = new Date();
  const customerName = input.customerName.trim();
  const email = input.email.trim().toLowerCase();
  const preferredDate = input.preferredDate
    ? input.preferredDate.toISOString().slice(0, 10)
    : null;
  const preferredTime = input.preferredTime?.trim() || null;

  try {
    const [savedRequest] = await db
      .insert(repairRequestsTable)
      .values({
      requestId,
      customerName,
      phone: input.phone,
      email,
      applianceType: input.applianceType,
      problemDescription: input.problemDescription.trim(),
      address: input.address.trim(),
       customerId: null,
      preferredDate,
      preferredTime,
      status: "pending",
       emailStatus: "not_configured",
      createdAt: submittedAt,
      updatedAt: submittedAt,
      })
      .returning();

    if (!savedRequest) {
      throw new Error("Repair request insert returned no saved row");
    }

    req.log.info({ requestId }, "Saved guest repair request");
  } catch (error) {
    req.log.error({ err: error, requestId }, "Failed to save repair request");
    res.status(500).json({
      error: "We could not save your repair request. Please try again.",
    });
    return;
  }

  res.status(201).json(
    CreateRepairRequestResponse.parse({
      success: true,
      requestId,
      message:
        "Your repair request was submitted successfully.",
    }),
  );
});

export default router;