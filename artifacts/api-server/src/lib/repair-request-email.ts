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
  customerType?: "Guest" | "Registered";
  notificationType?: "repair-request" | "booking";
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendEmail(payload: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!isValidEmail(payload.to)) {
    throw new Error("Email delivery recipient is invalid");
  }

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
  const businessEmail =
    process.env.OWNER_EMAIL?.trim().toLowerCase() ||
    process.env.BUSINESS_EMAIL?.trim().toLowerCase();
  const from = process.env.EMAIL_FROM;

  if (!businessEmail || !from) {
    throw new Error("Email delivery is not configured");
  }
  if (!isValidEmail(businessEmail) || !isValidEmail(data.email)) {
    throw new Error("Email delivery recipient is invalid");
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
  const additionalNotes = data.additionalNotes?.trim() || "None provided";
  const customerType = data.customerType ?? "Guest";
  const isBooking = data.notificationType === "booking";

  const businessText = isBooking
    ? [
        "New repair booking requires review.",
        `Booking/request ID: ${data.requestId}`,
        `Customer name: ${data.customerName}`,
        `Customer email: ${data.email}`,
        `Customer phone: ${data.phone}`,
        `Customer type: ${customerType}`,
        `Appliance/service type: ${data.applianceType}`,
        `Problem description: ${data.problemDescription}`,
        `Preferred appointment date: ${data.preferredDate ?? "Not specified"}`,
        `Preferred appointment time: ${data.preferredTime ?? "Not specified"}`,
        `Full service address: ${data.address}`,
        `Additional notes: ${additionalNotes}`,
        `Booking submitted: ${submittedAt}`,
      ].join("\n")
    : [
        `New repair request: ${data.requestId}`,
        `Customer: ${data.customerName}`,
        `Phone: ${data.phone}`,
        `Email: ${data.email}`,
        `Customer type: ${customerType}`,
        `Appliance: ${data.applianceType}`,
        `Problem: ${data.problemDescription}`,
        `Address: ${data.address}`,
        `Preferred schedule: ${preferredSchedule}`,
        `Additional notes: ${additionalNotes}`,
        `Submitted: ${submittedAt}`,
      ].join("\n");

  const customerText = isBooking
    ? [
        `Hi ${data.customerName},`,
        "",
        "Thank you for submitting your repair booking request. We have received your request successfully.",
        "",
        `Booking/request ID: ${data.requestId}`,
        `Appliance or service type: ${data.applianceType}`,
        `Problem description: ${data.problemDescription}`,
        `Preferred appointment date: ${data.preferredDate ?? "Not specified"}`,
        `Preferred appointment time: ${data.preferredTime ?? "Not specified"}`,
        `Service address: ${data.address}`,
        `Additional notes: ${additionalNotes}`,
        "Current status: Pending",
        "",
        "Our team will review your details and contact you soon to confirm the appointment.",
        "",
        "Thank you,",
        "RZ Home Appliances Care",
      ].join("\n")
    : [
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

  const businessHtml = isBooking
    ? `
        <h2>New Repair Booking Received – ${escapeHtml(data.requestId)}</h2>
        <p><strong>This new booking requires review.</strong></p>
        <p><strong>Booking/request ID:</strong> ${escapeHtml(data.requestId)}</p>
        <p><strong>Customer name:</strong> ${escapeHtml(data.customerName)}</p>
        <p><strong>Customer email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Customer phone:</strong> ${escapeHtml(data.phone)}</p>
        <p><strong>Customer type:</strong> ${escapeHtml(customerType)}</p>
        <p><strong>Appliance/service type:</strong> ${escapeHtml(data.applianceType)}</p>
        <p><strong>Problem description:</strong><br>${escapeHtml(data.problemDescription).replace(/\n/g, "<br>")}</p>
        <p><strong>Preferred appointment date:</strong> ${escapeHtml(data.preferredDate ?? "Not specified")}</p>
        <p><strong>Preferred appointment time:</strong> ${escapeHtml(data.preferredTime ?? "Not specified")}</p>
        <p><strong>Full service address:</strong><br>${escapeHtml(data.address).replace(/\n/g, "<br>")}</p>
        <p><strong>Additional notes:</strong><br>${escapeHtml(additionalNotes).replace(/\n/g, "<br>")}</p>
        <p><strong>Booking submitted:</strong> ${escapeHtml(submittedAt)}</p>
      `
    : `
        <h2>New Repair Request - ${escapeHtml(data.requestId)}</h2>
        <p><strong>Customer:</strong> ${escapeHtml(data.customerName)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Customer type:</strong> ${escapeHtml(customerType)}</p>
        <p><strong>Appliance:</strong> ${escapeHtml(data.applianceType)}</p>
        <p><strong>Problem:</strong><br>${escapeHtml(data.problemDescription).replace(/\n/g, "<br>")}</p>
        <p><strong>Address:</strong><br>${escapeHtml(data.address).replace(/\n/g, "<br>")}</p>
        <p><strong>Preferred schedule:</strong> ${escapeHtml(preferredSchedule)}</p>
        <p><strong>Additional notes:</strong><br>${escapeHtml(additionalNotes).replace(/\n/g, "<br>")}</p>
        <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>
      `;

  const customerHtml = isBooking
    ? `
        <h2>Repair Booking Received – Confirmation</h2>
        <p>Hi ${escapeHtml(data.customerName)},</p>
        <p>Thank you for submitting your repair booking request. We have received your request successfully.</p>
        <p><strong>Booking/request ID:</strong> ${escapeHtml(data.requestId)}</p>
        <p><strong>Appliance or service type:</strong> ${escapeHtml(data.applianceType)}</p>
        <p><strong>Problem description:</strong><br>${escapeHtml(data.problemDescription).replace(/\n/g, "<br>")}</p>
        <p><strong>Preferred appointment date:</strong> ${escapeHtml(data.preferredDate ?? "Not specified")}</p>
        <p><strong>Preferred appointment time:</strong> ${escapeHtml(data.preferredTime ?? "Not specified")}</p>
        <p><strong>Service address:</strong><br>${escapeHtml(data.address).replace(/\n/g, "<br>")}</p>
        <p><strong>Additional notes:</strong><br>${escapeHtml(additionalNotes).replace(/\n/g, "<br>")}</p>
        <p><strong>Current status:</strong> Pending</p>
        <p>Our team will review your details and contact you soon to confirm the appointment.</p>
        <p>Thank you,<br>RZ Home Appliances Care</p>
      `
    : `
        <h2>We received your repair request</h2>
        <p>Hello ${escapeHtml(data.customerName)},</p>
        <p>Your request for <strong>${escapeHtml(data.applianceType)}</strong> has been received.</p>
        <p><strong>Request ID:</strong> ${escapeHtml(data.requestId)}</p>
        <p>Our team will contact you shortly. This acknowledgement does not confirm an appointment.</p>
        <p>Phone: +91 80738 48334<br>Email: ${escapeHtml(businessEmail)}</p>
      `;

  await Promise.all([
    sendEmail({
      from,
      to: businessEmail,
      subject: isBooking
        ? `New Repair Booking Received – ${data.requestId}`
        : `New Repair Request - ${data.requestId}`,
      text: businessText,
      html: businessHtml,
    }),
    sendEmail({
      from,
      to: data.email,
      subject: isBooking
        ? "Repair Booking Received – Confirmation"
        : `Repair Request Received - ${data.requestId}`,
      text: customerText,
      html: customerHtml,
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