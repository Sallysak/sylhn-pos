"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit2, Plus, Trash2, Mail, Send, Printer, X,
  User,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { PopupWindow } from "@/components/popup-window";
import { AddTelephoneForm, type PhoneDirectoryEntry } from "@/components/add-telephone-form";

// Re-export the entry type so consumers can import it from this module
export type { PhoneDirectoryEntry };

// ===== Light blue palette (matches reference image) =====
const LIGHT_BLUE_BG = '#D6E6F5';        // light blue main background
const HEADER_BLUE = '#1E5A8E';           // dark blue title bar
const BTN_ICON_BLUE = '#1E5A8E';         // dark blue icons on buttons
const BTN_HOVER = '#B9D7EE';             // button hover
const FIELD_BORDER = '#808080';
const GRID_LINE = '#000000';

// ===== Initial directory data (sample contacts) =====
const initialDirectory: PhoneDirectoryEntry[] = [
  {
    id: 'td1', title: 'Mr', name: 'Ama Osei', address: 'East Legon, Accra', city: 'Accra',
    state: 'Greater Accra', code: 'GL-001', country: 'Ghana',
    homeTel: '+233 30 111 2222', workTel: '+233 30 555 6666', mobile: '+233 24 111 2222',
    fax: '+233 30 111 3333', website: 'www.oseienterprises.com', email: 'ama.osei@email.com',
    notes: 'VIP customer · Wholesale buyer', group: 'VIP Customers',
  },
  {
    id: 'td2', title: 'Mrs', name: 'Kwame Mensah', address: 'Osu, Accra', city: 'Accra',
    state: 'Greater Accra', code: 'GL-002', country: 'Ghana',
    homeTel: '+233 30 333 4444', workTel: '', mobile: '+233 24 333 4444',
    fax: '', website: '', email: 'kwame.m@email.com',
    notes: 'Regular phone orders', group: 'Customers',
  },
  {
    id: 'td3', title: 'Ms', name: 'Akosua Frimpong', address: 'Adenta, Accra', city: 'Accra',
    state: 'Greater Accra', code: 'GL-003', country: 'Ghana',
    homeTel: '+233 30 555 7777', workTel: '+233 30 999 0000', mobile: '+233 24 555 6666',
    fax: '+233 30 555 8888', website: 'frimpongfarms.com', email: 'akosua.f@email.com',
    notes: 'Farm supplier', group: 'Suppliers',
  },
  {
    id: 'td4', title: 'Mr', name: 'Yao Adjei', address: 'Tema, Greater Accra', city: 'Tema',
    state: 'Greater Accra', code: 'TM-001', country: 'Ghana',
    homeTel: '', workTel: '+233 30 222 1111', mobile: '+233 24 777 8888',
    fax: '', website: '', email: 'yao.adjei@email.com',
    notes: 'Delivery contact', group: 'Customers',
  },
  {
    id: 'td5', title: 'Dr', name: 'Kofi Asante', address: 'Kumasi, Ashanti', city: 'Kumasi',
    state: 'Ashanti', code: 'AS-001', country: 'Ghana',
    homeTel: '+233 51 222 333', workTel: '+233 51 444 555', mobile: '+233 20 111 2222',
    fax: '', website: '', email: 'kofi.asante@email.com',
    notes: 'Bulk orders · Monthly', group: 'Wholesale',
  },
  {
    id: 'td6', title: 'Mr', name: 'AgriCorp Ghana', address: 'Kumasi, Ashanti Region', city: 'Kumasi',
    state: 'Ashanti', code: 'AS-002', country: 'Ghana',
    homeTel: '', workTel: '+233 51 100 200', mobile: '+233 24 111 9999',
    fax: '+233 51 100 300', website: 'www.agricorp.gh', email: 'sales@agricorp.gh',
    notes: 'Primary supplier · Fruits', group: 'Suppliers',
  },
  {
    id: 'td7', title: 'Mr', name: 'Fan Milk Ghana', address: 'Tema, Greater Accra', city: 'Tema',
    state: 'Greater Accra', code: 'TM-002', country: 'Ghana',
    homeTel: '', workTel: '+233 30 333 555', mobile: '+233 24 333 4444',
    fax: '', website: 'www.fanmilk.gh', email: 'orders@fanmilk.gh',
    notes: 'Dairy supplier', group: 'Suppliers',
  },
  {
    id: 'td8', title: 'Mrs', name: 'Esi Boateng', address: 'Spintex Road, Accra', city: 'Accra',
    state: 'Greater Accra', code: 'GL-004', country: 'Ghana',
    homeTel: '+233 30 888 9999', workTel: '', mobile: '+233 24 999 0000',
    fax: '', website: '', email: 'esi.boateng@email.com',
    notes: 'Frequent customer · Loyalty member', group: 'Customers',
  },
];

