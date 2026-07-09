"use client";

import { useState, useEffect, useRef } from "react";
import { Save, X, User, Phone, Mail, MapPin, Globe, FileText, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PopupWindow } from "@/components/popup-window";

// ===== Light green / teal palette (matches reference image) =====
const LIGHT_GREEN_BG = '#D6EBD0';       // light green main background
const HEADER_GREEN = '#4CAF50';          // green title bar
const BTN_BLUE = '#2196F3';
const BTN_RED = '#F44336';
const FIELD_BORDER = '#808080';
const LABEL_COLOR = '#000000';

export interface PhoneDirectoryEntry {
  id: string;
  title: string;
  name: string;
  address: string;
  city: string;
  state: string;
  code: string;
  country: string;
  homeTel: string;
  workTel: string;
  mobile: string;
  fax: string;
  website: string;
  email: string;
  notes: string;
  group: string;
}

const EMPTY_ENTRY: PhoneDirectoryEntry = {
  id: '',
  title: '',
  name: '',
  address: '',
  city: '',
  state: '',
  code: '',
  country: 'Ghana',
  homeTel: '',
  workTel: '',
  mobile: '',
  fax: '',
  website: '',
  email: '',
  notes: '',
  group: '',
};

interface AddTelephoneFormProps {
  /** Existing entry to edit (for Modify mode). null = new entry. */
  entry?: PhoneDirectoryEntry | null;
  onClose: () => void;
  onSave: (entry: PhoneDirectoryEntry) => void;
  /** When true, opens as its own PopupWindow. When false, opens as a centered overlay (used inside other popups). */
  asOverlay?: boolean;
  title?: string;
}

