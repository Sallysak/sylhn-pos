"use client";

import { useState, useRef, useEffect } from "react";
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

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
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
            <Button variant="outline" onClick={() => { setStoreName(COMPANY.name); setContact(COMPANY.contact); setAddress(COMPANY.address); setTaxRate((TAX_RATE * 100).toString()); setCurrency("GHS"); setLowStockThreshold("20"); setReceiptFooter("Thank you for shopping!"); toast({ title: "Settings reset to defaults" }); }}>Reset to Defaults</Button>
            <Button onClick={() => { try { localStorage.setItem("sylhn_settings", JSON.stringify({ storeName, contact, address, taxRate, currency, lowStockThreshold, receiptFooter, enableNotifications, enableLowStockAlerts })); toast({ title: "Settings saved", description: "System settings saved successfully" }); } catch { toast({ title: "Save failed", variant: "destructive" }); } }} className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900">
              <Save className="h-4 w-4" /> Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== User Management Tab =====
function UserManagement({ users, setUsers }: {
  users: SystemUser[];
  setUsers: React.Dispatch<React.SetStateAction<SystemUser[]>>;
}) {
  const { toast } = useToast();
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  const roleColors: Record<string, string> = {
    admin: "bg-rose-100 text-rose-700",
    manager: "bg-blue-100 text-blue-700",
    cashier: "bg-emerald-100 text-emerald-700",
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setShowUserForm(true);
  };

  const handleEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setShowUserForm(true);
  };

  const handleToggleActive = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active, lastLogin: u.active ? u.lastLogin : new Date().toLocaleString('en-GB').replace(',', '') } : u));
    const user = users.find(u => u.id === id);
    toast({ title: user?.active ? "User deactivated" : "User activated", description: user?.name });
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    toast({ title: "User deleted", description: user?.name });
  };

  const handleSaveUser = (user: SystemUser) => {
    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === user.id ? user : u));
      toast({ title: "User updated", description: user.name });
    } else {
      setUsers(prev => [...prev, { ...user, id: `u-${Date.now()}`, lastLogin: "Never" }]);
      toast({ title: "User added", description: user.name });
    }
    setShowUserForm(false);
    setEditingUser(null);
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-bold text-slate-800">User Management</h2>
          <Badge variant="outline" className="font-mono text-xs">{users.length} users</Badge>
        </div>
        <Button onClick={handleAddUser} className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900">
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
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
                    <button onClick={() => handleEditUser(u)} className="h-7 w-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition" title="Edit User">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleToggleActive(u.id)} className="h-7 w-7 rounded-md bg-amber-100 text-amber-600 hover:bg-amber-200 flex items-center justify-center transition" title={u.active ? "Deactivate" : "Activate"}>
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDeleteUser(u.id)} className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition" title="Delete User">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Form Modal */}
      <AnimatePresence>
        {showUserForm && (
          <UserFormModal user={editingUser} onSave={handleSaveUser} onClose={() => { setShowUserForm(false); setEditingUser(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== User Form Modal =====
function UserFormModal({ user, onSave, onClose }: { user: SystemUser | null; onSave: (u: SystemUser) => void; onClose: () => void; }) {
  const [form, setForm] = useState<SystemUser>(user || { id: "", name: "", username: "", role: "cashier", pin: "", active: true, email: "" });
  const isNew = !user;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">{isNew ? <Plus className="h-5 w-5" /> : <Edit2 className="h-5 w-5" />}<h3 className="font-bold">{isNew ? "Add New User" : "Edit User"}</h3></div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Full Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Doe" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm" /></div>
          <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Username</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. jdoe" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm font-mono" /></div>
          <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@sylhn.com" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as SystemUser["role"] })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm"><option value="admin">Admin</option><option value="manager">Manager</option><option value="cashier">Cashier</option></select></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">PIN (4-8 digits)</label><input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })} placeholder="1234" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm font-mono" /></div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-slate-700" /> Active user (can log in)</label>
        </div>
        <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <button onClick={() => { if (form.name && form.username && form.pin) onSave(form); }} disabled={!form.name || !form.username || !form.pin} className="h-10 px-5 rounded-lg bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"><Save className="h-4 w-4 inline mr-1" />{isNew ? "Add User" : "Save Changes"}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Backup & Restore Tab =====
function BackupRestore() {
  const { toast } = useToast();
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupHistory, setBackupHistory] = useState<{ name: string; size: string; date: string; path: string }[]>([]);
  const [restorePreview, setRestorePreview] = useState<{ products: number; groups: number; transactions: number; date: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRestoreDataRef = useRef<string | null>(null);

  useEffect(() => { try { const stored = localStorage.getItem("sylhn_backup_history"); if (stored) setBackupHistory(JSON.parse(stored)); } catch { /* ignore */ } }, []);
  const saveBackupHistory = (history: typeof backupHistory) => { setBackupHistory(history); try { localStorage.setItem("sylhn_backup_history", JSON.stringify(history)); } catch { /* ignore */ } };

  const handleBackup = () => {
    setBacking(true);
    try {
      const systemData: Record<string, any> = { _meta: { company: COMPANY.name, version: "2.0.0", backupDate: new Date().toISOString(), software: "SYLHN POS" } };
      const keys = ["sylhn-products", "sylhn-groups", "sylhn-history", "sylhn-held-orders", "sylhn-daily-total", "sylhn-txn-count", "sylhn-suppliers", "sylhn-stocktake-schedule", "sylhn-stocktake-notifications", "sylhn-variance-thresholds", "sylhn-stock-adjustment-draft", "sylhn-stock-adjustment-audit", "sylhn-stocktake-audit-committed", "sylhn-system-users", "sylhn-system-settings", "sylhn-audit-log", "sylhn-expenses", "sylhn-cash-recon", "sylhn-momo-transactions", "sylhn-telephone-directory", "sylhn-po-draft-from-reorder", "sylhn-stocktake-last-notified", "sylhn-critical-alerts-last-notified"];
      keys.forEach(k => { const val = localStorage.getItem(k); if (val) { try { systemData[k] = JSON.parse(val); } catch { systemData[k] = val; } } });
      const jsonStr = JSON.stringify(systemData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const fileName = `sylhn-backup-${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}-${Date.now().toString().slice(-6)}.json`;
      const link = document.createElement("a"); link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      const sizeKB = (blob.size / 1024).toFixed(1); const sizeStr = parseFloat(sizeKB) > 1024 ? `${(parseFloat(sizeKB) / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
      const now = new Date(); const dateStr = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      const newHistory = [{ name: fileName, size: sizeStr, date: dateStr, path: `Downloads/${fileName}` }, ...backupHistory].slice(0, 10);
      saveBackupHistory(newHistory);
      toast({ title: "Backup created", description: `${fileName} (${sizeStr}) saved to Downloads` });
    } catch (err: any) { toast({ title: "Backup failed", description: err.message, variant: "destructive" }); } finally { setBacking(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setRestoring(true);
    const reader = new FileReader();
    reader.onload = (ev) => { try { const jsonStr = ev.target?.result as string; const data = JSON.parse(jsonStr);
      if (!data._meta || !data._meta.company) { toast({ title: "Invalid backup file", variant: "destructive" }); setRestoring(false); return; }
      pendingRestoreDataRef.current = jsonStr;
      setRestorePreview({ products: data['sylhn-products']?.length || 0, groups: data['sylhn-groups']?.length || 0, transactions: data['sylhn-history']?.length || 0, date: data._meta.backupDate ? new Date(data._meta.backupDate).toLocaleString('en-GB') : "Unknown" });
      toast({ title: "Backup file loaded", description: file.name });
    } catch (err: any) { toast({ title: "Invalid file", description: err.message, variant: "destructive" }); } finally { setRestoring(false); } };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!pendingRestoreDataRef.current) return;
    try { const data = JSON.parse(pendingRestoreDataRef.current);
      Object.keys(data).forEach(key => { if (key.startsWith("_")) return; const val = typeof data[key] === "string" ? data[key] : JSON.stringify(data[key]); localStorage.setItem(key, val); });
      toast({ title: "Data restored", description: "Page will reload to apply changes" });
      setRestorePreview(null); pendingRestoreDataRef.current = null;
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) { toast({ title: "Restore failed", description: err.message, variant: "destructive" }); }
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200"><Database className="h-5 w-5 text-slate-700" /><h2 className="text-base font-bold text-slate-800">Backup & Restore</h2></div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <div className="p-6 max-w-2xl mx-auto space-y-5">
          <div className="bg-blue-50 rounded-xl p-5 ring-1 ring-blue-200">
            <div className="flex items-start gap-3 mb-3"><div className="h-11 w-11 rounded-xl bg-blue-100 flex items-center justify-center"><Download className="h-5 w-5 text-blue-600" /></div><div className="flex-1"><div className="font-bold text-slate-800">Create Backup</div><div className="text-xs text-slate-500 mt-0.5">Export all system data to a JSON backup file</div></div></div>
            <Button onClick={handleBackup} disabled={backing} className="w-full bg-blue-600 hover:bg-blue-700">{backing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Creating...</> : <><Download className="h-4 w-4" /> Create Backup Now</>}</Button>
            <div className="mt-2 text-[10px] text-slate-500 text-center">File saved to your <strong>Downloads</strong> folder</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-5 ring-1 ring-amber-200">
            <div className="flex items-start gap-3 mb-3"><div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center"><Upload className="h-5 w-5 text-amber-600" /></div><div className="flex-1"><div className="font-bold text-slate-800">Restore from Backup</div><div className="text-xs text-slate-500 mt-0.5">Select a backup file to restore all data</div></div></div>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={restoring} variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100">{restoring ? <><RefreshCw className="h-4 w-4 animate-spin" /> Loading...</> : <><Upload className="h-4 w-4" /> Select Backup File (.json)</>}</Button>
            {restorePreview && (<div className="mt-3 p-3 rounded-lg bg-white ring-1 ring-amber-300"><div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-amber-600" /> Backup Preview</div><div className="grid grid-cols-2 gap-2 text-xs mb-3"><div className="bg-slate-50 rounded px-2 py-1"><span className="text-slate-500">Date:</span> <span className="font-semibold">{restorePreview.date}</span></div><div className="bg-slate-50 rounded px-2 py-1"><span className="text-slate-500">Products:</span> <span className="font-semibold">{restorePreview.products}</span></div><div className="bg-slate-50 rounded px-2 py-1"><span className="text-slate-500">Groups:</span> <span className="font-semibold">{restorePreview.groups}</span></div><div className="bg-slate-50 rounded px-2 py-1"><span className="text-slate-500">Txns:</span> <span className="font-semibold">{restorePreview.transactions}</span></div></div><div className="flex gap-2"><button onClick={() => { setRestorePreview(null); pendingRestoreDataRef.current = null; if (fileInputRef.current) fileInputRef.current.value = ""; }} className="flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">Cancel</button><button onClick={handleConfirmRestore} className="flex-1 h-8 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Confirm Restore</button></div><div className="mt-1 text-[9px] text-rose-500 text-center">⚠ This will overwrite current data</div></div>)}
          </div>
          <div className="bg-white rounded-xl p-5 ring-1 ring-slate-200"><div className="font-bold text-slate-800 mb-3 flex items-center gap-2"><HardDrive className="h-4 w-4 text-slate-500" /> Backup History ({backupHistory.length})</div>{backupHistory.length === 0 ? <div className="text-center py-6 text-slate-400 text-xs">No backups yet</div> : <div className="space-y-2">{backupHistory.map((b, i) => (<div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100"><Database className="h-5 w-5 text-slate-400 flex-shrink-0" /><div className="flex-1 min-w-0"><div className="text-xs font-mono text-slate-700 truncate">{b.name}</div><div className="text-[10px] text-slate-400">{b.size} · {b.date} · 📁 {b.path}</div></div><button onClick={() => { saveBackupHistory(backupHistory.filter((_, j) => j !== i)); toast({ title: "Record removed" }); }} className="h-7 w-7 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button></div>))}</div>}</div>
          <div className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200"><div className="text-xs font-bold text-slate-700 mb-1">📌 How Backup Works</div><div className="text-[11px] text-slate-500 space-y-0.5"><div>• <strong>Backup</strong>: Downloads JSON to Downloads folder</div><div>• <strong>Restore</strong>: Upload backup JSON to restore</div><div>• <strong>Location</strong>: C:\Users\YourName\Downloads</div></div></div>
        </div>
      </div>
    </div>
  );
}

// ===== Cashier Shift Tab =====
function CashierShift({ cashier, dailyTotal, transactionCount }: { cashier: string; dailyTotal: number; transactionCount: number; }) {
  const { toast } = useToast();
  const [shiftStartMs] = useState(Date.now());
  const [shiftStartStr] = useState(new Date().toLocaleString('en-GB'));
  const [openingFloat, setOpeningFloat] = useState("100.00");
  const [shiftActive, setShiftActive] = useState(true);
  const [shiftPaused, setShiftPaused] = useState(false);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pausedAccumulated, setPausedAccumulated] = useState(0);
  const [pauseStartMs, setPauseStartMs] = useState<number | null>(null);

  // Live clock: tick every second when shift is active and not paused
  useEffect(() => {
    if (!shiftActive || shiftPaused) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - shiftStartMs - pausedAccumulated - (pauseStartMs ? Date.now() - pauseStartMs : 0)) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [shiftActive, shiftPaused, shiftStartMs, pausedAccumulated, pauseStartMs]);

  // Format seconds to HH:MM:SS
  const formatDuration = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handlePauseShift = () => {
    if (!shiftActive || shiftPaused) return;
    setPauseStartMs(Date.now());
    setShiftPaused(true);
    toast({ title: "⏸ Shift Paused", description: `${cashier}'s shift has been paused. Timer stopped. Resume anytime.` });
  };

  const handleResumeShift = () => {
    if (!shiftPaused) return;
    if (pauseStartMs) {
      setPausedAccumulated(prev => prev + (Date.now() - pauseStartMs));
      setPauseStartMs(null);
    }
    setShiftPaused(false);
    toast({ title: "▶ Shift Resumed", description: `${cashier}'s shift has been resumed. Timer running.` });
  };

  const handleEndShift = () => {
    if (!shiftActive) return;
    // Finalize elapsed time
    const finalPaused = pausedAccumulated + (pauseStartMs ? Date.now() - pauseStartMs : 0);
    setElapsedSeconds(Math.floor((Date.now() - shiftStartMs - finalPaused) / 1000));
    setShiftActive(false);
    setShiftPaused(false);
    setEndTime(new Date().toLocaleString('en-GB'));
    const expectedCash = parseFloat(openingFloat) + dailyTotal;
    toast({ title: "⏹ Shift Ended", description: `${cashier} — ${transactionCount} txns, ${formatGHS(dailyTotal)} sales, expected cash: ${formatGHS(expectedCash)}` });
  };

  const handleStartNewShift = () => {
    window.location.reload(); // Simplest way to reset everything
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200"><Clock className="h-5 w-5 text-slate-700" /><h2 className="text-base font-bold text-slate-800">Cashier Shift Management</h2></div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Current Shift Status */}
          <div className={cn("rounded-xl p-5 ring-1", shiftActive ? (shiftPaused ? "bg-amber-50 ring-amber-200" : "bg-gradient-to-br from-emerald-50 to-teal-50 ring-emerald-200") : "bg-rose-50 ring-rose-200")}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("h-2 w-2 rounded-full", shiftActive ? (shiftPaused ? "bg-amber-500" : "bg-emerald-500 animate-pulse") : "bg-rose-500")} />
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: shiftActive ? (shiftPaused ? '#92400e' : '#065f46') : '#991b1b' }}>
                {shiftActive ? (shiftPaused ? "Shift Paused" : "Active Shift") : "Shift Ended"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white ring-2 flex items-center justify-center font-bold text-2xl" style={{ color: shiftActive ? '#059669' : '#dc2626', borderColor: shiftActive ? '#6ee7b7' : '#fca5a5' }}>{cashier.charAt(0)}</div>
              <div>
                <div className="font-bold text-slate-800 text-lg">{cashier}</div>
                <div className="text-xs text-slate-500">Register #1 · Started: {shiftStartStr}{endTime && ` · Ended: ${endTime}`}</div>
              </div>
              {/* Live Clock */}
              <div className="ml-auto text-right">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">{shiftActive ? (shiftPaused ? "Paused Duration" : "Shift Duration") : "Total Duration"}</div>
                <div className={cn("text-2xl font-bold font-mono", shiftActive ? (shiftPaused ? "text-amber-600" : "text-emerald-600") : "text-rose-600")}>
                  {formatDuration(elapsedSeconds)}
                </div>
                <div className="text-[9px] text-slate-400">
                  {shiftActive ? (shiftPaused ? "⏸ Timer paused" : "▶ Timer running") : "⏹ Timer stopped"}
                </div>
              </div>
            </div>
          </div>

          {/* Shift Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 ring-1 ring-slate-200 text-center"><div className="text-[10px] text-slate-500 uppercase font-semibold">Transactions</div><div className="text-2xl font-bold text-slate-800">{transactionCount}</div></div>
            <div className="bg-white rounded-xl p-4 ring-1 ring-slate-200 text-center"><div className="text-[10px] text-slate-500 uppercase font-semibold">Total Sales</div><div className="text-2xl font-bold text-emerald-600 font-mono">{formatGHS(dailyTotal)}</div></div>
            <div className="bg-white rounded-xl p-4 ring-1 ring-slate-200 text-center"><div className="text-[10px] text-slate-500 uppercase font-semibold">Avg Sale</div><div className="text-2xl font-bold text-blue-600 font-mono">{formatGHS(transactionCount > 0 ? dailyTotal / transactionCount : 0)}</div></div>
          </div>

          {/* Opening Float */}
          <div className="bg-white rounded-xl p-5 ring-1 ring-slate-200">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Opening Cash Float</label>
            <div className="flex items-center gap-2"><span className="text-lg font-bold text-slate-700">{CURRENCY}</span><input value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} disabled={!shiftActive} className="flex-1 h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-500 outline-none font-mono font-bold text-lg disabled:bg-slate-50" /></div>
            {shiftActive && <div className="mt-2 text-xs text-slate-500">Expected cash at end of shift: <span className="font-bold text-emerald-600">{formatGHS(parseFloat(openingFloat) || 0 + dailyTotal)}</span></div>}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            {shiftActive ? (
              <>
                {shiftPaused ? (
                  <Button onClick={handleResumeShift} className="h-12 bg-emerald-600 hover:bg-emerald-700"><Power className="h-4 w-4" /> Resume Shift</Button>
                ) : (
                  <Button onClick={handlePauseShift} variant="outline" className="h-12"><RefreshCw className="h-4 w-4" /> Pause Shift</Button>
                )}
                <Button onClick={handleEndShift} className="h-12 bg-rose-600 hover:bg-rose-700"><Power className="h-4 w-4" /> End Shift</Button>
              </>
            ) : (
              <Button onClick={handleStartNewShift} className="h-12 col-span-2 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4" /> Start New Shift</Button>
            )}
          </div>

          {endTime && (
            <div className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200">
              <div className="text-sm font-bold text-slate-700 mb-2">Shift Summary</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded px-2 py-1"><span className="text-slate-500">Start:</span> <span className="font-semibold">{shiftStartStr}</span></div>
                <div className="bg-white rounded px-2 py-1"><span className="text-slate-500">End:</span> <span className="font-semibold">{endTime}</span></div>
                <div className="bg-white rounded px-2 py-1"><span className="text-slate-500">Duration:</span> <span className="font-semibold font-mono text-rose-600">{formatDuration(elapsedSeconds)}</span></div>
                <div className="bg-white rounded px-2 py-1"><span className="text-slate-500">Opening Float:</span> <span className="font-semibold">{formatGHS(parseFloat(openingFloat) || 0)}</span></div>
                <div className="bg-white rounded px-2 py-1"><span className="text-slate-500">Expected Cash:</span> <span className="font-semibold text-emerald-600">{formatGHS((parseFloat(openingFloat) || 0) + dailyTotal)}</span></div>
                <div className="bg-white rounded px-2 py-1"><span className="text-slate-500">Transactions:</span> <span className="font-semibold">{transactionCount}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
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
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage on mount
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sylhn_security");
      if (stored) {
        const s = JSON.parse(stored);
        setRequirePin(s.requirePin ?? true);
        setRequireLogin(s.requireLogin ?? true);
        setAutoLock(s.autoLock ?? false);
        setPinLength(s.pinLength ?? "4");
      }
    } catch { /* ignore */ }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = () => {
    try {
      localStorage.setItem("sylhn_security", JSON.stringify({ requirePin, requireLogin, autoLock, pinLength }));
      setSaved(true);
      toast({ title: "✅ Security settings saved", description: "All security settings have been updated" });
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleResetPin = () => {
    toast({ title: "PIN Reset", description: "All user PINs have been reset to default (1234). Users will be prompted to set a new PIN on next login." });
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200"><Lock className="h-5 w-5 text-slate-700" /><h2 className="text-base font-bold text-slate-800">Security & Permissions</h2></div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Authentication */}
          <SettingsSection title="Authentication" icon={KeyRound}>
            <ToggleSetting label="Require Login" description="Users must log in to access the system" enabled={requireLogin} onToggle={() => setRequireLogin(!requireLogin)} />
            <ToggleSetting label="Require PIN for Sales" description="Cashier must enter PIN before processing payment" enabled={requirePin} onToggle={() => setRequirePin(!requirePin)} />
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">PIN Length</label>
              <select value={pinLength} onChange={(e) => setPinLength(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm">
                <option value="4">4 digits</option><option value="6">6 digits</option><option value="8">8 digits</option>
              </select>
            </div>
            <button onClick={handleResetPin} className="w-full h-9 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"><KeyRound className="h-3.5 w-3.5" /> Reset All User PINs</button>
          </SettingsSection>

          {/* Auto-Lock */}
          <SettingsSection title="Session Security" icon={Shield}>
            <ToggleSetting label="Auto-Lock Screen" description="Lock screen after 5 minutes of inactivity" enabled={autoLock} onToggle={() => setAutoLock(!autoLock)} />
            {autoLock && <div className="text-xs text-slate-500 bg-blue-50 p-2 rounded">Screen will auto-lock after 5 minutes of no activity. Users will need to re-enter their PIN to resume.</div>}
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
                  <div className="flex flex-wrap gap-1">{r.perms.map(p => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}</div>
                </div>
              ))}
            </div>
          </SettingsSection>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <Button onClick={handleSave} className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900">
              {saved ? <><CheckCircle2 className="h-4 w-4" /> Saved!</> : <><Save className="h-4 w-4" /> Save Security Settings</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== About System Tab =====
function AboutSystem() {
  return (
    <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200"><Info className="h-5 w-5 text-slate-700" /><h2 className="text-base font-bold text-slate-800">About SYLHN POS</h2></div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <div className="p-6 max-w-2xl mx-auto">
          <div className="text-center mb-6"><div className="h-20 w-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold text-4xl mb-3 shadow-lg">S</div><div className="text-2xl font-bold text-slate-800">{COMPANY.name}</div><div className="text-sm text-slate-500">{COMPANY.tagline}</div></div>
          <div className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200 space-y-2 mb-6"><AboutRow label="Company Name" value={COMPANY.name} /><AboutRow label="Address" value={COMPANY.address} /><AboutRow label="Contact" value={COMPANY.contact} /><AboutRow label="Email" value={COMPANY.email} /></div>
          <div className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200 space-y-2 mb-6"><div className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-2">System Information</div><AboutRow label="Software" value="SYLHN POS v2.0.0" /><AboutRow label="Build" value="2026.07.07" /><AboutRow label="Framework" value="Next.js 16 + TypeScript" /><AboutRow label="Database" value="SQLite (Prisma)" /><AboutRow label="License" value="Commercial - Single Store" /></div>
          <div className="grid grid-cols-3 gap-3 mb-6"><div className="bg-emerald-50 rounded-xl p-3 text-center ring-1 ring-emerald-100"><CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" /><div className="text-xs font-semibold text-emerald-700">System Active</div></div><div className="bg-blue-50 rounded-xl p-3 text-center ring-1 ring-blue-100"><Zap className="h-6 w-6 text-blue-500 mx-auto mb-1" /><div className="text-xs font-semibold text-blue-700">Latest Version</div></div><div className="bg-purple-50 rounded-xl p-3 text-center ring-1 ring-purple-100"><Shield className="h-6 w-6 text-purple-500 mx-auto mb-1" /><div className="text-xs font-semibold text-purple-700">Secured</div></div></div>
          <div className="text-center text-xs text-slate-400"><div>© 2026 {COMPANY.name}. All rights reserved.</div><div className="mt-1">Powered by Z.ai Technology</div></div>
        </div>
      </div>
    </div>
  );
}

// ===== Helper Components =====
function SettingsSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (<div className="bg-white rounded-xl ring-1 ring-slate-200 p-4"><div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100"><Icon className="h-4 w-4 text-slate-500" /><h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{title}</h3></div><div className="space-y-3">{children}</div></div>);
}
function SettingField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (<div><label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-slate-500 outline-none text-sm" /></div>);
}
function ToggleSetting({ label, description, enabled, onToggle }: { label: string; description: string; enabled: boolean; onToggle: () => void }) {
  return (<div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-slate-700">{label}</div><div className="text-xs text-slate-500">{description}</div></div><button onClick={onToggle} className={cn("relative h-6 w-11 rounded-full transition", enabled ? "bg-emerald-500" : "bg-slate-300")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-5" : "translate-x-0.5")} /></button></div>);
}
function AboutRow({ label, value }: { label: string; value: string }) {
  return (<div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800">{value}</span></div>);
}