interface TelephoneDirectoryProps {
  /** When provided, directory uses these as the data source. Otherwise uses internal initialDirectory. */
  entries?: PhoneDirectoryEntry[];
  /** When provided, parent can sync changes back. */
  onEntriesChange?: (entries: PhoneDirectoryEntry[]) => void;
  onClose: () => void;
  /** When true, opens as its own PopupWindow. When false, opens as overlay. */
  asWindow?: boolean;
  title?: string;
}

export function TelephoneDirectory({
  entries,
  onEntriesChange,
  onClose,
  asWindow = true,
  title = 'My Phone Directory',
}: TelephoneDirectoryProps) {
  const { toast } = useToast();
  const [directory, setDirectory] = useState<PhoneDirectoryEntry[]>(entries ?? initialDirectory);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PhoneDirectoryEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync to parent
  useEffect(() => {
    if (onEntriesChange) onEntriesChange(directory);
  }, [directory, onEntriesChange]);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return directory;
    const q = search.toLowerCase();
    return directory.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.homeTel.includes(q) ||
      e.workTel.includes(q) ||
      e.mobile.includes(q) ||
      e.fax.includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.group || '').toLowerCase().includes(q)
    );
  }, [directory, search]);

  // Keep selectedIndex in range
  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIndex]);

  // ===== Action handlers =====
  const handleModify = () => {
    const entry = filtered[selectedIndex];
    if (!entry) { toast({ title: 'Select an entry first', variant: 'destructive' }); return; }
    setEditingEntry(entry);
    setShowAddForm(true);
  };

  const handleNew = () => {
    setEditingEntry(null);
    setShowAddForm(true);
  };

  const handleDelete = () => {
    const entry = filtered[selectedIndex];
    if (!entry) { toast({ title: 'Select an entry first', variant: 'destructive' }); return; }
    setDirectory(prev => prev.filter(e => e.id !== entry.id));
    toast({ title: 'Entry deleted (F4)', description: entry.name });
  };

  const handleEmail = () => {
    const entry = filtered[selectedIndex];
    if (!entry) { toast({ title: 'Select an entry first', variant: 'destructive' }); return; }
    if (!entry.email) { toast({ title: 'No email for this entry', variant: 'destructive' }); return; }
    toast({ title: 'Email opened', description: `Composing email to ${entry.name} <${entry.email}>` });
  };

  const handleBulkEmail = () => {
    if (filtered.length === 0) { toast({ title: 'No entries to email', variant: 'destructive' }); return; }
    const emails = filtered.filter(e => e.email).map(e => e.email);
    if (emails.length === 0) { toast({ title: 'No emails found', variant: 'destructive' }); return; }
    toast({ title: 'Bulk email (BCC)', description: `Composing bulk email to ${emails.length} contacts` });
  };

  const handleEnvelope = () => {
    const entry = filtered[selectedIndex];
    if (!entry) { toast({ title: 'Select an entry first', variant: 'destructive' }); return; }
    // Open print window for an envelope
    const printWin = window.open('', '_blank', 'width=600,height=400');
    if (!printWin) { toast({ title: 'Popup blocked', variant: 'destructive' }); return; }
    printWin.document.write(`<!DOCTYPE html><html><head><title>Envelope - ${entry.name}</title>
      <style>
        body { margin: 0; padding: 40px; font-family: Arial, sans-serif; }
        .envelope { width: 400px; height: 200px; border: 1px dashed #999; padding: 30px; margin: 0 auto; }
        .addr { font-size: 14px; line-height: 1.5; }
      </style></head><body>
      <div class="envelope">
        <div class="addr">
          <strong>${entry.title} ${entry.name}</strong><br/>
          ${entry.address}<br/>
          ${entry.city}, ${entry.state} ${entry.code}<br/>
          ${entry.country}
        </div>
      </div>
      <script>window.onload = () => { window.print(); };<\/script>
      </body></html>`);
    printWin.document.close();
    toast({ title: 'Printing envelope (F3)', description: `For ${entry.name}` });
  };

  const handleSaveEntry = (entry: PhoneDirectoryEntry) => {
    if (editingEntry) {
      // Modify existing
      setDirectory(prev => prev.map(e => e.id === entry.id ? entry : e));
      toast({ title: 'Entry updated', description: entry.name });
    } else {
      // Add new
      setDirectory(prev => [...prev, entry]);
      toast({ title: 'Entry added', description: entry.name });
      // Auto-select the new entry
      setTimeout(() => {
        setSelectedIndex(directory.length); // index of newly added
      }, 100);
    }
    setShowAddForm(false);
    setEditingEntry(null);
  };

  // ===== Keyboard navigation =====
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); handleModify(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  // Global keyboard shortcuts: F3, F4
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (isTyping) return;
      if (e.key === 'F3') { e.preventDefault(); handleEnvelope(); }
      if (e.key === 'F4') { e.preventDefault(); handleDelete(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selectedIndex]);

  const body = (
    <div className="h-full flex flex-col" style={{ fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: LIGHT_BLUE_BG }}>
      {/* Search Bar */}
      <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor: FIELD_BORDER, backgroundColor: '#E8F0FA' }}>
        <label className="text-[11px] font-bold text-slate-800">Search for:</label>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Type name, phone, email, or group..."
          className="flex-1 h-7 px-2 text-[11px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
          style={{ borderColor: FIELD_BORDER }}
        />
        <span className="text-[10px] text-slate-700 font-mono">{filtered.length} of {directory.length}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
        {/* Header */}
        <div className="flex-shrink-0 grid grid-cols-[1.5fr_1.3fr_1.3fr_1.3fr_1.3fr_2fr] gap-0 px-2 py-1 text-[10px] font-bold border-b-2" style={{ backgroundColor: '#B9D7EE', color: '#000000', borderColor: GRID_LINE }}>
          <div>Name ▲</div>
          <div>Home Tel.</div>
          <div>Work Tel.</div>
          <div>Mobile</div>
          <div>Fax</div>
          <div>Email</div>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div>
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-[11px]">
                <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No entries found. Click <strong>New</strong> to add one.
              </div>
            ) : (
              filtered.map((entry, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedIndex(idx)}
                    onDoubleClick={handleModify}
                    className="grid grid-cols-[1.5fr_1.3fr_1.3fr_1.3fr_1.3fr_2fr] gap-0 px-2 py-0.5 text-[10px] cursor-pointer border-b"
                    style={{
                      backgroundColor: isSelected ? '#A8D0EE' : (idx % 2 === 1 ? '#F0F7FC' : '#FFFFFF'),
                      borderColor: GRID_LINE,
                    }}
                  >
                    <div className="font-semibold text-slate-900 truncate">
                      {entry.title && <span className="text-slate-500 mr-1">{entry.title}</span>}
                      {entry.name}
                    </div>
                    <div className="font-mono text-slate-700 truncate">{entry.homeTel || '—'}</div>
                    <div className="font-mono text-slate-700 truncate">{entry.workTel || '—'}</div>
                    <div className="font-mono text-slate-700 truncate">{entry.mobile || '—'}</div>
                    <div className="font-mono text-slate-700 truncate">{entry.fax || '—'}</div>
                    <div className="text-blue-700 truncate">{entry.email || '—'}</div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 px-3 py-2 flex items-center gap-1.5 flex-wrap border-t" style={{ borderColor: FIELD_BORDER, backgroundColor: '#E8F0FA' }}>
        <button
          onClick={handleModify}
          className="h-8 px-3 rounded border-2 bg-white text-[10px] font-semibold flex items-center gap-1 transition hover:bg-blue-50"
          style={{ borderColor: BTN_ICON_BLUE, color: '#000000' }}
          title="Modify selected entry"
        >
          <Edit2 className="h-3.5 w-3.5" style={{ color: BTN_ICON_BLUE }} />
          Modify
        </button>
        <button
          onClick={handleNew}
          className="h-8 px-3 rounded border-2 bg-white text-[10px] font-semibold flex items-center gap-1 transition hover:bg-blue-50"
          style={{ borderColor: BTN_ICON_BLUE, color: '#000000' }}
          title="Add new entry"
        >
          <Plus className="h-3.5 w-3.5" style={{ color: BTN_ICON_BLUE }} />
          New
        </button>
        <button
          onClick={handleDelete}
          className="h-8 px-3 rounded border-2 bg-white text-[10px] font-semibold flex items-center gap-1 transition hover:bg-rose-50"
          style={{ borderColor: BTN_ICON_BLUE, color: '#000000' }}
          title="Delete entry (F4)"
        >
          <Trash2 className="h-3.5 w-3.5" style={{ color: BTN_ICON_BLUE }} />
          Delete <kbd className="text-[8px] bg-slate-100 px-0.5 rounded font-mono">F4</kbd>
        </button>
        <button
          onClick={handleEmail}
          className="h-8 px-3 rounded border-2 bg-white text-[10px] font-semibold flex items-center gap-1 transition hover:bg-blue-50"
          style={{ borderColor: BTN_ICON_BLUE, color: '#000000' }}
          title="Email this contact"
        >
          <Mail className="h-3.5 w-3.5" style={{ color: BTN_ICON_BLUE }} />
          Email
        </button>
        <button
          onClick={handleBulkEmail}
          className="h-8 px-3 rounded border-2 bg-white text-[10px] font-semibold flex items-center gap-1 transition hover:bg-blue-50"
          style={{ borderColor: BTN_ICON_BLUE, color: '#000000' }}
          title="Send bulk email to filtered contacts"
        >
          <Send className="h-3.5 w-3.5" style={{ color: BTN_ICON_BLUE }} />
          Bulk Email
        </button>
        <button
          onClick={handleEnvelope}
          className="h-8 px-3 rounded border-2 bg-white text-[10px] font-semibold flex items-center gap-1 transition hover:bg-blue-50"
          style={{ borderColor: BTN_ICON_BLUE, color: '#000000' }}
          title="Print envelope (F3)"
        >
          <Printer className="h-3.5 w-3.5" style={{ color: BTN_ICON_BLUE }} />
          Envelop <kbd className="text-[8px] bg-slate-100 px-0.5 rounded font-mono">F3</kbd>
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="h-8 px-3 rounded border-2 bg-white text-[10px] font-semibold flex items-center gap-1 transition hover:bg-rose-50"
          style={{ borderColor: BTN_ICON_BLUE, color: '#000000' }}
          title="Close (Esc)"
        >
          <X className="h-3.5 w-3.5" style={{ color: '#F44336' }} />
          Close <kbd className="text-[8px] bg-slate-100 px-0.5 rounded font-mono">Esc</kbd>
        </button>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 px-3 py-0.5 text-[8px] text-slate-700 flex items-center gap-3" style={{ backgroundColor: '#C8D8E8' }}>
        <span className="font-mono">{filtered.length} entries shown</span>
        <span className="font-mono">· Total: {directory.length}</span>
        <div className="flex-1" />
        <span>↑↓ Navigate · Enter Modify · Esc Close</span>
      </div>

      {/* ===== Add/Edit Telephone Entry Popup ===== */}
      <AnimatePresence>
        {showAddForm && (
          <AddTelephoneForm
            entry={editingEntry}
            onClose={() => { setShowAddForm(false); setEditingEntry(null); }}
            onSave={handleSaveEntry}
            title={editingEntry ? 'Modify Entry' : 'Add New Entry'}
          />
        )}
      </AnimatePresence>
    </div>
  );

  if (asWindow) {
    return (
      <PopupWindow
        title={title}
        titleBarColor={HEADER_BLUE}
        initialWidth={900}
        initialHeight={560}
        minWidth={700}
        minHeight={450}
        onClose={onClose}
      >
        {body}
      </PopupWindow>
    );
  }

  return body;
}
