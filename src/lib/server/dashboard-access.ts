import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE_NAME = "dashboard_access";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value) return "/";

  try {
    const base = new URL("https://dashboard.invalid");
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

type Environment = Record<string, string | undefined>;

export type AccessConfig = {
  enabled: boolean;
  code: string;
  sessionSecret: string;
};

type SessionPayload = {
  version: 1;
  issuedAt: number;
  expiresAt: number;
  codeVersion: string;
  nonce: string;
};

export function readAccessConfig(environment: Environment): AccessConfig | null {
  const protectionSetting = environment.DASHBOARD_ACCESS_PROTECTION;
  if (protectionSetting === undefined || protectionSetting === "false") {
    return {
      enabled: false,
      code: "",
      sessionSecret: "",
    };
  }

  if (protectionSetting !== "true") {
    return null;
  }

  const code = environment.DASHBOARD_ACCESS_CODE ?? "";
  const sessionSecret = environment.DASHBOARD_SESSION_SECRET ?? "";

  if (code.length < 8 || Buffer.byteLength(sessionSecret) < 32) {
    return null;
  }

  return {
    enabled: true,
    code,
    sessionSecret,
  };
}

function digest(value: string): Buffer {
  return createHmac("sha256", "dashboard-access-comparison").update(value).digest();
}

export function matchesAccessCode(submitted: string, expected: string): boolean {
  return timingSafeEqual(digest(submitted), digest(expected));
}

function codeVersion(code: string, sessionSecret: string): string {
  return createHmac("sha256", sessionSecret).update(`code-version:${code}`).digest("base64url");
}

function sign(payload: string, sessionSecret: string): Buffer {
  return createHmac("sha256", sessionSecret).update(`session:${payload}`).digest();
}

export function createSessionToken(
  config: AccessConfig,
  nowInSeconds = Math.floor(Date.now() / 1000)
): string {
  const payload: SessionPayload = {
    version: 1,
    issuedAt: nowInSeconds,
    expiresAt: nowInSeconds + SESSION_TTL_SECONDS,
    codeVersion: codeVersion(config.code, config.sessionSecret),
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload, config.sessionSecret).toString("base64url");
  return `${encodedPayload}.${signature}`;
}

export function isSessionTokenValid(
  token: string | undefined,
  config: AccessConfig,
  nowInSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!token || token.length > 2048) return false;

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  try {
    const [encodedPayload, encodedSignature] = parts;
    const submittedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = sign(encodedPayload, config.sessionSecret);
    if (
      submittedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(submittedSignature, expectedSignature)
    ) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<SessionPayload>;
    if (
      payload.version !== 1 ||
      !Number.isInteger(payload.issuedAt) ||
      !Number.isInteger(payload.expiresAt) ||
      typeof payload.codeVersion !== "string" ||
      typeof payload.nonce !== "string" ||
      payload.issuedAt! > nowInSeconds + 60 ||
      payload.expiresAt! <= nowInSeconds ||
      payload.expiresAt! - payload.issuedAt! !== SESSION_TTL_SECONDS
    ) {
      return false;
    }

    const expectedCodeVersion = Buffer.from(codeVersion(config.code, config.sessionSecret), "utf8");
    const submittedCodeVersion = Buffer.from(payload.codeVersion, "utf8");
    return (
      submittedCodeVersion.length === expectedCodeVersion.length &&
      timingSafeEqual(submittedCodeVersion, expectedCodeVersion)
    );
  } catch {
    return false;
  }
}
