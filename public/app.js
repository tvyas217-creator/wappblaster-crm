const $ = s => document.querySelector(s);
let currentUser = null;
let currentFilter = "available";
let searchTimer = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function prettyDate(value) {
  if (!value) return "Just now";
  const d = new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
}
function showNotice(message, success = false) {
  const n = $("#notice"); n.textContent = message; n.classList.remove("hidden", "success");
  if (success) n.classList.add("success");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearNotice() { $("#notice").classList.add("hidden"); }
async function boot() {
  try {
    const result = await api("/api/me");
    if (result.user) { currentUser = result.user; showApp(); }
  } catch (_) {}
}
function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app-screen").classList.remove("hidden");
  $("#user-name").textContent = currentUser.name;
  $("#user-role").textContent = currentUser.role;
  $("#user-avatar").textContent = currentUser.name.trim().charAt(0).toUpperCase();
  $("#admin-panel").classList.toggle("hidden", currentUser.role !== "admin");
  loadAll();
}
async function loadAll() {
  clearNotice();
  try {
    await Promise.all([loadDashboard(), loadLeads(), currentUser.role === "admin" ? Promise.all([loadStaff(), loadSettings()]) : Promise.resolve()]);
  } catch (e) { showNotice(e.message); }
}
async function loadDashboard() {
  const { stats } = await api("/api/dashboard");
  for (const k of ["available","mine","claimed","total","followups"]) {
    if ($("#stat-" + k)) $("#stat-" + k).textContent = stats[k];
    if ($("#nav-" + k)) $("#nav-" + k).textContent = stats[k];
  }
}
function setPageLabels() {
  const labels = {
    available: ["Available Leads", "Claim a lead to make it yours.", "Ready for claiming"],
    mine: ["My Leads", "These leads are claimed by you.", "Your claimed leads"],
    claimed: ["All Claimed Leads", "See who has claimed each lead.", "Claimed by the team"],
    followups: ["Follow-ups", "Leads with a scheduled follow-up.", "Follow-up queue"]
  };
  const [title, subtitle, heading] = labels[currentFilter];
  $("#page-title").textContent = title;
  $("#page-subtitle").textContent = currentUser.company_name ? `${subtitle} · ${currentUser.company_name}` : subtitle;
  $("#list-heading").textContent = heading;
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === currentFilter));
}
function renderLead(l) {
  const claimed = l.claimed_by !== null;
  const owner = l.claimed_by_name ? `Claimed by <b>${escapeHtml(l.claimed_by_name)}</b>` : "Available to claim";
  const canClaim = !claimed && currentFilter === "available";
  const canUpdate = claimed && (currentUser.role === "admin" || l.claimed_by === currentUser.id);
  const statuses = ["new","contacted","qualified","converted","lost"];
  return `<article class="lead-card" data-id="${l.id}">
    <div class="lead-main"><div class="lead-icon">${escapeHtml((l.customer_name || "?").trim().charAt(0).toUpperCase())}</div>
      <div class="lead-info">
        <div class="lead-title-row"><span class="lead-title">${escapeHtml(l.customer_name)}</span><span class="source-pill">${escapeHtml(l.source)}</span><span class="source-pill">#${l.id}</span></div>
        <div class="lead-meta">${l.phone ? `☎ <a href="tel:${escapeHtml(l.phone.replace(/[^+0-9]/g, ""))}">${escapeHtml(l.phone)}</a> · ` : ""}Added ${escapeHtml(prettyDate(l.created_at))}</div>
        ${l.message ? `<div class="lead-message">${escapeHtml(l.message)}</div>` : ""}
        ${l.remark ? `<div class="lead-message"><b>Latest remark:</b> ${escapeHtml(l.remark)}</div>` : ""}
        ${l.follow_up_at ? `<div class="lead-message"><b>Follow-up:</b> ${escapeHtml(l.follow_up_at.replace("T", " "))}</div>` : ""}
        <div class="claim-owner">${claimed ? "●" : "○"} <span class="${claimed ? "" : "green"}">${owner}</span>${claimed && l.claimed_at ? `<span>· ${escapeHtml(prettyDate(l.claimed_at))}</span>` : ""}</div>
      </div>
    </div>
    <div class="lead-actions">
      ${canClaim ? `<button class="claim-btn" data-claim="${l.id}">ME ↗</button>` : ""}
      ${claimed ? `<span class="claimed-label">✓ ${l.claimed_by === currentUser.id ? "Claimed by you" : "Claimed"}</span>` : ""}
      ${canUpdate ? `<select class="status-select" data-status="${l.id}" aria-label="Lead status">${statuses.map(s=>`<option value="${s}" ${l.status===s?"selected":""}>${s[0].toUpperCase()+s.slice(1)}</option>`).join("")}</select>` : ""}
      ${canUpdate ? `<details class="lead-notes"><summary>Remark / Follow-up</summary><form data-notes="${l.id}" class="notes-form"><textarea name="remark" maxlength="2000" placeholder="Call outcome, customer requirement...">${escapeHtml(l.remark || "")}</textarea><label>Follow-up time<input name="follow_up_at" type="datetime-local" value="${escapeHtml(l.follow_up_at || "")}"></label><button class="btn outline" type="submit">Save notes</button></form></details>` : ""}
      ${currentUser.role === "admin" && claimed ? `<button class="admin-reopen" data-reopen="${l.id}">Release / Reopen</button>` : ""}
      ${currentUser.role === "admin" ? `<button class="admin-reopen" data-history="${l.id}">History</button>` : ""}
    </div>
  </article>`;
}
async function loadLeads() {
  setPageLabels();
  const q = $("#search-input").value.trim();
  const { leads } = await api(`/api/leads?filter=${encodeURIComponent(currentFilter)}&search=${encodeURIComponent(q)}`);
  $("#leads-list").innerHTML = leads.map(renderLead).join("");
  $("#empty-state").classList.toggle("hidden", leads.length > 0);
  $("#leads-list").classList.toggle("hidden", leads.length === 0);
}
document.addEventListener("click", async e => {
  const nav = e.target.closest("[data-filter]");
  if (nav) { currentFilter = nav.dataset.filter; await loadLeads(); return; }
  const claimBtn = e.target.closest("[data-claim]");
  if (claimBtn) {
    claimBtn.disabled = true; claimBtn.textContent = "Claiming…";
    try {
      const result = await api(`/api/leads/${claimBtn.dataset.claim}/claim`, { method: "POST", body: "{}" });
      showNotice(result.message, true);
    } catch (err) { showNotice(err.message); }
    await loadAll(); return;
  }
  const reopen = e.target.closest("[data-reopen]");
  if (reopen && confirm("Release this lead so any employee can claim it again?")) {
    try { await api(`/api/leads/${reopen.dataset.reopen}/reopen`, { method:"POST", body:"{}" }); showNotice("Lead reopened.", true); await loadAll(); }
    catch (err) { showNotice(err.message); }
    return;
  }
  const history = e.target.closest("[data-history]");
  if (history) {
    try {
      const { history: rows } = await api(`/api/history/${history.dataset.history}`);
      alert(rows.length ? rows.map(r => `${prettyDate(r.created_at)} — ${r.action} — ${r.employee_name || "System"}${r.details ? " ("+r.details+")" : ""}`).join("\n") : "No history available.");
    } catch (err) { showNotice(err.message); }
  }
});
document.addEventListener("submit", async e => {
  const form = e.target.closest("[data-notes]");
  if (!form) return;
  e.preventDefault();
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    await api(`/api/leads/${form.dataset.notes}/notes`, { method:"PATCH", body:JSON.stringify(body) });
    showNotice("Remark and follow-up saved.", true);
    await loadAll();
  } catch (err) { showNotice(err.message); }
});
document.addEventListener("change", async e => {
  const status = e.target.closest("[data-status]");
  if (status) {
    try { await api(`/api/leads/${status.dataset.status}/status`, { method:"PATCH", body:JSON.stringify({status:status.value}) }); showNotice("Lead status updated.", true); await loadDashboard(); }
    catch (err) { showNotice(err.message); await loadLeads(); }
  }
});
$("#login-form").addEventListener("submit", async e => {
  e.preventDefault(); $("#login-error").textContent = "";
  try {
    const { user } = await api("/api/login", { method:"POST", body:JSON.stringify({ email:$("#login-email").value, password:$("#login-password").value }) });
    currentUser = user; showApp();
  } catch (err) { $("#login-error").textContent = err.message; }
});
$("#logout-btn").addEventListener("click", async () => {
  await api("/api/logout", { method:"POST", body:"{}" }).catch(()=>{});
  currentUser = null; $("#app-screen").classList.add("hidden"); $("#login-screen").classList.remove("hidden"); $("#login-password").value = "";
});
$("#refresh-btn").addEventListener("click", loadAll);
$("#search-input").addEventListener("input", () => {
  clearTimeout(searchTimer); searchTimer = setTimeout(loadLeads, 220);
});
$("#lead-form").addEventListener("submit", async e => {
  e.preventDefault(); const form = new FormData(e.currentTarget); const body = Object.fromEntries(form.entries());
  try {
    await api("/api/leads", { method:"POST", body:JSON.stringify(body) });
    e.currentTarget.reset(); $("#lead-form-msg").textContent = "Lead added successfully.";
    currentFilter = "available"; await loadAll();
  } catch (err) { $("#lead-form-msg").textContent = err.message; }
});
$("#staff-form").addEventListener("submit", async e => {
  e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget).entries());
  try {
    await api("/api/users", { method:"POST", body:JSON.stringify(body) });
    e.currentTarget.reset(); showNotice("Employee account created.", true); await loadStaff();
  } catch (err) { showNotice(err.message); }
});
async function loadStaff() {
  const { users } = await api("/api/users");
  $("#staff-list").innerHTML = users.map(u => `<div class="staff-row"><span><b>${escapeHtml(u.name)}</b> · ${escapeHtml(u.email)} <span class="muted">(${escapeHtml(u.role)})</span></span>${u.role === "employee" ? `<button class="admin-reopen" data-toggle-user="${u.id}">${u.active ? "Deactivate" : "Activate"}</button>` : `<span class="muted">Admin</span>`}</div>`).join("");
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-toggle-user]");
  if (!b) return;
  try { await api(`/api/users/${b.dataset.toggleUser}/toggle`, { method:"POST", body:"{}" }); await loadStaff(); }
  catch (err) { showNotice(err.message); }
});

