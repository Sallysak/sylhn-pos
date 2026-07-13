"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Shield, Lock, Users, Eye, Edit2, Trash2, Plus, X,
  KeyRound, Settings, Activity, Database, Save, Check, AlertTriangle,
  Clock, User, Power, ChevronRight, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY, formatGHS } from "@/lib/pos-data";

// ===== Types =====
export type UserRole = 'admin' | 'manager' | 'cashier' | 'stockkeeper' | 'accountant';

export interface SystemUser {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone: string;
  email: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
  permissions: UserPermissions;
}

export interface UserPermissions {
  pos: boolean;
  sales: boolean;
  stock: boolean;
  purchase: boolean;
  accounts: boolean;
  telephone: boolean;
  maintenance: boolean;
  financeOps: boolean;
  canVoid: boolean;
  canDiscount: boolean;
  canAdjustStock: boolean;
  canDeleteProducts: boolean;
  canExport: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface SystemSettings {
  companyName: string;
  currency: string;
  taxRate: number;
  taxName: string;
  lowStockThreshold: number;
  receiptFooter: string;
  autoBackup: boolean;
  sessionTimeout: number;
  requirePasswordForVoid: boolean;
  requirePasswordForDiscount: boolean;
  requirePasswordForAdjust: boolean;
  maxDiscountPercent: number;
}

// ===== Default users =====
const DEFAULT_USERS: SystemUser[] = [
  {
    id: 'u-admin', username: 'admin', password: 'admin123', fullName: 'System Administrator',
    role: 'admin', phone: '+233592766044', email: 'admin@sylhn.com', active: true,
    createdAt: '2026-01-01', lastLogin: new Date().toISOString(),
    permissions: { pos: true, sales: true, stock: true, purchase: true, accounts: true, telephone: true, maintenance: true, financeOps: true, canVoid: true, canDiscount: true, canAdjustStock: true, canDeleteProducts: true, canExport: true },
  },
  {
    id: 'u-manager', username: 'manager', password: 'manager123', fullName: 'Store Manager',
    role: 'manager', phone: '+233 24 111 2222', email: 'manager@sylhn.com', active: true,
    createdAt: '2026-01-01',
    permissions: { pos: true, sales: true, stock: true, purchase: true, accounts: true, telephone: true, maintenance: false, financeOps: true, canVoid: true, canDiscount: true, canAdjustStock: true, canDeleteProducts: false, canExport: true },
  },
  {
    id: 'u-cashier', username: 'cashier', password: 'cashier123', fullName: 'Sarah Johnson',
    role: 'cashier', phone: '+233 24 333 4444', email: 'sarah@sylhn.com', active: true,
    createdAt: '2026-01-01',
    permissions: { pos: true, sales: true, stock: false, purchase: false, accounts: false, telephone: true, maintenance: false, financeOps: false, canVoid: false, canDiscount: true, canAdjustStock: false, canDeleteProducts: false, canExport: false },
  },
];

const DEFAULT_SETTINGS: SystemSettings = {
  companyName: COMPANY.name,
  currency: 'GHC',
  taxRate: 15,
  taxName: 'VAT',
  lowStockThreshold: 10,
  receiptFooter: 'Thank you for shopping with us!',
  autoBackup: true,
  sessionTimeout: 30,
  requirePasswordForVoid: true,
  requirePasswordForDiscount: false,
  requirePasswordForAdjust: true,
  maxDiscountPercent: 20,
};

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; desc: string }> = {
  admin: { label: 'Administrator', color: 'text-rose-700', bg: 'bg-rose-100', desc: 'Full system access' },
  manager: { label: 'Manager', color: 'text-blue-700', bg: 'bg-blue-100', desc: 'Operations + finance access' },
  cashier: { label: 'Cashier', color: 'text-emerald-700', bg: 'bg-emerald-100', desc: 'POS + sales only' },
  stockkeeper: { label: 'Stock Keeper', color: 'text-amber-700', bg: 'bg-amber-100', desc: 'Stock management only' },
  accountant: { label: 'Accountant', color: 'text-purple-700', bg: 'bg-purple-100', desc: 'Accounts + finance only' },
};

const USERS_KEY = 'sylhn-system-users';
const SETTINGS_KEY = 'sylhn-system-settings';
const AUDIT_KEY = 'sylhn-audit-log';
const SESSION_KEY = 'sylhn-current-user';

