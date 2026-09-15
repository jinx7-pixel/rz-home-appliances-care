import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, siteSettingsTable } from "@workspace/db";
import { requireAdmin } from "./admin-repair-requests";

const router = Router();
const WEBSITE_ENABLED_KEY = "website_enabled";

export async function isWebsiteEnabled(): Promise<boolean> {
  const [setting] = await db
    .select({ value: siteSettingsTable.value })
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, WEBSITE_ENABLED_KEY))
    .limit(1);

  return setting?.value ?? true;
}

router.use((_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});

router.get("/site-status", async (_request, response) => {
  try {
    return response.json({ enabled: await isWebsiteEnabled() });
  } catch {
    return response.status(503).json({
      enabled: false,
      error: "Website availability could not be checked.",
    });
  }
});

router.get("/admin/site-status", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;

  return response.json({ enabled: await isWebsiteEnabled() });
});

router.patch("/admin/site-status", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;

  if (typeof request.body?.enabled !== "boolean") {
    return response.status(400).json({
      error: "Website enabled state must be a boolean.",
    });
  }

  const [setting] = await db
    .insert(siteSettingsTable)
    .values({
      key: WEBSITE_ENABLED_KEY,
      value: request.body.enabled,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteSettingsTable.key,
      set: {
        value: request.body.enabled,
        updatedAt: new Date(),
      },
    })
    .returning({ value: siteSettingsTable.value });

  return response.json({ enabled: setting?.value ?? request.body.enabled });
});

export default router;