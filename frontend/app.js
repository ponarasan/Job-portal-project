// Arasan Hire frontend — clean UI. Same origin, no build step.
const api = "";
const $ = (id) => document.getElementById(id);
let currentUser = null, applyJobId = null, editJobId = null, editCompanyId = null;
let companiesCache = [], jobsCache = [];
let appliedJobIds = new Set();

// IDs of jobs I've applied to (seeker only) — drives hiding the Apply button
async function refreshApplied() {
  appliedJobIds = new Set();
  if (!token() || isRec()) return;
  try {
    const apps = await handle(await fetch(api + "/applications/me", { headers: headers(false) }));
    apps.forEach((a) => appliedJobIds.add(a.job_id));
  } catch {}
}
const hasApplied = (id) => appliedJobIds.has(id);
const appliedBadge = `<span class="badge applied">Applied</span>`;

// ---------- helpers ----------
function toast(m) { const t = $("toast"); t.textContent = m; t.style.display = "block"; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = "none", 2800); }
const token = () => localStorage.getItem("token");
function headers(json = true) { const h = {}; if (json) h["Content-Type"] = "application/json"; if (token()) h["Authorization"] = "Bearer " + token(); return h; }
async function handle(res) {
  if (!res.ok) { let m = res.statusText; try { const j = await res.json(); m = j.detail || JSON.stringify(j); } catch {} throw new Error(m); }
  if (res.status === 204) return null; return res.json();
}
const esc = (s) => String(s ?? "").replace(/['"<>&]/g, (c) => ({ "'": "&#39;", '"': "&quot;", "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
const isRec = () => currentUser && (currentUser.role === "recruiter" || currentUser.role === "admin");
function openModal(html) { $("modal-body").innerHTML = html; $("modal").style.display = "flex"; }
function closeModal() { $("modal").style.display = "none"; }
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
document.querySelectorAll("#nav button, .header-actions button").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));
function show(v) {
  document.querySelectorAll("#nav button, .header-actions button").forEach((x) => x.classList.remove("active"));
  document.querySelectorAll(`#nav button[data-view="${v}"], .header-actions button[data-view="${v}"]`).forEach((x) => x.classList.add("active"));
  document.querySelectorAll(".view").forEach((x) => x.classList.remove("active"));
  $("view-" + v).classList.add("active");
  if (v === "jobs") loadJobs(); if (v === "companies") loadCompanies();
  if (v === "dashboard") loadDashboard(); if (v === "profile") loadProfile();
}