// ===== Login Screen =====
export function AdminLogin({ onSuccess, onCancel, adminOnly = false }: { onSuccess: (user: SystemUser) => void; onCancel: () => void; adminOnly?: boolean }) {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const users = useMemo(() => {
    try {
      const cached = localStorage.getItem(USERS_KEY);
      return cached ? JSON.parse(cached) : DEFAULT_USERS;
    } catch { return DEFAULT_USERS; }
  }, []);

  // Reset all credentials back to the factory defaults (admin/admin123, etc.).
  // Useful when the admin password has been changed and forgotten, or when
  // cached user data has become corrupted.
  const handleResetCredentials = () => {
    try {
      localStorage.removeItem(USERS_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('sylhn-login-attempts');
    } catch { /* ignore */ }
    setShowResetConfirm(false);
    setAttempts(0);
    setLocked(false);
    setError('');
    setUsername('');
    setPassword('');
    toast({
      title: 'Credentials reset',
      description: 'Default users restored. Sign in with admin / admin123.',
    });
    // Force re-mount of the login component so the users useMemo re-reads
    // from DEFAULT_USERS instead of the (now-cleared) cache.
    setTimeout(() => window.location.reload(), 400);
  };

  const handleLogin = () => {
    if (locked) return;
    if (!username || !password) { setError('Enter username and password'); return; }

    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setLocked(true);
        setError('Account locked after 3 failed attempts. Try again in 30 seconds.');
        setTimeout(() => { setLocked(false); setAttempts(0); setError(''); }, 30000);
      } else {
        setError(`Invalid credentials. ${3 - newAttempts} attempt(s) remaining.`);
      }
      return;
    }

    if (!user.active) { setError('Account is deactivated. Contact administrator.'); return; }
    if (adminOnly && user.role !== 'admin' && user.role !== 'manager') { setError('Insufficient privileges. Admin or Manager access required.'); return; }

    // Update last login
    const updated = users.map(u => u.id === user.id ? { ...u, lastLogin: new Date().toISOString() } : u);
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));

    toast({ title: `Welcome, ${user.fullName}`, description: `Logged in as ${ROLE_CONFIG[user.role].label}` });
    onSuccess(user);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="w-full max-w-sm">
        {/* Logo / Icon */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-rose-500 via-pink-600 to-purple-700 flex items-center justify-center shadow-2xl ring-4 ring-white/10 mb-3">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">{adminOnly ? 'Admin Access' : 'Sign In'}</h2>
          <p className="text-xs text-slate-400">{COMPANY.name} · {adminOnly ? 'Administrative Panel' : 'Point of Sale System'}</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/20">
          <div className="px-5 sm:px-8 py-5 sm:py-6 space-y-4">
            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-xs">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
              </motion.div>
            )}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} disabled={locked} placeholder="Enter username" className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-100 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none text-sm font-medium transition bg-slate-50/50 disabled:opacity-50" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} disabled={locked} placeholder="Enter password" className="w-full h-11 pl-10 pr-10 rounded-xl border-2 border-slate-100 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none text-sm font-medium transition bg-slate-50/50 disabled:opacity-50" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><Eye className="h-4 w-4" /></button>
              </div>
            </div>
            <button onClick={handleLogin} disabled={locked} className="w-full h-11 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white text-sm font-bold transition shadow-lg shadow-rose-500/30 disabled:opacity-50 flex items-center justify-center gap-2">
              <KeyRound className="h-4 w-4" /> {locked ? 'Locked — Wait...' : 'Sign In'}
            </button>
          </div>

          {/* Demo credentials hint */}
          <div className="px-5 sm:px-8 py-3 bg-slate-50 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Demo Credentials</div>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold transition underline-offset-2 hover:underline"
                title="Restore admin/manager/cashier to default passwords"
              >
                Reset password
              </button>
            </div>
            <div className="text-[10px] text-slate-500 font-mono space-y-0.5">
              {adminOnly ? (
                <>
                  <div>admin / admin123 <span className="text-rose-500">(Administrator)</span></div>
                  <div>manager / manager123 <span className="text-blue-500">(Manager)</span></div>
                </>
              ) : (
                <>
                  <div>admin / admin123 <span className="text-rose-500">(Administrator)</span></div>
                  <div>manager / manager123 <span className="text-blue-500">(Manager)</span></div>
                  <div>cashier / cashier123 <span className="text-emerald-500">(Cashier)</span></div>
                </>
              )}
            </div>
          </div>
        </div>

        <button onClick={onCancel} className="w-full mt-4 text-xs text-slate-400 hover:text-white transition">{adminOnly ? '← Back to POS' : 'Login required to continue'}</button>
      </motion.div>

      {/* ===== Reset Credentials Confirmation Dialog ===== */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowResetConfirm(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-rose-500 text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold">Reset all credentials?</h3>
            </div>
            <div className="px-6 py-4 text-xs text-slate-600 space-y-2">
              <p>This will restore the default users and passwords:</p>
              <ul className="font-mono text-[11px] text-slate-700 bg-slate-50 rounded-lg p-2 space-y-0.5">
                <li>admin / admin123</li>
                <li>manager / manager123</li>
                <li>cashier / cashier123</li>
              </ul>
              <p className="text-rose-600 font-semibold">Any users you added or passwords you changed will be lost.</p>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="h-9 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleResetCredentials}
                className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" /> Yes, reset
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// ===== Admin Panel =====
type AdminTab = 'users' | 'permissions' | 'settings' | 'audit';

export function AdminPanel({ currentUser, onBack }: { currentUser: SystemUser; onBack: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load from localStorage
  useEffect(() => {
    try {
      const u = localStorage.getItem(USERS_KEY);
      setUsers(u ? JSON.parse(u) : DEFAULT_USERS);
      const s = localStorage.getItem(SETTINGS_KEY);
      setSettings(s ? JSON.parse(s) : DEFAULT_SETTINGS);
      const a = localStorage.getItem(AUDIT_KEY);
      setAuditLog(a ? JSON.parse(a) : []);
    } catch { /* ignore */ }
  }, []);

  // Persist
  useEffect(() => { try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {} }, [users]);
  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} }, [settings]);

  const logAction = (action: string, module: string, details: string, severity: 'info' | 'warning' | 'critical' = 'info') => {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}`, timestamp: new Date().toISOString(),
      user: currentUser.username, action, module, details, severity,
    };
    setAuditLog(prev => {
      const updated = [entry, ...prev].slice(0, 500);
      try { localStorage.setItem(AUDIT_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveUser = (user: SystemUser) => {
    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === user.id ? user : u));
      logAction('User Updated', 'Admin', `Updated user: ${user.username} (${user.fullName})`);
      toast({ title: 'User updated', description: user.fullName });
    } else {
      setUsers(prev => [...prev, user]);
      logAction('User Created', 'Admin', `Created user: ${user.username} (${user.fullName}) as ${ROLE_CONFIG[user.role].label}`);
      toast({ title: 'User created', description: `${user.fullName} (${ROLE_CONFIG[user.role].label})` });
    }
    setShowUserForm(false);
    setEditingUser(null);
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    if (user?.role === 'admin') { toast({ title: 'Cannot delete admin', description: 'Administrator accounts cannot be deleted', variant: 'destructive' }); return; }
    if (id === currentUser.id) { toast({ title: 'Cannot delete yourself', variant: 'destructive' }); return; }
    setUsers(prev => prev.filter(u => u.id !== id));
    logAction('User Deleted', 'Admin', `Deleted user: ${user?.username}`, 'warning');
    toast({ title: 'User deleted', description: user?.fullName });
  };

  const toggleUserActive = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u));
    const user = users.find(u => u.id === id);
    logAction(user?.active ? 'User Deactivated' : 'User Activated', 'Admin', `${user?.username}: ${user?.active ? 'deactivated' : 'activated'}`, 'warning');
    toast({ title: user?.active ? 'User deactivated' : 'User activated', description: user?.fullName });
  };

  const handleSaveSettings = () => {
    logAction('Settings Updated', 'Admin', `System settings updated by ${currentUser.username}`);
    toast({ title: 'Settings saved', description: 'System configuration updated' });
  };

  const tabs = [
    { id: 'users' as const, label: 'Users', icon: Users, color: 'rose' },
    { id: 'permissions' as const, label: 'Permissions', icon: Shield, color: 'blue' },
    { id: 'settings' as const, label: 'Settings', icon: Settings, color: 'amber' },
    { id: 'audit' as const, label: 'Audit Log', icon: Activity, color: 'emerald' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-rose-50/20 to-slate-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-rose-900 to-slate-900 text-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center ring-1 ring-white/20">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Administrative Panel</div>
                <div className="text-[10px] text-slate-300">{COMPANY.name}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-semibold">{currentUser.fullName}</div>
              <div className="text-[10px] text-slate-400">{ROLE_CONFIG[currentUser.role].label}</div>
            </div>
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold", ROLE_CONFIG[currentUser.role].bg, ROLE_CONFIG[currentUser.role].color)}>
              {currentUser.fullName.charAt(0)}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 px-6 py-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all", tab === t.id ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6" style={{ scrollbarWidth: 'thin' }}>
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

              {/* ===== USERS TAB ===== */}
              {tab === 'users' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="rounded-2xl p-4 bg-rose-50 ring-1 ring-rose-200"><div className="text-xs font-bold text-rose-700 uppercase mb-1">Total Users</div><div className="text-xl font-bold text-slate-800">{users.length}</div></div>
                    <div className="rounded-2xl p-4 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-xs font-bold text-emerald-700 uppercase mb-1">Active</div><div className="text-xl font-bold text-emerald-600">{users.filter(u => u.active).length}</div></div>
                    <div className="rounded-2xl p-4 bg-slate-100 ring-1 ring-slate-200"><div className="text-xs font-bold text-slate-500 uppercase mb-1">Inactive</div><div className="text-xl font-bold text-slate-600">{users.filter(u => !u.active).length}</div></div>
                    <div className="rounded-2xl p-4 bg-amber-50 ring-1 ring-amber-200"><div className="text-xs font-bold text-amber-700 uppercase mb-1">Admins</div><div className="text-xl font-bold text-amber-600">{users.filter(u => u.role === 'admin').length}</div></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search users..." className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-rose-400" />
                    </div>
                    <div className="flex-1" />
                    <button onClick={() => { setEditingUser(null); setShowUserForm(true); }} className="h-9 px-4 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 text-white text-sm font-bold flex items-center gap-1.5 shadow-md"><Plus className="h-4 w-4" /> Add User</button>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2.5">User</th><th className="text-left px-3 py-2.5">Role</th><th className="text-left px-3 py-2.5">Contact</th><th className="text-center px-3 py-2.5">Status</th><th className="text-center px-3 py-2.5">Last Login</th><th className="text-center px-4 py-2.5">Actions</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((u, i) => (
                          <tr key={u.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold", ROLE_CONFIG[u.role].bg, ROLE_CONFIG[u.role].color)}>{u.fullName.charAt(0)}</div><div><div className="font-semibold text-slate-800 text-sm">{u.fullName}</div><div className="text-[10px] text-slate-400 font-mono">@{u.username}</div></div></div></td>
                            <td className="px-3 py-2.5"><span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold", ROLE_CONFIG[u.role].bg, ROLE_CONFIG[u.role].color)}>{ROLE_CONFIG[u.role].label}</span></td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{u.phone || '—'}<br />{u.email || '—'}</td>
                            <td className="px-3 py-2.5 text-center"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", u.active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>{u.active ? 'Active' : 'Inactive'}</span></td>
                            <td className="px-3 py-2.5 text-center text-[10px] text-slate-400">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-GB') : 'Never'}</td>
                            <td className="px-4 py-2.5"><div className="flex items-center justify-center gap-1">
                              <button onClick={() => { setEditingUser(u); setShowUserForm(true); }} className="h-7 w-7 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => toggleUserActive(u.id)} className={cn("h-7 w-7 rounded flex items-center justify-center", u.active ? "bg-amber-100 text-amber-600 hover:bg-amber-200" : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200")}><Power className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDeleteUser(u.id)} className="h-7 w-7 rounded bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== PERMISSIONS TAB ===== */}
              {tab === 'permissions' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                    <div className="px-5 py-3 bg-blue-50 border-b border-blue-100"><span className="text-sm font-bold text-slate-700">Role Permissions Matrix</span></div>
                    <div className="overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                      <table className="w-full text-sm">
                        <thead><tr className="bg-slate-800 text-white text-xs uppercase"><th className="text-left px-4 py-2.5 sticky left-0 bg-slate-800">Permission</th><th className="text-center px-3 py-2.5">Admin</th><th className="text-center px-3 py-2.5">Manager</th><th className="text-center px-3 py-2.5">Cashier</th><th className="text-center px-3 py-2.5">Stock Keeper</th><th className="text-center px-3 py-2.5">Accountant</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { key: 'pos', label: 'POS Access' },
                            { key: 'sales', label: 'Sales Menu' },
                            { key: 'stock', label: 'Stock Management' },
                            { key: 'purchase', label: 'Purchase Management' },
                            { key: 'accounts', label: 'Accounts & Reports' },
                            { key: 'telephone', label: 'Telephone Module' },
                            { key: 'maintenance', label: 'System Maintenance' },
                            { key: 'financeOps', label: 'Financial Operations' },
                            { key: 'canVoid', label: 'Void Transactions' },
                            { key: 'canDiscount', label: 'Apply Discounts' },
                            { key: 'canAdjustStock', label: 'Adjust Stock Quantities' },
                            { key: 'canDeleteProducts', label: 'Delete Products' },
                            { key: 'canExport', label: 'Export Data' },
                          ].map(perm => {
                            const roles: UserRole[] = ['admin', 'manager', 'cashier', 'stockkeeper', 'accountant'];
                            const defaults: Record<UserRole, boolean> = {
                              admin: true,
                              manager: ['pos','sales','stock','purchase','accounts','telephone','financeOps','canVoid','canDiscount','canAdjustStock','canExport'].includes(perm.key),
                              cashier: ['pos','sales','telephone','canDiscount'].includes(perm.key),
                              stockkeeper: ['stock','canAdjustStock','canExport'].includes(perm.key),
                              accountant: ['accounts','financeOps','canExport'].includes(perm.key),
                            };
                            return (
                              <tr key={perm.key} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5 font-medium text-slate-700 sticky left-0 bg-white">{perm.label}</td>
                                {roles.map(role => (
                                  <td key={role} className="text-center px-3 py-2.5">
                                    {defaults[role] ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : <X className="h-4 w-4 text-slate-300 mx-auto" />}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 ring-1 ring-blue-200 text-xs text-blue-700">
                    <strong>Note:</strong> Individual user permissions can be customized when editing a user. The matrix above shows the default permissions for each role. Admins always have full access and cannot be restricted.
                  </div>
                </div>
              )}

              {/* ===== SETTINGS TAB ===== */}
              {tab === 'settings' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                    <div className="px-5 py-3 bg-amber-50 border-b border-amber-100"><span className="text-sm font-bold text-slate-700">System Configuration</span></div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Company Name</label><input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm" /></div>
                        <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Currency Symbol</label><input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm" /></div>
                        <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Tax Rate (%)</label><input type="number" value={settings.taxRate} onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm font-mono" /></div>
                        <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Tax Name</label><input value={settings.taxName} onChange={(e) => setSettings({ ...settings, taxName: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm" /></div>
                        <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Low Stock Threshold</label><input type="number" value={settings.lowStockThreshold} onChange={(e) => setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm font-mono" /></div>
                        <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Max Discount (%)</label><input type="number" value={settings.maxDiscountPercent} onChange={(e) => setSettings({ ...settings, maxDiscountPercent: parseInt(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm font-mono" /></div>
                        <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Session Timeout (minutes)</label><input type="number" value={settings.sessionTimeout} onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm font-mono" /></div>
                        <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Receipt Footer</label><input value={settings.receiptFooter} onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-amber-400 text-sm" /></div>
                      </div>
                      <div className="border-t border-slate-100 pt-4">
                        <div className="text-xs font-bold text-slate-600 uppercase mb-3">Security Settings</div>
                        <div className="space-y-2">
                          {[
                            { key: 'requirePasswordForVoid', label: 'Require password to void transactions' },
                            { key: 'requirePasswordForDiscount', label: 'Require password for discounts above threshold' },
                            { key: 'requirePasswordForAdjust', label: 'Require password for stock adjustments' },
                            { key: 'autoBackup', label: 'Auto-backup data to browser storage' },
                          ].map(s => (
                            <label key={s.key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                              <input type="checkbox" checked={(settings as any)[s.key]} onChange={(e) => setSettings({ ...settings, [s.key]: e.target.checked })} className="h-4 w-4 accent-rose-600" />
                              <span className="text-sm text-slate-700">{s.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <button onClick={handleSaveSettings} className="h-10 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold flex items-center gap-2 shadow-md"><Save className="h-4 w-4" /> Save Settings</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== AUDIT LOG TAB ===== */}
              {tab === 'audit' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-2xl p-4 bg-emerald-50 ring-1 ring-emerald-200"><div className="text-xs font-bold text-emerald-700 uppercase mb-1">Total Events</div><div className="text-xl font-bold text-slate-800">{auditLog.length}</div></div>
                    <div className="rounded-2xl p-4 bg-amber-50 ring-1 ring-amber-200"><div className="text-xs font-bold text-amber-700 uppercase mb-1">Warnings</div><div className="text-xl font-bold text-amber-600">{auditLog.filter(a => a.severity === 'warning').length}</div></div>
                    <div className="rounded-2xl p-4 bg-rose-50 ring-1 ring-rose-200"><div className="text-xs font-bold text-rose-700 uppercase mb-1">Critical</div><div className="text-xl font-bold text-rose-600">{auditLog.filter(a => a.severity === 'critical').length}</div></div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                    <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between"><span className="text-sm font-bold text-slate-700">Activity Log (Last 500 events)</span></div>
                    <div className="max-h-96 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                      {auditLog.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">No activity logged yet</div> : auditLog.map((entry, i) => (
                        <div key={entry.id} className={cn("flex items-start gap-3 px-5 py-3 border-b border-slate-50", i % 2 === 1 && 'bg-slate-50/30')}>
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", entry.severity === 'critical' ? 'bg-rose-100 text-rose-600' : entry.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')}>
                            {entry.severity === 'critical' ? <AlertTriangle className="h-4 w-4" /> : entry.severity === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-800">{entry.action}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">{entry.module}</span></div>
                            <div className="text-xs text-slate-500">{entry.details}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{new Date(entry.timestamp).toLocaleString('en-GB')} · by {entry.user}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

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
function UserFormModal({ user, onSave, onClose }: { user: SystemUser | null; onSave: (u: SystemUser) => void; onClose: () => void }) {
  const [form, setForm] = useState<SystemUser>(user || {
    id: `u-${Date.now()}`, username: '', password: '', fullName: '', role: 'cashier', phone: '', email: '', active: true,
    createdAt: new Date().toISOString(),
    permissions: { pos: true, sales: true, stock: false, purchase: false, accounts: false, telephone: true, maintenance: false, financeOps: false, canVoid: false, canDiscount: true, canAdjustStock: false, canDeleteProducts: false, canExport: false },
  });

  const togglePermission = (key: keyof UserPermissions) => {
    if (form.role === 'admin') return; // Admin always has all permissions
    setForm({ ...form, permissions: { ...form.permissions, [key]: !form.permissions[key] } });
  };

  const permissionLabels: { key: keyof UserPermissions; label: string }[] = [
    { key: 'pos', label: 'POS' }, { key: 'sales', label: 'Sales' }, { key: 'stock', label: 'Stock' },
    { key: 'purchase', label: 'Purchase' }, { key: 'accounts', label: 'Accounts' }, { key: 'telephone', label: 'Telephone' },
    { key: 'maintenance', label: 'Maintenance' }, { key: 'financeOps', label: 'Finance Ops' },
    { key: 'canVoid', label: 'Void' }, { key: 'canDiscount', label: 'Discount' }, { key: 'canAdjustStock', label: 'Adjust Stock' },
    { key: 'canDeleteProducts', label: 'Delete Products' }, { key: 'canExport', label: 'Export' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white"><h3 className="text-lg font-bold">{user ? 'Edit User' : 'Add User'}</h3><button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ scrollbarWidth: 'thin' }}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Full Name</label><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm" /></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Username</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm font-mono" /></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Password</label><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm font-mono" /></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm">{Object.entries(ROLE_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm" /></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-rose-400 text-sm" /></div>
          </div>
          {/* Permissions */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">{form.role === 'admin' ? 'Permissions (Admin has full access)' : 'Custom Permissions'}</label>
            <div className="grid grid-cols-3 gap-2">
              {permissionLabels.map(p => (
                <label key={p.key} className={cn("flex items-center gap-1.5 p-2 rounded-lg cursor-pointer text-xs", form.permissions[p.key] ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50 ring-1 ring-slate-100", form.role === 'admin' && "opacity-60 cursor-not-allowed")}>
                  <input type="checkbox" checked={form.permissions[p.key]} onChange={() => togglePermission(p.key)} disabled={form.role === 'admin'} className="h-3.5 w-3.5 accent-rose-600" />
                  <span className="text-slate-700 font-medium">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => form.fullName && form.username && form.password && onSave(form)} disabled={!form.fullName || !form.username || !form.password} className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700">{user ? 'Update User' : 'Create User'}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
