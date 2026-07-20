import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimitApiRead, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

// GET /api/admin/security-audit — comprehensive security posture dashboard
// Returns: user 2FA status, recent failed logins, locked accounts, sensitive
// actions, password age, session count, audit log size.
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  } catch (e) { return e as Response; }

  const ip = getClientIp(req);
  const rl = rateLimitApiRead(ip);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // User accounts overview
    const allUsers = await db.systemUser.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        active: true,
        twoFactorEnabled: true,
        lastLogin: true,
        lastPasswordChange: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        passwordResetRequired: true,
      },
    });

    const usersWith2FA = allUsers.filter(u => u.twoFactorEnabled).length;
    const lockedUsers = allUsers.filter(u => u.lockedUntil && u.lockedUntil > now);
    const usersNeedingPasswordReset = allUsers.filter(u => u.passwordResetRequired);
    const inactiveUsers = allUsers.filter(u => !u.active);

    // Password age analysis
    const oldPasswordUsers = allUsers.filter(u => {
      if (!u.lastPasswordChange) return true; // never changed (legacy)
      const ageDays = (now.getTime() - u.lastPasswordChange.getTime()) / (1000 * 60 * 60 * 24);
      return ageDays > 90; // 90+ days since last change
    });

    // Recent login activity (last 24h)
    const recentLogins = await db.auditLog.findMany({
      where: {
        action: "LOGIN",
        timestamp: { gte: last24h },
      },
      orderBy: { timestamp: "desc" },
      take: 20,
      select: { user: true, timestamp: true, ipAddress: true, userAgent: true },
    });

    // Recent failed logins (last 7d)
    const failedLogins = await db.auditLog.findMany({
      where: {
        action: { in: ["LOGIN_FAILED", "LOGIN_BLOCKED"] },
        timestamp: { gte: last7d },
      },
      orderBy: { timestamp: "desc" },
      take: 50,
      select: { user: true, timestamp: true, ipAddress: true, details: true, action: true },
    });

    // Recent critical audit events (last 30d)
    const criticalEvents = await db.auditLog.findMany({
      where: {
        severity: { in: ["critical", "warning"] },
        timestamp: { gte: last30d },
      },
      orderBy: { timestamp: "desc" },
      take: 50,
      select: { user: true, action: true, module: true, details: true, severity: true, timestamp: true, ipAddress: true },
    });

    // Sensitive actions (data wipe, user creation/deletion, permission changes)
    const sensitiveActions = await db.auditLog.findMany({
      where: {
        action: { in: ["WIPE_ALL_DATA", "BACKUP_RESTORE", "CREATE", "UPDATE", "DELETE", "2FA_DISABLED", "CREDIT_SETTLE"] },
        module: { in: ["admin", "auth", "users"] },
        timestamp: { gte: last30d },
      },
      orderBy: { timestamp: "desc" },
      take: 30,
      select: { user: true, action: true, module: true, details: true, timestamp: true, ipAddress: true },
    });

    // Count by event type (last 30d)
    const eventCounts = await db.auditLog.groupBy({
      by: ["action"],
      where: { timestamp: { gte: last30d } },
      _count: { _all: true },
      orderBy: { _count: { action: "desc" } },
      take: 20,
    });

    // Failed login attempts by IP (potential brute force)
    const failedByIp = await db.auditLog.groupBy({
      by: ["ipAddress"],
      where: {
        action: { in: ["LOGIN_FAILED", "LOGIN_BLOCKED"] },
        timestamp: { gte: last7d },
      },
      _count: { _all: true },
      orderBy: { _count: { ipAddress: "desc" } },
      take: 10,
    });

    // Audit log size
    const auditLogTotal = await db.auditLog.count();

    return NextResponse.json({
      generatedAt: now.toISOString(),
      generatedBy: user.username,

      userSecurity: {
        total: allUsers.length,
        with2FA: usersWith2FA,
        without2FA: allUsers.length - usersWith2FA,
        locked: lockedUsers.length,
        needPasswordReset: usersNeedingPasswordReset.length,
        inactive: inactiveUsers.length,
        oldPasswords: oldPasswordUsers.length,
        users: allUsers.map(u => ({
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          active: u.active,
          twoFactorEnabled: u.twoFactorEnabled,
          lastLogin: u.lastLogin?.toISOString() || null,
          lastPasswordChange: u.lastPasswordChange?.toISOString() || null,
          passwordAgeDays: u.lastPasswordChange
            ? Math.floor((now.getTime() - u.lastPasswordChange.getTime()) / (1000 * 60 * 60 * 24))
            : null,
          failedAttempts: u.failedLoginAttempts,
          locked: u.lockedUntil && u.lockedUntil > now,
          lockedUntil: u.lockedUntil?.toISOString() || null,
          needsReset: u.passwordResetRequired,
        })),
      },

      recentActivity: {
        logins24h: recentLogins.length,
        recentLogins,
        failedLogins7d: failedLogins.length,
        failedLogins,
        criticalEvents30d: criticalEvents.length,
        criticalEvents,
        sensitiveActions30d: sensitiveActions.length,
        sensitiveActions,
      },

      auditLogStats: {
        total: auditLogTotal,
        last30d: eventCounts.reduce((s, e) => s + (e._count?._all ?? 0), 0),
        topEvents: eventCounts.map(e => ({ action: e.action, count: e._count?._all ?? 0 })),
      },

      threatIntel: {
        failedLoginByIp: failedByIp.map(g => ({
          ipAddress: g.ipAddress || "unknown",
          attempts: g._count?._all ?? 0,
        })),
      },

      recommendations: generateRecommendations({
        usersWithout2FA: allUsers.length - usersWith2FA,
        lockedUsers: lockedUsers.length,
        oldPasswords: oldPasswordUsers.length,
        failedLogins7d: failedLogins.length,
        inactiveUsers: inactiveUsers.length,
      }),
    });
  } catch (e: any) {
    console.error("GET /api/admin/security-audit error:", e);
    return NextResponse.json({ error: "Failed to generate security audit", detail: e?.message }, { status: 500 });
  }
}

