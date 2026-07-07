"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Settings2, Users, Database, Clock, Lock, Zap, Store,
  Power, Save, Plus, X, Edit2, Trash2, Shield, Download, Upload,
  CheckCircle2, AlertTriangle, KeyRound, Bell, Globe, Palette,
  UserCog, HardDrive, RefreshCw, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, CURRENCY, TAX_RATE, formatGHS } from "@/lib/pos-data";

type MaintenanceTab = "settings" | "users" | "backup" | "shift" | "security" | "about";

interface SystemUser {
  id: string;
  name: string;
  username: string;
  role: "admin" | "manager" | "cashier";
  pin: string;
  active: boolean;
  lastLogin?: string;
  email: string;
}

const initialUsers: SystemUser[] = [
  { id: "u1", name: "Sarah Johnson", username: "sarah", role: "admin", pin: "1234", active: true, lastLogin: "2026-07-07 08:30", email: "sarah@sylhn.com" },
  { id: "u2", name: "Mike Mensah", username: "mike", role: "manager", pin: "5678", active: true, lastLogin: "2026-07-07 09:15", email: "mike@sylhn.com" },
  { id: "u3", name: "Grace Owusu", username: "grace", role: "cashier", pin: "9012", active: true, lastLogin: "2026-07-06 17:45", email: "grace@sylhn.com" },
  { id: "u4", name: "Daniel Tetteh", username: "daniel", role: "cashier", pin: "3456", active: false, email: "daniel@sylhn.com" },
];

interface MaintenanceProps {
  onBack: () => void;
  cashier: string;
  dailyTotal: number;
  transactionCount: number;
}

