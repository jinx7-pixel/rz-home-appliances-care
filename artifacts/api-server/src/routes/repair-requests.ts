import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { CreateRepairRequestBody, CreateRepairRequestResponse } from "@workspace/api-zod";
import { db, repairRequestsTable } from "@workspace/db";
import { getAuthenticatedCustomer } from "../lib/auth-session";
import { sendRepairRequestEmails } from "../lib/repair-request-email";

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
  const authenticatedCustomer = await getAuthenticatedCustomer(req, res);
  const preferredDate = input.preferredDate
    ? input.preferredDate.toISOString().slice(0, 10)
    : null;
  const preferredTime = input.preferredTime?.trim() || null;

  let savedRequest: typeof repairRequestsTable.$inferSelect | undefined;
  try {
    [savedRequest] = await db
      .insert(repairRequestsTable)
      .values({
        requestId,
        customerName,
        phone: input.phone,
        email,
        applianceType: input.applianceType,
        problemDescription: input.problemDescription.trim(),
        address: input.address.trim(),
        customerId: authenticatedCustomer?.id ?? null,
        preferredDate,
        preferredTime,
        status: "pending",
        emailStatus: "pending",
        createdAt: submittedAt,
        updatedAt: submittedAt,
      })
      .returning();

    if (!savedRequest) throw new Error("Repair request insert returned no saved row");

    req.log.info({ requestId }, "Saved guest repair request");
  } catch (error) {
    req.log.error({ err: error, requestId }, "Failed to save repair request");
    res.status(500).json({
      error: "We could not save your repair request. Please try again.",
    });
    return;
  }

  let emailStatus: "sent" | "failed" = "sent";
  try {
    await sendRepairRequestEmails({
      requestId: savedRequest.requestId,
      customerName: savedRequest.customerName,
      phone: savedRequest.phone,
      email: savedRequest.email,
      applianceType: savedRequest.applianceType,
      problemDescription: savedRequest.problemDescription,
      address: savedRequest.address,
      preferredDate: savedRequest.preferredDate,
      preferredTime: savedRequest.preferredTime,
      submittedAt: savedRequest.createdAt,
      customerType: authenticatedCustomer
        ? "Registered Customer"
        : "Guest",
      notificationType: "repair-request",
    });
  } catch (error) {
    emailStatus = "failed";
    req.log.error(
      { err: error, requestId: savedRequest.requestId },
      "Failed to send repair request emails",
    );
  }

  await db
    .update(repairRequestsTable)
    .set({ emailStatus, updatedAt: new Date() })
    .where(eq(repairRequestsTable.requestId, savedRequest.requestId))
    .catch((error) => {
      req.log.error(
        { err: error, requestId: savedRequest.requestId, emailStatus },
        "Failed to record repair request email status",
      );
    });

  res.status(201).json(
    CreateRepairRequestResponse.parse({
      success: true,
      requestId,
      message:
        emailStatus === "failed"
          ? "Your request is saved. We couldn't send the confirmation email, so there is no need to submit again."
          : "Your repair request was submitted successfully.",
    }),
  );
});

export default router;