function generateRecommendations(s: {
  usersWithout2FA: number;
  lockedUsers: number;
  oldPasswords: number;
  failedLogins7d: number;
  inactiveUsers: number;
}): Array<{ severity: "critical" | "warning" | "info"; title: string; description: string }> {
  const recs: Array<{ severity: "critical" | "warning" | "info"; title: string; description: string }> = [];

  if (s.lockedUsers > 0) {
    recs.push({
      severity: "critical",
      title: `${s.lockedUsers} account(s) currently locked`,
      description: "Investigate immediately — these accounts may be under brute-force attack. Review failed login details below.",
    });
  }
  if (s.failedLogins7d > 20) {
    recs.push({
      severity: "warning",
      title: `High failed login volume (${s.failedLogins7d} in 7 days)`,
      description: "Consider tightening rate limits or blocking offending IPs at the firewall level.",
    });
  }
  if (s.usersWithout2FA > 0) {
    recs.push({
      severity: "warning",
      title: `${s.usersWithout2FA} user(s) without 2FA`,
      description: "Enable TOTP 2FA on all admin/manager accounts for defense in depth. Cashiers can opt in.",
    });
  }
  if (s.oldPasswords > 0) {
    recs.push({
      severity: "warning",
      title: `${s.oldPasswords} user(s) with passwords >90 days old`,
      description: "Enforce a password rotation policy. Users should change passwords every 90 days.",
    });
  }
  if (s.inactiveUsers > 0) {
    recs.push({
      severity: "info",
      title: `${s.inactiveUsers} inactive user account(s)`,
      description: "Review and deactivate any accounts no longer in use. Former employees should not retain access.",
    });
  }
  if (recs.length === 0) {
    recs.push({
      severity: "info",
      title: "Security posture is healthy",
      description: "No critical issues detected. Continue regular audits.",
    });
  }
  return recs;
}
