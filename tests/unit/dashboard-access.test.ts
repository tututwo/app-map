import { describe, expect, test } from "vitest";
import {
  createSessionToken,
  isSessionTokenValid,
  readAccessConfig,
  sanitizeNextPath,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from "../../src/lib/server/dashboard-access";

const sessionSecret = "a-test-session-secret-that-is-longer-than-32-characters";

describe("dashboard access sessions", () => {
  test("changing the access code revokes an existing session", () => {
    const original = readAccessConfig({
      DASHBOARD_ACCESS_PROTECTION: "true",
      DASHBOARD_ACCESS_CODE: "original-test-code",
      DASHBOARD_SESSION_SECRET: sessionSecret,
    });
    const rotated = readAccessConfig({
      DASHBOARD_ACCESS_PROTECTION: "true",
      DASHBOARD_ACCESS_CODE: "rotated-test-code",
      DASHBOARD_SESSION_SECRET: sessionSecret,
    });
    expect(original?.enabled).toBe(true);
    expect(rotated?.enabled).toBe(true);

    const token = createSessionToken(original!, 1_800_000_000);

    expect(isSessionTokenValid(token, original!, 1_800_000_001)).toBe(true);
    expect(isSessionTokenValid(token, rotated!, 1_800_000_001)).toBe(false);
  });

  test("deployed session cookies use browser security controls", () => {
    expect(sessionCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  test("post-login navigation stays on this site", () => {
    expect(sanitizeNextPath("/PDF?from=2003&to=2011")).toBe("/PDF?from=2003&to=2011");
    expect(sanitizeNextPath("//attacker.example/path")).toBe("/");
    expect(sanitizeNextPath("/\\attacker.example/path")).toBe("/");
    expect(sanitizeNextPath("https://attacker.example/path")).toBe("/");
  });

  test("protection is opt-in and fails closed when enabled without complete secrets", () => {
    expect(readAccessConfig({})).toEqual({ enabled: false, code: "", sessionSecret: "" });
    expect(readAccessConfig({ DASHBOARD_ACCESS_PROTECTION: "false" })).toEqual({
      enabled: false,
      code: "",
      sessionSecret: "",
    });
    expect(readAccessConfig({ DASHBOARD_ACCESS_PROTECTION: "tru" })).toBeNull();
    expect(
      readAccessConfig({
        DASHBOARD_ACCESS_PROTECTION: "true",
        DASHBOARD_ACCESS_CODE: "complete-code",
      })
    ).toBeNull();
  });

  test("sessions expire after the interview window", () => {
    const config = readAccessConfig({
      DASHBOARD_ACCESS_PROTECTION: "true",
      DASHBOARD_ACCESS_CODE: "original-test-code",
      DASHBOARD_SESSION_SECRET: sessionSecret,
    })!;
    const issuedAt = 1_800_000_000;
    const token = createSessionToken(config, issuedAt);

    expect(isSessionTokenValid(token, config, issuedAt + SESSION_TTL_SECONDS - 1)).toBe(true);
    expect(isSessionTokenValid(token, config, issuedAt + SESSION_TTL_SECONDS)).toBe(false);
  });
});
