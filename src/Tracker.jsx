import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

const STAGES = [
  { key: "data_collection", hasChecklist: true , label: "Data Collection",       icon: "📥" },
  { key: "tally_entry",     hasChecklist: true ,     label: "Accounting Entry",           icon: "📒" },
  { key: "bank_recon",      hasChecklist: true ,      label: "Bank Reconciliation",   icon: "🏦" },
  { key: "gst_recon",       hasChecklist: false,       label: "GST Reconciliation",    icon: "📊" },
  { key: "tds_entries",     hasChecklist: false,     label: "TDS Entries",           icon: "🧾" },
  { key: "review",          hasChecklist: true ,          label: "Review & Finalization", icon: "✅" },
];

const ENTITY_TYPES   = ["Individual", "Proprietor", "Partnership Firm", "LLP", "Company"];
const FREQUENCIES    = ["Monthly", "Quarterly", "Annually"];
const STATUS_OPTIONS = ["Pending", "In Progress", "Done", "N/A"];
const MONTHS         = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const MONTH_FULL     = ["April","May","June","July","August","September","October","November","December","January","February","March"];
const QUARTERS       = ["Q1 (Apr–Jun)","Q2 (Jul–Sep)","Q3 (Oct–Dec)","Q4 (Jan–Mar)"];

function fyList() {
  const list = ["FY 2025-26"];
  for (let y = 2026; y <= 2030; y++) list.push(`FY ${y}-${String(y+1).slice(2)}`);
  return list;
}
function currentFY() {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  // Jan(0) Feb(1) Mar(2) → point to the FY that starts in April of the same year
  // Apr(3) onwards → FY starting this year
  return m >= 3 ? `FY ${y}-${String(y+1).slice(2)}` : `FY ${y}-${String(y+1).slice(2)}`;
}
function periodsForClient(client) {
  if (client.frequency === "Monthly")   return MONTHS.map((m,i) => ({ key:m, label:MONTH_FULL[i] }));
  if (client.frequency === "Quarterly") return QUARTERS.map(q => ({ key:q, label:q }));
  return [{ key:"Year End", label:"Year End" }];
}

const STATUS_STYLES = {
  "Pending":     { bg:"#2A1A0588", border:"#92400E", color:"#FCD34D", dot:"#F59E0B" },
  "In Progress": { bg:"#0C234088", border:"#1E40AF", color:"#93C5FD", dot:"#3B82F6" },
  "Done":        { bg:"#052E1688", border:"#166534", color:"#86EFAC", dot:"#22C55E" },
  "N/A":         { bg:"#1A1A2E88", border:"#334155", color:"#64748B", dot:"#475569" },
};
const GRID_COLORS = { "Pending":"#78350F","In Progress":"#1D4ED8","Done":"#166534","N/A":"#1E293B" };

// ── Theme tokens ──────────────────────────────────────────────────────────────
const DARK_THEME = {
  bgBase:      "#0A0F1E",
  bgCard:      "#111827",
  bgInput:     "#0A0F1E",
  bgSidebar:   "#0A0F1E",
  bgStage:     "#0A0F1E",
  bgStageFoot: "#06080F",
  bgTopbar:    "#0A0F1E",
  bgChecklist: "#0A0F1E",
  bgModal:     "#111827",
  bgHover:     "#111827",
  bgRowAct:    "#0C1E38",
  bgPtabAct:   "#0C1E38",
  bgFyAct:     "#0C1E38",
  border:      "#1E293B",
  borderStrong:"#334155",
  borderRowSep:"#0F172A",
  accent:      "#2563EB",
  accentHover: "#1D4ED8",
  accentLight: "#93C5FD",
  textPrimary: "#F1F5F9",
  textBody:    "#E2E8F0",
  textMuted:   "#94A3B8",
  textFaint:   "#475569",
  textFaintest:"#334155",
  pfill:       "linear-gradient(90deg,#2563EB,#06B6D4)",
  scrollThumb: "#1E293B",
  scrollTrack: "#0A0F1E",
  toastOk:     "#14532D",
  toastOkTxt:  "#86EFAC",
  toastErr:    "#7F1D1D",
  toastErrTxt: "#FCA5A5",
  tagEntity:   { bg:"#1E3A5F33", border:"#1E3A5F", color:"#93C5FD" },
  tagFreq:     { bg:"#1C3B2C33", border:"#1C3B2C", color:"#6EE7B7" },
  btnDelete:   { bg:"#7F1D1D22", border:"#7F1D1D55", color:"#FCA5A5", bgHover:"#7F1D1D55" },
  overdue:     { bg:"#130303", bgHover:"#1A0808", bgHeader:"#1A050588", bgSection:"#1A050588", bgAlert:"#7F1D1D33", border:"#7F1D1D", borderFaint:"#7F1D1D55", borderRow:"#7F1D1D22", textPrimary:"#FCA5A5", textFaint:"#7F1D1D", textPeriod:"#F87171", countBg:"#7F1D1D55", divider:"#7F1D1D55" },
  gridColors:  { "Pending":"#78350F", "In Progress":"#1D4ED8", "Done":"#166534", "N/A":"#1E293B" },
  avColors:    ["#1E3A5F","#1C3B2C","#3B1D6E","#4A1942","#2D1B00","#1A2E4A"],
  avText:      "#FFFFFF",
  statusStyles: {
    "Pending":     { bg:"#2A1A0588", border:"#92400E", color:"#FCD34D", dot:"#F59E0B" },
    "In Progress": { bg:"#0C234088", border:"#1E40AF", color:"#93C5FD", dot:"#3B82F6" },
    "Done":        { bg:"#052E1688", border:"#166534", color:"#86EFAC", dot:"#22C55E" },
    "N/A":         { bg:"#1A1A2E88", border:"#334155", color:"#64748B", dot:"#475569" },
  },
};

const LIGHT_THEME = {
  bgBase:      "#BAE6FD",
  bgCard:      "#FFFFFF",
  bgInput:     "#EFF9FF",
  bgSidebar:   "#D4EEFA",
  bgStage:     "#EFF9FF",
  bgStageFoot: "#E0F3FD",
  bgTopbar:    "#0C2D48",
  bgChecklist: "#EFF9FF",
  bgModal:     "#FFFFFF",
  bgHover:     "#E0F3FD",
  bgRowAct:    "#FFFFFF",
  bgPtabAct:   "#FFFFFF",
  bgFyAct:     "#BAE6FD",
  border:      "#7EC8E8",
  borderStrong:"#56A8C8",
  borderRowSep:"#C8E8F8",
  accent:      "#0EA5E9",
  accentHover: "#0284C7",
  accentLight: "#0C2D48",
  textPrimary: "#0C2D48",
  textBody:    "#0C2D48",
  textMuted:   "#1A5A7A",
  textFaint:   "#3A7A9A",
  textFaintest:"#5A9ABA",
  pfill:       "linear-gradient(90deg,#0EA5E9,#38BDF8)",
  scrollThumb: "#7EC8E8",
  scrollTrack: "#BAE6FD",
  toastOk:     "#DCFCE7",
  toastOkTxt:  "#166534",
  toastErr:    "#FEE2E2",
  toastErrTxt: "#991B1B",
  tagEntity:   { bg:"#DBEAFE", border:"#93C5FD", color:"#1D4ED8" },
  tagFreq:     { bg:"#DCFCE7", border:"#86EFAC", color:"#166534" },
  btnDelete:   { bg:"#FEE2E2", border:"#FCA5A5", color:"#991B1B", bgHover:"#FECACA" },
  overdue:     { bg:"#FFF1F1", bgHover:"#FFE4E4", bgHeader:"#FEE2E255", bgSection:"#FEE2E255", bgAlert:"#FEE2E2", border:"#F87171", borderFaint:"#FECACA", borderRow:"#FED7D7", textPrimary:"#991B1B", textFaint:"#DC2626", textPeriod:"#EF4444", countBg:"#FECACA", divider:"#FECACA" },
  gridColors:  { "Pending":"#D97706", "In Progress":"#2563EB", "Done":"#16A34A", "N/A":"#94A3B8" },
  avColors:    ["#BFDBFE","#BBF7D0","#DDD6FE","#FBCFE8","#FDE68A","#BAE6FD"],
  avText:      "#0C2D48",
  statusStyles: {
    "Pending":     { bg:"#FEF3C7", border:"#FCD34D", color:"#92400E", dot:"#D97706" },
    "In Progress": { bg:"#DBEAFE", border:"#93C5FD", color:"#1D4ED8", dot:"#3B82F6" },
    "Done":        { bg:"#DCFCE7", border:"#86EFAC", color:"#166534", dot:"#22C55E" },
    "N/A":         { bg:"#F1F5F9", border:"#CBD5E1", color:"#64748B", dot:"#94A3B8" },
  },
};

function emptyStageData(key) {
  const base = { status:"Pending", doneBy:"", doneDate:"", remarks:"" };
  if (["data_collection","tally_entry","bank_recon","review"].includes(key)) base.checklist = [];
  return base;
}
function emptyPeriod() {
  return Object.fromEntries(STAGES.map(s => [s.key, emptyStageData(s.key)]));
}
function stageProgress(periodData) {
  const vals = STAGES.map(s => periodData?.[s.key]?.status || "Pending");
  const done = vals.filter(v => v === "Done").length;
  const na   = vals.filter(v => v === "N/A").length;
  const total = vals.length - na;
  return total === 0 ? 100 : Math.round((done / total) * 100);
}
function overallStatus(periodData) {
  if (!periodData) return "Pending";
  const vals = STAGES.map(s => periodData[s.key]?.status || "Pending");
  if (vals.every(v => v === "Done" || v === "N/A")) return "Done";
  if (vals.some(v => v === "In Progress" || v === "Done")) return "In Progress";
  return "Pending";
}
function ensurePeriods(client, fy) {
  const periods = periodsForClient(client);
  const fyData  = client.periods?.[fy] || {};
  const filled  = { ...fyData };
  periods.forEach(p => {
    if (!filled[p.key]) {
      filled[p.key] = emptyPeriod();
    } else {
      STAGES.forEach(s => {
        if (typeof filled[p.key][s.key] === "string") {
          const old = filled[p.key][s.key];
          filled[p.key][s.key] = { ...emptyStageData(s.key), status: old };
        } else if (!filled[p.key][s.key]) {
          filled[p.key][s.key] = emptyStageData(s.key);
        } else if (["data_collection","tally_entry","bank_recon","review"].includes(s.key) && !filled[p.key][s.key].checklist) {
          filled[p.key][s.key].checklist = [];
        }
      });
    }
  });
  return { ...client, periods: { ...client.periods, [fy]: filled } };
}
const newClient = () => ({ name:"", entity:"Proprietor", pan:"", gstin:"", contact:"", phone:"", frequency:"Monthly", notes:"", periods:{} });

// ── Main Tracker ──────────────────────────────────────────────────────────────

