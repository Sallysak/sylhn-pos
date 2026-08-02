"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Edit2, Trash2, Key, Shield, Power, X, Save, Check,
  Loader2, AlertTriangle, Lock, Eye, EyeOff, UserCog, Settings2,
  CreditCard, Package, FileText, Wallet, Phone, RotateCcw, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";
import { cn } from "@/lib/utils";

interface UserRecord {
  id: string;
  username: string;
  fullName: string;
  role: string;
  phone: string;
  email: string;
  active: boolean;
  permissions: string;
  lastLogin: string | null;
  createdAt: string;
  twoFactorEnabled: boolean;
  passwordResetRequired: boolean;
  _count?: { sales: number; auditLogs: number; shifts: number };
}

// All configurable permissions
const ALL_PERMISSIONS = [
  { key: "pos", label: "POS (Checkout)", icon: CreditCard, color: "text-emerald-600" },
  { key: "sales", label: "Sales Reports", icon: FileText, color: "text-blue-600" },
  { key: "stock", label: "Stock Management", icon: Package, color: "text-amber-600" },
  { key: "purchase", label: "Purchasing", icon: Package, color: "text-violet-600" },
  { key: "accounts", label: "Accounts", icon: Wallet, color: "text-rose-600" },
  { key: "telephone", label: "Telephone/Orders", icon: Phone, color: "text-cyan-600" },
  { key: "maintenance", label: "Maintenance", icon: Settings2, color: "text-slate-600" },
  { key: "financeOps", label: "Finance Operations", icon: Wallet, color: "text-indigo-600" },
  { key: "canVoid", label: "Void Transactions", icon: RotateCcw, color: "text-rose-600" },
  { key: "canDiscount", label: "Apply Discounts", icon: Tag, color: "text-amber-600" },
  { key: "canAdjustStock", label: "Adjust Stock", icon: Package, color: "text-violet-600" },
  { key: "canDeleteProducts", label: "Delete Products", icon: Trash2, color: "text-rose-600" },
  { key: "canExport", label: "Export Data", icon: FileText, color: "text-blue-600" },
];

// Import Tag icon
import { Tag } from "lucide-react";

const ROLE_PRESETS: Record<string, Record<string, boolean>> = {
  admin: Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, true])),
  manager: Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, !["canDeleteProducts"].includes(p.key)])),
  cashier: Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, ["pos", "sales", "telephone", "canDiscount"].includes(p.key)])),
  stockkeeper: Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, ["pos", "stock", "purchase", "canAdjustStock", "canExport"].includes(p.key)])),
  accountant: Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, ["pos", "accounts", "financeOps", "canExport"].includes(p.key)])),
};

const roleColors: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  cashier: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  stockkeeper: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  accountant: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};