// ---------- USER: register / login / me / update / resume ----------
function toggleRegister() {
  const f = $("register-form");
  const b = $("register-toggle");
  if (!f) return;
  const hidden = getComputedStyle(f).display === "none";
  f.style.display = hidden ? "" : "none";
  if (b) b.textContent = hidden ? "Hide register" : "Register";
}
window.toggleRegister = toggleRegister;
async function register() {
  try {
    await handle(await fetch(api + "/users/register", { method: "POST", headers: headers(),
      body: JSON.stringify({ name: $("reg-name").value.trim(), email: $("reg-email").value.trim(), password: $("reg-pass").value, role: $("reg-role").value }) }));
    toast("Registered. Please log in."); show("auth");
    const rf = $("register-form"); if (rf) rf.style.display = "none";
    const rt = $("register-toggle"); if (rt) rt.textContent = "Register";
  } catch (e) { toast("Register failed: " + e.message); }
}
async function login() {
  try {
    const j = await handle(await fetch(api + "/users/login", { method: "POST", headers: headers(),
      body: JSON.stringify({ email: $("login-email").value.trim(), password: $("login-pass").value }) }));
    localStorage.setItem("token", j.access_token);
    await refreshMe();
    toast(isRec() ? "Welcome back." : "Logged in as " + currentUser.name);
    show(isRec() ? "dashboard" : "jobs");
  } catch (e) { toast("Login failed: " + e.message); }
}
async function adminLogin() {
  try {
    const j = await handle(await fetch(api + "/users/login", { method: "POST", headers: headers(),
      body: JSON.stringify({ email: $("admin-login-email").value.trim(), password: $("admin-login-pass").value }) }));
    localStorage.setItem("token", j.access_token);
    await refreshMe();
    if (!currentUser || currentUser.role !== "admin") {
      localStorage.removeItem("token"); currentUser = null; refreshBadge();
      return toast("Not an admin account.");
    }
    toast("Welcome, admin.");
    show("dashboard");
  } catch (e) { toast("Admin login failed: " + e.message); }
}
function logout() { localStorage.removeItem("token"); currentUser = null; refreshBadge(); show("jobs"); toast("Logged out"); }
async function refreshMe() {
  if (!token()) { currentUser = null; refreshBadge(); return; }
  try { currentUser = await handle(await fetch(api + "/users/me", { headers: headers(false) })); }
  catch { currentUser = null; localStorage.removeItem("token"); }
  refreshBadge();
}
function refreshBadge() {
  const r = isRec();
  const isAdmin = currentUser && currentUser.role === "admin";
  const role = !currentUser ? "guest" : isAdmin ? "admin" : r ? "recruiter" : "seeker";
  document.body.classList.remove("role-guest", "role-seeker", "role-recruiter", "role-admin");
  document.body.classList.add("role-" + role);
  $("role-pill").textContent = !currentUser ? "guest" : currentUser.role;
  const badge = currentUser ? `${currentUser.name} · ${currentUser.role}` : "Not logged in";
  const ub = $("user-badge"); if (ub) ub.textContent = badge;
  $("role-bar").textContent = !currentUser
    ? "Browse jobs as a guest. Log in as a job seeker to apply, or as a recruiter to hire."
    : isAdmin ? "Admin mode — approve recruiters, oversee jobs and companies."
    : r ? "Recruiter mode — post jobs, manage companies, review applicants."
    : "Job seeker mode — browse, apply, track status on your dashboard.";
  $("nav-jobs").textContent = r ? "All Jobs" : "Jobs";
  $("nav-companies").textContent = r ? "My Companies" : "Companies";
  $("nav-companies").style.display = currentUser && !r ? "none" : "";
  $("nav-dashboard").textContent = r ? "Hiring" : "My Applications";
  $("nav-auth").style.display = currentUser ? "none" : "";
  $("hero-seeker").style.display = r ? "none" : "flex";
  $("hero-recruiter").style.display = r ? "flex" : "none";
  $("create-company-card").style.display = r ? "" : "none";
  $("my-companies-card").style.display = r ? "" : "none";
  $("dash-recruiter").style.display = r ? "" : "none";
  $("dash-seeker").style.display = r ? "none" : "";
  $("dash-title").textContent = !currentUser ? "Dashboard" : r ? "Hiring Dashboard" : "My Applications";
  $("dash-sub").textContent = !currentUser ? "Log in to see your dashboard." : r ? "Post jobs, review applicants, update statuses." : "Track your applications and their status.";
}