export default function Tracker({ session }) {
  const [clients,      setClients]      = useState([]);
  const [loaded,       setLoaded]       = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [view,         setView]         = useState("dashboard");
  const [editClient,   setEditClient]   = useState(null);
  const [activeFY,     setActiveFY]     = useState(currentFY());
  const [activePeriod, setActivePeriod] = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterEntity, setFilterEntity] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState(null);
  const [showExport,   setShowExport]   = useState(false);
  const [darkMode,     setDarkMode]     = useState(() => localStorage.getItem("caTrackerDark") === "true");

  const th = darkMode ? DARK_THEME : LIGHT_THEME;
  const toggleDark = () => setDarkMode(d => {
    const next = !d;
    localStorage.setItem("caTrackerDark", String(next));
    return next;
  });

  const loadClients = useCallback(async () => {
    const { data, error } = await supabase.from("clients").select("*");
    if (!error && data) setClients(data.map(r => ({ ...r.data, id: r.id })));
    setLoaded(true);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const saveClientToDb = async (client) => {
    setSaving(true);
    const { id, ...data } = client;
    let saved = null;
    if (id && !id.toString().startsWith("new_")) {
      const { error } = await supabase.from("clients").update({ data: { ...data, id } }).eq("id", id);
      if (error) { toast$("Save failed: " + error.message, "error"); setSaving(false); return null; }
      saved = client;
    } else {
      const { data: inserted, error } = await supabase.from("clients").insert({ data: { ...data } }).select().single();
      if (error) { toast$("Save failed: " + error.message, "error"); setSaving(false); return null; }
      saved = { ...data, id: inserted.id };
    }
    setSaving(false);
    return saved;
  };

  const persistClient = async (updated) => {
    const { id, ...data } = updated;
    await supabase.from("clients").update({ data: { ...data, id } }).eq("id", id);
  };

  const toast$ = (msg, type="success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2800); };

  const selectClient = (c) => {
    const filled = ensurePeriods(c, activeFY);
    setSelected(filled);
    const periods = periodsForClient(filled);
    const now = new Date();
    let def = periods[0].key;
    if (filled.frequency === "Monthly") {
      const idx = now.getMonth() >= 3 ? now.getMonth()-3 : now.getMonth()+9;
      def = MONTHS[Math.min(idx, periods.length-1)];
    }
    setActivePeriod(def);
    setView("detail");
  };

  const handleSaveClient = async (client) => {
    const filled = ensurePeriods(client, activeFY);
    const saved  = await saveClientToDb(filled);
    if (!saved) return;
    const existing = clients.find(c => c.id === saved.id);
    const updated  = existing ? clients.map(c => c.id===saved.id ? saved : c) : [...clients, saved];
    setClients(updated); setSelected(saved);
    setActivePeriod(periodsForClient(saved)[0].key); setView("detail");
    toast$(existing ? "Client updated." : "Client added.");
  };

  const handleDelete = async (id) => {
    await supabase.from("clients").delete().eq("id", id);
    setClients(clients.filter(c => c.id !== id));
    setView("list"); setSelected(null);
    toast$("Client removed.", "error");
  };

  // deep update helper
  const applyUpdate = (clientId, updater) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    const updated = updater(client);
    setClients(clients.map(c => c.id===clientId ? updated : c));
    setSelected(updated);
    return updated;
  };

  const handleStageUpdate = async (clientId, periodKey, stageKey, field, value) => {
    const client = clients.find(c => c.id === clientId);
    const oldVal = client?.periods?.[activeFY]?.[periodKey]?.[stageKey]?.[field];
    const updated = applyUpdate(clientId, c => ({
      ...c,
      periods: { ...c.periods, [activeFY]: { ...c.periods?.[activeFY],
        [periodKey]: { ...c.periods?.[activeFY]?.[periodKey],
          [stageKey]: { ...c.periods?.[activeFY]?.[periodKey]?.[stageKey], [field]: value }
        }
      }}
    }));
    if (updated) {
      await persistClient(updated);
      // Record audit for status changes immediately; text fields recorded on blur via onBlur in UI
      if (field === "status" && oldVal !== value) {
        const email = session?.user?.email || "";
        const actor = email.split("@")[0];
        const stageName = STAGES.find(s => s.key === stageKey)?.label || stageKey;
        const entry = { id: Date.now().toString(), ts: new Date().toISOString(), actor,
          type: "status", period: periodKey, fy: activeFY, stage: stageName, from: oldVal||"Pending", to: value };
        const final = { ...updated, auditLog: [entry, ...(updated.auditLog||[])] };
        setClients(clients => clients.map(c => c.id===clientId ? final : c));
        setSelected(final);
        await persistClient(final);
      }
    }
  };

  const handleAddChecklistItem = async (clientId, periodKey, stageKey, label, scope) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const newItem = { id: Date.now().toString(), label, status:"Pending", doneBy:"", doneDate:"" };
    const allPeriods = periodsForClient(client);

    // Determine which periods to add to based on scope
    const currentIdx = allPeriods.findIndex(p => p.key === periodKey);
    const targetPeriods = scope === "all"
      ? allPeriods.slice(currentIdx)       // current + all future
      : allPeriods.slice(currentIdx, currentIdx + 1); // this period only

    const updated = applyUpdate(clientId, c => {
      const fyData = { ...c.periods?.[activeFY] };
      targetPeriods.forEach(p => {
        const existing = fyData[p.key]?.[stageKey]?.checklist || [];
        const alreadyExists = existing.some(i => i.id === newItem.id);
        if (!alreadyExists) {
          fyData[p.key] = {
            ...fyData[p.key],
            [stageKey]: {
              ...fyData[p.key]?.[stageKey],
              checklist: [...existing, { ...newItem, status:"Pending", doneBy:"", doneDate:"" }]
            }
          };
        }
      });
      return { ...c, periods: { ...c.periods, [activeFY]: fyData } };
    });
    if (updated) {
      await persistClient(updated);
      const email = session?.user?.email || "";
      const actor = email.split("@")[0];
      const stageName = STAGES.find(s => s.key === stageKey)?.label || stageKey;
      const scopeNote = scope === "all" ? " (all future periods)" : " (this period only)";
      const entry = { id: Date.now().toString(), ts: new Date().toISOString(), actor,
        type: "checklist_add", period: periodKey, fy: activeFY, stage: stageName, item: label + scopeNote };
      const final = { ...updated, auditLog: [entry, ...(updated.auditLog||[])] };
      setClients(clients => clients.map(c => c.id===clientId ? final : c));
      setSelected(final);
      await persistClient(final);
    }
  };

  const handleBulkMarkNA = async (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const periods = periodsForClient(client);
    const updated = applyUpdate(clientId, c => {
      const fyData = { ...(c.periods?.[activeFY] || {}) };
      periods.forEach(p => {
        const pd = fyData[p.key];
        // Only touch periods that are completely untouched — no doneBy, doneDate, remarks, checklist activity
        const isUntouched = STAGES.every(s => {
          const sd = pd?.[s.key];
          if (!sd) return true;
          return !sd.doneBy && !sd.doneDate && !sd.remarks &&
            (!sd.checklist || sd.checklist.every(i => i.status === "Pending" && !i.doneBy && !i.doneDate));
        });
        const ost = overallStatus(pd);
        if (isUntouched && ost !== "Done") {
          fyData[p.key] = Object.fromEntries(
            STAGES.map(s => [s.key, { ...(pd?.[s.key] || emptyStageData(s.key)), status: "N/A" }])
          );
        }
      });
      return { ...c, periods: { ...c.periods, [activeFY]: fyData } };
    });
    if (updated) {
      await persistClient(updated);
      toast$("Empty periods marked as N/A.");
    }
  };

  const handleChecklistItemUpdate = async (clientId, periodKey, stageKey, itemId, field, value) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = client.periods?.[activeFY]?.[periodKey]?.[stageKey]?.checklist || [];
    const newList  = existing.map(item => item.id===itemId ? { ...item, [field]:value } : item);
    const updated  = applyUpdate(clientId, c => ({
      ...c, periods: { ...c.periods, [activeFY]: { ...c.periods?.[activeFY],
        [periodKey]: { ...c.periods?.[activeFY]?.[periodKey],
          [stageKey]: { ...c.periods?.[activeFY]?.[periodKey]?.[stageKey], checklist: newList }
        }
      }}
    }));
    if (updated) await persistClient(updated);
  };

  const handleDeleteChecklistItem = async (clientId, periodKey, stageKey, itemId, scope) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const allPeriods = periodsForClient(client);
    const currentIdx = allPeriods.findIndex(p => p.key === periodKey);
    const targetPeriods = scope === "all"
      ? allPeriods.slice(currentIdx)
      : allPeriods.slice(currentIdx, currentIdx + 1);

    const deletedLabel = (client.periods?.[activeFY]?.[periodKey]?.[stageKey]?.checklist||[]).find(i=>i.id===itemId)?.label || "";

    const updated = applyUpdate(clientId, c => {
      const fyData = { ...c.periods?.[activeFY] };
      targetPeriods.forEach(p => {
        const existing = fyData[p.key]?.[stageKey]?.checklist || [];
        fyData[p.key] = {
          ...fyData[p.key],
          [stageKey]: {
            ...fyData[p.key]?.[stageKey],
            checklist: existing.filter(item => item.id !== itemId)
          }
        };
      });
      return { ...c, periods: { ...c.periods, [activeFY]: fyData } };
    });
    if (updated) {
      await persistClient(updated);
      const email = session?.user?.email || "";
      const actor = email.split("@")[0];
      const stageName = STAGES.find(s => s.key === stageKey)?.label || stageKey;
      const scopeNote = scope === "all" ? " (all future periods)" : " (this period only)";
      const entry = { id: Date.now().toString(), ts: new Date().toISOString(), actor,
        type: "checklist_delete", period: periodKey, fy: activeFY, stage: stageName, item: deletedLabel + scopeNote };
      const final = { ...updated, auditLog: [entry, ...(updated.auditLog||[])] };
      setClients(clients => clients.map(c => c.id===clientId ? final : c));
      setSelected(final);
      await persistClient(final);
    }
  };

  const handleEditChecklistItem = async (clientId, periodKey, stageKey, itemId, newLabel, scope) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const allPeriods = periodsForClient(client);
    const currentIdx = allPeriods.findIndex(p => p.key === periodKey);
    const targetPeriods = scope === "all"
      ? allPeriods.slice(currentIdx)
      : allPeriods.slice(currentIdx, currentIdx + 1);

    const updated = applyUpdate(clientId, c => {
      const fyData = { ...c.periods?.[activeFY] };
      targetPeriods.forEach(p => {
        const existing = fyData[p.key]?.[stageKey]?.checklist || [];
        fyData[p.key] = {
          ...fyData[p.key],
          [stageKey]: {
            ...fyData[p.key]?.[stageKey],
            checklist: existing.map(item => item.id === itemId ? { ...item, label: newLabel } : item)
          }
        };
      });
      return { ...c, periods: { ...c.periods, [activeFY]: fyData } };
    });
    if (updated) {
      await persistClient(updated);
      const email = session?.user?.email || "";
      const actor = email.split("@")[0];
      const stageName = STAGES.find(s => s.key === stageKey)?.label || stageKey;
      const scopeNote = scope === "all" ? " (all future periods)" : " (this period only)";
      const entry = { id: Date.now().toString(), ts: new Date().toISOString(), actor,
        type: "checklist_edit", period: periodKey, fy: activeFY, stage: stageName, item: `"${newLabel}"${scopeNote}` };
      const final = { ...updated, auditLog: [entry, ...(updated.auditLog||[])] };
      setClients(clients => clients.map(c => c.id===clientId ? final : c));
      setSelected(final);
      await persistClient(final);
    }
  };

  const handleReorderChecklistItems = async (clientId, periodKey, stageKey, newOrder, scope) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const allPeriods = periodsForClient(client);
    const currentIdx = allPeriods.findIndex(p => p.key === periodKey);
    const targetPeriods = scope === "all"
      ? allPeriods.slice(currentIdx)
      : allPeriods.slice(currentIdx, currentIdx + 1);

    const updated = applyUpdate(clientId, c => {
      const fyData = { ...c.periods?.[activeFY] };
      targetPeriods.forEach(p => {
        const existing = fyData[p.key]?.[stageKey]?.checklist || [];
        // Reorder by matching IDs from newOrder; items not in newOrder appended at end
        const reordered = newOrder
          .map(id => existing.find(i => i.id === id))
          .filter(Boolean);
        const rest = existing.filter(i => !newOrder.includes(i.id));
        fyData[p.key] = {
          ...fyData[p.key],
          [stageKey]: { ...fyData[p.key]?.[stageKey], checklist: [...reordered, ...rest] }
        };
      });
      return { ...c, periods: { ...c.periods, [activeFY]: fyData } };
    });
    if (updated) await persistClient(updated);
  };

  // ── Audit Trail ──────────────────────────────────────────────────────────────
  const recordAudit = async (clientId, action) => {
    // Skip if no meaningful value to record
    if (action.type === "field" && !action.to) return;
    const email = session?.user?.email || "";
    const actor = email.split("@")[0];
    const entry = { id: Date.now().toString(), ts: new Date().toISOString(), actor, fy: activeFY, ...action };
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const final = { ...client, auditLog: [entry, ...(client.auditLog||[])] };
    setClients(cls => cls.map(c => c.id===clientId ? final : c));
    setSelected(final);
    await persistClient(final);
  };

  const handleAddCommLog = async (clientId, entry) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = client.commLog || [];
    const newEntry = { id: Date.now().toString(), date: entry.date, note: entry.note, addedBy: entry.addedBy };
    const updated = applyUpdate(clientId, c => ({ ...c, commLog: [newEntry, ...existing] }));
    if (updated) await persistClient(updated);
  };

  const handleDeleteCommLog = async (clientId, entryId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const updated = applyUpdate(clientId, c => ({ ...c, commLog: (c.commLog||[]).filter(e => e.id !== entryId) }));
    if (updated) {
      await persistClient(updated);
      const email = session?.user?.email || "";
      const actor = email.split("@")[0];
      const stageName = STAGES.find(s => s.key === stageKey)?.label || stageKey;
      const deletedItem = (clients.find(c=>c.id===clientId)?.periods?.[activeFY]?.[periodKey]?.[stageKey]?.checklist||[]).find(i=>i.id===itemId);
      const entry = { id: Date.now().toString(), ts: new Date().toISOString(), actor,
        type: "checklist_delete", period: periodKey, fy: activeFY, stage: stageName, item: deletedItem?.label||"" };
      const final = { ...updated, auditLog: [entry, ...(updated.auditLog||[])] };
      setClients(clients => clients.map(c => c.id===clientId ? final : c));
      setSelected(final);
      await persistClient(final);
    }
  };

  const filtered = clients.filter(c => {
    const ms = c.name.toLowerCase().includes(search.toLowerCase()) || (c.pan||"").toLowerCase().includes(search.toLowerCase());
    const me = filterEntity==="All" || c.entity===filterEntity;
    const fyData = c.periods?.[activeFY]||{};
    const allV = Object.values(fyData).flatMap(p => STAGES.map(s => p[s.key]?.status || "Pending"));
    const ost = !allV.length?"Pending":allV.every(v=>v==="Done"||v==="N/A")?"Done":allV.some(v=>v==="In Progress"||v==="Done")?"In Progress":"Pending";
    return ms && me && (filterStatus==="All"||ost===filterStatus);
  });

  if (!loaded) return (
    <div style={{minHeight:"100vh",background:"#0A0F1E",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#475569",fontFamily:"sans-serif",fontSize:14}}>Loading clients…</div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:th.bgBase,fontFamily:"'DM Sans',sans-serif",color:th.textBody,display:"flex",flexDirection:"column",transition:"background .25s,color .25s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:${th.scrollTrack};}
        ::-webkit-scrollbar-thumb{background:${th.scrollThumb};border-radius:3px;}
        input,select,textarea{outline:none;font-family:'DM Sans',sans-serif;}
        .card{background:${th.bgCard};border:1px solid ${th.border};border-radius:14px;}
        .btn-p{background:linear-gradient(135deg,${th.accent},${th.accentHover});color:#fff;border:none;border-radius:8px;padding:8px 16px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;}
        .btn-p:hover{opacity:.88;transform:translateY(-1px);}
        .btn-g{background:transparent;color:${th.textMuted};border:1px solid ${th.border};border-radius:8px;padding:8px 14px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .18s;}
        .btn-g:hover{background:${th.bgHover};color:${th.textPrimary};}
        .btn-d{background:#7F1D1D22;color:#FCA5A5;border:1px solid #7F1D1D55;border-radius:8px;padding:8px 14px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .18s;}
        .btn-d:hover{background:#7F1D1D55;}
        .inp{background:${th.bgInput};border:1px solid ${th.border};border-radius:8px;color:${th.textPrimary};padding:8px 12px;font-size:13px;width:100%;transition:border .18s;}
        .inp:focus{border-color:${th.accent};}
        .inp-sm{background:${th.bgInput};border:1px solid ${th.border};border-radius:6px;color:${th.textPrimary};padding:5px 9px;font-size:12px;font-family:'DM Sans',sans-serif;transition:border .18s;outline:none;}
        .inp-sm:focus{border-color:${th.accent};}
        .sel{background:${th.bgInput};border:1px solid ${th.border};border-radius:8px;color:${th.textPrimary};padding:8px 12px;font-size:13px;cursor:pointer;}
        .lbl{font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:${th.textFaint};margin-bottom:4px;}
        .tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
        .crow{cursor:pointer;padding:14px 16px;border-bottom:1px solid ${th.borderRowSep};transition:background .14s;display:flex;align-items:center;gap:12px;}
        .crow:hover{background:${th.bgHover};}
        .crow.act{background:${th.bgRowAct};border-left:3px solid ${th.accent};}
        .spill{border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid transparent;font-family:'DM Sans',sans-serif;transition:all .14s;white-space:nowrap;}
        .spill:hover{filter:brightness(${darkMode?'1.2':'0.92'});}
        .pbar{height:5px;border-radius:3px;background:${th.border};overflow:hidden;}
        .pfill{height:100%;border-radius:3px;background:${th.pfill};transition:width .4s ease;}
        .av{display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;}
        .pgrid-cell{height:28px;border-radius:5px;cursor:pointer;transition:all .14s;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:.4px;border:2px solid transparent;}
        .pgrid-cell:hover{filter:brightness(1.15);}
        .ptab{padding:6px 13px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid ${th.border};transition:all .14s;white-space:nowrap;background:transparent;font-family:'DM Sans',sans-serif;color:${th.textFaint};}
        .ptab:hover{border-color:${th.borderStrong};}
        .ptab.act{background:${th.bgPtabAct};border-color:${th.accent};color:${darkMode?'#93C5FD':th.accent};}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
        .modal{background:${th.bgModal};border:1px solid ${th.border};border-radius:16px;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;}
        .fy-btn{padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${darkMode?th.border:'rgba(255,255,255,0.18)'};background:transparent;color:${darkMode?th.textFaint:'rgba(255,255,255,0.55)'};font-family:'DM Sans',sans-serif;transition:all .14s;}
        .fy-btn:hover{border-color:${darkMode?th.borderStrong:'rgba(255,255,255,0.4)'};color:${darkMode?th.textMuted:'rgba(255,255,255,0.85)'};}
        .fy-btn.act{background:${th.bgFyAct};border-color:${darkMode?th.accent:'#BAE6FD'};color:${darkMode?'#93C5FD':'#0C2D48'};font-weight:700;}
        .stage-block{background:${th.bgStage};border-radius:10px;border:1px solid ${th.border};overflow:hidden;transition:border .18s,background .25s;}
        .stage-block.active-border{border-color:${th.accent}44;}
        .stage-head{display:flex;align-items:center;gap:11px;padding:10px 13px;}
        .stage-foot{padding:14px;border-top:1px solid ${th.border};background:${th.bgStageFoot};display:flex;flex-direction:column;gap:11px;}
        .checklist-row{display:flex;align-items:center;gap:8px;padding:8px 10px;background:${th.bgChecklist};border-radius:7px;border:1px solid ${th.border};}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Topbar — always navy in both modes */}
      <div style={{background:th.bgTopbar,borderBottom:`1px solid ${darkMode?th.border:'#1A4A6A'}`,padding:"0 22px",height:54,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:"linear-gradient(135deg,#2563EB,#0EA5E9)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>📋</div>
          <span style={{fontFamily:"'Libre Baskerville',serif",fontSize:18,fontWeight:700,color:"#F1F5F9"}}>MSA Accounting Tracker</span>
          {saving && <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginLeft:6}}>saving…</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {fyList().map(fy=>(
            <button key={fy} className={`fy-btn${activeFY===fy?" act":""}`}
              onClick={()=>{setActiveFY(fy);setView("dashboard");setSelected(null);}}>
              {fy}
            </button>
          ))}
          <div style={{width:1,height:18,background:"rgba(255,255,255,0.15)",margin:"0 4px"}}/>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{session.user.email}</span>
          <button style={{background:"transparent",color:"rgba(255,255,255,0.55)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:8,padding:"6px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer"}} onClick={async()=>await supabase.auth.signOut()}>Sign out</button>
          <button className={`fy-btn${view==="dashboard"?" act":""}`} onClick={()=>{setView("dashboard");setSelected(null);}}>📊 Dashboard</button>
          <button style={{background:"transparent",color:"rgba(255,255,255,0.55)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:8,padding:"6px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer"}} onClick={()=>downloadAllAuditLog(clients)}>⬇ Audit Log</button>
          <button style={{background:"transparent",color:"#93C5FD",border:"1px solid #1D4ED8",borderRadius:8,padding:"6px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer"}} onClick={()=>setShowExport(true)}>📤 Export</button>
          {/* Dark/Light toggle */}
          <button
            onClick={toggleDark}
            title={darkMode?"Switch to Light Mode":"Switch to Dark Mode"}
            style={{background:"transparent",border:"1px solid rgba(255,255,255,0.18)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:15,lineHeight:1,transition:"all .18s"}}
          >{darkMode ? "☀️" : "🌙"}</button>
          <button className="btn-p" onClick={()=>{setEditClient(newClient());setView("form");}}>+ Add Client</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{width:290,flexShrink:0,borderRight:`1px solid ${th.border}`,display:"flex",flexDirection:"column",overflow:"hidden",background:th.bgSidebar}}>
          <div style={{padding:"11px",borderBottom:`1px solid ${th.border}`}}>
            <input className="inp" placeholder="🔍  Search name or PAN…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:8}}/>
            <div style={{display:"flex",gap:6}}>
              <select className="sel" value={filterEntity} onChange={e=>setFilterEntity(e.target.value)} style={{flex:1,fontSize:11}}>
                <option value="All">All Entities</option>
                {ENTITY_TYPES.map(e=><option key={e}>{e}</option>)}
              </select>
              <select className="sel" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{flex:1,fontSize:11}}>
                <option value="All">All Status</option>
                {["Pending","In Progress","Done"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{overflowY:"auto",flex:1}}>
            {filtered.length===0 && <div style={{padding:28,textAlign:"center",color:th.textFaint,fontSize:13}}>{clients.length===0?"No clients yet. Add your first client!":"No clients match your filters."}</div>}
            {filtered.map(c=>{
              const fyData=c.periods?.[activeFY]||{};
              const periods=periodsForClient(c);
              const doneCount=periods.filter(p=>overallStatus(fyData[p.key])==="Done").length;
              const pct=periods.length===0?0:Math.round((doneCount/periods.length)*100);
              const initials=c.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
              const avBg=th.avColors[c.name.charCodeAt(0)%6];
              return (
                <div key={c.id} className={`crow${selected?.id===c.id?" act":""}`} onClick={()=>selectClient(c)}>
                  <div className="av" style={{background:avBg,color:th.avText,width:36,height:36,borderRadius:9,fontSize:13,border:`1px solid ${th.border}`}}>{initials}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:th.textPrimary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                    <div style={{fontSize:11,color:th.textFaint,marginBottom:5}}>{c.entity} · {c.frequency}</div>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div className="pbar" style={{flex:1}}><div className="pfill" style={{width:`${pct}%`}}/></div>
                      <span style={{fontSize:10,color:th.textFaint,flexShrink:0}}>{doneCount}/{periods.length}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main panel */}
        <div style={{flex:1,overflowY:"auto",padding:22,background:th.bgBase}}>
          {view==="dashboard" && (
            <Dashboard
              clients={clients}
              activeFY={activeFY}
              th={th}
              onSelectClient={(c, period) => {
                const filled = ensurePeriods(c, activeFY);
                setSelected(filled);
                setActivePeriod(period);
                setView("detail");
              }}
            />
          )}
          {view==="list" && (
            <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
              <div style={{fontSize:42}}>👈</div>
              <div style={{fontSize:14,fontWeight:600,color:th.textFaint}}>Select a client to view details</div>
              <div style={{fontSize:11,color:th.textFaintest}}>Tracking {activeFY}</div>
            </div>
          )}
          {view==="detail" && selected && (
            <DetailView
              client={selected} activeFY={activeFY}
              activePeriod={activePeriod} setActivePeriod={setActivePeriod}
              th={th}
              isPastFY={(() => {
                const fyStartYear = parseInt(activeFY.split(" ")[1].split("-")[0]);
                const now = new Date();
                const curStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
                return fyStartYear < curStart;
              })()}
              onEdit={()=>{setEditClient({...selected});setView("form");}}
              onDelete={()=>handleDelete(selected.id)}
              onBulkMarkNA={()=>handleBulkMarkNA(selected.id)}
              onStageUpdate={handleStageUpdate}
              onAddChecklistItem={handleAddChecklistItem}
              onChecklistItemUpdate={handleChecklistItemUpdate}
              onEditChecklistItem={handleEditChecklistItem}
              onReorderChecklistItems={handleReorderChecklistItems}
              onDeleteChecklistItem={handleDeleteChecklistItem}
              onAddCommLog={handleAddCommLog}
              onDeleteCommLog={handleDeleteCommLog}
              onAudit={recordAudit}
            />
          )}
        </div>
      </div>

      {view==="form" && editClient && (
        <ClientForm client={editClient} onSave={handleSaveClient} onCancel={()=>setView(selected?"detail":"list")} th={th}/>
      )}

      {showExport && (
        <ExportModal clients={clients} onClose={()=>setShowExport(false)} th={th}/>
      )}

      {toast && (
        <div style={{position:"fixed",bottom:22,right:22,padding:"10px 18px",borderRadius:9,fontSize:13,fontWeight:600,zIndex:999,animation:"fadeUp .28s ease",background:toast.type==="error"?th.toastErr:th.toastOk,color:toast.type==="error"?th.toastErrTxt:th.toastOkTxt,border:`1px solid ${toast.type==="error"?th.toastErrTxt+"44":th.toastOkTxt+"44"}`}}>
          {toast.type==="error"?"⚠ ":"✓ "}{toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Detail View ───────────────────────────────────────────────────────────────

function DetailView({ client, activeFY, activePeriod, setActivePeriod, th, isPastFY, onEdit, onDelete, onBulkMarkNA, onStageUpdate, onAddChecklistItem, onChecklistItemUpdate, onEditChecklistItem, onReorderChecklistItems, onDeleteChecklistItem, onAddCommLog, onDeleteCommLog, onAudit }) {
  const [confirmDel,    setConfirmDel]    = useState(false);
  const [showAudit,     setShowAudit]     = useState(false);
  const [confirmBulkNA, setConfirmBulkNA] = useState(false);
  const periods    = periodsForClient(client);
  const fyData     = client.periods?.[activeFY] || {};
  const periodData = fyData[activePeriod] || emptyPeriod();
  const pct  = stageProgress(periodData);
  const st   = overallStatus(periodData);
  const fyDone = periods.filter(p => overallStatus(fyData[p.key]) === "Done").length;
  const fyPct  = periods.length===0?0:Math.round((fyDone/periods.length)*100);
  const avBg   = th.avColors[client.name.charCodeAt(0)%6];
  const initials = client.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const ss = th.statusStyles[st];

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:13}}>
          <div className="av" style={{background:avBg,color:th.avText,width:48,height:48,borderRadius:12,fontSize:17,border:`2px solid ${th.border}`}}>{initials}</div>
          <div>
            <h1 style={{fontFamily:"'Libre Baskerville',serif",fontSize:22,fontWeight:700,color:th.textPrimary,lineHeight:1.2}}>{client.name}</h1>
            <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
              <span className="tag" style={{background:th.tagEntity.bg,border:`1px solid ${th.tagEntity.border}`,color:th.tagEntity.color}}>{client.entity}</span>
              <span className="tag" style={{background:th.tagFreq.bg,border:`1px solid ${th.tagFreq.border}`,color:th.tagFreq.color}}>{client.frequency}</span>
              <span className="tag" style={{background:ss.bg,border:`1px solid ${ss.border}`,color:ss.color}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:ss.dot,flexShrink:0}}/>
                {activePeriod}: {st}
              </span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
          {isPastFY && !confirmBulkNA && (
            <button onClick={()=>setConfirmBulkNA(true)}
              style={{background:th.bgCard,color:th.textFaint,border:`1px solid ${th.border}`,borderRadius:8,padding:"8px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",transition:"all .18s"}}>
              🧹 Mark Empty N/A
            </button>
          )}
          {isPastFY && confirmBulkNA && (
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:11,color:th.textFaint}}>Mark all untouched periods as N/A?</span>
              <button onClick={()=>{onBulkMarkNA();setConfirmBulkNA(false);}}
                style={{background:th.accent,color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                Confirm
              </button>
              <button onClick={()=>setConfirmBulkNA(false)}
                style={{background:"transparent",color:th.textFaint,border:`1px solid ${th.border}`,borderRadius:7,padding:"6px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer"}}>
                Cancel
              </button>
            </div>
          )}
          <button className="btn-g" onClick={()=>setShowAudit(!showAudit)}>🕓 History</button>
          <button className="btn-g" onClick={onEdit}>✏ Edit</button>
          {!confirmDel
            ? <button onClick={()=>setConfirmDel(true)}
                style={{background:th.btnDelete.bg,color:th.btnDelete.color,border:`1px solid ${th.btnDelete.border}`,borderRadius:8,padding:"8px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",transition:"all .18s"}}>
                🗑 Delete
              </button>
            : <button onClick={onDelete}
                style={{background:th.btnDelete.bgHover,color:th.btnDelete.color,border:`1px solid ${th.btnDelete.border}`,borderRadius:8,padding:"8px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer"}}>
                Confirm?
              </button>}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="card" style={{padding:16}}>
          <div className="lbl" style={{color:th.accent,marginBottom:12}}>Client Profile</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[{l:"PAN",v:client.pan||"—"},{l:"GSTIN",v:client.gstin||"Not Applicable"},{l:"Entity",v:client.entity},{l:"Frequency",v:client.frequency},{l:"Email",v:client.contact||"—"},{l:"Phone",v:client.phone||"—"}].map(f=>(
              <div key={f.l}><div className="lbl">{f.l}</div><div style={{fontSize:12,color:th.textMuted,fontWeight:500,wordBreak:"break-all"}}>{f.v}</div></div>
            ))}
          </div>
          {client.notes && (
            <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${th.border}`}}>
              <div className="lbl">Notes</div>
              <div style={{fontSize:11,color:th.textFaint,lineHeight:1.6}}>{client.notes}</div>
            </div>
          )}
        </div>

        <div className="card" style={{padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div className="lbl" style={{color:th.accent}}>{activeFY} Overview</div>
            <span style={{fontSize:20,fontWeight:700,color:th.textPrimary}}>{fyPct}%</span>
          </div>
          <div className="pbar" style={{height:6,marginBottom:14}}><div className="pfill" style={{width:`${fyPct}%`}}/></div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(periods.length,6)},1fr)`,gap:4}}>
            {periods.map(p=>{
              const ost=overallStatus(fyData[p.key]);
              const isAct=activePeriod===p.key;
              const gc=th.gridColors[ost];
              return (
                <div key={p.key} className="pgrid-cell" onClick={()=>setActivePeriod(p.key)}
                  style={{background:isAct?gc:gc+"55",border:isAct?`2px solid ${th.statusStyles[ost].dot}`:"2px solid transparent",color:isAct?"#fff":th.textFaint}}>
                  {p.key}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap"}}>
            {["Pending","In Progress","Done"].map(s=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:th.textFaint}}>
                <div style={{width:9,height:9,borderRadius:2,background:th.gridColors[s]}}/>{s}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Period tabs + stages */}
      <div className="card" style={{padding:18}}>
        <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:12,marginBottom:14,borderBottom:`1px solid ${th.border}`}}>
          {periods.map(p=>{
            const ost=overallStatus(fyData[p.key]);
            const isAct=activePeriod===p.key;
            return (
              <button key={p.key} className={`ptab${isAct?" act":""}`} onClick={()=>setActivePeriod(p.key)}
                style={{color:isAct?th.accent:th.statusStyles[ost].color}}>
                <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:th.statusStyles[ost].dot,marginRight:5,verticalAlign:"middle"}}/>
                {p.key}
              </button>
            );
          })}
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:th.textPrimary}}>{MONTH_FULL[MONTHS.indexOf(activePeriod)]||activePeriod}</div>
            <div style={{fontSize:11,color:th.textMuted}}>{pct}% complete</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div className="pbar" style={{width:90,height:5}}><div className="pfill" style={{width:`${pct}%`}}/></div>
            <span style={{fontSize:13,fontWeight:700,color:th.textPrimary}}>{pct}%</span>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {STAGES.map(stage => (
            <StageBlock
              key={stage.key}
              stage={stage}
              stageData={periodData[stage.key] || emptyStageData(stage.key)}
              clientId={client.id}
              periodKey={activePeriod}
              th={th}
              onStageUpdate={onStageUpdate}
              onAddChecklistItem={onAddChecklistItem}
              onChecklistItemUpdate={onChecklistItemUpdate}
              onEditChecklistItem={onEditChecklistItem}
              onReorderChecklistItems={onReorderChecklistItems}
              onDeleteChecklistItem={onDeleteChecklistItem}
              onAudit={onAudit}
            />
          ))}
        </div>
      </div>

      {/* Communication Log */}
      <CommunicationLog
        clientId={client.id}
        entries={client.commLog||[]}
        th={th}
        onAdd={onAddCommLog}
        onDelete={onDeleteCommLog}
      />

      {/* Audit Log */}
      {showAudit && (
        <AuditLog entries={client.auditLog||[]} th={th}/>
      )}
    </div>
  );
}

// ── Stage Block ───────────────────────────────────────────────────────────────

function StageBlock({ stage, stageData, clientId, periodKey, th, onStageUpdate, onAddChecklistItem, onChecklistItemUpdate, onEditChecklistItem, onReorderChecklistItems, onDeleteChecklistItem, onAudit }) {
  const [expanded,       setExpanded]       = useState(false);
  const [newItemLabel,   setNewItemLabel]   = useState("");
  const [addScope,       setAddScope]       = useState(null);
  const [deleteScope,    setDeleteScope]    = useState(null);
  const [editScope,      setEditScope]      = useState(null);
  const [editingId,      setEditingId]      = useState(null);
  const [editValue,      setEditValue]      = useState("");
  const [reorderScope,   setReorderScope]   = useState(null);
  const [dragOverId,     setDragOverId]     = useState(null);
  const [blockError,     setBlockError]     = useState(null);   // hard block message
  const [pendingWarn,    setPendingWarn]    = useState(null);   // { items: [], onConfirm }

  const val     = stageData.status || "Pending";
  const ss      = th.statusStyles[val];
  const hasData = stageData.doneBy || stageData.doneDate || stageData.remarks || (stageData.checklist?.length > 0);

  // ── Status click with Done validation ──
  const handleStatusClick = (opt) => {
    if (opt !== "Done") {
      setBlockError(null); setPendingWarn(null);
      onStageUpdate(clientId, periodKey, stage.key, "status", opt);
      return;
    }
    // Hard block — Done By or Done Date missing
    const missingFields = [];
    if (!stageData.doneBy?.trim())   missingFields.push("Done By");
    if (!stageData.doneDate?.trim()) missingFields.push("Done Date");
    if (missingFields.length > 0) {
      setBlockError(`Please fill ${missingFields.join(" and ")} before marking as Done.`);
      if (!expanded) setExpanded(true);
      return;
    }
    setBlockError(null);
    // Soft warning — pending checklist items
    const pendingItems = (stageData.checklist || []).filter(
      i => i.status === "Pending" || (!i.status)
    );
    if (pendingItems.length > 0) {
      setPendingWarn({
        items: pendingItems,
        onConfirm: () => {
          onStageUpdate(clientId, periodKey, stage.key, "status", "Done");
          setPendingWarn(null);
        }
      });
      return;
    }
    onStageUpdate(clientId, periodKey, stage.key, "status", "Done");
  };

  // ── Add ──
  const requestAdd = () => {
    if (!newItemLabel.trim()) return;
    setAddScope({ label: newItemLabel.trim() });
  };
  const confirmAdd = (scope) => {
    onAddChecklistItem(clientId, periodKey, stage.key, addScope.label, scope);
    setNewItemLabel(""); setAddScope(null);
  };

  // ── Edit ──
  const startEdit = (item) => {
    setEditingId(item.id); setEditValue(item.label);
    setDeleteScope(null); setReorderScope(null);
  };
  const requestEdit = () => {
    if (!editValue.trim() || editValue.trim() === editingId) return;
    const item = (stageData.checklist||[]).find(i => i.id === editingId);
    if (!item || editValue.trim() === item.label) { setEditingId(null); return; }
    setEditScope({ itemId: editingId, oldLabel: item.label, newLabel: editValue.trim() });
    setEditingId(null);
  };
  const confirmEdit = (scope) => {
    onEditChecklistItem(clientId, periodKey, stage.key, editScope.itemId, editScope.newLabel, scope);
    setEditScope(null);
  };

  // ── Delete ──
  const requestDelete = (itemId, label) => {
    setEditingId(null); setReorderScope(null);
    setDeleteScope({ itemId, label });
  };
  const confirmDelete = (scope) => {
    onDeleteChecklistItem(clientId, periodKey, stage.key, deleteScope.itemId, scope);
    setDeleteScope(null);
  };

  // ── Drag & drop reorder ──
  const handleDragStart = (e, id) => {
    e.dataTransfer.setData("dragId", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, id) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    setDragOverId(null);
    const dragId = e.dataTransfer.getData("dragId");
    if (!dragId || dragId === targetId) return;
    const list = stageData.checklist || [];
    const oldOrder = list.map(i => i.id);
    const fromIdx = oldOrder.indexOf(dragId);
    const toIdx   = oldOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newOrder = [...oldOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragId);
    setReorderScope({ newOrder });
  };
  const confirmReorder = (scope) => {
    onReorderChecklistItems(clientId, periodKey, stage.key, reorderScope.newOrder, scope);
    setReorderScope(null);
  };

  // ── Shared scope picker ──
  const scopeBox = (onThis, onAll, onCancel, label) => (
    <div style={{background:th.bgCard,border:`1px solid ${th.accent}`,borderRadius:8,padding:"10px 12px",marginBottom:6,display:"flex",flexDirection:"column",gap:8}}>
      <div style={{fontSize:11,color:th.textMuted,fontWeight:600}}>{label}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <button onClick={onThis}
          style={{background:th.bgStage,border:`1px solid ${th.border}`,borderRadius:6,padding:"4px 12px",fontSize:11,fontWeight:600,color:th.textMuted,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
          This period only
        </button>
        <button onClick={onAll}
          style={{background:th.accent,border:`1px solid ${th.accent}`,borderRadius:6,padding:"4px 12px",fontSize:11,fontWeight:600,color:"#fff",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
          This + all future periods
        </button>
        <button onClick={onCancel}
          style={{background:"transparent",border:"none",fontSize:11,color:th.textFaintest,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:"4px 6px"}}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className={`stage-block${hasData?" active-border":""}`}>
      <div className="stage-head">
        <span style={{fontSize:17,width:22,textAlign:"center",flexShrink:0}}>{stage.icon}</span>
        <span style={{flex:1,fontSize:13,fontWeight:500,color:th.textMuted}}>{stage.label}</span>
        <div style={{display:"flex",gap:4}}>
          {STATUS_OPTIONS.map(opt=>(
            <button key={opt} className="spill"
              onClick={()=>handleStatusClick(opt)}
              style={{background:val===opt?th.statusStyles[opt].bg:"transparent",color:val===opt?th.statusStyles[opt].color:th.textFaintest,border:val===opt?`1px solid ${th.statusStyles[opt].border}`:`1px solid ${th.border}`}}>
              {opt}
            </button>
          ))}
        </div>
        <button onClick={()=>setExpanded(!expanded)}
          style={{marginLeft:8,background:"transparent",border:`1px solid ${th.border}`,color:th.textFaint,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>
          {expanded?"▲":"▼"}
        </button>
      </div>

      {/* Hard block error */}
      {blockError && (
        <div style={{margin:"0 13px 10px",padding:"9px 13px",background:th.toastErr,border:`1px solid ${th.toastErrTxt}44`,borderRadius:7,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,color:th.toastErrTxt,fontWeight:500}}>⚠ {blockError}</span>
          <button onClick={()=>setBlockError(null)} style={{background:"transparent",border:"none",color:th.toastErrTxt,cursor:"pointer",fontSize:14,padding:0,lineHeight:1}}>✕</button>
        </div>
      )}

      {/* Soft warning — pending checklist items */}
      {pendingWarn && (
        <div style={{margin:"0 13px 10px",padding:"12px 14px",background:th.bgCard,border:`1px solid ${th.accent}`,borderRadius:8,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:12,color:th.textMuted,fontWeight:600}}>⚠ The following checklist items are still pending:</div>
          <ul style={{paddingLeft:18,display:"flex",flexDirection:"column",gap:4}}>
            {pendingWarn.items.map(i=>(
              <li key={i.id} style={{fontSize:12,color:th.textFaint}}>{i.label}</li>
            ))}
          </ul>
          <div style={{fontSize:11,color:th.textFaint}}>Do you want to mark this stage as Done anyway?</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={pendingWarn.onConfirm}
              style={{background:th.accent,color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              Mark Done Anyway
            </button>
            <button onClick={()=>setPendingWarn(null)}
              style={{background:"transparent",color:th.textMuted,border:`1px solid ${th.border}`,borderRadius:7,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              Go Back
            </button>
          </div>
        </div>
      )}

      {!expanded && hasData && (
        <div style={{padding:"0 13px 10px 51px",display:"flex",gap:14,flexWrap:"wrap"}}>
          {stageData.doneBy   && <span style={{fontSize:11,color:th.textMuted}}>👤 {stageData.doneBy}</span>}
          {stageData.doneDate && <span style={{fontSize:11,color:th.textMuted}}>📅 {stageData.doneDate}</span>}
          {stageData.remarks  && <span style={{fontSize:11,color:th.textMuted,fontStyle:"italic"}}>💬 {stageData.remarks.slice(0,60)}{stageData.remarks.length>60?"…":""}</span>}
          {stageData.checklist?.length > 0 && <span style={{fontSize:11,color:th.textMuted}}>✓ {stageData.checklist.filter(i=>i.status==="Done").length}/{stageData.checklist.length} items</span>}
        </div>
      )}

      {expanded && (
        <div className="stage-foot">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div className="lbl">Done By</div>
              <input className="inp" placeholder="e.g. Jay"
                value={stageData.doneBy||""}
                onChange={e=>onStageUpdate(clientId,periodKey,stage.key,"doneBy",e.target.value)}
                onBlur={e=>onAudit(clientId,{type:"field",period:periodKey,stage:stage.label,field:"Done By",to:e.target.value})}
                style={{fontSize:12}}/>
            </div>
            <div>
              <div className="lbl">Done Date</div>
              <input className="inp" type="date"
                value={stageData.doneDate||""}
                onChange={e=>onStageUpdate(clientId,periodKey,stage.key,"doneDate",e.target.value)}
                onBlur={e=>onAudit(clientId,{type:"field",period:periodKey,stage:stage.label,field:"Done Date",to:e.target.value})}
                style={{fontSize:12}}/>
            </div>
          </div>
          <div>
            <div className="lbl">Remarks</div>
            <textarea className="inp" placeholder="e.g. Purchase received. Office expenses file pending."
              value={stageData.remarks||""}
              onChange={e=>onStageUpdate(clientId,periodKey,stage.key,"remarks",e.target.value)}
              onBlur={e=>e.target.value&&onAudit(clientId,{type:"field",period:periodKey,stage:stage.label,field:"Remarks",to:e.target.value})}
              rows={2} style={{fontSize:12,resize:"vertical"}}/>
          </div>

          {stage.hasChecklist && (
            <div>
              <div className="lbl" style={{marginBottom:8}}>{stage.label} Checklist</div>
              {(stageData.checklist||[]).length === 0 && (
                <div style={{fontSize:12,color:th.textFaintest,marginBottom:10,fontStyle:"italic"}}>No checklist items yet. Add items below.</div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                {(stageData.checklist||[]).map(item=>(
                  <div key={item.id}
                    draggable
                    onDragStart={e=>handleDragStart(e,item.id)}
                    onDragOver={e=>handleDragOver(e,item.id)}
                    onDragLeave={()=>setDragOverId(null)}
                    onDrop={e=>handleDrop(e,item.id)}
                  >
                    {/* Edit scope picker */}
                    {editScope?.itemId === item.id && scopeBox(
                      () => confirmEdit("this"),
                      () => confirmEdit("all"),
                      () => setEditScope(null),
                      `Rename "${editScope.oldLabel}" → "${editScope.newLabel}" in:`
                    )}
                    {/* Delete scope picker */}
                    {deleteScope?.itemId === item.id && scopeBox(
                      () => confirmDelete("this"),
                      () => confirmDelete("all"),
                      () => setDeleteScope(null),
                      `Remove "${item.label}" from:`
                    )}

                    <div className="checklist-row" style={{
                      opacity: dragOverId===item.id ? 0.5 : 1,
                      borderColor: dragOverId===item.id ? th.accent : th.border,
                      cursor:"grab"
                    }}>
                      {/* Drag handle */}
                      <span style={{color:th.textFaintest,fontSize:13,cursor:"grab",flexShrink:0,paddingRight:2,userSelect:"none"}}>⠿</span>

                      {/* Status toggle */}
                      <div onClick={()=>{
                          const next=item.status==="Pending"?"Done":item.status==="Done"?"N/A":"Pending";
                          onChecklistItemUpdate(clientId,periodKey,stage.key,item.id,"status",next);
                        }}
                        style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${th.statusStyles[item.status||"Pending"].dot}`,background:item.status==="Done"?th.statusStyles["Done"].dot:item.status==="N/A"?th.statusStyles["N/A"].dot:"transparent",cursor:"pointer",flexShrink:0,transition:"all .14s"}}
                      />

                      {/* Label — inline edit or display */}
                      {editingId === item.id ? (
                        <input
                          autoFocus
                          className="inp"
                          value={editValue}
                          onChange={e=>setEditValue(e.target.value)}
                          onKeyDown={e=>{ if(e.key==="Enter") requestEdit(); if(e.key==="Escape"){ setEditingId(null); } }}
                          onBlur={requestEdit}
                          style={{flex:1,fontSize:12,padding:"2px 6px",height:24}}
                        />
                      ) : (
                        <span
                          style={{flex:1,fontSize:12,color:item.status==="Done"?th.textFaintest:th.textMuted,textDecoration:item.status==="Done"?"line-through":"none"}}
                          onDoubleClick={()=>startEdit(item)}
                        >{item.label}</span>
                      )}

                      {/* Done by + date */}
                      <input className="inp-sm" placeholder="Done by"
                        value={item.doneBy||""}
                        onChange={e=>onChecklistItemUpdate(clientId,periodKey,stage.key,item.id,"doneBy",e.target.value)}
                        style={{width:88}}/>
                      <input className="inp-sm" type="date"
                        value={item.doneDate||""}
                        onChange={e=>onChecklistItemUpdate(clientId,periodKey,stage.key,item.id,"doneDate",e.target.value)}
                        style={{width:130}}/>

                      {/* Edit button */}
                      <button
                        onClick={()=>editingId===item.id ? requestEdit() : startEdit(item)}
                        title="Edit label"
                        style={{background:"transparent",border:"none",color:editingId===item.id?th.accent:th.textFaintest,cursor:"pointer",fontSize:13,padding:"0 2px",lineHeight:1}}>✏</button>

                      {/* Delete button */}
                      <button
                        onClick={()=>deleteScope?.itemId===item.id ? setDeleteScope(null) : requestDelete(item.id, item.label)}
                        style={{background:"transparent",border:"none",color:deleteScope?.itemId===item.id?th.accent:th.textFaintest,cursor:"pointer",fontSize:15,padding:"0 2px",lineHeight:1}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reorder scope picker */}
              {reorderScope && scopeBox(
                () => confirmReorder("this"),
                () => confirmReorder("all"),
                () => setReorderScope(null),
                "Apply this new order to:"
              )}

              {/* Add scope picker */}
              {addScope && scopeBox(
                () => confirmAdd("this"),
                () => confirmAdd("all"),
                () => setAddScope(null),
                `Add "${addScope.label}" to:`
              )}

              <div style={{display:"flex",gap:8}}>
                <input className="inp" placeholder="Add a checklist item…"
                  value={newItemLabel}
                  onChange={e=>setNewItemLabel(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&requestAdd()}
                  style={{fontSize:12}}/>
                <button className="btn-p" onClick={requestAdd} style={{whiteSpace:"nowrap",padding:"7px 14px",fontSize:12}}>+ Add</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function DashboardTable({ rows, onSelectClient, isOverdue, th }) {
  if (rows.length === 0) return null;
  return (
    <div style={{borderRadius:10,overflow:"hidden",border:isOverdue?`1px solid ${th.overdue.border}`:`1px solid ${th.border}`}}>
      <div style={{display:"grid",gridTemplateColumns:`1fr 70px repeat(${STAGES.length},1fr)`,background:isOverdue?th.overdue.bgHeader:th.bgStageFoot,borderBottom:isOverdue?`1px solid ${th.overdue.borderFaint}`:`1px solid ${th.border}`,padding:"8px 14px",gap:6}}>
        <div className="lbl" style={{margin:0,color:isOverdue?"#FCA5A5":th.textFaint}}>Client</div>
        <div className="lbl" style={{margin:0,color:isOverdue?"#FCA5A5":th.textFaint}}>Period</div>
        {STAGES.map(s=>(
          <div key={s.key} className="lbl" style={{margin:0,textAlign:"center",fontSize:9,color:isOverdue?"#FCA5A5":th.textFaint}}>{s.label}</div>
        ))}
      </div>
      {rows.map(row=>{
        const avBg=th.avColors[row.client.name.charCodeAt(0)%6];
        const initials=row.client.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
        return (
          <div key={`${row.client.id}-${row.periodKey}`}
            onClick={()=>onSelectClient(row.client,row.periodKey)}
            style={{display:"grid",gridTemplateColumns:`1fr 70px repeat(${STAGES.length},1fr)`,padding:"9px 14px",gap:6,borderBottom:isOverdue?`1px solid ${th.overdue.borderRow}`:`1px solid ${th.borderRowSep}`,cursor:"pointer",transition:"background .14s",alignItems:"center",background:isOverdue?th.overdue.bg:"transparent"}}
            onMouseEnter={e=>e.currentTarget.style.background=isOverdue?th.overdue.bgHover:th.bgHover}
            onMouseLeave={e=>e.currentTarget.style.background=isOverdue?th.overdue.bg:"transparent"}>
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
              <div style={{width:26,height:26,borderRadius:7,background:avBg,color:th.avText,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,border:`1px solid ${th.border}`}}>{initials}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:isOverdue?th.overdue.textPrimary:th.textPrimary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.client.name}</div>
                <div style={{fontSize:10,color:isOverdue?th.overdue.textFaint:th.textFaintest}}>{row.client.entity}</div>
              </div>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:isOverdue?th.overdue.textPeriod:th.textFaint}}>{row.periodKey}</div>
            {STAGES.map(s=>{
              const st=row.periodData[s.key]?.status||"Pending";
              const dot=th.statusStyles[st].dot;
              const bg=th.statusStyles[st].bg;
              const border=th.statusStyles[st].border;
              return (
                <div key={s.key} style={{display:"flex",justifyContent:"center"}}>
                  <div title={st} style={{width:22,height:22,borderRadius:"50%",background:bg,border:`2px solid ${border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:9,height:9,borderRadius:"50%",background:dot}}/>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function DashboardSection({ title, icon, rows, onSelectClient, isOverdue, th, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (rows.length === 0) return null;
  return (
    <div style={{marginBottom:14}}>
      <button onClick={()=>setOpen(!open)}
        style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:isOverdue?th.overdue.bgSection:th.bgCard,border:isOverdue?`1px solid ${th.overdue.border}`:`1px solid ${th.border}`,borderRadius:open?"8px 8px 0 0":"8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
        <span style={{fontSize:14}}>{icon}</span>
        <span style={{flex:1,fontSize:12,fontWeight:700,color:isOverdue?th.overdue.textPrimary:th.textMuted,textAlign:"left"}}>{title}</span>
        <span style={{fontSize:11,fontWeight:600,padding:"2px 10px",borderRadius:20,background:isOverdue?th.overdue.countBg:th.border,color:isOverdue?th.overdue.textPrimary:th.textFaint}}>{rows.length} period{rows.length!==1?"s":""}</span>
        <span style={{fontSize:11,color:isOverdue?th.overdue.textFaint:th.textFaintest}}>{open?"▲":"▼"}</span>
      </button>
      {open && <DashboardTable rows={rows} onSelectClient={onSelectClient} isOverdue={isOverdue} th={th}/>}
    </div>
  );
}

function Dashboard({ clients, activeFY, th, onSelectClient }) {
  const now         = new Date();
  const nowMonthIdx = now.getMonth() >= 3 ? now.getMonth()-3 : now.getMonth()+9;
  const curMonthKey = MONTHS[nowMonthIdx];

  // Determine if activeFY is a past FY (already ended)
  // FY ends in March, so "FY 2025-26" ended in Mar 2026
  // activeFY format: "FY 2026-27" → start year 2026
  const activeFYStartYear = parseInt(activeFY.split(" ")[1].split("-")[0]);
  const currentFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const isPastFY = activeFYStartYear < currentFYStartYear;

  // Current quarter key
  const curQuarterIdx = Math.floor(nowMonthIdx / 3);

  // Categorise rows
  const overdueMonthly=[], overdueQuarterly=[], overdueYearly=[];
  const currentMonthly=[], currentQuarterly=[], currentYearly=[];

  clients.forEach(client => {
    const periods = periodsForClient(client);
    const fyData  = client.periods?.[activeFY] || {};
    periods.forEach(p => {
      const pd  = fyData[p.key];
      const ost = overallStatus(pd);
      if (ost === "Done") return;

      const row = { client, periodKey: p.key, periodData: pd || {} };

      if (client.frequency === "Monthly") {
        const idx = MONTHS.indexOf(p.key);
        if (!isPastFY && idx > nowMonthIdx) return; // future — skip
        if (isPastFY || idx < nowMonthIdx) overdueMonthly.push(row);
        else currentMonthly.push(row);
      } else if (client.frequency === "Quarterly") {
        const qKeys = ["Q1 (Apr–Jun)","Q2 (Jul–Sep)","Q3 (Oct–Dec)","Q4 (Jan–Mar)"];
        const idx   = qKeys.indexOf(p.key);
        if (!isPastFY && idx > curQuarterIdx) return;
        if (isPastFY || idx < curQuarterIdx) overdueQuarterly.push(row);
        else currentQuarterly.push(row);
      } else {
        // Annually — only show if this is a past FY
        if (isPastFY) overdueYearly.push(row);
        // During the active FY, yearly clients are hidden completely
      }
    });
  });

  // Sort each group by client name
  const byName = (a,b) => a.client.name.localeCompare(b.client.name);
  overdueMonthly.sort((a,b)=>{
    const ai=MONTHS.indexOf(a.periodKey), bi=MONTHS.indexOf(b.periodKey);
    return ai!==bi ? ai-bi : byName(a,b);
  });
  overdueQuarterly.sort(byName);
  overdueYearly.sort(byName);
  currentMonthly.sort(byName);
  currentQuarterly.sort(byName);
  currentYearly.sort(byName);

  const totalOverdue = overdueMonthly.length + overdueQuarterly.length + overdueYearly.length;
  const totalCurrent = currentMonthly.length + currentQuarterly.length + currentYearly.length;

  // Summary stats
  const allClients = clients.length;
  const fullyDone  = clients.filter(c => {
    const periods = periodsForClient(c);
    const fyData  = c.periods?.[activeFY] || {};
    return periods.every(p => overallStatus(fyData[p.key]) === "Done");
  }).length;
  const notStarted = clients.filter(c => {
    const fyData = c.periods?.[activeFY] || {};
    const allV   = periodsForClient(c).flatMap(p => STAGES.map(s => fyData[p.key]?.[s.key]?.status||"Pending"));
    return allV.every(v => v === "Pending");
  }).length;
  const inProgress = allClients - fullyDone - notStarted;
  const pct = allClients===0?0:Math.round((fullyDone/allClients)*100);

  // Fix 2: Theme-aware card definitions — no more hardcoded dark backgrounds
  const CARDS = [
    { label:"Total Clients", value:allClients, color:"#2563EB", bg:th.bgCard, border:th.border },
    { label:"Fully Done",    value:fullyDone,  color:"#22C55E", bg:th.bgCard, border:th.border },
    { label:"In Progress",   value:inProgress, color:"#3B82F6", bg:th.bgCard, border:th.border },
    { label:"Not Started",   value:notStarted, color:"#F59E0B", bg:th.bgCard, border:th.border },
    { label:"Overall",       value:`${pct}%`,  color:th.accent, bg:th.bgCard, border:th.accent },
  ];

  const allDone = totalOverdue===0 && totalCurrent===0;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
        <div>
          <h2 style={{fontFamily:"'Libre Baskerville',serif",fontSize:20,fontWeight:700,color:th.textPrimary,marginBottom:3}}>Dashboard</h2>
          <div style={{fontSize:12,color:th.textFaint}}>{activeFY} — as of {curMonthKey} {now.getFullYear()}</div>
        </div>
        {totalOverdue > 0 && (
          <div style={{background:th.overdue.bgAlert,border:`1px solid ${th.overdue.border}`,borderRadius:10,padding:"8px 16px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>🚨</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:th.overdue.textPrimary}}>{totalOverdue} Overdue Period{totalOverdue!==1?"s":""}</div>
              <div style={{fontSize:11,color:th.overdue.textFaint}}>Requires immediate attention</div>
            </div>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:11,marginBottom:22}}>
        {CARDS.map(c=>(
          <div key={c.label} style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:12,padding:"13px 15px",boxShadow:`0 1px 4px ${c.border}22`}}>
            <div style={{fontSize:22,fontWeight:700,color:c.color,marginBottom:3}}>{c.value}</div>
            <div style={{fontSize:10,color:th.textPrimary,fontWeight:700,textTransform:"uppercase",letterSpacing:".7px",opacity:.6}}>{c.label}</div>
          </div>
        ))}
      </div>

      {allDone ? (
        <div className="card" style={{padding:40,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:10}}>🎉</div>
          <div style={{fontSize:14,fontWeight:600,color:"#22C55E"}}>All caught up!</div>
          <div style={{fontSize:12,color:th.textFaint,marginTop:4}}>No pending work for {activeFY}</div>
        </div>
      ) : (
        <div>
          {totalOverdue > 0 && (
            <div style={{marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{height:1,flex:1,background:th.overdue.divider}}/>
                <span style={{fontSize:11,fontWeight:700,color:th.overdue.textPeriod,textTransform:"uppercase",letterSpacing:"1px"}}>⚠ Overdue — Past Periods Not Closed</span>
                <div style={{height:1,flex:1,background:th.overdue.divider}}/>
              </div>
              <DashboardSection title="Monthly Clients — Overdue"   icon="📅" rows={overdueMonthly}   onSelectClient={onSelectClient} isOverdue={true}  th={th}/>
              <DashboardSection title="Quarterly Clients — Overdue" icon="📆" rows={overdueQuarterly} onSelectClient={onSelectClient} isOverdue={true}  th={th}/>
              <DashboardSection title="Yearly Clients — Overdue"    icon="🗓" rows={overdueYearly}    onSelectClient={onSelectClient} isOverdue={true}  th={th}/>
            </div>
          )}
          {totalCurrent > 0 && (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{height:1,flex:1,background:th.border}}/>
                <span style={{fontSize:11,fontWeight:700,color:th.textFaint,textTransform:"uppercase",letterSpacing:"1px"}}>📅 Current Period — {curMonthKey}</span>
                <div style={{height:1,flex:1,background:th.border}}/>
              </div>
              <DashboardSection title="Monthly Clients"   icon="📅" rows={currentMonthly}   onSelectClient={onSelectClient} isOverdue={false} th={th}/>
              <DashboardSection title="Quarterly Clients" icon="📆" rows={currentQuarterly} onSelectClient={onSelectClient} isOverdue={false} th={th}/>
              <DashboardSection title="Yearly Clients"    icon="🗓" rows={currentYearly}    onSelectClient={onSelectClient} isOverdue={false} th={th}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Communication Log ─────────────────────────────────────────────────────────

function CommunicationLog({ clientId, entries, th, onAdd, onDelete }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm]     = useState({ date: today, note: "", addedBy: "" });
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const handleAdd = () => {
    if (!form.note.trim() || !form.addedBy.trim() || !form.date) return;
    onAdd(clientId, form);
    setForm({ date: today, note: "", addedBy: "" });
    setAdding(false);
  };

  return (
    <div className="card" style={{padding:18, marginTop:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div className="lbl" style={{color:th.accent,margin:0}}>💬 Communication Log</div>
        <button className="btn-p" style={{padding:"5px 13px",fontSize:12}} onClick={()=>setAdding(!adding)}>
          {adding ? "Cancel" : "+ Add Entry"}
        </button>
      </div>

      {adding && (
        <div style={{background:th.bgStageFoot,border:`1px solid ${th.border}`,borderRadius:9,padding:13,marginBottom:14,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div className="lbl">Date</div>
              <input className="inp" type="date" value={form.date}
                onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                style={{fontSize:12}}/>
            </div>
            <div>
              <div className="lbl">Added By</div>
              <input className="inp" placeholder="e.g. Jay"
                value={form.addedBy}
                onChange={e=>setForm(f=>({...f,addedBy:e.target.value}))}
                style={{fontSize:12}}/>
            </div>
          </div>
          <div>
            <div className="lbl">Note</div>
            <textarea className="inp" placeholder="e.g. Called client, documents awaited."
              value={form.note}
              onChange={e=>setForm(f=>({...f,note:e.target.value}))}
              rows={2} style={{fontSize:12,resize:"vertical"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <button className="btn-p" onClick={handleAdd}
              style={{opacity:(form.note.trim()&&form.addedBy.trim()&&form.date)?1:.4,fontSize:12,padding:"6px 16px"}}>
              Save Entry
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !adding && (
        <div style={{fontSize:12,color:th.textFaintest,fontStyle:"italic",textAlign:"center",padding:"14px 0"}}>
          No communication entries yet.
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {entries.map(entry => (
          <div key={entry.id} style={{display:"flex",gap:12,padding:"10px 13px",background:th.bgStageFoot,borderRadius:8,border:`1px solid ${th.border}`,alignItems:"flex-start"}}>
            <div style={{flexShrink:0,marginTop:2}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:th.accent,marginTop:4}}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,color:th.textMuted,lineHeight:1.6}}>{entry.note}</div>
              <div style={{display:"flex",gap:12,marginTop:5}}>
                <span style={{fontSize:11,color:th.textFaint}}>📅 {entry.date}</span>
                <span style={{fontSize:11,color:th.textFaint}}>👤 {entry.addedBy}</span>
              </div>
            </div>
            {confirmId === entry.id
              ? <button onClick={()=>{onDelete(clientId,entry.id);setConfirmId(null);}}
                  style={{background:th.btnDelete.bgHover,border:`1px solid ${th.btnDelete.border}`,color:th.btnDelete.color,borderRadius:6,padding:"3px 9px",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>
                  Confirm?
                </button>
              : <button onClick={()=>setConfirmId(entry.id)}
                  style={{background:"transparent",border:"none",color:th.textFaintest,cursor:"pointer",fontSize:14,padding:"0 2px",flexShrink:0}}>✕</button>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

function AuditLog({ entries, th }) {
  const fmt = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) +
      " " + d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true });
  };
  const describe = (e) => {
    if (e.type === "status")           return `${e.stage} [${e.period}] changed from "${e.from}" → "${e.to}"`;
    if (e.type === "field")            return `${e.stage} [${e.period}] — ${e.field} set to "${e.to}"`;
    if (e.type === "checklist_add")    return `${e.stage} [${e.period}] — checklist item added: "${e.item}"`;
    if (e.type === "checklist_edit")   return `${e.stage} [${e.period}] — checklist item renamed to ${e.item}`;
    if (e.type === "checklist_delete") return `${e.stage} [${e.period}] — checklist item removed: "${e.item}"`;
    return JSON.stringify(e);
  };
  return (
    <div className="card" style={{padding:18,marginTop:14}}>
      <div className="lbl" style={{color:th.accent,marginBottom:14}}>🕓 Audit Trail</div>
      {entries.length === 0 && (
        <div style={{fontSize:12,color:th.textFaintest,fontStyle:"italic",textAlign:"center",padding:"14px 0"}}>
          No changes recorded yet.
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:340,overflowY:"auto"}}>
        {entries.map(e => (
          <div key={e.id} style={{display:"flex",gap:12,padding:"9px 12px",background:th.bgStageFoot,borderRadius:7,border:`1px solid ${th.border}`,alignItems:"flex-start"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:th.textFaint,flexShrink:0,marginTop:5}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,color:th.textMuted}}>{describe(e)}</div>
              <div style={{display:"flex",gap:12,marginTop:4}}>
                <span style={{fontSize:10,color:th.textFaint}}>👤 {e.actor}</span>
                <span style={{fontSize:10,color:th.textFaint}}>🕓 {fmt(e.ts)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Client Form ───────────────────────────────────────────────────────────────

function ClientForm({ client, onSave, onCancel, th }) {
  const [form, setForm] = useState(client);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const isNew = !client.name;
  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal">
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${th.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h2 style={{fontFamily:"'Libre Baskerville',serif",fontSize:17,color:th.textPrimary}}>{isNew?"Add New Client":"Edit Client"}</h2>
          <button className="btn-g" onClick={onCancel} style={{padding:"5px 10px"}}>✕</button>
        </div>
        <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:13}}>
          <div><div className="lbl">Client Name *</div><input className="inp" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Ramesh Traders"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
            <div><div className="lbl">Entity Type</div><select className="inp sel" value={form.entity} onChange={e=>set("entity",e.target.value)}>{ENTITY_TYPES.map(e=><option key={e}>{e}</option>)}</select></div>
            <div><div className="lbl">Accounting Frequency</div><select className="inp sel" value={form.frequency} onChange={e=>set("frequency",e.target.value)}>{FREQUENCIES.map(f=><option key={f}>{f}</option>)}</select></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
            <div><div className="lbl">PAN</div><input className="inp" value={form.pan} onChange={e=>set("pan",e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10}/></div>
            <div><div className="lbl">GSTIN (if applicable)</div><input className="inp" value={form.gstin} onChange={e=>set("gstin",e.target.value.toUpperCase())} placeholder="24ABCDE1234F1Z5" maxLength={15}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
            <div><div className="lbl">Email</div><input className="inp" value={form.contact} onChange={e=>set("contact",e.target.value)} placeholder="client@email.com"/></div>
            <div><div className="lbl">Phone</div><input className="inp" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="9876543210" maxLength={10}/></div>
          </div>
          <div><div className="lbl">Notes</div><textarea className="inp" value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any important notes…" rows={3} style={{resize:"vertical"}}/></div>
        </div>
        <div style={{padding:"13px 22px",borderTop:`1px solid ${th.border}`,display:"flex",justifyContent:"flex-end",gap:8}}>
          <button className="btn-g" onClick={onCancel}>Cancel</button>
          <button className="btn-p" onClick={()=>form.name.trim()&&onSave(form)} style={{opacity:form.name.trim()?1:.4}}>{isNew?"Add Client":"Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Audit Log Download (standalone) ──────────────────────────────────────────

function downloadAllAuditLog(clients) {
  const rows = [];
  clients.forEach(client => {
    (client.auditLog || []).forEach(e => {
      let description = "";
      if (e.type === "status")                description = `${e.stage} [${e.period}] changed "${e.from}" → "${e.to}"`;
      else if (e.type === "field")            description = `${e.stage} [${e.period}] — ${e.field} set to "${e.to}"`;
      else if (e.type === "checklist_add")    description = `${e.stage} [${e.period}] — checklist added: "${e.item}"`;
      else if (e.type === "checklist_delete") description = `${e.stage} [${e.period}] — checklist removed: "${e.item}"`;
      else description = JSON.stringify(e);
      const d   = new Date(e.ts);
      const fmt = d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})
                + " " + d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
      rows.push({ Client:client.name, FY:e.fy||"", Actor:e.actor||"", Timestamp:fmt, Description:description });
    });
  });
  rows.sort((a,b) => a.Client.localeCompare(b.Client));
  const headers = ["Client","FY","Actor","Timestamp","Description"];
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => `"${(r[h]||"").replace(/"/g,'""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "Audit_Log_All_Clients.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Export Modal ──────────────────────────────────────────────────────────────

function ExportModal({ clients, onClose, th }) {
  const allFYs = fyList();
  const [selClients,  setSelClients]  = useState(clients.map(c => c.id));
  const [selFYs,      setSelFYs]      = useState([currentFY()]);
  const [periodMode,  setPeriodMode]  = useState("all");
  const [selPeriods,  setSelPeriods]  = useState([]);
  const [inclCommLog, setInclCommLog] = useState(true);
  const [exporting,   setExporting]   = useState(false);
  const [progress,    setProgress]    = useState("");

  const toggleClient = (id) => setSelClients(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  const toggleFY     = (fy) => setSelFYs(p    => p.includes(fy) ? p.filter(x=>x!==fy) : [...p, fy]);
  const togglePeriod = (k)  => setSelPeriods(p => p.includes(k) ? p.filter(x=>x!==k)  : [...p, k]);
  const allCliSel    = selClients.length === clients.length;
  const togAllCli    = () => setSelClients(allCliSel ? [] : clients.map(c => c.id));

  const allFreqs     = [...new Set(clients.filter(c => selClients.includes(c.id)).map(c => c.frequency))];
  const hasMonthly   = allFreqs.includes("Monthly");
  const hasQuarterly = allFreqs.includes("Quarterly");

  const doExport = async () => {
    if (!selClients.length || !selFYs.length) return;
    setExporting(true);
    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
    } catch(e) {
      setProgress("Failed to load export libraries. Check your connection.");
      setExporting(false); return;
    }
    const XLSX  = window.XLSX;
    const JSZip = window.JSZip;
    const zip   = new JSZip();
    const chosenClients = clients.filter(c => selClients.includes(c.id));

    for (const client of chosenClients) {
      setProgress(`Exporting ${client.name}…`);
      const wb = XLSX.utils.book_new();
      for (const fy of selFYs) {
        const allPeriods = periodsForClient(client);
        let periodsToExport = allPeriods;
        if (periodMode !== "all" && selPeriods.length) {
          periodsToExport = allPeriods.filter(p => selPeriods.includes(p.key));
        }
        for (const period of periodsToExport) {
          const fyData     = client.periods?.[fy] || {};
          const periodData = fyData[period.key]   || {};
          const sheetName  = `${fy} - ${period.key}`.replace(/[:\\/?*[\]]/g,"").slice(0, 31);
          const rows = [];
          rows.push(["Client Name", client.name]);
          rows.push(["Entity Type", client.entity]);
          rows.push(["PAN",         client.pan    || "—"]);
          rows.push(["GSTIN",       client.gstin  || "—"]);
          rows.push(["Email",       client.contact|| "—"]);
          rows.push(["Phone",       client.phone  || "—"]);
          rows.push(["Frequency",   client.frequency]);
          rows.push(["FY",          fy]);
          rows.push(["Period",      period.label]);
          rows.push([]);
          rows.push(["Stage","Status","Done By","Done Date","Remarks","Checklist Items"]);
          STAGES.forEach(stage => {
            const sd        = periodData[stage.key] || {};
            const checklist = (sd.checklist || []).map(i =>
              `[${i.status||"Pending"}] ${i.label}${i.doneBy ? " ("+i.doneBy+")" : ""}`
            ).join("; ");
            rows.push([stage.label, sd.status||"Pending", sd.doneBy||"", sd.doneDate||"", sd.remarks||"", checklist]);
          });
          const ws = XLSX.utils.aoa_to_sheet(rows);
          ws["!cols"] = [22, 14, 14, 14, 34, 50].map(w => ({ wch: w }));
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
      }
      if (inclCommLog) {
        const commRows = [["Date","Note","Added By"]];
        (client.commLog || []).forEach(e => commRows.push([e.date, e.note, e.addedBy]));
        const ws = XLSX.utils.aoa_to_sheet(commRows);
        ws["!cols"] = [{ wch:14 }, { wch:50 }, { wch:14 }];
        XLSX.utils.book_append_sheet(wb, ws, "Communication Log");
      }
      const wbBuf   = XLSX.write(wb, { bookType:"xlsx", type:"array" });
      const safeName= client.name.replace(/[^\w\s]/g,"").replace(/\s+/g,"_");
      zip.file(`${safeName}.xlsx`, wbBuf);
    }

    setProgress("Compressing…");
    const blob = await zip.generateAsync({ type:"blob" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "MSA_Tracker_Export.zip"; a.click();
    URL.revokeObjectURL(url);
    setExporting(false); setProgress(""); onClose();
  };

  // Theme-aware styles
  const S = {
    row:  { display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"5px 8px", borderRadius:6, transition:"background .12s" },
    chk:  { width:14, height:14, borderRadius:3, border:`1px solid ${th.border}`, background:th.bgInput, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:th.textPrimary },
    chkOn:{ background:th.accent, borderColor:th.accent, color:"#fff" },
    lbl:  { fontSize:12, color:th.textMuted },
    sec:  { marginBottom:18 },
    sh:   { fontSize:10, fontWeight:700, letterSpacing:".8px", textTransform:"uppercase", color:th.textFaint, marginBottom:8 },
  };
  const Chk = ({ on, onClick, label, style }) => (
    <div style={{ ...S.row, ...style }} onClick={onClick}>
      <div style={{ ...S.chk, ...(on ? S.chkOn : {}) }}>{on && "✓"}</div>
      <span style={S.lbl}>{label}</span>
    </div>
  );

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && !exporting && onClose()}>
      <div className="modal" style={{ maxWidth:700 }}>
        {/* Header */}
        <div style={{padding:"16px 22px",borderBottom:`1px solid ${th.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h2 style={{fontFamily:"'Libre Baskerville',serif",fontSize:16,color:th.textPrimary}}>📤 Export Data</h2>
            <p style={{fontSize:11,color:th.textFaint,marginTop:2}}>One Excel file per client, bundled into a single ZIP download.</p>
          </div>
          {!exporting && <button className="btn-g" onClick={onClose} style={{padding:"5px 10px"}}>✕</button>}
        </div>

        {/* Body */}
        <div style={{padding:"18px 22px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:22,maxHeight:"62vh",overflowY:"auto"}}>
          {/* Left column */}
          <div>
            <div style={S.sec}>
              <div style={S.sh}>Clients</div>
              <Chk on={allCliSel} onClick={togAllCli} label="Select All"
                style={{marginBottom:6,paddingBottom:8,borderBottom:`1px solid ${th.border}`}}/>
              <div style={{maxHeight:170,overflowY:"auto",display:"flex",flexDirection:"column",gap:1}}>
                {clients.map(c => (
                  <Chk key={c.id} on={selClients.includes(c.id)} onClick={() => toggleClient(c.id)} label={c.name}/>
                ))}
              </div>
            </div>

            <div style={S.sec}>
              <div style={S.sh}>Financial Year</div>
              <div style={{display:"flex",flexDirection:"column",gap:1}}>
                {allFYs.map(fy => (
                  <Chk key={fy} on={selFYs.includes(fy)} onClick={() => toggleFY(fy)} label={fy}/>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div>
            <div style={S.sec}>
              <div style={S.sh}>Periods to Include</div>
              <div style={{display:"flex",flexDirection:"column",gap:1,marginBottom:10}}>
                {[["all","All periods"],["months","Specific months"],["quarters","Specific quarters"]].map(([v,l]) => (
                  <div key={v} style={S.row} onClick={() => { setPeriodMode(v); setSelPeriods([]); }}>
                    <div style={{...S.chk,borderRadius:"50%",...(periodMode===v?S.chkOn:{})}}>{periodMode===v&&"●"}</div>
                    <span style={S.lbl}>{l}</span>
                  </div>
                ))}
              </div>

              {periodMode === "months" && hasMonthly && (
                <div>
                  <div style={{fontSize:10,color:th.textFaintest,marginBottom:6}}>Select months:</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                    {MONTHS.map(m => (
                      <div key={m} onClick={() => togglePeriod(m)}
                        style={{padding:"4px 0",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"center",
                          background:selPeriods.includes(m)?th.accent+"22":th.bgInput,
                          border:`1px solid ${selPeriods.includes(m)?th.accent:th.border}`,
                          color:selPeriods.includes(m)?th.accent:th.textFaint}}>
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {periodMode === "quarters" && hasQuarterly && (
                <div>
                  <div style={{fontSize:10,color:th.textFaintest,marginBottom:6}}>Select quarters:</div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {QUARTERS.map(q => (
                      <div key={q} onClick={() => togglePeriod(q)}
                        style={{padding:"6px 10px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",
                          background:selPeriods.includes(q)?th.accent+"22":th.bgInput,
                          border:`1px solid ${selPeriods.includes(q)?th.accent:th.border}`,
                          color:selPeriods.includes(q)?th.accent:th.textFaint}}>
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {periodMode !== "all" && !hasMonthly && !hasQuarterly && (
                <div style={{fontSize:11,color:th.textFaintest,fontStyle:"italic"}}>No matching periods for selected clients.</div>
              )}
            </div>

            <div style={S.sec}>
              <div style={S.sh}>Additional Sheets</div>
              <Chk on={inclCommLog} onClick={() => setInclCommLog(!inclCommLog)} label="Include Communication Log sheet"/>
            </div>

            {/* Output preview */}
            <div style={{background:th.bgStageFoot,border:`1px solid ${th.border}`,borderRadius:8,padding:"11px 13px"}}>
              <div style={{fontSize:10,fontWeight:700,color:th.textFaint,letterSpacing:".6px",textTransform:"uppercase",marginBottom:7}}>Output Preview</div>
              <div style={{fontSize:11,color:th.textMuted,lineHeight:1.8}}>
                📁 <code style={{color:th.accent}}>MSA_Tracker_Export.zip</code><br/>
                {clients.filter(c=>selClients.includes(c.id)).map(c=>{
                  const safe = c.name.replace(/[^\w\s]/g,"").replace(/\s+/g,"_");
                  return <span key={c.id}>└ <code style={{color:"#22C55E"}}>{safe}.xlsx</code><br/></span>;
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:"13px 22px",borderTop:`1px solid ${th.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,color:th.textFaint}}>
            {selClients.length} client{selClients.length!==1?"s":""} · {selFYs.length} FY{selFYs.length!==1?"s":""}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {progress && <span style={{fontSize:11,color:th.accent,animation:"fadeUp .2s ease"}}>{progress}</span>}
            {!exporting && <button className="btn-g" onClick={onClose}>Cancel</button>}
            <button className="btn-p"
              onClick={doExport}
              disabled={exporting || !selClients.length || !selFYs.length}
              style={{opacity:(exporting||!selClients.length||!selFYs.length)?0.5:1,minWidth:110}}>
              {exporting ? "⏳ Exporting…" : "⬇ Export ZIP"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
