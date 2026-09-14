import { ReplitConnectors } from "@replit/connectors-sdk";

type RepairRequestEmailData = {
  requestId: string;
  customerName: string;
  phone: string;
  email: string;
  applianceType: string;
  problemDescription: string;
  address: string;
  preferredDate: string | null;
  preferredTime: string | null;
  submittedAt: Date;
};

const connectors = new ReplitConnectors();

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

async function sendEmail(payload: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`Resend rejected email delivery with status ${response.status}`);
  }
}

export async function sendRepairRequestEmails(
  data: RepairRequestEmailData,
): Promise<void> {
  const businessEmail = process.env.BUSINESS_EMAIL;
  const from = process.env.EMAIL_FROM;

  if (!businessEmail || !from) {
    throw new Error("Email delivery is not configured");
  }

  const preferredSchedule = [
    data.preferredDate ?? "No preferred date",
    data.preferredTime ?? "No preferred time",
  ].join(" · ");
  const submittedAt = data.submittedAt.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const businessText = [
    `New repair request: ${data.requestId}`,
    `Customer: ${data.customerName}`,
    `Phone: ${data.phone}`,
    `Email: ${data.email}`,
    `Appliance: ${data.applianceType}`,
    `Problem: ${data.problemDescription}`,
    `Address: ${data.address}`,
    `Preferred schedule: ${preferredSchedule}`,
    `Submitted: ${submittedAt}`,
  ].join("\n");

  const customerText = [
    `Hello ${data.customerName},`,
    "",
    `We received your ${data.applianceType} request.`,
    `Request ID: ${data.requestId}`,
    "The RZ Home Appliances Care team will contact you shortly.",
    "This is a request acknowledgement, not a confirmed appointment.",
    "",
    "Phone: +91 80738 48334",
    `Email: ${businessEmail}`,
  ].join("\n");

  await Promise.all([
    sendEmail({
      from,
      to: businessEmail,
      subject: `New Repair Request - ${data.requestId}`,
      text: businessText,
      html: `
        <h2>New Repair Request - ${escapeHtml(data.requestId)}</h2>
        <p><strong>Customer:</strong> ${escapeHtml(data.customerName)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Appliance:</strong> ${escapeHtml(data.applianceType)}</p>
        <p><strong>Problem:</strong><br>${escapeHtml(data.problemDescription).replace(/\n/g, "<br>")}</p>
        <p><strong>Address:</strong><br>${escapeHtml(data.address).replace(/\n/g, "<br>")}</p>
        <p><strong>Preferred schedule:</strong> ${escapeHtml(preferredSchedule)}</p>
        <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>
      `,
    }),
    sendEmail({
      from,
      to: data.email,
      subject: `Repair Request Received - ${data.requestId}`,
      text: customerText,
      html: `
        <h2>We received your repair request</h2>
        <p>Hello ${escapeHtml(data.customerName)},</p>
        <p>Your request for <strong>${escapeHtml(data.applianceType)}</strong> has been received.</p>
        <p><strong>Request ID:</strong> ${escapeHtml(data.requestId)}</p>
        <p>Our team will contact you shortly. This acknowledgement does not confirm an appointment.</p>
        <p>Phone: +91 80738 48334<br>Email: ${escapeHtml(businessEmail)}</p>
      `,
    }),
  ]);
}