export function MaintenanceModule({ onBack, cashier, dailyTotal, transactionCount }: MaintenanceProps) {
  const [tab, setTab] = useState<MaintenanceTab>("settings");
  const [users, setUsers] = useState<SystemUser[]>(initialUsers);
  const { toast } = useToast();

  const tabs = [
    { id: "settings" as const, label: "System Settings", icon: Settings2 },
    { id: "users" as const, label: "User Management", icon: Users },
    { id: "backup" as const, label: "Backup & Restore", icon: Database },
    { id: "shift" as const, label: "Cashier Shift", icon: Clock },
    { id: "security" as const, label: "Security", icon: Lock },
    { id: "about" as const, label: "About", icon: Info },
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">System Maintenance</div>
                <div className="text-[10px] text-slate-300/90">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-300/80">{COMPANY.address}</div>
            <div className="text-xs font-mono text-slate-300">{COMPANY.contact}</div>
          </div>
        </div>
      </header>

      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 px-6 py-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === t.id ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-hidden p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {tab === "settings" && <SystemSettings />}
            {tab === "users" && <UserManagement users={users} setUsers={setUsers} />}
            {tab === "backup" && <BackupRestore />}
            {tab === "shift" && <CashierShift cashier={cashier} dailyTotal={dailyTotal} transactionCount={transactionCount} />}
            {tab === "security" && <SecuritySettings />}
            {tab === "about" && <AboutSystem />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ===== System Settings Tab =====
function SystemSettings() {
  const { toast } = useToast();
  const [storeName, setStoreName] = useState(COMPANY.name);
  const [contact, setContact] = useState(COMPANY.contact);
  const [address, setAddress] = useState(COMPANY.address);
  const [taxRate, setTaxRate] = useState((TAX_RATE * 100).toString());
  const [currency, setCurrency] = useState("GHS");
  const [lowStockThreshold, setLowStockThreshold] = useState("20");
  const [receiptFooter, setReceiptFooter] = useState("Thank you for shopping!");
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [enableLowStockAlerts, setEnableLowStockAlerts] = useState(true);

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <Settings2 className="h-5 w-5 text-slate-700" />
        <h2 className="text-base font-bold text-slate-800">System Settings</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Company Info */}
          <SettingsSection title="Company Information" icon={Store}>
            <SettingField label="Store Name" value={storeName} onChange={setStoreName} />
            <SettingField label="Contact Phone" value={contact} onChange={setContact} />
            <SettingField label="Address" value={address} onChange={setAddress} />
          </SettingsSection>

          {/* Financial Settings */}
          <SettingsSection title="Financial Settings" icon={Globe}>
            <SettingField label="VAT/Tax Rate (%)" value={taxRate} onChange={setTaxRate} type="number" />
            <SettingField label="Currency Code" value={currency} onChange={setCurrency} />
            <SettingField label="Low Stock Threshold" value={lowStockThreshold} onChange={setLowStockThreshold} type="number" />
          </SettingsSection>

          {/* Receipt Settings */}
          <SettingsSection title="Receipt Settings" icon={Palette}>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Receipt Footer Message</label>
              <textarea value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm" />
            </div>
          </SettingsSection>

          {/* Notifications */}
          <SettingsSection title="Notifications" icon={Bell}>
            <ToggleSetting label="Enable Notifications" description="Show system notifications for events" enabled={enableNotifications} onToggle={() => setEnableNotifications(!enableNotifications)} />
            <ToggleSetting label="Low Stock Alerts" description="Notify when products reach reorder level" enabled={enableLowStockAlerts} onToggle={() => setEnableLowStockAlerts(!enableLowStockAlerts)} />
          </SettingsSection>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="outline">Reset to Defaults</Button>
            <Button onClick={() => toast({ title: "Settings saved", description: "System settings updated successfully" })} className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900">
              <Save className="h-4 w-4" /> Save Settings
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== User Management Tab =====
function UserManagement({ users, setUsers }: {
  users: SystemUser[];
  setUsers: React.Dispatch<React.SetStateAction<SystemUser[]>>;
}) {
  const { toast } = useToast();
  const roleColors: Record<string, string> = {
    admin: "bg-rose-100 text-rose-700",
    manager: "bg-blue-100 text-blue-700",
    cashier: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-bold text-slate-800">User Management</h2>
          <Badge variant="outline" className="font-mono text-xs">{users.length} users</Badge>
        </div>
        <Button className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900">
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-white text-[11px] uppercase tracking-wide z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Name</th>
              <th className="text-left px-3 py-2.5 font-semibold">Username</th>
              <th className="text-left px-3 py-2.5 font-semibold">Email</th>
              <th className="text-center px-3 py-2.5 font-semibold">Role</th>
              <th className="text-center px-3 py-2.5 font-semibold">PIN</th>
              <th className="text-center px-3 py-2.5 font-semibold">Status</th>
              <th className="text-left px-3 py-2.5 font-semibold">Last Login</th>
              <th className="text-center px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-700 font-bold text-xs">
                      {u.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-slate-800">{u.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-slate-600">{u.username}</td>
                <td className="px-3 py-2.5 text-slate-500 text-xs">{u.email}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold uppercase", roleColors[u.role])}>{u.role}</span>
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-slate-600">••••</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold", u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-500 text-xs">{u.lastLogin || "Never"}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => toast({ title: "Edit User", description: u.name })} className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { setUsers(prev => prev.map(x => x.id === u.id ? { ...x, active: !x.active } : x)); toast({ title: u.active ? "User deactivated" : "User activated", description: u.name }); }}
                      className="h-7 w-7 rounded-md bg-amber-100 text-amber-600 hover:bg-amber-200 flex items-center justify-center transition"
                      title={u.active ? "Deactivate" : "Activate"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setUsers(prev => prev.filter(x => x.id !== u.id))} className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

// ===== Backup & Restore Tab =====
function BackupRestore() {
  const { toast } = useToast();
  const [backing, setBacking] = useState(false);

  const handleBackup = () => {
    setBacking(true);
    setTimeout(() => {
      setBacking(false);
      toast({ title: "Backup created", description: "Database backed up successfully" });
    }, 2000);
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <Database className="h-5 w-5 text-slate-700" />
        <h2 className="text-base font-bold text-slate-800">Backup & Restore</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Backup */}
          <div className="bg-slate-50 rounded-xl p-5 ring-1 ring-slate-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Download className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="font-bold text-slate-800">Create Backup</div>
                <div className="text-xs text-slate-500 mt-0.5">Export all system data (products, sales, stock, users) to a backup file</div>
              </div>
            </div>
            <Button onClick={handleBackup} disabled={backing} className="w-full bg-blue-600 hover:bg-blue-700">
              {backing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Backing up...</> : <><Download className="h-4 w-4" /> Create Backup Now</>}
            </Button>
          </div>

          {/* Restore */}
          <div className="bg-amber-50 rounded-xl p-5 ring-1 ring-amber-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Upload className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <div className="font-bold text-slate-800">Restore from Backup</div>
                <div className="text-xs text-slate-500 mt-0.5">Upload a backup file to restore system data. This will overwrite current data.</div>
              </div>
            </div>
            <Button onClick={() => toast({ title: "Restore", description: "Select a backup file to restore" })} variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100">
              <Upload className="h-4 w-4" /> Select Backup File
            </Button>
          </div>

          {/* Backup History */}
          <div className="bg-white rounded-xl p-5 ring-1 ring-slate-200">
            <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-slate-500" /> Recent Backups
            </div>
            <div className="space-y-2">
              {[
                { name: "backup-2026-07-07.sylhn", size: "2.4 MB", date: "Today, 08:00", auto: true },
                { name: "backup-2026-07-06.sylhn", size: "2.3 MB", date: "Yesterday, 08:00", auto: true },
                { name: "backup-2026-07-05.sylhn", size: "2.3 MB", date: "3 days ago", auto: false },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition">
                  <Database className="h-5 w-5 text-slate-400" />
                  <div className="flex-1">
                    <div className="text-sm font-mono text-slate-700">{b.name}</div>
                    <div className="text-xs text-slate-400">{b.size} · {b.date}</div>
                  </div>
                  {b.auto && <Badge variant="outline" className="text-[10px]">Auto</Badge>}
                  <button className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center"><Download className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Cashier Shift Tab =====
function CashierShift({ cashier, dailyTotal, transactionCount }: {
  cashier: string;
  dailyTotal: number;
  transactionCount: number;
}) {
  const { toast } = useToast();
  const [shiftStart] = useState("2026-07-07 08:00");
  const [openingFloat, setOpeningFloat] = useState("100.00");

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <Clock className="h-5 w-5 text-slate-700" />
        <h2 className="text-base font-bold text-slate-800">Cashier Shift Management</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Current Shift */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 ring-1 ring-emerald-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Active Shift</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white ring-2 ring-emerald-300 flex items-center justify-center text-emerald-600 font-bold text-2xl">
                {cashier.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-800 text-lg">{cashier}</div>
                <div className="text-xs text-slate-500">Register #1 · Started: {shiftStart}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-slate-500">Shift Duration</div>
                <div className="text-xl font-bold font-mono text-emerald-600">04:23:15</div>
              </div>
            </div>
          </div>

          {/* Shift Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 ring-1 ring-slate-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Transactions</div>
              <div className="text-2xl font-bold text-slate-800">{transactionCount}</div>
            </div>
            <div className="bg-white rounded-xl p-4 ring-1 ring-slate-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Sales</div>
              <div className="text-2xl font-bold text-emerald-600 font-mono">{formatGHS(dailyTotal)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 ring-1 ring-slate-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Avg Sale</div>
              <div className="text-2xl font-bold text-blue-600 font-mono">{formatGHS(transactionCount > 0 ? dailyTotal / transactionCount : 0)}</div>
            </div>
          </div>

          {/* Opening Float */}
          <div className="bg-white rounded-xl p-5 ring-1 ring-slate-200">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Opening Cash Float</label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-700">{CURRENCY}</span>
              <input value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} className="flex-1 h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-500 outline-none font-mono font-bold text-lg" />
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => toast({ title: "Shift paused", description: "You can resume anytime" })} variant="outline" className="h-12">
              <RefreshCw className="h-4 w-4" /> Pause Shift
            </Button>
            <Button onClick={() => toast({ title: "Shift ended", description: `End of shift — ${transactionCount} transactions, ${formatGHS(dailyTotal)} in sales` })} className="h-12 bg-rose-600 hover:bg-rose-700">
              <Power className="h-4 w-4" /> End Shift
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Security Settings Tab =====
function SecuritySettings() {
  const { toast } = useToast();
  const [requirePin, setRequirePin] = useState(true);
  const [requireLogin, setRequireLogin] = useState(true);
  const [autoLock, setAutoLock] = useState(false);
  const [pinLength, setPinLength] = useState("4");

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <Lock className="h-5 w-5 text-slate-700" />
        <h2 className="text-base font-bold text-slate-800">Security & Permissions</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Authentication */}
          <SettingsSection title="Authentication" icon={KeyRound}>
            <ToggleSetting label="Require Login" description="Users must log in to access the system" enabled={requireLogin} onToggle={() => setRequireLogin(!requireLogin)} />
            <ToggleSetting label="Require PIN for Sales" description="Cashier must enter PIN before processing payment" enabled={requirePin} onToggle={() => setRequirePin(!requirePin)} />
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">PIN Length</label>
              <select value={pinLength} onChange={(e) => setPinLength(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm">
                <option value="4">4 digits</option>
                <option value="6">6 digits</option>
                <option value="8">8 digits</option>
              </select>
            </div>
          </SettingsSection>

          {/* Auto-Lock */}
          <SettingsSection title="Session Security" icon={Shield}>
            <ToggleSetting label="Auto-Lock Screen" description="Lock screen after 5 minutes of inactivity" enabled={autoLock} onToggle={() => setAutoLock(!autoLock)} />
          </SettingsSection>

          {/* Role Permissions */}
          <SettingsSection title="Role Permissions" icon={UserCog}>
            <div className="space-y-2">
              {[
                { role: "Administrator", perms: ["Full access", "User management", "Settings", "Reports", "Refunds", "Voids"] },
                { role: "Manager", perms: ["POS", "Stock", "Reports", "Refunds", "Voids (with approval)"] },
                { role: "Cashier", perms: ["POS", "Search products", "Process payments"] },
              ].map(r => (
                <div key={r.role} className="p-3 rounded-lg bg-slate-50 ring-1 ring-slate-100">
                  <div className="font-semibold text-slate-800 text-sm mb-1">{r.role}</div>
                  <div className="flex flex-wrap gap-1">
                    {r.perms.map(p => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <Button onClick={() => toast({ title: "Security settings saved" })} className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900">
              <Save className="h-4 w-4" /> Save Security Settings
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== About System Tab =====
function AboutSystem() {
  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <Info className="h-5 w-5 text-slate-700" />
        <h2 className="text-base font-bold text-slate-800">About SYLHN POS</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto">
          {/* Logo & Company */}
          <div className="text-center mb-6">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold text-4xl mb-3 shadow-lg">
              S
            </div>
            <div className="text-2xl font-bold text-slate-800">{COMPANY.name}</div>
            <div className="text-sm text-slate-500">{COMPANY.tagline}</div>
          </div>

          {/* Company Details */}
          <div className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200 space-y-2 mb-6">
            <AboutRow label="Company Name" value={COMPANY.name} />
            <AboutRow label="Address" value={COMPANY.address} />
            <AboutRow label="Contact" value={COMPANY.contact} />
            <AboutRow label="Email" value={COMPANY.email} />
          </div>

          {/* System Info */}
          <div className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200 space-y-2 mb-6">
            <div className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-2">System Information</div>
            <AboutRow label="Software" value="SYLHN POS v2.0.0" />
            <AboutRow label="Build" value="2026.07.07" />
            <AboutRow label="Framework" value="Next.js 16 + TypeScript" />
            <AboutRow label="Database" value="SQLite (Prisma)" />
            <AboutRow label="License" value="Commercial - Single Store" />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-emerald-50 rounded-xl p-3 text-center ring-1 ring-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
              <div className="text-xs font-semibold text-emerald-700">System Active</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center ring-1 ring-blue-100">
              <Zap className="h-6 w-6 text-blue-500 mx-auto mb-1" />
              <div className="text-xs font-semibold text-blue-700">Latest Version</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center ring-1 ring-purple-100">
              <Shield className="h-6 w-6 text-purple-500 mx-auto mb-1" />
              <div className="text-xs font-semibold text-purple-700">Secured</div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-slate-400">
            <div>© 2026 {COMPANY.name}. All rights reserved.</div>
            <div className="mt-1">Powered by Z.ai Technology</div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Helper Components =====
function SettingsSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
        <Icon className="h-4 w-4 text-slate-500" />
        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm" />
    </div>
  );
}

function ToggleSetting({ label, description, enabled, onToggle }: { label: string; description: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
      <button
        onClick={onToggle}
        className={cn("relative h-6 w-11 rounded-full transition", enabled ? "bg-emerald-500" : "bg-slate-300")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