// ---------- JOB: search / filter / detail / create / update / delete / apply ----------
function clearFilters() { $("f-search").value = $("f-location").value = $("f-company").value = ""; $("f-type").value = ""; loadJobs(); }
async function loadJobs() {
  const p = new URLSearchParams();
  if ($("f-search").value.trim()) p.set("search", $("f-search").value.trim());
  if ($("f-location").value.trim()) p.set("location", $("f-location").value.trim());
  if ($("f-type").value) p.set("job_type", $("f-type").value);
  if ($("f-company").value) p.set("company_id", $("f-company").value);
  try {
    await refreshApplied();
    const jobs = await handle(await fetch(api + "/jobs?" + p.toString()));
    jobsCache = jobs;
    const cos = await handle(await fetch(api + "/companies"));
    companiesCache = cos;
    const coName = (id) => cos.find((c) => c.id === id)?.name || ("Company #" + id);
    const stats = `<div class="stat"><b>${jobs.length}</b><span>jobs</span></div><div class="stat"><b>${cos.length}</b><span>companies</span></div>`;
    $("jobs-stats").innerHTML = stats;
    const rs = $("jobs-stats-r"); if (rs) rs.innerHTML = stats;
    $("jobs-list").innerHTML = jobs.length ? "" : `<div class="empty">No jobs match. Try clearing filters.</div>`;
    const rec = isRec();
    jobs.forEach((j) => {
      const d = document.createElement("div");
      d.className = "card job" + (j.is_active ? "" : " closed");
      const actions = rec
        ? `<div class="row"><button class="ghost small" onclick="viewJob(${j.id})">Details</button>
           <button class="primary small" onclick="show('dashboard');setTimeout(()=>{$('app-jobid').value=${j.id};loadJobApplicants()},300)">Applicants</button></div>`
        : hasApplied(j.id)
        ? `<div class="row"><button class="ghost small" onclick="viewJob(${j.id})">Details</button>${appliedBadge}</div>`
        : `<div class="row"><button class="ghost small" onclick="viewJob(${j.id})">Details</button>
           <button class="primary small" onclick="openApply(${j.id})">Apply</button></div>`;
      d.innerHTML = `<h3>${esc(j.title)}</h3>
        <div><span class="badge ${esc(j.job_type)}">${esc(j.job_type)}</span><span class="badge">${esc(j.location || "—")}</span>
        <span class="badge ${j.is_active ? "active" : "inactive"}">${j.is_active ? "Open" : "Closed"}</span></div>
        <p class="desc">${esc(j.description).slice(0, 160)}${j.description.length > 160 ? "…" : ""}</p>
        <div class="meta">${esc(coName(j.company_id))} · Job #${j.id}</div>
        ${actions}`;
      $("jobs-list").appendChild(d);
    });
  } catch (e) { toast("Load jobs failed: " + e.message); }
}
async function viewJob(id) {
  try {
    const j = await handle(await fetch(api + `/jobs/${id}`));
    const co = companiesCache.find((c) => c.id === j.company_id);
    const cta = isRec()
      ? `<div class="row"><button class="primary" onclick="closeModal();show('dashboard');setTimeout(()=>{$('app-jobid').value=${j.id};loadJobApplicants()},300)">View applicants</button>
         <button class="ghost" onclick="closeModal()">Close</button></div>`
      : hasApplied(j.id)
      ? `<div class="row">${appliedBadge}<button class="ghost" onclick="closeModal()">Close</button></div>`
      : `<div class="row"><button class="primary" onclick="closeModal();openApply(${j.id})">Apply now</button>
         <button class="ghost" onclick="closeModal()">Close</button></div>`;
    openModal(`<h2>${esc(j.title)}</h2>
      <div><span class="badge ${esc(j.job_type)}">${esc(j.job_type)}</span><span class="badge">${esc(j.location || "—")}</span>
      <span class="badge ${j.is_active ? "active" : "inactive"}">${j.is_active ? "Open" : "Closed"}</span></div>
      <p class="meta">${esc(co?.name || "Company #" + j.company_id)} ${co?.location ? "· " + esc(co.location) : ""} · Job #${j.id} · posted ${new Date(j.created_at).toLocaleDateString()}</p>
      <p>${esc(j.description).replace(/\n/g, "<br>")}</p>
      ${cta}
      <p class="muted">GET /jobs/${j.id}</p>`);
  } catch (e) { toast("Failed: " + e.message); }
}
function openApply(id) {
  if (!token()) return toast("Log in as a job seeker first");
  if (hasApplied(id)) return toast("Already applied to this job");
  const j = jobsCache.find((x) => x.id === id);
  applyJobId = id;
  openModal(`<h2>Apply — ${esc(j?.title || "Job #" + id)}</h2>
    <p class="muted">Upload your resume (PDF / DOC / DOCX · max 5 MB). It also updates your profile resume.</p>
    <input type="file" id="m-resume" accept=".pdf,.doc,.docx" />
    <div class="row"><button class="primary" onclick="submitApply()">Submit application</button>
    <button class="ghost" onclick="closeModal()">Cancel</button></div>
    <p class="muted">POST /jobs/${id}/apply (multipart resume file)</p>`);
}
async function submitApply() {
  try {
    const f = $("m-resume").files[0];
    if (!f) return toast("Choose your resume file first");
    const fd = new FormData(); fd.append("file", f);
    await handle(await fetch(api + `/jobs/${applyJobId}/apply`, { method: "POST",
      headers: { Authorization: "Bearer " + token() }, body: fd }));
    closeModal(); toast("Application submitted.");
    appliedJobIds.add(applyJobId);
    loadJobs();
  } catch (e) { toast("Apply failed: " + e.message); }
}
async function postJob() {
  try {
    const cid = Number($("job-company").value);
    if (!cid) return toast("Create a company first");
    await handle(await fetch(api + "/jobs", { method: "POST", headers: headers(),
      body: JSON.stringify({ company_id: cid, title: $("job-title").value.trim(), description: $("job-desc").value.trim(),
        location: $("job-location").value.trim() || null, job_type: $("job-type").value }) }));
    $("job-title").value = $("job-desc").value = $("job-location").value = "";
    toast("Job published."); loadDashboard();
  } catch (e) { toast("Post failed: " + e.message); }
}
function openEditJob(id) {
  const j = jobsCache.find((x) => x.id === id) || {};
  editJobId = id;
  openModal(`<h2>Edit job #${id}</h2>
    <input id="m-jtitle" value="${esc(j.title || "")}" placeholder="Title" />
    <textarea id="m-jdesc" placeholder="Description">${esc(j.description || "")}</textarea>
    <div class="formgrid2"><input id="m-jloc" value="${esc(j.location || "")}" placeholder="Location" />
    <select id="m-jtype"><option>full_time</option><option>part_time</option><option>contract</option><option>internship</option><option>remote</option></select></div>
    <label><input type="checkbox" id="m-jactive" ${j.is_active ? "checked" : ""} style="width:auto" /> Active (open for applications)</label>
    <div class="row"><button class="primary" onclick="submitEditJob()">Save</button><button class="ghost" onclick="closeModal()">Cancel</button></div>
    <p class="muted">PUT /jobs/${id}</p>`);
  $("m-jtype").value = j.job_type || "full_time";
}
async function submitEditJob() {
  try {
    await handle(await fetch(api + `/jobs/${editJobId}`, { method: "PUT", headers: headers(),
      body: JSON.stringify({ title: $("m-jtitle").value, description: $("m-jdesc").value, location: $("m-jloc").value || null,
        job_type: $("m-jtype").value, is_active: $("m-jactive").checked }) }));
    closeModal(); toast("Job updated."); loadDashboard(); loadJobs();
  } catch (e) { toast("Update failed: " + e.message); }
}
async function deleteJob(id) {
  if (!confirm(`Delete job #${id}? Its applications will be removed too.`)) return;
  try { await handle(await fetch(api + `/jobs/${id}`, { method: "DELETE", headers: headers(false) })); toast("Job deleted."); loadDashboard(); }
  catch (e) { toast("Failed: " + e.message); }
}

