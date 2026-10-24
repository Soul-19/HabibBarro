/* Site public : lit data/site.json et data/projects.json */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const getJSON = async (p) => {
  const r = await fetch(p + "?t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error(p + " : " + r.status);
  return r.json();
};
const exists = async (p) => {
  try { const r = await fetch(p, { method: "HEAD", cache: "no-store" }); return r.ok; } catch { return false; }
};
const ext = (p) => (p.split(".").pop() || "").toLowerCase();
const viewable = (p) => ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "txt", "md"].includes(ext(p));
const size = (n) => !n ? "" : n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + " Ko" : (n / 1024 / 1024).toFixed(1).replace(".", ",") + " Mo";

function smithChart() {
  const R = 200, rs = [0, 0.5, 1, 2, 5], xs = [0.5, 1, 2];
  let g = `<circle cx="0" cy="0" r="${R}"/><line x1="${-R}" y1="0" x2="${R}" y2="0"/>`;
  rs.forEach((r) => { if (r) g += `<circle cx="${(r / (1 + r)) * R}" cy="0" r="${R / (1 + r)}"/>`; });
  let arcs = "";
  xs.forEach((x) => { [1, -1].forEach((s) => { arcs += `<circle cx="${R}" cy="${(s * R) / x}" r="${R / x}"/>`; }); });
  return `<svg class="smith" viewBox="-210 -210 420 420" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.1">
    <defs><clipPath id="sc"><circle r="${R}"/></clipPath></defs>${g}<g clip-path="url(#sc)">${arcs}</g></svg>`;
}

function docCard(key, d) {
  return `<article class="doc" id="doc-${key}">
    <header><h3>${esc(d.label)}</h3>
    <div class="btns"><a class="btn small" href="${encodeURI(d.path)}" target="_blank" rel="noopener">Ouvrir</a>
    <a class="btn small primary" href="${encodeURI(d.path)}" download>Télécharger</a></div></header>
    <iframe title="${esc(d.label)}" src="${encodeURI(d.path)}#view=FitH" loading="lazy"></iframe></article>`;
}

async function home() {
  const s = await getJSON("data/site.json");
  document.title = `${s.name} — ${s.title}`;
  const links = [s.email && `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`, s.linkedin && `<a href="${esc(s.linkedin)}" rel="noopener">LinkedIn</a>`, s.github && `<a href="${esc(s.github)}" rel="noopener">GitHub</a>`].filter(Boolean);
  $("#hero").innerHTML = smithChart() + `<div class="wrap"><div class="hero-text">
    <h1>${esc(s.name)}</h1><p class="role">${esc(s.title)}</p><p class="school">${esc(s.school)}</p>
    <p class="intro">${esc(s.intro)}</p>
    <div class="actions"><a class="btn primary" href="#documents">CV et lettre de motivation</a><a class="btn" href="projets.html">Voir mes projets</a></div></div></div>`;
  $("#skills").innerHTML = (s.skills || []).map((k) => `<li>${esc(k)}</li>`).join("");
  const entries = Object.entries(s.documents || {});
  const ok = await Promise.all(entries.map(([, d]) => exists(d.path)));
  $("#docs").innerHTML = entries.map(([k, d], i) => ok[i] ? docCard(k, d) :
    `<article class="doc"><header><h3>${esc(d.label)}</h3></header><p class="missing">Ce document sera bientôt disponible.</p></article>`).join("");
  $("#contact").innerHTML = links.length ? links.join(" · ") : "";
  $("#year").textContent = new Date().getFullYear() + " " + s.name;
}

async function projects() {
  const list = await getJSON("data/projects.json");
  const grid = $("#projects"), tags = $("#tags"), q = $("#q");
  let tag = "";
  const all = [...new Set(list.flatMap((p) => p.tags || []))].sort((a, b) => a.localeCompare(b, "fr"));
  const draw = () => {
    const needle = q.value.trim().toLowerCase();
    const shown = list.filter((p) => (!tag || (p.tags || []).includes(tag)) &&
      (!needle || [p.title, p.summary, ...(p.tags || [])].join(" ").toLowerCase().includes(needle)));
    grid.innerHTML = shown.length ? shown.map(card).join("") : `<p class="empty">${list.length ? "Aucun projet ne correspond à cette recherche." : "Les projets arrivent bientôt."}</p>`;
  };
  const card = (p) => `<article class="project"><div><h3>${esc(p.title)}</h3>${p.date ? `<span class="date">${esc(p.date)}</span>` : ""}</div>
    <p>${esc(p.summary)}</p>
    ${(p.tags || []).length ? `<ul class="chips">${p.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${p.link ? `<p><a href="${esc(p.link)}" rel="noopener" class="act">Voir le projet en ligne</a></p>` : ""}
    ${(p.files || []).length ? `<ul class="files">${p.files.map((f) => `<li><span class="ext">${esc(ext(f.path).toUpperCase())}</span><span class="name">${esc(f.name)}${f.size ? ` (${size(f.size)})` : ""}</span>
      ${viewable(f.path) ? `<a class="act" href="${encodeURI(f.path)}" target="_blank" rel="noopener">Ouvrir</a>` : ""}
      <a class="act" href="${encodeURI(f.path)}" download>Télécharger</a></li>`).join("")}</ul>` : ""}</article>`;
  if (all.length) {
    const btn = (t, l) => `<button class="chip" type="button" data-t="${esc(t)}" aria-pressed="${t === tag}">${esc(l)}</button>`;
    const paint = () => { tags.innerHTML = btn("", "Tous") + all.map((t) => btn(t, t)).join(""); };
    tags.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; tag = b.dataset.t; paint(); draw(); });
    paint();
  }
  q.addEventListener("input", draw);
  draw();
  try { const s = await getJSON("data/site.json"); $("#year").textContent = new Date().getFullYear() + " " + s.name; } catch {}
}

const page = document.body.dataset.page;
document.querySelectorAll(".top nav a").forEach((a) => { if (a.dataset.page === page) a.setAttribute("aria-current", "page"); });
({ home, projects }[page] || (() => {}))().catch((e) => {
  const m = $("main"); if (m) m.insertAdjacentHTML("afterbegin", `<div class="wrap"><p class="empty">Le contenu n’a pas pu être chargé (${esc(e.message)}). Rechargez la page dans un instant.</p></div>`);
});
