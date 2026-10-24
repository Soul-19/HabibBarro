/* Administration : modifie les fichiers du dépôt GitHub via l'API (aucun serveur). */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LS = "cvsite_admin";
let cfg = null, site = null, projects = null, editing = null;

/* ---------- messages ---------- */
let timer;
function say(msg, err = false, keep = false) {
  const s = $("#status"); s.textContent = msg; s.className = "status" + (err ? " err" : ""); s.hidden = false;
  clearTimeout(timer); if (!keep) timer = setTimeout(() => (s.hidden = true), err ? 9000 : 4500);
}
const AFTER = " Le site public se met à jour dans environ une minute.";

/* ---------- API GitHub ---------- */
async function gh(path, { method = "GET", body, query = "" } = {}) {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}${query}`;
  const r = await fetch(url, {
    method, cache: "no-store",
    headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) throw new Error("Jeton refusé. Vérifiez qu’il est valide et non expiré.");
  if (r.status === 403) throw new Error("Accès interdit. Le jeton doit avoir la permission « Contents : Read and write » sur ce dépôt.");
  if (r.status === 404 && method === "GET") return null;
  if (r.status === 404) throw new Error("Dépôt ou fichier introuvable. Vérifiez le nom d’utilisateur et le nom du dépôt.");
  if (r.status === 409 || r.status === 422) throw new Error("Conflit d’enregistrement. Rechargez la page puis recommencez.");
  if (!r.ok) throw new Error("Erreur GitHub " + r.status);
  return r.json();
}
const utf8ToB64 = (t) => btoa(unescape(encodeURIComponent(t)));
const b64ToUtf8 = (b) => decodeURIComponent(escape(atob(b.replace(/\n/g, ""))));
const fileToB64 = (f) => new Promise((res, rej) => {
  const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = () => rej(new Error("Lecture du fichier impossible : " + f.name)); fr.readAsDataURL(f);
});
async function readJSON(path) {
  const j = await gh(path, { query: "?ref=" + encodeURIComponent(cfg.branch) });
  return j ? { sha: j.sha, data: JSON.parse(b64ToUtf8(j.content)) } : null;
}
const shas = {};
async function writeJSON(path, data, message) {
  const body = { message, branch: cfg.branch, content: utf8ToB64(JSON.stringify(data, null, 2) + "\n") };
  if (shas[path]) body.sha = shas[path];
  const r = await gh(path, { method: "PUT", body });
  shas[path] = r.content.sha;
}
async function putBinary(path, file, message) {
  const cur = await gh(path, { query: "?ref=" + encodeURIComponent(cfg.branch) });
  const body = { message, branch: cfg.branch, content: await fileToB64(file) };
  if (cur && cur.sha) body.sha = cur.sha;
  await gh(path, { method: "PUT", body });
}
async function removeFile(path, message) {
  const cur = await gh(path, { query: "?ref=" + encodeURIComponent(cfg.branch) });
  if (cur && cur.sha) await gh(path, { method: "DELETE", body: { message, branch: cfg.branch, sha: cur.sha } });
}

/* ---------- outils ---------- */
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "fichier";
function safeName(n) {
  const i = n.lastIndexOf("."); const base = i > 0 ? n.slice(0, i) : n, ext = i > 0 ? n.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return slug(base) + (ext ? "." + ext : "");
}
const tagsOf = (s) => s.split(",").map((t) => t.trim()).filter(Boolean);
const MAX = 25 * 1024 * 1024;
const tooBig = (files) => [...files].find((f) => f.size > MAX);
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- connexion ---------- */
function showLogin() {
  $("#app").hidden = true; $("#login").hidden = false;
  const guess = location.hostname.endsWith(".github.io") ? location.hostname.split(".")[0] : "";
  const parts = location.pathname.split("/").filter(Boolean);
  $("#owner").value = (cfg && cfg.owner) || guess;
  $("#repo").value = (cfg && cfg.repo) || (guess && parts[0] && !parts[0].endsWith(".html") ? parts[0] : guess ? guess + ".github.io" : "");
  $("#branch").value = (cfg && cfg.branch) || "main";
}
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  cfg = { owner: $("#owner").value.trim(), repo: $("#repo").value.trim(), branch: $("#branch").value.trim() || "main", token: $("#token").value.trim() };
  try {
    say("Connexion en cours", false, true);
    await load();
    localStorage.setItem(LS, JSON.stringify(cfg));
    $("#token").value = ""; $("#login").hidden = true; $("#app").hidden = false; tab("docs");
    say("Connecté.");
  } catch (err) { say(err.message, true); }
});
$("#logout").addEventListener("click", () => { localStorage.removeItem(LS); cfg = null; showLogin(); });

async function load() {
  const s = await readJSON("data/site.json"), p = await readJSON("data/projects.json");
  if (!s) throw new Error("Le fichier data/site.json est introuvable dans ce dépôt. Vérifiez le nom du dépôt et la branche.");
  site = s.data; shas["data/site.json"] = s.sha;
  projects = p ? p.data : []; if (p) shas["data/projects.json"] = p.sha;
}

/* ---------- onglets ---------- */
document.querySelectorAll("[role=tab]").forEach((b) => b.addEventListener("click", () => tab(b.dataset.tab)));
function tab(name) {
  editing = null;
  document.querySelectorAll("[role=tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === name));
  ({ docs: viewDocs, projects: viewProjects, profile: viewProfile }[name])();
}

/* ---------- CV et lettre ---------- */
const hintDoc = (d) => `Fichier actuel : <a href="${encodeURI(d.path)}${d.v ? "?v=" + d.v : ""}" target="_blank" rel="noopener">${esc(d.path)}</a>${d.updated ? ", remplacé le " + esc(d.updated) : ""}`;
let busy = false;
function viewDocs() {
  $("#view").innerHTML = Object.entries(site.documents).map(([k, d]) => `
    <form class="panel" data-k="${esc(k)}">
      <h3 style="margin:0 0 .25rem;font-family:var(--display)">${esc(d.label)}</h3>
      <p class="hint" style="margin-bottom:.75rem" data-hint>${hintDoc(d)}</p>
      <div class="field"><label for="f-${esc(k)}">Nouveau fichier PDF</label><input id="f-${esc(k)}" type="file" accept="application/pdf,.pdf" required></div>
      <button class="btn primary" type="submit">Remplacer ${esc(d.label.toLowerCase())}</button>
    </form>`).join("");
  document.querySelectorAll("#view form").forEach((f) => f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return say("Un envoi est déjà en cours. Patientez un instant.", true);
    const k = f.dataset.k, input = f.querySelector("input"), file = input.files[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) return say("Choisissez un fichier PDF.", true);
    if (tooBig([file])) return say("Fichier trop lourd. La limite est de 25 Mo.", true);
    busy = true; const btns = document.querySelectorAll("#view button"); btns.forEach((b) => (b.disabled = true));
    try {
      say("Envoi de « " + site.documents[k].label + " » en cours", false, true);
      await putBinary(site.documents[k].path, file, "Mise à jour : " + site.documents[k].label);
      site.documents[k].updated = today(); site.documents[k].v = Date.now();
      await writeJSON("data/site.json", site, "Date de mise à jour : " + site.documents[k].label);
      /* Seul ce formulaire est mis à jour : l'autre garde son fichier choisi. */
      f.querySelector("[data-hint]").innerHTML = hintDoc(site.documents[k]); input.value = "";
      say("« " + site.documents[k].label + " » remplacé." + AFTER);
    } catch (err) { say(err.message, true); }
    busy = false; btns.forEach((b) => (b.disabled = false));
  }));
}

/* ---------- Projets ---------- */
function viewProjects() {
  $("#view").innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:1rem"><p class="hint">${projects.length} projet${projects.length > 1 ? "s" : ""}. Les premiers de la liste apparaissent en premier sur le site.</p>
    <button class="btn primary" id="add" type="button">Ajouter un projet</button></div>
    <ul class="plist">${projects.map((p, i) => `<li><div><div class="t">${esc(p.title)}</div><div class="m">${(p.files || []).length} fichier${(p.files || []).length > 1 ? "s" : ""}${p.tags && p.tags.length ? " · " + esc(p.tags.join(", ")) : ""}</div></div>
      <div class="row"><button class="btn small" data-a="up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Monter ${esc(p.title)}">Monter</button>
      <button class="btn small" data-a="down" data-i="${i}" ${i === projects.length - 1 ? "disabled" : ""} aria-label="Descendre ${esc(p.title)}">Descendre</button>
      <button class="btn small" data-a="edit" data-i="${i}">Modifier</button>
      <button class="btn small danger" data-a="del" data-i="${i}">Supprimer</button></div></li>`).join("")}</ul>
    ${projects.length ? "" : '<p class="empty">Aucun projet pour l’instant. Ajoutez le premier.</p>'}`;
  $("#add").onclick = () => projectForm(null);
  $("#view").onclick = async (e) => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const i = +b.dataset.i, a = b.dataset.a;
    try {
      if (a === "edit") return projectForm(i);
      if (a === "up" || a === "down") {
        const j = a === "up" ? i - 1 : i + 1; [projects[i], projects[j]] = [projects[j], projects[i]];
        await writeJSON("data/projects.json", projects, "Ordre des projets"); say("Ordre enregistré." + AFTER); return viewProjects();
      }
      if (a === "del") {
        const p = projects[i];
        if (!confirm(`Supprimer « ${p.title} » et ses ${(p.files || []).length} fichier(s) ? Cette action est définitive.`)) return;
        say("Suppression en cours", false, true);
        for (const f of p.files || []) await removeFile(f.path, "Suppression d’un fichier : " + p.title);
        projects.splice(i, 1);
        await writeJSON("data/projects.json", projects, "Suppression du projet : " + p.title);
        say("Projet supprimé." + AFTER); viewProjects();
      }
    } catch (err) { say(err.message, true); }
  };
}