// ---------- COMPANY: list / detail / create / mine / update / delete / applicants ----------
async function loadCompanies() {
  try {
    const cos = await handle(await fetch(api + "/companies"));
    companiesCache = cos;
    $("companies-list").innerHTML = cos.length ? "" : `<div class="empty">No companies yet.</div>`;
    cos.forEach((c) => {
      const d = document.createElement("div");
      d.className = "card co";
      d.innerHTML = `<h3>${esc(c.name)}</h3>
        <div class="meta">${esc(c.location || "—")} · ${esc(c.website || "—")} · #${c.id}</div>
        <p class="desc">${esc((c.description || "").slice(0, 140))}</p>
        <div class="row"><button class="ghost small" onclick="viewCompany(${c.id})">View and jobs</button></div>`;
      $("companies-list").appendChild(d);
    });
    if (isRec()) {
      const mine = await handle(await fetch(api + "/companies/me", { headers: headers(false) }));
      $("my-companies-list").innerHTML = mine.length ? "" : `<p class="muted">You haven't created any company yet.</p>`;
      mine.forEach((c) => {
        const d = document.createElement("div");
        d.className = "card";
        d.innerHTML = `<b>${esc(c.name)}</b> <span class="muted">#${c.id} · ${esc(c.location || "")}</span>
          <div class="row"><button class="ghost small" onclick="viewCompany(${c.id})">View</button>
          <button class="ghost small" onclick="openEditCompany(${c.id})">Edit</button>
          <button class="danger small" onclick="deleteCompany(${c.id})">Delete</button></div>`;
        $("my-companies-list").appendChild(d);
      });
    }
  } catch (e) { toast("Companies failed: " + e.message); }
}
async function viewCompany(id) {
  try {
    const c = await handle(await fetch(api + `/companies/${id}`));
    const jobs = await handle(await fetch(api + `/jobs?company_id=${id}`));
    const jobBtn = (jid) => isRec()
      ? `<button class="primary small" onclick="closeModal();show('dashboard');setTimeout(()=>{$('app-jobid').value=${jid};loadJobApplicants()},300)">Applicants</button>`
      : hasApplied(jid)
      ? appliedBadge
      : `<button class="primary small" onclick="closeModal();openApply(${jid})">Apply</button>`;
    openModal(`<h2>${esc(c.name)}</h2>
      <p class="meta">${esc(c.location || "—")} · ${esc(c.website || "—")}</p><p>${esc(c.description || "No description.")}</p>
      <h3>Open jobs (${jobs.length})</h3>
      ${jobs.map((j) => `<div class="card"><b>${esc(j.title)}</b> <span class="badge ${esc(j.job_type)}">${esc(j.job_type)}</span>
        <div class="row"><button class="ghost small" onclick="closeModal();viewJob(${j.id})">Details</button>
        ${jobBtn(j.id)}</div></div>`).join("") || "<p class='muted'>No jobs yet.</p>"}
      <button class="ghost" onclick="closeModal()">Close</button>
      <p class="muted">GET /companies/${id} · GET /jobs?company_id=${id}</p>`);
  } catch (e) { toast("Failed: " + e.message); }
}
async function createCompany() {
  try {
    await handle(await fetch(api + "/companies", { method: "POST", headers: headers(),
      body: JSON.stringify({ name: $("co-name").value.trim(), location: $("co-location").value.trim() || null,
        website: $("co-website").value.trim() || null, description: $("co-desc").value.trim() || null }) }));
    $("co-name").value = $("co-location").value = $("co-website").value = $("co-desc").value = "";
    toast("Company created."); loadCompanies(); loadDashboard();
  } catch (e) { toast("Create failed: " + e.message); }
}
async function openEditCompany(id) {
  const c = companiesCache.find((x) => x.id === id) || {};
  try {
    const full = await handle(await fetch(api + `/companies/${id}`)); Object.assign(c, full);
  } catch {}
  editCompanyId = id;
  openModal(`<h2>Edit company #${id}</h2>
    <input id="m-cname" value="${esc(c.name || "")}" placeholder="Name" />
    <input id="m-cloc" value="${esc(c.location || "")}" placeholder="Location" />
    <input id="m-cweb" value="${esc(c.website || "")}" placeholder="Website" />
    <textarea id="m-cdesc" placeholder="Description">${esc(c.description || "")}</textarea>
    <div class="row"><button class="primary" onclick="submitEditCompany()">Save</button><button class="ghost" onclick="closeModal()">Cancel</button></div>
    <p class="muted">PUT /companies/${id}</p>`);
}
async function submitEditCompany() {
  try {
    await handle(await fetch(api + `/companies/${editCompanyId}`, { method: "PUT", headers: headers(),
      body: JSON.stringify({ name: $("m-cname").value, location: $("m-cloc").value || null, website: $("m-cweb").value || null, description: $("m-cdesc").value || null }) }));
    closeModal(); toast("Company updated."); loadCompanies();
  } catch (e) { toast("Update failed: " + e.message); }
}
async function deleteCompany(id) {
  if (!confirm(`Delete company #${id}? All its jobs and applications will be removed.`)) return;
  try { await handle(await fetch(api + `/companies/${id}`, { method: "DELETE", headers: headers(false) })); toast("Company deleted."); loadCompanies(); }
  catch (e) { toast("Failed: " + e.message); }
}

