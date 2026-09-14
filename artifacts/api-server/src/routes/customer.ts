import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, repairRequestsTable } from "@workspace/db";
import { getAuthenticatedCustomer } from "../lib/auth-session";

const router: IRouter = Router();

router.get("/repair-requests", async (request, response) => {
  const customer = await getAuthenticatedCustomer(request, response);
  if (!customer) {
    return response.status(401).json({
      error: "Authentication is required to view repair requests.",
    });
  }

  const requests = await db
    .select({
      requestId: repairRequestsTable.requestId,
      applianceType: repairRequestsTable.applianceType,
      problemDescription: repairRequestsTable.problemDescription,
      preferredDate: repairRequestsTable.preferredDate,
      preferredTime: repairRequestsTable.preferredTime,
      status: repairRequestsTable.status,
      createdAt: repairRequestsTable.createdAt,
    })
    .from(repairRequestsTable)
    .where(eq(repairRequestsTable.customerId, customer.id))
    .orderBy(desc(repairRequestsTable.createdAt));

  return response.json(
    requests.map((request) => ({
      ...request,
      createdAt: request.createdAt.toISOString(),
    })),
  );
});

export default router;