function projectForm(i) {
  const isNew = i === null, p = isNew ? { id: "", title: "", summary: "", tags: [], date: "", link: "", files: [] } : projects[i];
  $("#view").innerHTML = `<form class="panel" id="pf">
    <h3 style="margin:0 0 1rem;font-family:var(--display)">${isNew ? "Nouveau projet" : "Modifier le projet"}</h3>
    <div class="field"><label for="t">Titre</label><input id="t" required value="${esc(p.title)}"></div>
    <div class="field"><label for="s">Description</label><textarea id="s">${esc(p.summary)}</textarea></div>
    <div class="grid2">
      <div class="field"><label for="g">Thèmes</label><input id="g" value="${esc((p.tags || []).join(", "))}"><p class="hint">Séparez-les par des virgules, par exemple : RF, PCB.</p></div>
      <div class="field"><label for="d">Période</label><input id="d" value="${esc(p.date)}" placeholder="Septembre 2026"></div>
    </div>
    <div class="field"><label for="l">Lien en ligne (facultatif)</label><input id="l" type="url" value="${esc(p.link)}" placeholder="https://"></div>
    ${(p.files || []).length ? `<div class="field"><label>Fichiers actuels</label><div class="existing">${p.files.map((f, k) => `<label><input type="checkbox" data-k="${k}"> Retirer ${esc(f.name)}</label>`).join("")}</div></div>` : ""}
    <div class="field"><label for="n">Ajouter des fichiers</label><input id="n" type="file" multiple><p class="hint">Tous formats, 25 Mo maximum par fichier.</p></div>
    <div class="row"><button class="btn primary" type="submit">Enregistrer</button><button class="btn" type="button" id="cancel">Annuler</button></div></form>`;
  $("#cancel").onclick = viewProjects;
  $("#pf").onsubmit = async (e) => {
    e.preventDefault();
    const files = $("#n").files, big = tooBig(files);
    if (big) return say(`« ${big.name} » dépasse 25 Mo.`, true);
    const btn = e.submitter || $("#pf button[type=submit]"); btn.disabled = true;
    try {
      const title = $("#t").value.trim();
      const id = p.id || slug(title) + "-" + Date.now().toString(36);
      const keep = [], drop = [];
      (p.files || []).forEach((f, k) => (document.querySelector(`.existing input[data-k="${k}"]`)?.checked ? drop : keep).push(f));
      say("Enregistrement en cours", false, true);
      for (const f of drop) await removeFile(f.path, "Retrait d’un fichier : " + title);
      const used = new Set(keep.map((f) => f.path));
      for (const f of files) {
        let name = safeName(f.name), path = `files/projets/${id}/${name}`, n = 2;
        while (used.has(path)) { const j = name.lastIndexOf("."); path = `files/projets/${id}/${j > 0 ? name.slice(0, j) + "-" + n + name.slice(j) : name + "-" + n}`; n++; }
        used.add(path); say(`Envoi de ${f.name}`, false, true);
        await putBinary(path, f, "Ajout d’un fichier : " + title);
        keep.push({ name: f.name, path, size: f.size });
      }
      const item = { id, title, summary: $("#s").value.trim(), tags: tagsOf($("#g").value), date: $("#d").value.trim(), link: $("#l").value.trim(), files: keep };
      if (isNew) projects.unshift(item); else projects[i] = item;
      await writeJSON("data/projects.json", projects, (isNew ? "Nouveau projet : " : "Projet modifié : ") + title);
      say("Projet enregistré." + AFTER); viewProjects();
    } catch (err) { say(err.message, true); btn.disabled = false; }
  };
  $("#t").focus();
}