// clickable resume link (served at /uploads/...) or fallback text
const resumeLink = (p) => p
  ? `<a href="/${esc(p).replace(/\\/g, "/")}" target="_blank">${esc(p.split(/[\\/]/).pop())}</a>`
  : `<span class="muted">No resume</span>`;

// ---------- APPLICATIONS: mine / detail / status / withdraw / per-job / per-company ----------
async function loadMyApps() {
  if (!token()) { $("myapps-list").innerHTML = `<div class="empty">Log in to see your applications.</div>`; return; }
  try {
    const apps = await handle(await fetch(api + "/applications/me", { headers: headers(false) }));
    const counts = {};
    apps.forEach((a) => counts[a.status] = (counts[a.status] || 0) + 1);
    $("myapps-list").innerHTML = apps.length ? "" : `<div class="empty">You haven't applied yet — browse jobs.</div>`;
    apps.forEach((a) => {
      const d = document.createElement("div");
      d.className = "card";
      d.innerHTML = `<b>Job #${a.job_id}</b> <span class="badge ${a.status}">${a.status}</span>
        <div class="meta">Applied ${new Date(a.applied_at).toLocaleString()} · App #${a.id}</div>
        <p class="desc">Resume: ${resumeLink(a.resume_path)}</p>
        <div class="row"><button class="ghost small" onclick="viewApplication(${a.id})">Details</button>
        <button class="danger small" onclick="withdraw(${a.id})">Withdraw</button></div>`;
      $("myapps-list").appendChild(d);
    });
    return counts;
  } catch (e) { toast("Load failed: " + e.message); }
}
async function viewApplication(id) {
  try {
    const a = await handle(await fetch(api + `/applications/${id}`, { headers: headers(false) }));
    openModal(`<h2>Application #${a.id} <span class="badge ${a.status}">${a.status}</span></h2>
      <p class="meta">Job #${a.job_id} · Seeker #${a.applicant_id} · ${new Date(a.applied_at).toLocaleString()}</p>
      <p><b>Resume:</b> ${resumeLink(a.resume_path)}</p>
      <div class="row"><button class="ghost" onclick="closeModal()">Close</button>
      ${!isRec() ? `<button class="danger" onclick="closeModal();withdraw(${a.id})">Withdraw</button>` : ""}</div>
      <p class="muted">GET /applications/${id}</p>`);
  } catch (e) { toast("Failed: " + e.message); }
}
async function withdraw(id) {
  if (!confirm(`Withdraw application #${id}?`)) return;
  try {
    const a = await handle(await fetch(api + `/applications/${id}`, { headers: headers(false) }));
    await handle(await fetch(api + `/applications/${id}`, { method: "DELETE", headers: headers(false) }));
    appliedJobIds.delete(a.job_id);
    toast("Withdrawn. You can apply again."); loadMyApps(); loadJobs();
  }
  catch (e) { toast("Failed: " + e.message); }
}
async function setStatus(id) {
  try {
    await handle(await fetch(api + `/applications/${id}/status`, { method: "PATCH", headers: headers(),
      body: JSON.stringify({ status: $("st-" + id).value }) }));
    toast("Status set to " + $("st-" + id).value); loadApplicants();
  } catch (e) { toast("Failed: " + e.message); }
}
function renderApplicants(apps, source) {
  $("applicants-list").innerHTML = apps.length
    ? `<table><tr><th>App</th><th>Job</th><th>Seeker</th><th>Resume</th><th>Status</th><th>Set status</th></tr>` +
      apps.map((a) => `<tr><td>${a.id}</td><td>${a.job_id}</td><td>${a.applicant_id}</td>
        <td>${resumeLink(a.resume_path)}</td>
        <td><span class="badge ${a.status}">${a.status}</span></td>
        <td><select id="st-${a.id}"><option>applied</option><option>shortlisted</option><option>rejected</option><option>hired</option></select>
        <button class="small primary" onclick="setStatus(${a.id})">Set</button></td></tr>`).join("") + `</table><p class="muted">${apps.length} applicant(s) · ${source}</p>`
    : `<div class="empty">No applicants found.</div>`;
  apps.forEach((a) => { const s = $("st-" + a.id); if (s) s.value = a.status; });
}
async function loadApplicants() {
  const cid = $("app-company").value, st = $("app-status").value;
  if (!cid) return toast("No company selected");
  try {
    let url = api + `/companies/${cid}/applicants` + (st ? `?app_status=${st}` : "");
    renderApplicants(await handle(await fetch(url, { headers: headers(false) })), `GET /companies/${cid}/applicants`);
  } catch (e) { toast("Failed: " + e.message); }
}
async function loadJobApplicants() {
  const jid = $("app-jobid").value;
  if (!jid) return toast("Enter a Job ID");
  try {
    renderApplicants(await handle(await fetch(api + `/jobs/${jid}/applications`, { headers: headers(false) })), `GET /jobs/${jid}/applications`);
  } catch (e) { toast("Failed: " + e.message); }
}