export function AddTelephoneForm({
  entry = null,
  onClose,
  onSave,
  asOverlay = true,
  title = 'Add New Entry',
}: AddTelephoneFormProps) {
  const { toast } = useToast();
  const isEditing = !!entry;
  const [form, setForm] = useState<PhoneDirectoryEntry>(entry || { ...EMPTY_ENTRY, id: `tel-${Date.now()}` });
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const setField = <K extends keyof PhoneDirectoryEntry>(key: K, value: PhoneDirectoryEntry[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      nameRef.current?.focus();
      return;
    }
    onSave(form);
    toast({
      title: isEditing ? 'Entry updated (F2)' : 'Entry saved (F2)',
      description: `${form.title} ${form.name}`.trim(),
    });
  };

  // F2 to save, Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (e.key === 'F2') { e.preventDefault(); handleSave(); }
      if (e.key === 'Escape' && !isTyping) { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Field renderer: label on top, input below
  const field = (
    label: string,
    key: keyof PhoneDirectoryEntry,
    opts: { placeholder?: string; type?: string; width?: string; icon?: React.ReactNode; required?: boolean; multiline?: boolean } = {}
  ) => {
    const { placeholder = '', type = 'text', width = 'w-full', icon, required = false, multiline = false } = opts;
    return (
      <div className={width}>
        <label className="text-[10px] font-bold mb-0.5 block flex items-center gap-1" style={{ color: LABEL_COLOR }}>
          {icon}{label}{required && <span className="text-rose-600">*</span>}
        </label>
        {multiline ? (
          <textarea
            value={form[key] as string}
            onChange={(e) => setField(key, e.target.value as any)}
            placeholder={placeholder}
            rows={3}
            className="w-full h-14 px-2 py-1 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400 resize-none"
            style={{ borderColor: FIELD_BORDER }}
          />
        ) : (
          <input
            type={type}
            value={form[key] as string}
            onChange={(e) => setField(key, e.target.value as any)}
            placeholder={placeholder}
            ref={key === 'name' ? nameRef : undefined}
            className="w-full h-7 px-2 text-[10px] border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
            style={{ borderColor: FIELD_BORDER }}
          />
        )}
      </div>
    );
  };

  const body = (
    <div className="h-full flex flex-col" style={{ fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: LIGHT_GREEN_BG }}>
      {/* Form Body — 2-column layout with grouped fields */}
      <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {/* Left column: personal + address */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
              {field('Title', 'title', { placeholder: 'Mr', width: 'w-[80px]' })}
              {field('Name', 'name', { placeholder: 'Full name', icon: <User className="h-2.5 w-2.5" />, required: true })}
            </div>
            {field('Address', 'address', { placeholder: 'Street address', icon: <MapPin className="h-2.5 w-2.5" /> })}
            {field('City', 'city', { placeholder: 'City' })}
            <div className="grid grid-cols-[1fr_80px] gap-2 items-end">
              {field('State', 'state', { placeholder: 'State/Region', width: 'w-full' })}
              {field('Code', 'code', { placeholder: 'Code', width: 'w-[80px]' })}
            </div>
            {field('Country', 'country', { placeholder: 'Country' })}
            {field('Group', 'group', { placeholder: 'e.g. Customers, Suppliers, VIP', icon: <Tag className="h-2.5 w-2.5" /> })}
          </div>

          {/* Right column: contact details */}
          <div className="space-y-2.5">
            {field('Home Telephone', 'homeTel', { placeholder: '+233 ...', type: 'tel', icon: <Phone className="h-2.5 w-2.5" /> })}
            {field('Work Telephone', 'workTel', { placeholder: '+233 ...', type: 'tel' })}
            {field('Mobile', 'mobile', { placeholder: '+233 ...', type: 'tel' })}
            {field('Fax', 'fax', { placeholder: '+233 ...', type: 'tel' })}
            {field('http://', 'website', { placeholder: 'www.example.com', icon: <Globe className="h-2.5 w-2.5" /> })}
            {field('Email', 'email', { placeholder: 'name@example.com', type: 'email', icon: <Mail className="h-2.5 w-2.5" /> })}
          </div>
        </div>

        {/* Notes — full width */}
        <div className="mt-3">
          {field('Notes', 'notes', { placeholder: 'Additional notes about this contact...', icon: <FileText className="h-2.5 w-2.5" />, multiline: true })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center justify-center gap-3 border-t" style={{ borderColor: '#808080', backgroundColor: '#E8F4E0' }}>
        <button
          onClick={handleSave}
          className="h-8 px-6 rounded border-2 bg-white text-[11px] font-bold flex items-center gap-1.5 transition hover:bg-blue-50"
          style={{ borderColor: HEADER_GREEN, color: '#000000' }}
        >
          <Save className="h-3.5 w-3.5" style={{ color: BTN_BLUE }} />
          Save <kbd className="text-[8px] bg-slate-100 px-0.5 rounded font-mono">F2</kbd>
        </button>
        <button
          onClick={onClose}
          className="h-8 px-6 rounded border-2 bg-white text-[11px] font-bold flex items-center gap-1.5 transition hover:bg-rose-50"
          style={{ borderColor: HEADER_GREEN, color: '#000000' }}
        >
          <X className="h-3.5 w-3.5" style={{ color: BTN_RED }} />
          Close <kbd className="text-[8px] bg-slate-100 px-0.5 rounded font-mono">Esc</kbd>
        </button>
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0 px-3 py-0.5 text-[8px] text-slate-700 flex items-center gap-3" style={{ backgroundColor: '#B8D8B0' }}>
        <span className="font-mono">{isEditing ? 'Editing' : 'New entry'} · {form.id}</span>
        <div className="flex-1" />
        <span>{form.name ? `${form.title} ${form.name}`.trim() : 'Untitled'}</span>
      </div>
    </div>
  );

  if (asOverlay) {
    return (
      <PopupWindow
        title={title}
        titleBarColor={HEADER_GREEN}
        initialWidth={620}
        initialHeight={560}
        minWidth={500}
        minHeight={480}
        onClose={onClose}
      >
        {body}
      </PopupWindow>
    );
  }

  return body;
}