/* ---------- Profil ---------- */
function viewProfile() {
  const f = (id, label, v, extra = "") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(v)}" ${extra}></div>`;
  $("#view").innerHTML = `<form class="panel" id="prf">
    <div class="grid2">${f("pn", "Nom affiché", site.name, "required")}${f("ps", "École", site.school)}</div>
    ${f("pt", "Titre", site.title)}
    <div class="field"><label for="pi">Présentation</label><textarea id="pi">${esc(site.intro)}</textarea></div>
    <div class="field"><label for="pk">Compétences</label><input id="pk" value="${esc((site.skills || []).join(", "))}"><p class="hint">Séparez-les par des virgules.</p></div>
    <div class="grid2">${f("pe", "Adresse e-mail publique", site.email, 'type="email"')}${f("pl", "LinkedIn (lien)", site.linkedin, 'type="url"')}</div>
    ${f("pg", "GitHub (lien)", site.github, 'type="url"')}
    <button class="btn primary" type="submit">Enregistrer</button></form>`;
  $("#prf").onsubmit = async (e) => {
    e.preventDefault();
    Object.assign(site, { name: $("#pn").value.trim(), school: $("#ps").value.trim(), title: $("#pt").value.trim(), intro: $("#pi").value.trim(), skills: tagsOf($("#pk").value), email: $("#pe").value.trim(), linkedin: $("#pl").value.trim(), github: $("#pg").value.trim() });
    try { await writeJSON("data/site.json", site, "Mise à jour du profil"); say("Profil enregistré." + AFTER); } catch (err) { say(err.message, true); }
  };
}

/* ---------- démarrage ---------- */
(async () => {
  try { cfg = JSON.parse(localStorage.getItem(LS) || "null"); } catch { cfg = null; }
  if (!cfg || !cfg.token) return showLogin();
  try { await load(); $("#app").hidden = false; tab("docs"); } catch (err) { showLogin(); say(err.message, true); }
})();
