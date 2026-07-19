"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft, Shield, Users, Database, Settings2, FileText,
  Activity, Lock, Download, Upload, RefreshCw, Bell, Globe,
  ChevronRight, Clock, AlertTriangle, CheckCircle2, Wrench,
  Mail, BookOpen, Eye, Server, HardDrive,
} from "lucide-react";
import { COMPANY } from "@/lib/pos-data";

interface AdminHubProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
  userRole: string;
}

interface AdminModule {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  bg: string;
  view?: string;
  href?: string;
  roles: string[]; // who can access
  badge?: string;
}

const MODULE_GROUPS: { category: string; icon: any; modules: AdminModule[] }[] = [
  {
    category: "User & Access",
    icon: Users,
    modules: [
      {
        id: "users",
        title: "User Management",
        description: "Create, edit, deactivate users. Set roles and permissions.",
        icon: Users,
        color: "text-blue-600",
        bg: "bg-blue-50",
        view: "maintenance",
        roles: ["admin"],
        badge: "Admin only",
      },
      {
        id: "security",
        title: "Security & Permissions",
        description: "Role-based access control, password policies, audit logs.",
        icon: Lock,
        color: "text-rose-600",
        bg: "bg-rose-50",
        view: "maintenance",
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    category: "System",
    icon: Settings2,
    modules: [
      {
        id: "system-settings",
        title: "System Settings",
        description: "Company info, tax rate, currency, receipt footer, notifications.",
        icon: Settings2,
        color: "text-slate-600",
        bg: "bg-slate-100",
        view: "maintenance",
        roles: ["admin", "manager"],
      },
      {
        id: "system-health",
        title: "System Health",
        description: "Database stats, memory usage, uptime, error tracking.",
        icon: Activity,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        view: "dashboard",
        roles: ["admin", "manager"],
      },
      {
        id: "data-integrity",
        title: "Data Integrity Check",
        description: "Verify stock quantities against history. Find discrepancies.",
        icon: CheckCircle2,
        color: "text-teal-600",
        bg: "bg-teal-50",
        view: "stock",
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    category: "Backup & Data",
    icon: Database,
    modules: [
      {
        id: "backup",
        title: "Backup & Restore",
        description: "Create database backups, restore from previous versions.",
        icon: Database,
        color: "text-purple-600",
        bg: "bg-purple-50",
        view: "maintenance",
        roles: ["admin"],
      },
      {
        id: "audit-logs",
        title: "Audit Logs",
        description: "Complete activity log — every action with user, IP, timestamp.",
        icon: FileText,
        color: "text-amber-600",
        bg: "bg-amber-50",
        view: "admin-panel",
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    category: "Operations",
    icon: Clock,
    modules: [
      {
        id: "cashier-shift",
        title: "Cashier Shift Management",
        description: "Open/close shifts, cash reconciliation, shift reports.",
        icon: Clock,
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        view: "maintenance",
        roles: ["admin", "manager"],
      },
      {
        id: "registers",
        title: "Register Management",
        description: "Configure POS registers, opening floats, terminal assignments.",
        icon: Server,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        view: "maintenance",
        roles: ["admin"],
      },
      {
        id: "z-report",
        title: "Z-Report (End of Day)",
        description: "Daily reconciliation report with auto-email cron setup.",
        icon: BookOpen,
        color: "text-violet-600",
        bg: "bg-violet-50",
        view: "dashboard",
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    category: "Communication",
    icon: Mail,
    modules: [
      {
        id: "email-system",
        title: "Email System",
        description: "SMTP configuration (Gmail/Outlook/Yahoo), send emails with attachments.",
        icon: Mail,
        color: "text-blue-600",
        bg: "bg-blue-50",
        view: "email-system",
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    category: "Maintenance",
    icon: Wrench,
    modules: [
      {
        id: "maintenance",
        title: "Maintenance Console",
        description: "Full maintenance module — all tabs in one place.",
        icon: Wrench,
        color: "text-orange-600",
        bg: "bg-orange-50",
        view: "maintenance",
        roles: ["admin", "manager"],
      },
      {
        id: "admin-panel",
        title: "Admin Panel",
        description: "Advanced admin tools, user approval, system configuration.",
        icon: Shield,
        color: "text-purple-600",
        bg: "bg-purple-50",
        view: "admin-panel",
        roles: ["admin"],
      },
    ],
  },
];

export function AdminHub({ onBack, onNavigate, userRole }: AdminHubProps) {
  const canAccess = (roles: string[]) => roles.includes(userRole);

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col lg:h-screen">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-90 flex-shrink-0" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">Admin Hub</h1>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate">All administrative modules · {userRole} access</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 max-w-5xl mx-auto w-full pb-24 lg:pb-4">
        {/* Access level banner */}
        <div className="mb-4 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl p-3 ring-1 ring-slate-200 flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${userRole === "admin" ? "bg-emerald-100" : "bg-amber-100"}`}>
            <Shield className={`h-5 w-5 ${userRole === "admin" ? "text-emerald-600" : "text-amber-600"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-800">
              {userRole === "admin" ? "Full Administrator Access" : "Manager Access (limited)"}
            </div>
            <div className="text-[11px] text-slate-500">
              {userRole === "admin"
                ? "You can access all administrative modules including user management and backups."
                : "You can access operational modules. User management and backups require admin role."}
            </div>
          </div>
        </div>

        {/* Module groups */}
        {MODULE_GROUPS.map((group, gi) => {
          const accessibleModules = group.modules.filter(m => canAccess(m.roles));
          if (accessibleModules.length === 0) return null;
          const GroupIcon = group.icon;
          return (
            <motion.div
              key={group.category}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 }}
              className="mb-5"
            >
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="h-7 w-7 rounded-lg bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center text-slate-600">
                  <GroupIcon className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">{group.category}</h2>
                <span className="text-[10px] text-slate-400 ml-auto">{accessibleModules.length} module{accessibleModules.length > 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accessibleModules.map(mod => {
                  const Icon = mod.icon;
                  return (
                    <button
                      key={mod.id}
                      onClick={() => mod.view && onNavigate(mod.view)}
                      className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-3 text-left hover:shadow-md hover:ring-emerald-300 transition active:scale-[0.98] flex items-start gap-3 group"
                    >
                      <div className={`h-10 w-10 rounded-lg ${mod.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${mod.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-slate-800">{mod.title}</span>
                          {mod.badge && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                              {mod.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 leading-snug">{mod.description}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition flex-shrink-0 mt-1" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}

        {/* Locked modules (visible but greyed out) */}
        {userRole !== "admin" && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Lock className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-400">Admin-Only Modules</h2>
            </div>
            <div className="bg-slate-100 rounded-xl p-4 text-center">
              <Lock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Some modules require administrator role</p>
              <p className="text-[11px] text-slate-400 mt-1">Ask an administrator to grant access or log in as admin</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-[10px] text-slate-400">
          <p>{COMPANY.name} · Admin Hub</p>
          <p className="mt-1">All actions are logged in the audit trail</p>
        </div>
      </main>
    </div>
  );
}
