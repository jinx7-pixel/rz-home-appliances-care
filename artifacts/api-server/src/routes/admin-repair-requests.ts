import { Router, type Request, type Response } from "express";
import {
  GetAdminRepairRequestsResponseItem,
  GetAdminRepairRequestsQueryParams,
  UpdateAdminRepairRequestBody,
} from "@workspace/api-zod";
import {
  adminUsersTable,
  db,
  repairRequestsTable,
} from "@workspace/db";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { getAuthenticatedAdmin } from "../lib/admin-auth";
import { sendRepairStatusEmail } from "../lib/repair-request-email";

const router = Router();

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function normalizeStatus(status: string): string {
  return status === "in-progress" ? "in_progress" : status;
}

function serializeRepairRequest(request: typeof repairRequestsTable.$inferSelect) {
  return GetAdminRepairRequestsResponseItem.parse({
    requestId: request.requestId,
    customerName: request.customerName,
    email: request.email,
    phone: request.phone,
    applianceType: request.applianceType,
    problemDescription: request.problemDescription,
    address: request.address,
    customerId: request.customerId,
    customerType: request.customerId ? "registered" : "guest",
    preferredDate: request.preferredDate,
    preferredTime: request.preferredTime,
    status: normalizeStatus(request.status),
    adminNotes: request.adminNotes,
    cancellationReason: request.cancellationReason,
    emailStatus: request.emailStatus,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  });
}

async function requireAdmin(
  request: Request,
  response: Response,
) {
  const admin = await getAuthenticatedAdmin(request, response);
  if (!admin) {
    response.status(403).json({ error: "Administrator access is required." });
    return null;
  }
  return admin;
}

router.get("/repair-requests", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;

  const parsed = GetAdminRepairRequestsQueryParams.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({
      error: "Invalid repair request filters.",
    });
  }

  const { search, status, customerType, sort } = parsed.data;
  const filters: SQL[] = [];

  if (search?.trim()) {
    const pattern = `%${escapeLikePattern(search.trim())}%`;
    filters.push(
      or(
        ilike(repairRequestsTable.requestId, pattern),
        ilike(repairRequestsTable.customerName, pattern),
        ilike(repairRequestsTable.email, pattern),
        ilike(repairRequestsTable.phone, pattern),
      )!,
    );
  }

  if (status) {
    filters.push(eq(repairRequestsTable.status, status));
  }

  if (customerType === "guest") {
    filters.push(isNull(repairRequestsTable.customerId));
  } else if (customerType === "registered") {
    filters.push(isNotNull(repairRequestsTable.customerId));
  }

  const requests = await db
    .select()
    .from(repairRequestsTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      sort === "oldest"
        ? asc(repairRequestsTable.createdAt)
        : desc(repairRequestsTable.createdAt),
    );

  return response.json(requests.map(serializeRepairRequest));
});

router.get("/repair-requests/:requestId", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;

  const [repairRequest] = await db
    .select()
    .from(repairRequestsTable)
    .where(eq(repairRequestsTable.requestId, request.params.requestId))
    .limit(1);

  if (!repairRequest) {
    return response.status(404).json({ error: "Repair request not found." });
  }

  return response.json(serializeRepairRequest(repairRequest));
});

router.patch("/repair-requests/:requestId", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;

  const parsed = UpdateAdminRepairRequestBody.safeParse(request.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return response.status(400).json({
      error: "Choose a valid status or enter internal notes.",
    });
  }

  const values: {
    status?: string;
    adminNotes?: string | null;
    cancellationReason?: string | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (parsed.data.status) {
    values.status = parsed.data.status;
  }
  if (Object.prototype.hasOwnProperty.call(parsed.data, "adminNotes")) {
    values.adminNotes = parsed.data.adminNotes?.trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(parsed.data, "cancellationReason")) {
    values.cancellationReason = parsed.data.cancellationReason?.trim() || null;
  }

  const [existingRequest] = await db
    .select()
    .from(repairRequestsTable)
    .where(eq(repairRequestsTable.requestId, request.params.requestId))
    .limit(1);

  if (!existingRequest) {
    return response.status(404).json({ error: "Repair request not found." });
  }

  const requestedStatus = parsed.data.status;
  const statusChanged =
    requestedStatus !== undefined &&
    normalizeStatus(existingRequest.status) !== requestedStatus;

  const [updatedRequest] = await db
    .update(repairRequestsTable)
    .set(values)
    .where(
      statusChanged
        ? and(
            eq(repairRequestsTable.requestId, request.params.requestId),
            ne(repairRequestsTable.status, requestedStatus!),
          )
        : eq(repairRequestsTable.requestId, request.params.requestId),
    )
    .returning();

  if (!updatedRequest) {
    const [currentRequest] = await db
      .select()
      .from(repairRequestsTable)
      .where(eq(repairRequestsTable.requestId, request.params.requestId))
      .limit(1);

    if (!currentRequest) {
      return response.status(404).json({ error: "Repair request not found." });
    }

    return response.json(serializeRepairRequest(currentRequest));
  }

  if (
    statusChanged &&
    (requestedStatus === "in_progress" ||
      requestedStatus === "completed" ||
      requestedStatus === "cancelled")
  ) {
    try {
      await sendRepairStatusEmail({
        requestId: updatedRequest.requestId,
        customerName: updatedRequest.customerName,
        email: updatedRequest.email,
        applianceType: updatedRequest.applianceType,
        status: requestedStatus,
        cancellationReason: updatedRequest.cancellationReason,
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
          requestId: updatedRequest.requestId,
          status: requestedStatus,
        },
        "Failed to send repair status-change email",
      );
    }
  }

  return response.json(serializeRepairRequest(updatedRequest));
});

export default router;