// Deterministic guardrail for the tracked Replit configuration file.
//
// Replit's shared environment tool writes values into the tracked `.replit`
// `[userenv.shared]` section rather than into a separate private store, so any
// value saved there becomes part of the public repository history. This check
// fails the build if the tracked file ever carries a shared environment section
// or any secret-bearing entry.
//
// The check is offline and deterministic: it only parses text. It never reads
// environment variables, credentials or the network, and it never repairs the
// file automatically. A violation requires a human decision.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SECTION_HEADER = /^\s*\[([^\]]*)\]/;
const ASSIGNMENT = /^\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/;

// Whole-token names that always indicate a secret-bearing entry.
const SECRET_TOKENS = new Set([
  "PASSWORD",
  "PASSWD",
  "SECRET",
  "TOKEN",
  "CREDENTIAL",
  "CREDENTIALS",
  "PRIVATEKEY",
  "APIKEY",
  "ACCESSKEY",
  "KEYSTORE",
  "KEYCHAIN",
]);

// A bare "KEY" is only treated as secret-bearing when it is qualified.
const KEY_QUALIFIERS = new Set([
  "API",
  "ACCESS",
  "PRIVATE",
  "SECRET",
  "ENCRYPTION",
  "SIGNING",
  "SSH",
  "REGISTRY",
  "CLIENT",
]);

// High-confidence secret value shapes. Deliberately narrow: these never match
// ordinary configuration values, so the check cannot fail on normal content.
const SECRET_VALUE_PATTERNS = [
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "AWS access key id", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "JSON web token", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { name: "provider API key", pattern: /\bsk-[A-Za-z0-9]{32,}\b/ },
];

function tokenizeKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toUpperCase());
}

export function isSecretBearingKey(key) {
  const tokens = tokenizeKey(key);
  if (tokens.some((token) => SECRET_TOKENS.has(token))) return true;
  return tokens.some(
    (token, index) =>
      token === "KEY" &&
      (index === 0 || KEY_QUALIFIERS.has(tokens[index - 1])),
  );
}

export function isUserenvSection(name) {
  const normalized = name.trim().toLowerCase();
  return normalized === "userenv" || normalized.startsWith("userenv.");
}

// Evaluate one configuration text. Returns the ordered list of violations;
// an empty list means the file is acceptable.
export function evaluateReplitConfig(contents) {
  const violations = [];

  String(contents)
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const lineNumber = index + 1;
      // Strip a trailing comment so an inline note cannot mask a real entry.
      const line = raw.replace(/\s+#.*$/, "");

      const section = SECTION_HEADER.exec(line);
      if (section) {
        const name = section[1].trim();
        if (isUserenvSection(name)) {
          violations.push(
            `line ${lineNumber}: [${name}] is not allowed in the tracked .replit file; shared environment values belong in Replit Secrets, not in Git`,
          );
        }
        return;
      }

      const assignment = ASSIGNMENT.exec(line);
      if (!assignment) return;

      const key = assignment[1];
      const value = assignment[2];

      if (isSecretBearingKey(key)) {
        violations.push(
          `line ${lineNumber}: secret-bearing key "${key}" is not allowed in the tracked .replit file`,
        );
      }

      for (const { name, pattern } of SECRET_VALUE_PATTERNS) {
        if (pattern.test(value)) {
          violations.push(
            `line ${lineNumber}: value of "${key}" matches a ${name} pattern; remove it from the tracked .replit file`,
          );
        }
      }
    });

  return { violations };
}

export async function checkReplitFile(path) {
  const contents = await readFile(path, "utf8");
  return { path, ...evaluateReplitConfig(contents) };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const target = process.argv[2]
    ? resolve(process.argv[2])
    : fileURLToPath(new URL("../../.replit", import.meta.url));

  let result;
  try {
    result = await checkReplitFile(target);
  } catch (error) {
    console.error(
      `Replit configuration check could not read ${target}: ${error.code ?? error.message}`,
    );
    process.exitCode = 1;
  }

  if (result) {
    if (result.violations.length) {
      for (const violation of result.violations) {
        console.error(`Replit configuration violation in ${target}: ${violation}`);
      }
      console.error(
        "The tracked .replit file must not contain shared environment sections or secret-bearing entries.",
      );
      process.exitCode = 1;
    } else {
      console.log(
        `Replit configuration verified: no shared environment sections or secret-bearing entries in ${target}.`,
      );
    }
  }
}
