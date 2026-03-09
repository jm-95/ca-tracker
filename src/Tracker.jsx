import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

const STAGES = [
  { key: "data_collection", label: "Data Collection",       icon: "📥" },
  { key: "tally_entry",     label: "Tally Entry",           icon: "📒" },
  { key: "bank_recon",      label: "Bank Reconciliation",   icon: "🏦" },
  { key: "gst_recon",       label: "GST Reconciliation",    icon: "📊" },
  { key: "tds_entries",     label: "TDS Entries",           icon: "🧾" },
  { key: "review",          label: "Review & Finalization", icon: "✅" },
];

const ENTITY_TYPES   = ["Individual", "Proprietor", "Partnership Firm", "LLP", "Company"];
const FREQUENCIES    = ["Monthly", "Quarterly", "Annually"];
const STATUS_OPTIONS = ["Pending", "In Progress", "Done", "N/A"];
const MONTHS         = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const MONTH_FULL     = ["April","May","June","July","August","September","October","November","December","January","February","March"];
const QUARTERS       = ["Q1 (Apr–Jun)","Q2 (Jul–Sep)","Q3 (Oct–Dec)","Q4 (Jan–Mar)"];

function fyList() {
  const list = [];
  for (let y = 2022; y <= 2025; y++) list.push(`FY ${y}-${String(y+1).slice(2)}`);
  return list;
}
function currentFY() {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  return m >= 3 ? `FY ${y}-${String(y+1).slice(2)}` : `FY ${y-1}-${String(y).slice(2)}`;
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

function emptyStageData(key) {
  const base = { status:"Pending", doneBy:"", doneDate:"", remarks:"" };
  if (key === "tally_entry") base.checklist = [];
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
        } else if (s.key === "tally_entry" && !filled[p.key][s.key].checklist) {
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
  const [view,         setView]         = useState("list");
  const [editClient,   setEditClient]   = useState(null);
  const [activeFY,     setActiveFY]     = useState(currentFY());
  const [activePeriod, setActivePeriod] = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterEntity, setFilterEntity] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState(null);

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
    const updated = applyUpdate(clientId, client => ({
      ...client,
      periods: { ...client.periods, [activeFY]: { ...client.periods?.[activeFY],
        [periodKey]: { ...client.periods?.[activeFY]?.[periodKey],
          [stageKey]: { ...client.periods?.[activeFY]?.[periodKey]?.[stageKey], [field]: value }
        }
      }}
    }));
    if (updated) await persistClient(updated);
  };

  const handleAddChecklistItem = async (clientId, periodKey, label) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = client.periods?.[activeFY]?.[periodKey]?.tally_entry?.checklist || [];
    const newItem  = { id: Date.now().toString(), label, status:"Pending", doneBy:"", doneDate:"" };
    const updated  = applyUpdate(clientId, c => ({
      ...c, periods: { ...c.periods, [activeFY]: { ...c.periods?.[activeFY],
        [periodKey]: { ...c.periods?.[activeFY]?.[periodKey],
          tally_entry: { ...c.periods?.[activeFY]?.[periodKey]?.tally_entry, checklist: [...existing, newItem] }
        }
      }}
    }));
    if (updated) await persistClient(updated);
  };

  const handleChecklistItemUpdate = async (clientId, periodKey, itemId, field, value) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = client.periods?.[activeFY]?.[periodKey]?.tally_entry?.checklist || [];
    const newList  = existing.map(item => item.id===itemId ? { ...item, [field]:value } : item);
    const updated  = applyUpdate(clientId, c => ({
      ...c, periods: { ...c.periods, [activeFY]: { ...c.periods?.[activeFY],
        [periodKey]: { ...c.periods?.[activeFY]?.[periodKey],
          tally_entry: { ...c.periods?.[activeFY]?.[periodKey]?.tally_entry, checklist: newList }
        }
      }}
    }));
    if (updated) await persistClient(updated);
  };

  const handleDeleteChecklistItem = async (clientId, periodKey, itemId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = client.periods?.[activeFY]?.[periodKey]?.tally_entry?.checklist || [];
    const newList  = existing.filter(item => item.id !== itemId);
    const updated  = applyUpdate(clientId, c => ({
      ...c, periods: { ...c.periods, [activeFY]: { ...c.periods?.[activeFY],
        [periodKey]: { ...c.periods?.[activeFY]?.[periodKey],
          tally_entry: { ...c.periods?.[activeFY]?.[periodKey]?.tally_entry, checklist: newList }
        }
      }}
    }));
    if (updated) await persistClient(updated);
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
    <div style={{minHeight:"100vh",background:"#0A0F1E",fontFamily:"'DM Sans',sans-serif",color:"#E2E8F0",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;} ::-webkit-scrollbar-track{background:#0A0F1E;} ::-webkit-scrollbar-thumb{background:#1E293B;border-radius:3px;}
        input,select,textarea{outline:none;font-family:'DM Sans',sans-serif;}
        .card{background:#111827;border:1px solid #1E293B;border-radius:14px;}
        .btn-p{background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;}
        .btn-p:hover{opacity:.88;transform:translateY(-1px);}
        .btn-g{background:transparent;color:#94A3B8;border:1px solid #1E293B;border-radius:8px;padding:8px 14px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .18s;}
        .btn-g:hover{background:#1E293B;color:#E2E8F0;}
        .btn-d{background:#7F1D1D22;color:#FCA5A5;border:1px solid #7F1D1D55;border-radius:8px;padding:8px 14px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .18s;}
        .btn-d:hover{background:#7F1D1D55;}
        .inp{background:#0A0F1E;border:1px solid #1E293B;border-radius:8px;color:#E2E8F0;padding:8px 12px;font-size:13px;width:100%;transition:border .18s;}
        .inp:focus{border-color:#2563EB;}
        .inp-sm{background:#0A0F1E;border:1px solid #1E293B;border-radius:6px;color:#E2E8F0;padding:5px 9px;font-size:12px;font-family:'DM Sans',sans-serif;transition:border .18s;outline:none;}
        .inp-sm:focus{border-color:#2563EB;}
        .sel{background:#0A0F1E;border:1px solid #1E293B;border-radius:8px;color:#E2E8F0;padding:8px 12px;font-size:13px;cursor:pointer;}
        .lbl{font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:#475569;margin-bottom:4px;}
        .tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
        .crow{cursor:pointer;padding:14px 16px;border-bottom:1px solid #0F172A;transition:background .14s;display:flex;align-items:center;gap:12px;}
        .crow:hover{background:#111827;}
        .crow.act{background:#0C1E38;border-left:3px solid #2563EB;}
        .spill{border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid transparent;font-family:'DM Sans',sans-serif;transition:all .14s;white-space:nowrap;}
        .spill:hover{filter:brightness(1.2);}
        .pbar{height:5px;border-radius:3px;background:#1E293B;overflow:hidden;}
        .pfill{height:100%;border-radius:3px;background:linear-gradient(90deg,#2563EB,#06B6D4);transition:width .4s ease;}
        .av{display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;}
        .pgrid-cell{height:28px;border-radius:5px;cursor:pointer;transition:all .14s;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:.4px;border:2px solid transparent;}
        .pgrid-cell:hover{filter:brightness(1.25);}
        .ptab{padding:6px 13px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #1E293B;transition:all .14s;white-space:nowrap;background:transparent;font-family:'DM Sans',sans-serif;}
        .ptab:hover{border-color:#334155;}
        .ptab.act{background:#0C1E38;border-color:#2563EB;color:#93C5FD;}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
        .modal{background:#111827;border:1px solid #1E293B;border-radius:16px;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;}
        .fy-btn{padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #1E293B;background:transparent;color:#475569;font-family:'DM Sans',sans-serif;transition:all .14s;}
        .fy-btn:hover{border-color:#334155;color:#94A3B8;}
        .fy-btn.act{background:#0C1E38;border-color:#2563EB;color:#93C5FD;}
        .stage-block{background:#0A0F1E;border-radius:10px;border:1px solid #1E293B;overflow:hidden;transition:border .18s;}
        .stage-block.active-border{border-color:#1E40AF55;}
        .stage-head{display:flex;align-items:center;gap:11px;padding:10px 13px;}
        .stage-foot{padding:14px 14px 14px 14px;border-top:1px solid #1E293B;background:#06080F;display:flex;flex-direction:column;gap:11px;}
        .checklist-row{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0A0F1E;border-radius:7px;border:1px solid #1E293B;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Topbar */}
      <div style={{background:"#0A0F1E",borderBottom:"1px solid #1E293B",padding:"0 22px",height:54,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:"linear-gradient(135deg,#2563EB,#0EA5E9)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>📋</div>
          <span style={{fontFamily:"'Libre Baskerville',serif",fontSize:18,fontWeight:700,color:"#F1F5F9"}}>CA Client Tracker</span>
          {saving && <span style={{fontSize:11,color:"#334155",marginLeft:6}}>saving…</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {fyList().map(fy=>(
            <button key={fy} className={`fy-btn${activeFY===fy?" act":""}`}
              onClick={()=>{setActiveFY(fy);setView("list");setSelected(null);}}>
              {fy}
            </button>
          ))}
          <div style={{width:1,height:18,background:"#1E293B",margin:"0 4px"}}/>
          <span style={{fontSize:11,color:"#334155"}}>{session.user.email}</span>
          <button className="btn-g" style={{padding:"6px 12px",fontSize:12}} onClick={async()=>await supabase.auth.signOut()}>Sign out</button>
          <button className="btn-p" onClick={()=>{setEditClient(newClient());setView("form");}}>+ Add Client</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{width:290,flexShrink:0,borderRight:"1px solid #1E293B",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"11px",borderBottom:"1px solid #1E293B"}}>
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
            {filtered.length===0 && <div style={{padding:28,textAlign:"center",color:"#334155",fontSize:13}}>{clients.length===0?"No clients yet. Add your first client!":"No clients match your filters."}</div>}
            {filtered.map(c=>{
              const fyData=c.periods?.[activeFY]||{};
              const periods=periodsForClient(c);
              const doneCount=periods.filter(p=>overallStatus(fyData[p.key])==="Done").length;
              const pct=periods.length===0?0:Math.round((doneCount/periods.length)*100);
              const initials=c.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
              const avBg=["#1E3A5F","#1C3B2C","#3B1D6E","#4A1942","#2D1B00","#1A2E4A"][c.name.charCodeAt(0)%6];
              return (
                <div key={c.id} className={`crow${selected?.id===c.id?" act":""}`} onClick={()=>selectClient(c)}>
                  <div className="av" style={{background:avBg,width:36,height:36,borderRadius:9,fontSize:13}}>{initials}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:"#F1F5F9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                    <div style={{fontSize:11,color:"#475569",marginBottom:5}}>{c.entity} · {c.frequency}</div>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div className="pbar" style={{flex:1}}><div className="pfill" style={{width:`${pct}%`}}/></div>
                      <span style={{fontSize:10,color:"#475569",flexShrink:0}}>{doneCount}/{periods.length}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main panel */}
        <div style={{flex:1,overflowY:"auto",padding:22}}>
          {view==="list" && (
            <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
              <div style={{fontSize:42}}>👈</div>
              <div style={{fontSize:14,fontWeight:600,color:"#334155"}}>Select a client to view details</div>
              <div style={{fontSize:11,color:"#1E293B"}}>Tracking {activeFY}</div>
            </div>
          )}
          {view==="detail" && selected && (
            <DetailView
              client={selected} activeFY={activeFY}
              activePeriod={activePeriod} setActivePeriod={setActivePeriod}
              onEdit={()=>{setEditClient({...selected});setView("form");}}
              onDelete={()=>handleDelete(selected.id)}
              onStageUpdate={handleStageUpdate}
              onAddChecklistItem={handleAddChecklistItem}
              onChecklistItemUpdate={handleChecklistItemUpdate}
              onDeleteChecklistItem={handleDeleteChecklistItem}
            />
          )}
        </div>
      </div>

      {view==="form" && editClient && (
        <ClientForm client={editClient} onSave={handleSaveClient} onCancel={()=>setView(selected?"detail":"list")}/>
      )}

      {toast && (
        <div style={{position:"fixed",bottom:22,right:22,padding:"10px 18px",borderRadius:9,fontSize:13,fontWeight:600,zIndex:999,animation:"fadeUp .28s ease",background:toast.type==="error"?"#7F1D1D":"#14532D",color:toast.type==="error"?"#FCA5A5":"#86EFAC"}}>
          {toast.type==="error"?"⚠ ":"✓ "}{toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Detail View ───────────────────────────────────────────────────────────────

function DetailView({ client, activeFY, activePeriod, setActivePeriod, onEdit, onDelete, onStageUpdate, onAddChecklistItem, onChecklistItemUpdate, onDeleteChecklistItem }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const periods    = periodsForClient(client);
  const fyData     = client.periods?.[activeFY] || {};
  const periodData = fyData[activePeriod] || emptyPeriod();
  const pct  = stageProgress(periodData);
  const st   = overallStatus(periodData);
  const fyDone = periods.filter(p => overallStatus(fyData[p.key]) === "Done").length;
  const fyPct  = periods.length===0?0:Math.round((fyDone/periods.length)*100);
  const avBg   = ["#1E3A5F","#1C3B2C","#3B1D6E","#4A1942","#2D1B00","#1A2E4A"][client.name.charCodeAt(0)%6];
  const initials = client.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:13}}>
          <div className="av" style={{background:avBg,width:48,height:48,borderRadius:12,fontSize:17}}>{initials}</div>
          <div>
            <h1 style={{fontFamily:"'Libre Baskerville',serif",fontSize:22,fontWeight:700,color:"#F1F5F9",lineHeight:1.2}}>{client.name}</h1>
            <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
              <span className="tag" style={{background:"#1E3A5F33",border:"1px solid #1E3A5F",color:"#93C5FD"}}>{client.entity}</span>
              <span className="tag" style={{background:"#1C3B2C33",border:"1px solid #1C3B2C",color:"#6EE7B7"}}>{client.frequency}</span>
              <span className="tag" style={{background:STATUS_STYLES[st].bg,border:`1px solid ${STATUS_STYLES[st].border}`,color:STATUS_STYLES[st].color}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:STATUS_STYLES[st].dot,flexShrink:0}}/>
                {activePeriod}: {st}
              </span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button className="btn-g" onClick={onEdit}>✏ Edit</button>
          {!confirmDel
            ? <button className="btn-d" onClick={()=>setConfirmDel(true)}>🗑 Delete</button>
            : <button className="btn-d" onClick={onDelete} style={{background:"#7F1D1D55"}}>Confirm?</button>}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="card" style={{padding:16}}>
          <div className="lbl" style={{color:"#2563EB",marginBottom:12}}>Client Profile</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[{l:"PAN",v:client.pan||"—"},{l:"GSTIN",v:client.gstin||"Not Applicable"},{l:"Entity",v:client.entity},{l:"Frequency",v:client.frequency},{l:"Email",v:client.contact||"—"},{l:"Phone",v:client.phone||"—"}].map(f=>(
              <div key={f.l}><div className="lbl">{f.l}</div><div style={{fontSize:12,color:"#CBD5E1",fontWeight:500,wordBreak:"break-all"}}>{f.v}</div></div>
            ))}
          </div>
          {client.notes && (
            <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid #1E293B"}}>
              <div className="lbl">Notes</div>
              <div style={{fontSize:11,color:"#475569",lineHeight:1.6}}>{client.notes}</div>
            </div>
          )}
        </div>

        <div className="card" style={{padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div className="lbl" style={{color:"#2563EB"}}>{activeFY} Overview</div>
            <span style={{fontSize:20,fontWeight:700,color:"#F1F5F9"}}>{fyPct}%</span>
          </div>
          <div className="pbar" style={{height:6,marginBottom:14}}><div className="pfill" style={{width:`${fyPct}%`}}/></div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(periods.length,6)},1fr)`,gap:4}}>
            {periods.map(p=>{
              const ost=overallStatus(fyData[p.key]);
              const isAct=activePeriod===p.key;
              return (
                <div key={p.key} className="pgrid-cell" onClick={()=>setActivePeriod(p.key)}
                  style={{background:GRID_COLORS[ost]+(isAct?"FF":"55"),border:isAct?`2px solid ${STATUS_STYLES[ost].dot}`:"2px solid transparent",color:isAct?"#fff":"#64748B"}}>
                  {p.key}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap"}}>
            {["Pending","In Progress","Done"].map(s=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#475569"}}>
                <div style={{width:9,height:9,borderRadius:2,background:GRID_COLORS[s]}}/>{s}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Period tabs + stages */}
      <div className="card" style={{padding:18}}>
        <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:12,marginBottom:14,borderBottom:"1px solid #1E293B"}}>
          {periods.map(p=>{
            const ost=overallStatus(fyData[p.key]);
            const isAct=activePeriod===p.key;
            return (
              <button key={p.key} className={`ptab${isAct?" act":""}`} onClick={()=>setActivePeriod(p.key)}
                style={{color:isAct?"#93C5FD":STATUS_STYLES[ost].color}}>
                <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:STATUS_STYLES[ost].dot,marginRight:5,verticalAlign:"middle"}}/>
                {p.key}
              </button>
            );
          })}
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#F1F5F9"}}>{MONTH_FULL[MONTHS.indexOf(activePeriod)]||activePeriod}</div>
            <div style={{fontSize:11,color:"#475569"}}>{pct}% complete</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div className="pbar" style={{width:90,height:5}}><div className="pfill" style={{width:`${pct}%`}}/></div>
            <span style={{fontSize:13,fontWeight:700,color:"#F1F5F9"}}>{pct}%</span>
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
              onStageUpdate={onStageUpdate}
              onAddChecklistItem={onAddChecklistItem}
              onChecklistItemUpdate={onChecklistItemUpdate}
              onDeleteChecklistItem={onDeleteChecklistItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Stage Block ───────────────────────────────────────────────────────────────

function StageBlock({ stage, stageData, clientId, periodKey, onStageUpdate, onAddChecklistItem, onChecklistItemUpdate, onDeleteChecklistItem }) {
  const [expanded,     setExpanded]     = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const val     = stageData.status || "Pending";
  const ss      = STATUS_STYLES[val];
  const hasData = stageData.doneBy || stageData.doneDate || stageData.remarks || (stageData.checklist?.length > 0);

  const addItem = () => {
    if (!newItemLabel.trim()) return;
    onAddChecklistItem(clientId, periodKey, newItemLabel.trim());
    setNewItemLabel("");
  };

  return (
    <div className={`stage-block${hasData?" active-border":""}`}>
      {/* Header row */}
      <div className="stage-head">
        <span style={{fontSize:17,width:22,textAlign:"center",flexShrink:0}}>{stage.icon}</span>
        <span style={{flex:1,fontSize:13,fontWeight:500,color:"#CBD5E1"}}>{stage.label}</span>
        {/* Status pills */}
        <div style={{display:"flex",gap:4}}>
          {STATUS_OPTIONS.map(opt=>(
            <button key={opt} className="spill"
              onClick={()=>onStageUpdate(clientId,periodKey,stage.key,"status",opt)}
              style={{background:val===opt?STATUS_STYLES[opt].bg:"transparent",color:val===opt?STATUS_STYLES[opt].color:"#334155",border:val===opt?`1px solid ${STATUS_STYLES[opt].border}`:"1px solid #1E293B"}}>
              {opt}
            </button>
          ))}
        </div>
        {/* Expand toggle */}
        <button onClick={()=>setExpanded(!expanded)}
          style={{marginLeft:8,background:"transparent",border:"1px solid #1E293B",color:"#475569",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>
          {expanded?"▲":"▼"}
        </button>
      </div>

      {/* Show summary line when collapsed but has data */}
      {!expanded && hasData && (
        <div style={{padding:"0 13px 10px 51px",display:"flex",gap:14,flexWrap:"wrap"}}>
          {stageData.doneBy  && <span style={{fontSize:11,color:"#475569"}}>👤 {stageData.doneBy}</span>}
          {stageData.doneDate && <span style={{fontSize:11,color:"#475569"}}>📅 {stageData.doneDate}</span>}
          {stageData.remarks && <span style={{fontSize:11,color:"#475569",fontStyle:"italic"}}>💬 {stageData.remarks.slice(0,60)}{stageData.remarks.length>60?"…":""}</span>}
          {stageData.checklist?.length > 0 && <span style={{fontSize:11,color:"#475569"}}>✓ {stageData.checklist.filter(i=>i.status==="Done").length}/{stageData.checklist.length} items</span>}
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="stage-foot">
          {/* Done by + date */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div className="lbl">Done By</div>
              <input className="inp" placeholder="e.g. Jay"
                value={stageData.doneBy||""}
                onChange={e=>onStageUpdate(clientId,periodKey,stage.key,"doneBy",e.target.value)}
                style={{fontSize:12}}/>
            </div>
            <div>
              <div className="lbl">Done Date</div>
              <input className="inp" type="date"
                value={stageData.doneDate||""}
                onChange={e=>onStageUpdate(clientId,periodKey,stage.key,"doneDate",e.target.value)}
                style={{fontSize:12,colorScheme:"dark"}}/>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <div className="lbl">Remarks</div>
            <textarea className="inp" placeholder="e.g. Purchase received. Office expenses file pending."
              value={stageData.remarks||""}
              onChange={e=>onStageUpdate(clientId,periodKey,stage.key,"remarks",e.target.value)}
              rows={2} style={{fontSize:12,resize:"vertical"}}/>
          </div>

          {/* Tally checklist */}
          {stage.key === "tally_entry" && (
            <div>
              <div className="lbl" style={{marginBottom:8}}>Tally Entry Checklist</div>
              {(stageData.checklist||[]).length === 0 && (
                <div style={{fontSize:12,color:"#334155",marginBottom:10,fontStyle:"italic"}}>No checklist items yet. Add items below.</div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                {(stageData.checklist||[]).map(item=>(
                  <div key={item.id} className="checklist-row">
                    {/* Toggle done circle */}
                    <div onClick={()=>{
                        const next=item.status==="Pending"?"Done":item.status==="Done"?"N/A":"Pending";
                        onChecklistItemUpdate(clientId,periodKey,item.id,"status",next);
                      }}
                      style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${STATUS_STYLES[item.status||"Pending"].dot}`,background:item.status==="Done"?STATUS_STYLES["Done"].dot:item.status==="N/A"?STATUS_STYLES["N/A"].dot:"transparent",cursor:"pointer",flexShrink:0,transition:"all .14s"}}
                    />
                    <span style={{flex:1,fontSize:12,color:item.status==="Done"?"#334155":"#CBD5E1",textDecoration:item.status==="Done"?"line-through":"none"}}>{item.label}</span>
                    <input className="inp-sm" placeholder="Done by"
                      value={item.doneBy||""}
                      onChange={e=>onChecklistItemUpdate(clientId,periodKey,item.id,"doneBy",e.target.value)}
                      style={{width:88}}/>
                    <input className="inp-sm" type="date"
                      value={item.doneDate||""}
                      onChange={e=>onChecklistItemUpdate(clientId,periodKey,item.id,"doneDate",e.target.value)}
                      style={{width:130,colorScheme:"dark"}}/>
                    <button onClick={()=>onDeleteChecklistItem(clientId,periodKey,item.id)}
                      style={{background:"transparent",border:"none",color:"#334155",cursor:"pointer",fontSize:15,padding:"0 2px",lineHeight:1}}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input className="inp" placeholder="e.g. Enter purchase expenses"
                  value={newItemLabel}
                  onChange={e=>setNewItemLabel(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addItem()}
                  style={{fontSize:12}}/>
                <button className="btn-p" onClick={addItem} style={{whiteSpace:"nowrap",padding:"7px 14px",fontSize:12}}>+ Add</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Client Form ───────────────────────────────────────────────────────────────

function ClientForm({ client, onSave, onCancel }) {
  const [form, setForm] = useState(client);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const isNew = !client.name;
  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal">
        <div style={{padding:"18px 22px",borderBottom:"1px solid #1E293B",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h2 style={{fontFamily:"'Libre Baskerville',serif",fontSize:17,color:"#F1F5F9"}}>{isNew?"Add New Client":"Edit Client"}</h2>
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
        <div style={{padding:"13px 22px",borderTop:"1px solid #1E293B",display:"flex",justifyContent:"flex-end",gap:8}}>
          <button className="btn-g" onClick={onCancel}>Cancel</button>
          <button className="btn-p" onClick={()=>form.name.trim()&&onSave(form)} style={{opacity:form.name.trim()?1:.4}}>{isNew?"Add Client":"Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}
