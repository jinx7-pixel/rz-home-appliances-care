import nodemailer, { type Transporter } from "nodemailer";

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
  additionalNotes?: string | null;
  submittedAt: Date;
};

let transporter: Transporter | null = null;

function getSmtpTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE === "true";
  const requireTLS = process.env.SMTP_REQUIRE_TLS === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;

  if (
    !host ||
    !Number.isInteger(port) ||
    port <= 0 ||
    !user ||
    !pass ||
    port !== 587 ||
    secure ||
    !requireTLS
  ) {
    throw new Error("Gmail SMTP delivery is not configured for STARTTLS");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: { user, pass: pass.replace(/\s/g, "") },
    tls: {
      minVersion: "TLSv1.2",
    },
  });

  return transporter;
}

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
  const result = await getSmtpTransporter().sendMail(payload);
  if ((result.rejected?.length ?? 0) > 0) {
    throw new Error("Gmail SMTP rejected one or more recipients");
  }
}

export async function verifyRepairEmailTransport(): Promise<void> {
  await getSmtpTransporter().verify();
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
    ...(data.additionalNotes
      ? [`Additional notes: ${data.additionalNotes}`]
      : []),
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
        ${data.additionalNotes ? `<p><strong>Additional notes:</strong><br>${escapeHtml(data.additionalNotes).replace(/\n/g, "<br>")}</p>` : ""}
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

export async function sendPasswordResetEmail(data: {
  email: string;
  fullName: string;
  resetLink: string;
}): Promise<void> {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error("Email delivery is not configured");
  }

  const greetingName = escapeHtml(data.fullName);
  const resetLink = escapeHtml(data.resetLink);
  const text = [
    `Hello ${data.fullName},`,
    "",
    "We received a request to reset your RZ Home Appliances Care password.",
    `Reset your password here: ${data.resetLink}`,
    "",
    "This link expires in 60 minutes and can be used only once.",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");

  await sendEmail({
    from,
    to: data.email,
    subject: "Reset your RZ Home Appliances Care password",
    text,
    html: `
      <h2>Password reset request</h2>
      <p>Hello ${greetingName},</p>
      <p>We received a request to reset your RZ Home Appliances Care password.</p>
      <p><a href="${resetLink}">Reset your password</a></p>
      <p>This link expires in 60 minutes and can be used only once.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });
}