export function PremiumUserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState<UserRecord | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState<UserRecord | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
      else toast({ title: "Failed to load users", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleActive = async (user: UserRecord) => {
    try {
      const res = await authedFetch(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !user.active }),
      });
      if (res.ok) {
        toast({ title: user.active ? "User deactivated" : "User activated", description: user.fullName });
        fetchUsers();
      } else {
        const data = await res.json();
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const handleDelete = async (user: UserRecord) => {
    if (!confirm(`Permanently delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      const res = await authedFetch(`/api/users/${user.id}?force=true`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "User deleted", description: user.fullName });
        fetchUsers();
      } else {
        const data = await res.json();
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const filtered = users.filter(u =>
    !search ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full bg-white dark:bg-slate-900 rounded-2xl shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-800 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          <h2 className="text-base font-bold text-slate-800 dark:text-white">User Management</h2>
          <Badge variant="outline" className="font-mono text-xs">{users.length} users</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="pl-8 h-8 w-40 text-xs"
            />
          </div>
          <Button onClick={() => { setEditingUser(null); setShowAddDialog(true); }} size="sm" className="bg-gradient-to-r from-slate-700 to-slate-800">
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {loading ? (
          <div className="text-center py-12 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" /> Loading users…
          </div>
        ) : (
          <div className="mobile-scroll-x">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 text-white text-[11px] uppercase tracking-wide z-10">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Username</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Email</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Role</th>
                  <th className="text-center px-3 py-2.5 font-semibold hidden sm:table-cell">2FA</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden lg:table-cell">Last Login</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(u => (
                  <tr key={u.id} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/50 transition", !u.active && "opacity-50")}>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{u.fullName}</div>
                      {u._count && <div className="text-[9px] text-slate-400">{u._count.sales} sales · {u._count.auditLogs} logs</div>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">{u.username}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 hidden md:table-cell">{u.email || "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge className={cn("text-[10px] font-bold", roleColors[u.role] || "bg-slate-100 text-slate-600")}>{u.role}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                      {u.twoFactorEnabled ? <Shield className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {u.active ? <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Active</Badge> : <Badge className="bg-rose-100 text-rose-700 text-[10px]">Inactive</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 hidden lg:table-cell">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setShowPermissionDialog(u)} title="Permissions" className="h-7 w-7 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-center text-blue-600">
                          <Shield className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setShowPasswordDialog(u)} title="Reset Password / Change Username" className="h-7 w-7 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/30 flex items-center justify-center text-amber-600">
                          <Key className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setEditingUser(u); setShowAddDialog(true); }} title="Edit" className="h-7 w-7 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleToggleActive(u)} title={u.active ? "Deactivate" : "Activate"} className="h-7 w-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600">
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(u)} title="Delete" className="h-7 w-7 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center justify-center text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit User Dialog */}
      <AnimatePresence>
        {showAddDialog && (
          <AddEditUserDialog
            user={editingUser}
            onClose={() => { setShowAddDialog(false); setEditingUser(null); }}
            onSaved={() => { setShowAddDialog(false); setEditingUser(null); fetchUsers(); }}
          />
        )}
      </AnimatePresence>

      {/* Permission Matrix Dialog */}
      <AnimatePresence>
        {showPermissionDialog && (
          <PermissionDialog
            user={showPermissionDialog}
            onClose={() => setShowPermissionDialog(null)}
            onSaved={() => { setShowPermissionDialog(null); fetchUsers(); }}
          />
        )}
      </AnimatePresence>

      {/* Password/Username Change Dialog */}
      <AnimatePresence>
        {showPasswordDialog && (
          <PasswordChangeDialog
            user={showPasswordDialog}
            onClose={() => setShowPasswordDialog(null)}
            onSaved={() => { setShowPasswordDialog(null); fetchUsers(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Add/Edit User Dialog =====
function AddEditUserDialog({ user, onClose, onSaved }: { user: UserRecord | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    username: user?.username || "",
    fullName: user?.fullName || "",
    role: user?.role || "cashier",
    phone: user?.phone || "",
    email: user?.email || "",
    password: user ? "" : "", // only for new users
    active: user?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!form.username.trim() || !form.fullName.trim()) {
      toast({ title: "Username and full name are required", variant: "destructive" });
      return;
    }
    if (!user && !form.password) {
      toast({ title: "Password required for new users", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (user) {
        // Update existing
        const res = await authedFetch(`/api/users/${user.id}`, {
          method: "PUT",
          body: JSON.stringify({
            username: form.username,
            fullName: form.fullName,
            role: form.role,
            phone: form.phone,
            email: form.email,
            active: form.active,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          toast({ title: "User updated", description: form.fullName });
          onSaved();
        } else {
          toast({ title: "Failed", description: data.error, variant: "destructive" });
        }
      } else {
        // Create new
        const res = await authedFetch("/api/users", {
          method: "POST",
          body: JSON.stringify({
            username: form.username,
            fullName: form.fullName,
            role: form.role,
            phone: form.phone,
            email: form.email,
            password: form.password,
            permissions: ROLE_PRESETS[form.role] || {},
          }),
        });
        const data = await res.json();
        if (res.ok) {
          toast({ title: "User created", description: form.fullName });
          onSaved();
        } else {
          toast({ title: "Failed", description: data.error, variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "Add New User"}</DialogTitle>
          <DialogDescription>{user ? "Update user details." : "Create a new system user with role-based permissions."}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label>Full Name *</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <Label>Username *</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <Label>Role</Label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-9 px-3 rounded-md border border-slate-200 text-sm">
              <option value="admin">Administrator</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
              <option value="stockkeeper">Stockkeeper</option>
              <option value="accountant">Accountant</option>
            </select>
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {!user && (
            <div className="col-span-2">
              <Label>Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Set initial password" />
            </div>
          )}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded" />
              <span className="text-xs font-medium">Active (can log in)</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {user ? "Update User" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Permission Matrix Dialog =====
function PermissionDialog({ user, onClose, onSaved }: { user: UserRecord; onClose: () => void; onSaved: () => void }) {
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try { setPerms(JSON.parse(user.permissions || "{}")); } catch { setPerms({}); }
  }, [user]);

  const togglePerm = (key: string) => {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const applyPreset = (role: string) => {
    setPerms({ ...ROLE_PRESETS[role] });
    toast({ title: `Applied ${role} preset`, description: "Review and save to confirm." });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authedFetch(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ permissions: perms }),
      });
      if (res.ok) {
        toast({ title: "Permissions updated", description: user.fullName });
        onSaved();
      } else {
        const data = await res.json();
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            Permissions — {user.fullName}
          </DialogTitle>
          <DialogDescription>Toggle individual permissions or apply a role preset.</DialogDescription>
        </DialogHeader>

        {/* Role presets */}
        <div className="flex flex-wrap gap-1.5 py-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase mr-1 self-center">Presets:</span>
          {Object.keys(ROLE_PRESETS).map(role => (
            <button
              key={role}
              onClick={() => applyPreset(role)}
              className={cn("px-2 py-1 rounded-md text-[10px] font-semibold transition", roleColors[role], "hover:opacity-80")}
            >
              {role}
            </button>
          ))}
        </div>

        {/* Permission grid */}
        <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto py-2">
          {ALL_PERMISSIONS.map(perm => {
            const enabled = perms[perm.key] === true;
            return (
              <button
                key={perm.key}
                onClick={() => togglePerm(perm.key)}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg ring-1 transition text-left",
                  enabled
                    ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-900/20 dark:ring-emerald-800"
                    : "bg-slate-50 ring-slate-200 dark:bg-slate-800/50 dark:ring-slate-700"
                )}
              >
                <perm.icon className={cn("h-4 w-4 flex-shrink-0", enabled ? perm.color : "text-slate-300")} />
                <span className={cn("text-xs font-medium flex-1", enabled ? "text-slate-800 dark:text-slate-200" : "text-slate-400")}>{perm.label}</span>
                {enabled && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Password Reset + Username Change Dialog =====
function PasswordChangeDialog({ user, onClose, onSaved }: { user: UserRecord; onClose: () => void; onSaved: () => void }) {
  const [newUsername, setNewUsername] = useState(user.username);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    const changes: string[] = [];
    const body: any = {};
    if (newUsername !== user.username) {
      body.username = newUsername;
      changes.push("username");
    }
    if (newPassword) {
      body.newPassword = newPassword;
      changes.push("password");
    }
    if (changes.length === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    setSaving(true);
    try {
      const res = await authedFetch(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Updated", description: `${user.fullName}: ${changes.join(" + ")} changed` });
        onSaved();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-amber-600" />
            Security — {user.fullName}
          </DialogTitle>
          <DialogDescription>Change username or reset password for this user.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Username</Label>
            <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="font-mono" />
            {newUsername !== user.username && <p className="text-[10px] text-amber-600 mt-1">⚠️ Username will change — user must use the new username to log in.</p>}
          </div>
          <div>
            <Label>Reset Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                className="pr-9"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Admin can set any password. User should change it after logging in.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
