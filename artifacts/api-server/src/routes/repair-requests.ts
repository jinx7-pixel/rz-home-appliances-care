import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { CreateRepairRequestBody, CreateRepairRequestResponse } from "@workspace/api-zod";
import { db, repairRequestsTable } from "@workspace/db";
import { getAuthenticatedCustomer } from "../lib/auth-session";
import { isRateLimited } from "../lib/rate-limit";
import { sendRepairRequestEmails } from "../lib/repair-request-email";

const router: IRouter = Router();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

function createPublicRequestId(idempotencyKey: string): string {
  const suffix = createHash("sha256")
    .update(idempotencyKey)
    .digest("hex")
    .slice(0, 21);
  return `RZ-${suffix.toUpperCase()}`;
}

function isSameSubmission(
  savedRequest: typeof repairRequestsTable.$inferSelect,
  input: Pick<
    typeof repairRequestsTable.$inferSelect,
    | "customerName"
    | "phone"
    | "email"
    | "applianceType"
    | "problemDescription"
    | "address"
    | "customerId"
    | "preferredDate"
    | "preferredTime"
  >,
): boolean {
  return (
    savedRequest.customerName === input.customerName &&
    savedRequest.phone === input.phone &&
    savedRequest.email === input.email &&
    savedRequest.applianceType === input.applianceType &&
    savedRequest.problemDescription === input.problemDescription &&
    savedRequest.address === input.address &&
    savedRequest.customerId === input.customerId &&
    savedRequest.preferredDate === input.preferredDate &&
    savedRequest.preferredTime === input.preferredTime
  );
}

function createSubmissionResponse(
  requestId: string,
  emailStatus: string,
) {
  return CreateRepairRequestResponse.parse({
    success: true,
    requestId,
    message:
      emailStatus === "failed"
        ? "Your request is saved. We couldn't send the confirmation email, so there is no need to submit again."
        : "Your repair request was submitted successfully.",
  });
}

router.post("/repair-requests", async (req, res): Promise<void> => {
  const clientKey = req.ip ?? req.socket.remoteAddress ?? "unknown";

  if (
    await isRateLimited({
      scope: "guest-repair-request",
      clientKey,
      maxAttempts: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
  ) {
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

  const idempotencyKey = req.get("Idempotency-Key");
  if (
    idempotencyKey === undefined ||
    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
  ) {
    res.status(400).json({
      error: "A valid request retry key is required.",
    });
    return;
  }

  const input = parsed.data;
  const requestId = createPublicRequestId(idempotencyKey);
  const submittedAt = new Date();
  const customerName = input.customerName.trim();
  const email = input.email.trim().toLowerCase();
  const authenticatedCustomer = await getAuthenticatedCustomer(req, res);
  const preferredDate = input.preferredDate
    ? input.preferredDate.toISOString().slice(0, 10)
    : null;
  const preferredTime = input.preferredTime?.trim() || null;
  const requestValues = {
    customerName,
    phone: input.phone,
    email,
    applianceType: input.applianceType,
    problemDescription: input.problemDescription.trim(),
    address: input.address.trim(),
    customerId: authenticatedCustomer?.id ?? null,
    preferredDate,
    preferredTime,
  };

  let savedRequest: typeof repairRequestsTable.$inferSelect | undefined;
  try {
    const insert = db
      .insert(repairRequestsTable)
      .values({
        requestId,
        ...requestValues,
        status: "pending",
        emailStatus: "pending",
        createdAt: submittedAt,
        updatedAt: submittedAt,
      });

    [savedRequest] = await insert
      .onConflictDoNothing({ target: repairRequestsTable.requestId })
      .returning();

    if (!savedRequest) {
      const [existingRequest] = await db
        .select()
        .from(repairRequestsTable)
        .where(eq(repairRequestsTable.requestId, requestId))
        .limit(1);

      if (!existingRequest) {
        throw new Error("Idempotent repair request conflict had no saved row");
      }

      if (!isSameSubmission(existingRequest, requestValues)) {
        res.status(409).json({
          error: "This retry key was already used for a different request.",
        });
        return;
      }

      req.log.info({ requestId }, "Replayed idempotent repair request");
      res.status(201).json(
        createSubmissionResponse(existingRequest.requestId, existingRequest.emailStatus),
      );
      return;
    }

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
    createSubmissionResponse(requestId, emailStatus),
  );
});

export default router;