// ---------- DASHBOARD ----------
async function loadDashboard() {
  await refreshMe();
  if (!currentUser) { $("dash-stats").innerHTML = `<div class="empty">Log in to see your dashboard.</div>`; return; }
  if (!isRec()) {
    const counts = (await loadMyApps()) || {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    $("dash-stats").innerHTML = `<div class="stat"><b>${total}</b><span>applied</span></div>
      <div class="stat"><b>${counts.shortlisted || 0}</b><span>shortlisted</span></div>
      <div class="stat"><b>${counts.hired || 0}</b><span>hired</span></div>
      <div class="stat"><b>${counts.rejected || 0}</b><span>rejected</span></div>`;
  } else {
    const admin = currentUser.role === "admin";
    let rcStatus = "approved";
    if (!admin) {
      try {
        const s = await handle(await fetch(api + "/recruiter/status", { headers: headers(false) }));
        rcStatus = s.status || "approved";
      } catch { rcStatus = "approved"; }
    }
    const rcOk = rcStatus === "approved";
    $("rc-status-card").style.display = rcOk ? "none" : "";
    $("hire-actions").style.display = rcOk ? "" : "none";
    $("hire-results").style.display = rcOk ? "" : "none";
    $("hire-jobs").style.display = rcOk ? "" : "none";
    $("admin-card").style.display = admin ? "" : "none";
    if (!rcOk) {
      $("rc-status-text").textContent = rcStatus === "rejected"
        ? "Your recruiter application was rejected. Update the details below and resubmit."
        : "Your recruiter application is under review. Job posting unlocks after admin approval.";
      return;
    }
    if (admin) loadPendingApplications();
    try {
      const cos = await handle(await fetch(api + "/companies/me", { headers: headers(false) }));
      const opts = cos.map((c) => `<option value="${c.id}">${esc(c.name)} (#${c.id})</option>`).join("");
      $("job-company").innerHTML = opts || "<option value=''>No company — create one first</option>";
      $("app-company").innerHTML = opts || "<option value=''>—</option>";
      let allJobs = [];
      for (const c of cos) allJobs.push(...(await handle(await fetch(api + `/jobs?company_id=${c.id}`))));
      jobsCache = allJobs;
      let totalApps = 0;
      for (const c of cos) totalApps += (await handle(await fetch(api + `/companies/${c.id}/applicants`, { headers: headers(false) }))).length;
      $("dash-stats").innerHTML = `<div class="stat"><b>${cos.length}</b><span>companies</span></div>
        <div class="stat"><b>${allJobs.length}</b><span>jobs posted</span></div>
        <div class="stat"><b>${totalApps}</b><span>applicants</span></div>`;
      $("myjobs-list").innerHTML = allJobs.length ? "" : `<div class="empty">No jobs yet — post your first one above.</div>`;
      allJobs.forEach((j) => {
        const d = document.createElement("div");
        d.className = "card";
        d.innerHTML = `<b>${esc(j.title)}</b> <span class="badge ${j.is_active ? "active" : "inactive"}">${j.is_active ? "Open" : "Closed"}</span>
          <span class="muted">#${j.id} · ${esc(j.location || "")} · ${esc(j.job_type)}</span>
          <div class="row"><button class="ghost small" onclick="viewJob(${j.id})">View</button>
          <button class="ghost small" onclick="openEditJob(${j.id})">Edit</button>
          <button class="ghost small" onclick="$('app-jobid').value=${j.id};loadJobApplicants()">Applicants</button>
          <button class="danger small" onclick="deleteJob(${j.id})">Delete</button></div>`;
        $("myjobs-list").appendChild(d);
      });
    } catch (e) { toast("Dashboard failed: " + e.message); }
  }
}

// ---------- RECRUITER APPROVAL + ADMIN ----------
async function submitRecruiterApplication() {
  try {
    await handle(await fetch(api + "/recruiter/apply", { method: "POST", headers: headers(),
      body: JSON.stringify({ company_name: $("rc-company").value.trim() || null,
        message: $("rc-message").value.trim() || null }) }));
    toast("Application submitted for review."); loadDashboard();
  } catch (e) { toast("Submit failed: " + e.message); }
}
async function loadPendingApplications() {
  const st = $("admin-filter").value;
  try {
    const apps = await handle(await fetch(api + "/admin/applications" + (st ? `?status=${st}` : ""), { headers: headers(false) }));
    $("pending-list").innerHTML = apps.length ? "" : `<div class="empty">No applications.</div>`;
    apps.forEach((a) => {
      const d = document.createElement("div");
      d.className = "card";
      d.style.marginBottom = "10px";
      d.innerHTML = `<b>${esc(a.applicant?.name || "User #" + a.user_id)}</b> <span class="badge ${a.status}">${a.status}</span>
        <div class="meta">${esc(a.applicant?.email || "")} · App #${a.id} · ${new Date(a.created_at).toLocaleString()}</div>
        <p class="desc">${esc(a.company_name || "—")}${a.message ? " — " + esc(a.message) : ""}</p>
        <div class="row"><button class="primary small" onclick="reviewApplication(${a.id},'approve')">Approve</button>
        <button class="danger small" onclick="reviewApplication(${a.id},'reject')">Reject</button></div>`;
      $("pending-list").appendChild(d);
    });
  } catch (e) { toast("Load failed: " + e.message); }
}
async function reviewApplication(id, decision) {
  try {
    await handle(await fetch(api + `/admin/applications/${id}`, { method: "PATCH", headers: headers(),
      body: JSON.stringify({ decision }) }));
    toast(decision === "approve" ? "Recruiter approved." : "Application rejected.");
    loadPendingApplications(); loadDashboard();
  } catch (e) { toast("Failed: " + e.message); }
}

// ---------- PROFILE: me / update / resume ----------
async function loadProfile() {
  if (!token()) { $("profile-pre").textContent = "Not logged in"; return; }
  try {
    const me = await handle(await fetch(api + "/users/me", { headers: headers(false) }));
    currentUser = me; refreshBadge();
    $("profile-pre").textContent = JSON.stringify(me, null, 2);
    $("pf-avatar").textContent = (me.name || "?")[0].toUpperCase();
    $("pf-headname").textContent = me.name; $("pf-headrole").textContent = `${me.role} · ${me.email}`;
    $("pf-name").value = me.name || ""; $("pf-phone").value = me.phone || "";
    $("pf-skills").value = me.skills || ""; $("pf-bio").value = me.bio || "";
    $("resume-info").textContent = me.resume_path ? "Saved: " + me.resume_path : "No resume uploaded yet.";
  } catch (e) { toast("Profile failed: " + e.message); }
}
async function updateProfile() {
  try {
    const body = {};
    const name = $("pf-name").value.trim();
    const phone = $("pf-phone").value.trim();
    const skills = $("pf-skills").value.trim();
    const bio = $("pf-bio").value.trim();
    if (name) body.name = name;
    if (phone) body.phone = phone;
    if (skills) body.skills = skills;
    if (bio) body.bio = bio;
    await handle(await fetch(api + "/users/me", { method: "PUT", headers: headers(),
      body: JSON.stringify(body) }));
    toast("Profile saved."); loadProfile();
  } catch (e) { toast("Save failed: " + e.message); }
}
async function uploadResume() {
  const f = $("resume-file").files[0];
  if (!f) return toast("Choose a file first");
  const fd = new FormData(); fd.append("file", f);
  try {
    await handle(await fetch(api + "/users/me/resume", { method: "POST", headers: { Authorization: "Bearer " + token() }, body: fd }));
    toast("Resume uploaded."); loadProfile();
  } catch (e) { toast("Upload failed: " + e.message); }
}

// init
refreshMe().then(() => loadJobs());