$("#register-form").addEventListener("submit", async e => {
  e.preventDefault(); $("#register-error").textContent = "";
  const body = Object.fromEntries(new FormData(e.currentTarget).entries());
  try { const {user} = await api("/api/register", {method:"POST", body:JSON.stringify(body)}); currentUser=user; showApp(); }
  catch(err) { $("#register-error").textContent=err.message; }
});
$("#import-csv-btn").addEventListener("click", async () => {
  const file=$("#csv-file").files[0]; if(!file){$("#import-msg").textContent="Choose a CSV file first.";return;}
  if(file.size>2_000_000){$("#import-msg").textContent="Maximum CSV size is 2 MB.";return;}
  try { const csv=await file.text(); const out=await api("/api/import.csv",{method:"POST",body:JSON.stringify({csv})}); $("#import-msg").textContent=`Imported ${out.added} leads; ${out.assigned} assigned automatically; skipped ${out.skipped} empty rows.`; currentFilter="available"; await loadAll(); }
  catch(err){$("#import-msg").textContent=err.message;}
});
$("#assign-next-btn").addEventListener("click",async()=>{const lead_id=Number($("#assign-lead-id").value);try{const out=await api("/api/leads/assign-next",{method:"POST",body:JSON.stringify({lead_id})});$("#assign-msg").textContent=`Lead assigned to employee ID ${out.employee}.`;await loadAll();}catch(err){$("#assign-msg").textContent=err.message;}});
$("#save-settings-btn").addEventListener("click",async()=>{try{await api("/api/settings",{method:"PATCH",body:JSON.stringify({assignment_mode:$("#assignment-mode").value})});$("#settings-msg").textContent="Setting saved.";}catch(err){$("#settings-msg").textContent=err.message;}});
async function loadReports(){try{const r=await api("/api/reports");const status=r.byStatus.map(x=>`<div class="staff-row"><span>${escapeHtml(x.status)}</span><b>${x.count}</b></div>`).join("");const employees=r.byEmployee.map(x=>`<div class="staff-row"><span><b>${escapeHtml(x.name)}</b> · ${x.total} leads</span><span>Won: ${x.converted||0} · Lost: ${x.lost||0}</span></div>`).join("");$("#reports-box").innerHTML=`<h3>Lead status</h3>${status||"No leads yet."}<h3>Employee performance</h3>${employees||"No employees yet."}`;}catch(err){showNotice(err.message);}}
$("#load-reports-btn").addEventListener("click",loadReports);
$("#password-form").addEventListener("submit",async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget).entries());try{const out=await api("/api/change-password",{method:"POST",body:JSON.stringify(body)});$("#password-msg").textContent=out.message;e.currentTarget.reset();}catch(err){$("#password-msg").textContent=err.message;}});
async function loadSettings(){if(currentUser?.role!=="admin")return;try{const {settings}=await api("/api/settings");$("#assignment-mode").value=settings.assignment_mode;}catch(_){}}

boot();