// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  nodes: new Map(),  // String(paperId) → node object
  links: [],         // {source, target} by paperId
  selected: null,
};
let lastResults     = [];       // papers from last search / load-sample
let currentFilter   = "all";   // "all" | "seed" | "user"
let pendingBulk     = [];       // parsed papers waiting for user confirmation
let allSeedPapers   = [];       // every paper loaded via the Load button this session
let currentVisible  = [];       // the currently rendered result items (for refreshBadges)
let filterTabActive = false;    // true when sidebar shows graph contents, not search results

// User-created papers persisted in localStorage across sessions
function loadUserPapersFromStorage() {
  try { return JSON.parse(localStorage.getItem("user-papers") || "[]"); } catch { return []; }
}
function saveUserPaperToStorage(paper) {
  const stored = loadUserPapersFromStorage();
  if (!stored.some(p => String(p.paperId) === String(paper.paperId))) {
    stored.push({ ...paper, _source: "user" });
    localStorage.setItem("user-papers", JSON.stringify(stored));
  }
}
let allUserPapers = loadUserPapersFromStorage();

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === f));
}

// ── D3 setup ──────────────────────────────────────────────────────────────────
const svg    = d3.select("#graph-svg");
const root   = svg.select("#graph-root");
const tipEl  = document.getElementById("tooltip");

const zoom = d3.zoom()
  .scaleExtent([0.06, 4])
  .on("zoom", e => { root.attr("transform", e.transform); repositionContextMenu(); });
svg.call(zoom);

const sim = d3.forceSimulation()
  .force("link",      d3.forceLink().id(d => d.paperId).distance(170))
  .force("charge",    d3.forceManyBody().strength(-500))
  .force("center",    d3.forceCenter())
  .force("collision", d3.forceCollide(44))
  .on("tick", ticked);

let linkSel = root.append("g").attr("class", "links").selectAll(".link");
const gFlow = root.append("g").attr("class", "flow"); // particles: above links, below nodes
let nodeSel = root.append("g").attr("class", "nodes").selectAll(".node");

// Draft edge line for hold-to-draw citation (rendered above links, below nodes)
const draftLine = root.select("g.links").append("line")
  .attr("class", "draft-edge")
  .style("display", "none")
  .attr("marker-end", "url(#arrow-draft)");

// Edge-draw state
let edgeDraw   = null;   // null | { src: nodeData }
let holdTimer  = null;
let holdStartX = 0, holdStartY = 0;
let holdMoved  = false;

function onHoldMove(e) {
  if (Math.abs(e.clientX - holdStartX) + Math.abs(e.clientY - holdStartY) > 8) holdMoved = true;
}

function cancelEdgeDraw() {
  edgeDraw = null;
  clearTimeout(holdTimer);
  draftLine.style("display", "none");
  svg.classed("edge-drawing", false);
  nodeSel.classed("edge-src", false).classed("edge-target", false);
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const nodes = [...state.nodes.values()];
  const links = state.links.filter(l =>
    state.nodes.has(String(l.source?.paperId ?? l.source)) &&
    state.nodes.has(String(l.target?.paperId ?? l.target))
  );

  linkSel = root.select(".links").selectAll(".link")
    .data(links, d => `${d.source?.paperId ?? d.source}->${d.target?.paperId ?? d.target}`)
    .join(
      enter => enter.append("line").attr("class", "link").attr("marker-end", "url(#arrow)"),
      u => u,
      exit => exit.remove()
    );

  nodeSel = root.select(".nodes").selectAll(".node")
    .data(nodes, d => d.paperId)
    .join(
      enter => {
        const g = enter.append("g").attr("class", "node")
          .call(d3.drag()
            .on("start", dragstarted)
            .on("drag",  dragged)
            .on("end",   dragended))
          .on("click", (_, d) => {
            if (edgeDraw?.persistent) {
              const srcId = edgeDraw.src.paperId;
              cancelEdgeDraw();
              if (d.paperId !== srcId) createCitation(srcId, d.paperId);
              return;
            }
            selectNode(d);
          })
          .on("dblclick", (e, d) => {
            e.stopPropagation();
            cancelEdgeDraw();
            edgeDraw = { src: d, persistent: true };
            svg.classed("edge-drawing", true);
            nodeSel.classed("edge-src", nd => nd.paperId === d.paperId);
            draftLine.attr("x1", d.x).attr("y1", d.y).attr("x2", d.x).attr("y2", d.y)
                     .style("display", null);
          })
          .on("contextmenu", (e, d) => { e.preventDefault(); e.stopPropagation(); showContextMenu(e, d); })
          .on("mouseover", (e, d) => {
            showTip(e, d);
            if (edgeDraw && d.paperId !== edgeDraw.src.paperId)
              d3.select(e.currentTarget).classed("edge-target", true);
          })
          .on("mouseout",  (e) => {
            hideTip();
            d3.select(e.currentTarget).classed("edge-target", false);
          });
        g.append("circle").attr("r", 18).attr("fill", d => colorFor(d));
        g.append("text").attr("dy", "0.35em").attr("text-anchor", "middle")
          .attr("y", 28).text(d => trunc(d.title, 22));
        return g;
      },
      u => {
        u.classed("selected", d => state.selected?.paperId === d.paperId);
        u.select("circle").attr("fill", d => colorFor(d));
        return u;
      },
      exit => exit.remove()
    );

  sim.nodes(nodes);
  sim.force("link").links(links);
  sim.alpha(0.3).restart();
  updateStatus();
  if (flowActive) updateFlowDots();
  if (walkActive) applyWalkVisuals();
}

function ticked() {
  linkSel.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
         .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
  nodeSel.attr("transform", d => `translate(${d.x},${d.y})`);
  if (edgeDraw) draftLine.attr("x1", edgeDraw.src.x).attr("y1", edgeDraw.src.y);
  if (ctxTarget) repositionContextMenu();
  if (walkActive && walkCurrent) {
    const wn = state.nodes.get(walkCurrent);
    if (wn) gFlow.select(".walk-dot").attr("cx", wn.x).attr("cy", wn.y);
  }
}

function repositionContextMenu() {
  const menu = document.getElementById("node-ctx-menu");
  if (!menu.classList.contains("visible")) return;
  const t = d3.zoomTransform(svg.node());
  const rect = svg.node().getBoundingClientRect();
  // Convert simulation coords → screen coords
  const [sx, sy] = t.apply([ctxTarget.x, ctxTarget.y]);
  const screenX = rect.left + sx;
  const screenY = rect.top  + sy;
  // Anchor menu to right of node centre, nudged down slightly
  let left = screenX + 22;
  let top  = screenY - 10;
  const mw = menu.offsetWidth  || 160;
  const mh = menu.offsetHeight || 100;
  if (left + mw > window.innerWidth)  left = screenX - mw - 22;
  if (top  + mh > window.innerHeight) top  = screenY - mh + 10;
  menu.style.left = left + "px";
  menu.style.top  = top  + "px";
}

// ── Colour by year ────────────────────────────────────────────────────────────
const colorScale = d3.scaleSequential(d3.interpolateCool).domain([1990, 2025]);
function colorFor(d) {
  if (state.selected?.paperId === d.paperId) return "#f59e0b";
  return colorScale(d.publicationYear || 2005);
}

// ── Animations ────────────────────────────────────────────────────────────────
let flowActive = false;
let flowRafId  = null;
let flowT0     = null;

function updateFlowDots() {
  const links = state.links.filter(l =>
    typeof l.source === "object" && typeof l.target === "object");
  // Two particles per link, offset by half a cycle
  const dotData = links.flatMap(l => [
    { link: l, phase: 0.00 },
    { link: l, phase: 0.50 },
  ]);
  gFlow.selectAll(".flow-dot")
    .data(dotData)
    .join("circle")
      .attr("class", "flow-dot")
      .attr("r", 3.5)
      .attr("pointer-events", "none");
}

function animateFlow(ts) {
  if (!flowActive) return;
  if (flowT0 === null) flowT0 = ts;
  const cycleMs = 2200;

  gFlow.selectAll(".flow-dot").each(function(d) {
    const src = d.link.source, tgt = d.link.target;
    if (!src || !tgt || src.x == null) return;
    const t   = ((ts - flowT0) / cycleMs + d.phase) % 1;
    const dx  = tgt.x - src.x, dy = tgt.y - src.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const margin = 22 / len;          // skip over node circle (r≈18 + gap)
    if (margin >= 0.48) return;       // nodes too close to animate
    const pt   = margin + t * (1 - 2 * margin);
    const fade = Math.min(t * 6, 1, (1 - t) * 6);
    d3.select(this)
      .attr("cx", src.x + pt * dx)
      .attr("cy", src.y + pt * dy)
      .attr("opacity", fade * 0.88)
      .attr("fill", colorFor(src));
  });

  flowRafId = requestAnimationFrame(animateFlow);
}

function startFlow() {
  flowActive = true; flowT0 = null;
  document.getElementById("flow-btn").classList.add("active");
  updateFlowDots();
  flowRafId = requestAnimationFrame(animateFlow);
}

function stopFlow() {
  flowActive = false;
  if (flowRafId) { cancelAnimationFrame(flowRafId); flowRafId = null; }
  document.getElementById("flow-btn").classList.remove("active");
  gFlow.selectAll(".flow-dot").remove();
}

// ── Random walk (PageRank demo) ───────────────────────────────────────────────
let walkActive   = false;
let walkTimerId  = null;
let walkStep     = 0;
let walkCurrent  = null;          // paperId string
let walkVisits   = new Map();     // paperId → visit count
let WALK_INTERVAL_MS  = 900;    // ms between hops (overridden by settings)
const WALK_RESTART_PROB = 0.15;   // teleport-back probability (as in PageRank)
const WALK_MAX_VISITS   = 30;     // saturates colour/size at this count
const WALK_DECAY        = 0.97;   // per-step multiplicative decay of all visit counts

function walkNeighbours(id) {
  // Directed outgoing neighbours (papers this one cites)
  const ids = [];
  state.links.forEach(l => {
    const s = String(l.source?.paperId ?? l.source);
    const t = String(l.target?.paperId ?? l.target);
    if (s === id) ids.push(t);
  });
  return ids;
}

function walkColour(visits) {
  const t = Math.min(visits / WALK_MAX_VISITS, 1);
  return d3.interpolateRgb("#4f8ef7", "#f43f5e")(t);  // blue → rose
}

function walkRadius(visits, base) {
  const t = Math.min(visits / WALK_MAX_VISITS, 1);
  return base * (1 + 0.6 * t);   // up to 60% bigger
}

function applyWalkVisuals() {
  if (!walkActive) return;
  nodeSel.select("circle").each(function(d) {
    const id = String(d.paperId);
    const v  = walkVisits.get(id) || 0;
    const base = d === state.selected ? 14 : 10;
    d3.select(this)
      .attr("r",    v > 0 ? walkRadius(v, base) : base)
      .attr("fill", v > 0 ? walkColour(v) : (d === state.selected ? "var(--accent)" : "var(--node-fill)"));
  });
}

function flashEdge(fromId, toId) {
  linkSel.each(function(l) {
    const s = String(l.source?.paperId ?? l.source);
    const t = String(l.target?.paperId ?? l.target);
    if (s === fromId && t === toId) {
      d3.select(this)
        .attr("stroke", "#fbbf24").attr("stroke-width", 3)
        .transition().duration(500).ease(d3.easeCubicOut)
        .attr("stroke", "var(--link)").attr("stroke-width", 1.5);
    }
  });
}

function moveWalkerDot(x, y, fresh) {
  let dot = gFlow.select(".walk-dot");
  if (dot.empty()) {
    dot = gFlow.append("circle")
      .attr("class", "walk-dot")
      .attr("r", 9)
      .attr("fill", "#f59e0b")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("opacity", 0.92)
      .attr("pointer-events", "none");
  }
  if (fresh) {
    dot.attr("cx", x).attr("cy", y).attr("opacity", 0.92);
  } else {
    dot.transition().duration(WALK_INTERVAL_MS * 0.75).ease(d3.easeCubicInOut)
      .attr("cx", x).attr("cy", y).attr("opacity", 0.92);
  }
}

function doWalkStep() {
  if (!walkActive) return;
  const nodeIds = [...state.nodes.keys()];
  if (!nodeIds.length) return;

  const prevId = walkCurrent;

  // Decay all visit counts
  walkVisits.forEach((v, k) => walkVisits.set(k, v * WALK_DECAY));

  // Choose next node
  let nextId;
  if (!prevId || Math.random() < WALK_RESTART_PROB) {
    // Teleport to random node
    nextId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
  } else {
    const neighbours = walkNeighbours(prevId);
    if (neighbours.length) {
      nextId = neighbours[Math.floor(Math.random() * neighbours.length)];
    } else {
      // Dead-end: teleport
      nextId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    }
  }

  // Update visits
  walkVisits.set(nextId, (walkVisits.get(nextId) || 0) + 1);
  walkCurrent = nextId;
  walkStep++;

  // Flash edge if we actually followed a link
  if (prevId && prevId !== nextId) flashEdge(prevId, nextId);

  // Move walker dot
  const node = state.nodes.get(nextId);
  const fresh = !prevId;
  if (node) moveWalkerDot(node.x, node.y, fresh);

  // Delay colour/HUD update until the dot arrives at the node
  const arrivalDelay = fresh ? 0 : Math.round(WALK_INTERVAL_MS * 0.75);
  setTimeout(() => {
    if (!walkActive) return;
    document.getElementById("walk-hud-step").textContent  = `Step ${walkStep}`;
    const paper = state.nodes.get(nextId);
    document.getElementById("walk-hud-paper").textContent = paper ? paper.title : "";
    applyWalkVisuals();
  }, arrivalDelay);

  walkTimerId = setTimeout(doWalkStep, WALK_INTERVAL_MS);
}

function startWalk() {
  if (walkActive) return;
  walkActive  = true;
  walkStep    = 0;
  walkCurrent = null;
  walkVisits  = new Map();
  document.getElementById("walk-btn").classList.add("active");
  document.getElementById("walk-hud").classList.add("visible");
  doWalkStep();
}

function stopWalk() {
  walkActive = false;
  if (walkTimerId) { clearTimeout(walkTimerId); walkTimerId = null; }
  document.getElementById("walk-btn").classList.remove("active");
  document.getElementById("walk-hud").classList.remove("visible");
  gFlow.select(".walk-dot").remove();
  render(); // restores node colours/sizes
}

function bfsRipple(source) {
  // Build undirected adjacency so the ripple spreads both along and against citations
  const adj = new Map();
  state.nodes.forEach((_, id) => adj.set(id, []));
  state.links.forEach(l => {
    const s = String(l.source?.paperId ?? l.source);
    const t = String(l.target?.paperId ?? l.target);
    adj.get(s)?.push(t);
    adj.get(t)?.push(s);
  });

  const dist = new Map([[String(source.paperId), 0]]);
  const queue = [String(source.paperId)];
  while (queue.length) {
    const cur = queue.shift(), d = dist.get(cur);
    adj.get(cur)?.forEach(nb => {
      if (!dist.has(nb)) { dist.set(nb, d + 1); queue.push(nb); }
    });
  }

  dist.forEach((d, id) => {
    const node = state.nodes.get(id);
    if (!node) return;
    setTimeout(() => {
      if (!state.nodes.has(id)) return;
      gFlow.append("circle")
        .attr("cx", node.x).attr("cy", node.y)
        .attr("r", 18)
        .attr("fill", "none")
        .attr("stroke", d === 0 ? "#f59e0b" : "#93c5fd")
        .attr("stroke-width", d === 0 ? 3 : 2)
        .attr("opacity", 0.85)
        .attr("pointer-events", "none")
        .transition().duration(680).ease(d3.easeCubicOut)
          .attr("r", 44)
          .attr("stroke-width", 0.3)
          .attr("opacity", 0)
          .remove();
    }, d * 130);
  });
}

// ── Node selection ────────────────────────────────────────────────────────────
function selectNode(d) {
  state.selected = d;
  bfsRipple(d);
  render();
  showDetail(d);
  refreshBadges();
}

function showDetail(d) {
  document.getElementById("dp-title").textContent = d.title;
  document.getElementById("dp-doi").textContent   = d.doi ? `DOI: ${d.doi}` : "";
  document.getElementById("dp-year").textContent  = d.publicationYear ? `Published: ${d.publicationYear}` : "";
  const el = document.getElementById("dp-authors");
  el.innerHTML = "";
  const authors = (d.authors || []).filter(a => a?.name?.trim());
  const AUTHOR_LIMIT = 5;
  authors.slice(0, AUTHOR_LIMIT).forEach(a => {
    const s = document.createElement("span"); s.className = "tag"; s.textContent = a.name;
    el.appendChild(s);
  });
  if (authors.length > AUTHOR_LIMIT) {
    const rest = authors.slice(AUTHOR_LIMIT);
    const more = document.createElement("span");
    more.className = "tag tag-more";
    more.textContent = `+${rest.length} more`;
    more.onclick = () => {
      more.remove();
      rest.forEach(a => {
        const s = document.createElement("span"); s.className = "tag"; s.textContent = a.name;
        el.appendChild(s);
      });
    };
    el.appendChild(more);
  }
  document.getElementById("detail-panel").classList.add("visible");
  document.getElementById("dp-expand-cited").onclick = () => expandCitedBy(d.paperId);
  document.getElementById("dp-expand-citing").onclick = () => expandCiting(d.paperId);
  document.getElementById("dp-remove").onclick = () => removeNodeWithUndo(d);
  const findBtn = document.getElementById("dp-find-online");
  if (d.doi) {
    findBtn.style.display = "";
    findBtn.onclick = () => {
      const url = `https://doi.org/${d.doi}`;
      const opened = window.open(url, "_blank", "noopener");
      if (!opened) {
        navigator.clipboard.writeText(url).catch(() => {});
        showToast(`Copied: ${url}`);
      }
    };
  } else {
    findBtn.style.display = "none";
  }
}

// ── Graph manipulation ────────────────────────────────────────────────────────
function addNodeToGraph(paper, near) {
  if (state.nodes.has(String(paper.paperId))) return;
  state.nodes.set(String(paper.paperId), {
    ...paper,
    x: (near?.x ?? 0) + (Math.random() * 120 - 60),
    y: (near?.y ?? 0) + (Math.random() * 120 - 60),
  });
}

function pushLink(src, tgt) {
  const exists = state.links.some(l =>
    (l.source?.paperId ?? l.source) == src &&
    (l.target?.paperId ?? l.target) == tgt
  );
  if (!exists) state.links.push({ source: src, target: tgt });
}

function removeNode(paperId) {
  state.nodes.delete(String(paperId));
  state.links = state.links.filter(l =>
    (l.source?.paperId ?? l.source) != paperId &&
    (l.target?.paperId ?? l.target) != paperId
  );
  if (state.selected?.paperId === paperId) {
    state.selected = null;
    document.getElementById("detail-panel").classList.remove("visible");
  }
  render(); refreshBadges();
}

function removeNodeWithUndo(paper) {
  const savedLinks = state.links
    .filter(l =>
      (l.source?.paperId ?? l.source) == paper.paperId ||
      (l.target?.paperId ?? l.target) == paper.paperId
    )
    .map(l => ({
      source: l.source?.paperId ?? l.source,
      target: l.target?.paperId ?? l.target,
    }));

  // Animate sidebar item out before removing from graph (refreshBadges skips .removing)
  const itemEl = document.querySelector(`.result-item[data-id="${paper.paperId}"]`);
  if (itemEl) {
    itemEl.classList.add("removing");
    setTimeout(() => { if (itemEl.parentNode) itemEl.remove(); }, 700);
  }

  removeNode(paper.paperId);

  showToast(`Removed "${trunc(paper.title, 40)}"`, {
    ms: 5500,
    undoFn: () => {
      addNodeToGraph(paper);
      savedLinks.forEach(l => pushLink(l.source, l.target));
      render();
      // Re-insert the paper into the visible list and re-render
      const base = lastResults.length ? lastResults : [...state.nodes.values()];
      if (!base.some(p => String(p.paperId) === String(paper.paperId))) base.unshift(paper);
      setResultsList(base, { showAddAll: !!lastResults.length, updateBase: false });
    },
  });
}

function removeNodes(paperIds) {
  const ids = new Set(paperIds.map(String));
  ids.forEach(id => state.nodes.delete(id));
  state.links = state.links.filter(l =>
    !ids.has(String(l.source?.paperId ?? l.source)) &&
    !ids.has(String(l.target?.paperId ?? l.target))
  );
  if (state.selected && ids.has(String(state.selected.paperId))) {
    state.selected = null;
    document.getElementById("detail-panel").classList.remove("visible");
  }
  render();
  if (filterTabActive) refreshFilterTabView(); else refreshBadges();
}

function removeNodesAnimated(paperIds) {
  const ids = new Set(paperIds.map(String));

  // Save state for undo before animating
  const savedPapers = paperIds.map(id => state.nodes.get(String(id))).filter(Boolean);
  const savedLinks  = state.links
    .filter(l => ids.has(String(l.source?.paperId ?? l.source)) || ids.has(String(l.target?.paperId ?? l.target)))
    .map(l => ({ source: l.source?.paperId ?? l.source, target: l.target?.paperId ?? l.target }));

  document.querySelectorAll(".result-item").forEach(el => {
    if (ids.has(el.dataset.id)) el.classList.add("removing");
  });

  setTimeout(() => {
    removeNodes(paperIds);
    const n = savedPapers.length;
    showToast(`Removed ${n} paper${n !== 1 ? "s" : ""} from graph`, {
      ms: 5500,
      undoFn: () => {
        savedPapers.forEach(p => addNodeToGraph(p));
        savedLinks.forEach(l => pushLink(l.source, l.target));
        render();
        if (filterTabActive) refreshFilterTabView(); else refreshBadges();
      },
    });
  }, 700);
}

// ── API helpers ───────────────────────────────────────────────────────────────
function setStatus(msg) { document.getElementById("status-bar").textContent = msg; }
function updateStatus() {
  const n = state.nodes.size, l = state.links.length;
  setStatus(n === 0 ? "No papers loaded"
    : `${n} paper${n !== 1 ? "s" : ""} · ${l} citation${l !== 1 ? "s" : ""}`);
  const badge = document.getElementById("graph-count-badge");
  if (n > 0) { badge.textContent = n; badge.style.display = ""; }
  else { badge.style.display = "none"; }
}

async function apiFetch(url, { allow404 = false } = {}) {
  const res = await fetch(url);
  if (res.status === 404 && allow404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function loadCitationsFor(paperId) {
  try {
    const cited = await apiFetch(`/papers/${paperId}/cited-by`);
    cited.forEach(p => pushLink(paperId, p.paperId));
  } catch (_) { /* ignore fetch errors for individual citation lookups */ }
}

// ── Load sample ───────────────────────────────────────────────────────────────
async function loadSample() {
  const n = Math.max(1, Math.min(20, parseInt(document.getElementById("sample-count").value) || 20));
  document.getElementById("sample-count").value = n;
  setFilter("all");
  setStatus("Loading…");
  try {
    const papers = await apiFetch(`/papers?limit=${n}`);
    papers.forEach(p => addNodeToGraph(p));
    render();
    papers.forEach(p => { if (!allSeedPapers.some(s => s.paperId === p.paperId)) allSeedPapers.push(p); });
    setResultsList(papers, { showAddAll: true, label: `${papers.length} papers in sample` });
    filterTabActive = true;

    setStatus("Loading citation edges…");
    await Promise.allSettled(papers.map(p => loadCitationsFor(p.paperId)));
    render();
    updateStatus();
    setTimeout(fitGraph, 800);
  } catch (e) { setStatus("Error: " + e.message); }
}

// ── Search ────────────────────────────────────────────────────────────────────
async function search() {
  const type = document.getElementById("search-type").value;
  const q    = document.getElementById("search-input").value.trim();
  if (!q) {
    setResultsList([], { showAddAll: false, label: "Enter a search term above." });
    updateStatus();
    return;
  }

  setFilter("all");
  setStatus("Searching…");
  const urls = {
    title:       `/papers/title/${encodeURIComponent(q)}`,
    author:      `/papers/author/${encodeURIComponent(q)}`,
    year:        `/papers/year/${encodeURIComponent(q)}`,
    institution: `/papers/institution/${encodeURIComponent(q)}`,
  };
  try {
    const raw = await apiFetch(urls[type]);
    let papers = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    let approximate = false;

    if (!papers.length && type === "title") {
      const fuzzyRaw = await apiFetch(`/papers/fuzzy-title/${encodeURIComponent(q)}`);
      papers = Array.isArray(fuzzyRaw) ? fuzzyRaw : (fuzzyRaw ? [fuzzyRaw] : []);
      approximate = papers.length > 0;
    }

    if (!papers.length) {
      setResultsList([], { showAddAll: false, label: "No results" });
      updateStatus(); return;
    }
    const label = approximate ? `${papers.length} approximate match${papers.length !== 1 ? "es" : ""} for "${trunc(q, 30)}"` : undefined;
    setResultsList(papers, { showAddAll: true, label });
    updateStatus();
  } catch (e) {
    setStatus("Error: " + e.message);
    setResultsList([], { showAddAll: false, label: "Search failed" });
  }
}

// ── Add paper to graph (single, on click) ─────────────────────────────────────
async function addPaperAndSelect(paper) {
  // Place near graph centre in screen space
  const rect = svg.node().getBoundingClientRect();
  const [cx, cy] = d3.zoomTransform(svg.node()).invert([rect.width / 2, rect.height / 2]);
  addNodeToGraph(paper, { x: cx, y: cy });

  // Connect to papers already in the graph
  const [citedRes, citingRes] = await Promise.allSettled([
    apiFetch(`/papers/${paper.paperId}/cited-by`),
    apiFetch(`/papers/${paper.paperId}/citing`),
  ]);
  if (citedRes.status === "fulfilled")
    citedRes.value.forEach(p => { if (state.nodes.has(String(p.paperId))) pushLink(paper.paperId, p.paperId); });
  if (citingRes.status === "fulfilled")
    citingRes.value.forEach(p => { if (state.nodes.has(String(p.paperId))) pushLink(p.paperId, paper.paperId); });

  render();
  selectNode(state.nodes.get(String(paper.paperId)));
}

// ── Add all results to graph ──────────────────────────────────────────────────
async function addAllToGraph(papers) {
  const fresh = papers.filter(p => !state.nodes.has(String(p.paperId)));
  if (!fresh.length) { setStatus("All results already in graph."); return; }
  fresh.forEach(p => addNodeToGraph(p));
  render();
  setStatus("Loading citation edges…");
  await Promise.allSettled(papers.map(p => loadCitationsFor(p.paperId)));
  render(); updateStatus(); refreshBadges();
  setTimeout(fitGraph, 800);
}

// ── Results list ──────────────────────────────────────────────────────────────
function refreshFilterTabView() {
  if (currentFilter === "user") {
    // Show all user-created papers across sessions, not just those in the graph
    const papers  = allUserPapers;
    const inCount = papers.filter(p => state.nodes.has(String(p.paperId))).length;
    const label   = papers.length
      ? `${papers.length} added paper${papers.length !== 1 ? "s" : ""}${inCount < papers.length ? ` · ${inCount} in graph` : " · all in graph"}`
      : "No added papers yet";
    setResultsList(papers, { showAddAll: true, label, updateBase: false });
    return;
  }
  if (currentFilter === "seed") {
    // Show all seed papers loaded this session, not just those currently in the graph
    const papers  = allSeedPapers;
    const inCount = papers.filter(p => state.nodes.has(String(p.paperId))).length;
    const label   = papers.length
      ? `${papers.length} seed paper${papers.length !== 1 ? "s" : ""}${inCount < papers.length ? ` · ${inCount} in graph` : " · all in graph"}`
      : "No seed papers loaded yet";
    setResultsList(papers, { showAddAll: true, label, updateBase: false });
    return;
  }
  const allInGraph = [...state.nodes.values()];
  const n     = allInGraph.length;
  const label = n ? `${n} paper${n !== 1 ? "s" : ""} in graph` : "No papers in graph";
  setResultsList(allInGraph, { showAddAll: true, label, updateBase: false });
}

function setResultsList(papers, { showAddAll = true, label, updateBase = true } = {}) {
  if (updateBase) { lastResults = papers; filterTabActive = false; }

  // Show filter tabs whenever there are papers in the graph
  const filterRow = document.getElementById("filter-row");
  filterRow.style.display = state.nodes.size > 0 ? "flex" : "none";

  const panel = document.getElementById("results-panel");
  const visible = currentFilter === "all" ? papers
    : papers.filter(p => (p._source || "seed") === currentFilter);

  currentVisible = visible; // track for refreshBadges

  if (!papers.length) {
    panel.innerHTML = `<div class="empty-state">${label || "No results found."}<br>Try a different search term.</div>`;
    return;
  }
  if (!visible.length) {
    panel.innerHTML = `<div class="empty-state">No ${currentFilter === "user" ? "manually added" : "seed"} papers in this set.</div>`;
    return;
  }

  const displayCount = visible.length;
  const countLabel = label ?? (currentFilter !== "all"
    ? `${displayCount} of ${papers.length} result${papers.length !== 1 ? "s" : ""}`
    : `${displayCount} result${displayCount !== 1 ? "s" : ""}`);

  panel.innerHTML = `
    <div class="results-bar" data-show-add="${showAddAll}">
      <span class="results-count">${esc(countLabel)}</span>
      <span class="bar-btns"></span>
    </div>` +
    visible.map(p => {
      const inGraph = state.nodes.has(String(p.paperId));
      const authorStr = (p.authors || []).map(a => a.name).join(", ");
      const yearPill = p.publicationYear
        ? `<span class="year-pill">${p.publicationYear}</span>`
        : `<span class="year-pill" style="opacity:0.45">—</span>`;
      return `
        <div class="result-item${inGraph ? " in-graph" : ""}" data-id="${p.paperId}">
          <div class="result-body">
            <div class="rtitle">${esc(p.title)}</div>
            <div class="rmeta">${yearPill}${authorStr ? `<span>${esc(authorStr)}</span>` : ""}</div>
          </div>
          <span class="graph-badge ${inGraph ? "done" : "add"}"
                title="${inGraph ? "Remove from graph" : "Add to graph"}">
            ${inGraph ? "−" : "+"}
          </span>
        </div>`;
    }).join("");

  panel.querySelectorAll(".result-item").forEach(el => {
    // Badge click: add to graph (+ badge) or remove from graph with undo (✓ badge)
    el.querySelector(".graph-badge").addEventListener("click", e => {
      e.stopPropagation();
      const id = el.dataset.id;
      if (state.nodes.has(id)) {
        removeNodeWithUndo(state.nodes.get(id));
      } else {
        const paper = lastResults.find(p => String(p.paperId) === id)
          || currentVisible.find(p => String(p.paperId) === id);
        if (paper) addPaperAndSelect(paper);
      }
    });

    // Row body click: select if in graph, add if not
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      if (state.nodes.has(id)) {
        selectNode(state.nodes.get(id));
      } else {
        const paper = currentVisible.find(p => String(p.paperId) === id)
          || lastResults.find(p => String(p.paperId) === id);
        if (paper) addPaperAndSelect(paper);
      }
    });

    // Right-click: show sidebar context menu for delete
    el.addEventListener("contextmenu", e => {
      e.preventDefault();
      const paper = currentVisible.find(p => String(p.paperId) === el.dataset.id)
        || lastResults.find(p => String(p.paperId) === el.dataset.id);
      if (paper) showSidebarCtxMenu(e, paper);
    });
  });

  refreshBadges(); // populate .bar-btns based on current graph state
}

function refreshBadges() {
  document.querySelectorAll(".result-item:not(.removing)").forEach(el => {
    const inGraph = state.nodes.has(el.dataset.id);
    el.classList.toggle("in-graph", inGraph);
    const badge = el.querySelector(".graph-badge");
    if (!badge) return;
    badge.className   = `graph-badge ${inGraph ? "done" : "add"}`;
    badge.title       = inGraph ? "Remove from graph" : "Add to graph";
    badge.textContent = inGraph ? "−" : "+";
  });

  // Update the results-bar action buttons
  const resultsBar = document.querySelector(".results-bar");
  if (!resultsBar || resultsBar.dataset.showAdd !== "true") return;
  const btns = resultsBar.querySelector(".bar-btns");
  if (!btns || !currentVisible.length) return;

  const inGraph    = currentVisible.filter(p =>  state.nodes.has(String(p.paperId)));
  const notInGraph = currentVisible.filter(p => !state.nodes.has(String(p.paperId)));
  const single     = currentVisible.length === 1;

  if (notInGraph.length === currentVisible.length) {
    // None in graph — offer to add all
    btns.innerHTML = `<button class="sm secondary" id="bar-add-btn">${single ? "Add to graph" : "Add all to graph"}</button>`;
    document.getElementById("bar-add-btn").onclick = () => addAllToGraph(notInGraph);
  } else if (inGraph.length === currentVisible.length) {
    // All in graph — offer to remove all
    btns.innerHTML = `<button class="sm danger" id="bar-remove-btn">${single ? "Remove from graph" : "Remove all from graph"}</button>`;
    document.getElementById("bar-remove-btn").onclick = () => removeNodesAnimated(inGraph.map(p => p.paperId));
  } else {
    // Mixed — offer both; "Remove remaining" = remove the ones already in graph
    btns.innerHTML = `
      <button class="sm secondary" id="bar-add-btn">Add ${notInGraph.length} to graph</button>
      <button class="sm danger"    id="bar-remove-btn">Remove remaining</button>`;
    document.getElementById("bar-add-btn").onclick    = () => addAllToGraph(notInGraph);
    document.getElementById("bar-remove-btn").onclick = () => removeNodesAnimated(inGraph.map(p => p.paperId));
  }
}

// ── Expand citations ──────────────────────────────────────────────────────────
async function expandCitedBy(paperId) {
  setStatus("Loading citations…");
  try {
    const papers = await apiFetch(`/papers/${paperId}/cited-by`);
    const anchor  = state.nodes.get(String(paperId));
    papers.forEach(p => { addNodeToGraph(p, anchor); pushLink(paperId, p.paperId); });
    render(); setTimeout(fitGraph, 600);
  } catch (e) { setStatus("Error: " + e.message); }
}

async function expandCiting(paperId) {
  setStatus("Loading citing papers…");
  try {
    const papers = await apiFetch(`/papers/${paperId}/citing`);
    const anchor  = state.nodes.get(String(paperId));
    papers.forEach(p => { addNodeToGraph(p, anchor); pushLink(p.paperId, paperId); });
    render(); setTimeout(fitGraph, 600);
  } catch (e) { setStatus("Error: " + e.message); }
}

// ── Graph settings (persisted to localStorage) ────────────────────────────────
function loadGraphSettings() {
  return {
    walkSpeed: parseInt(localStorage.getItem("setting-walk-speed") || "900"),
    charge:    parseInt(localStorage.getItem("setting-charge")     || "-500"),
    linkDist:  parseInt(localStorage.getItem("setting-link-dist")  || "170"),
  };
}

function applyGraphSettings(s) {
  // Walk speed
  WALK_INTERVAL_MS = s.walkSpeed;
  // Physics
  sim.force("charge", d3.forceManyBody().strength(s.charge));
  sim.force("link").distance(s.linkDist);
  if (state.nodes.size > 0) sim.alpha(0.25).restart();
}

// ── DOI lookup via CrossRef ───────────────────────────────────────────────────
async function fetchByDOI(doi) {
  doi = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!r.ok) throw new Error(`DOI not found: ${doi}`);
  const m = (await r.json()).message;
  return {
    title:           Array.isArray(m.title) ? m.title[0] : (m.title || doi),
    publicationYear: m.published?.["date-parts"]?.[0]?.[0] || null,
    doi:             m.DOI || doi,
    authors:         (m.author || []).map(a => [a.given, a.family].filter(Boolean).join(" ")),
  };
}

// ── Post a paper to backend, return saved paper ───────────────────────────────
async function savePaper(p) {
  return fetch("/papers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title:           p.title,
      publicationYear: p.publicationYear || null,
      doi:             p.doi || null,
      authors:         (p.authors || []).map(a => typeof a === "string" ? { name: a } : a),
    }),
  }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
    .then(paper => ({ ...paper, _source: "user" }));
}

// ── Settings panel ────────────────────────────────────────────────────────────
function openSettings() {
  closeAllPanels();
  const s = loadGraphSettings();
  const walkEl   = document.getElementById("setting-walk-speed");
  const chargeEl = document.getElementById("setting-charge");
  const distEl   = document.getElementById("setting-link-dist");
  walkEl.value   = s.walkSpeed;
  chargeEl.value = s.charge;
  distEl.value   = s.linkDist;
  document.getElementById("walk-speed-val").textContent = s.walkSpeed + " ms";
  document.getElementById("charge-val").textContent     = s.charge;
  document.getElementById("link-dist-val").textContent  = s.linkDist + " px";
  document.getElementById("settings-panel").classList.add("open");
}

document.getElementById("settings-btn").onclick = () => {
  document.getElementById("settings-panel").classList.contains("open")
    ? closeAllPanels() : openSettings();
};
document.getElementById("settings-close").onclick = closeAllPanels;

// Live-update labels and apply settings as sliders move
(function () {
  const sliders = [
    { id: "setting-walk-speed", label: "walk-speed-val", key: "setting-walk-speed", suffix: " ms" },
    { id: "setting-charge",     label: "charge-val",     key: "setting-charge",     suffix: "" },
    { id: "setting-link-dist",  label: "link-dist-val",  key: "setting-link-dist",  suffix: " px" },
  ];
  sliders.forEach(({ id, label, key, suffix }) => {
    document.getElementById(id).addEventListener("input", function () {
      document.getElementById(label).textContent = this.value + suffix;
      localStorage.setItem(key, this.value);
      applyGraphSettings(loadGraphSettings());
    });
  });
})();

document.getElementById("settings-clear-user").onclick = () => {
  if (!confirm("Remove all manually added papers from local storage? This cannot be undone.")) return;
  localStorage.removeItem("user-papers");
  allUserPapers = [];
  showToast("Saved papers cleared.");
  if (filterTabActive) refreshFilterTabView();
};

// ── New paper form ────────────────────────────────────────────────────────────
function closeAllPanels() {
  ["settings-panel", "add-paper-form", "bulk-panel"].forEach(id =>
    document.getElementById(id).classList.remove("open"));
}

document.getElementById("new-paper-btn").onclick = () => {
  const isOpen = document.getElementById("add-paper-form").classList.contains("open");
  closeAllPanels();
  if (!isOpen) document.getElementById("add-paper-form").classList.add("open");
};
document.getElementById("np-cancel").onclick = () => {
  document.getElementById("add-paper-form").classList.remove("open");
  document.getElementById("new-paper-form").reset();
};

document.getElementById("new-paper-form").addEventListener("submit", async e => {
  e.preventDefault();
  const title   = document.getElementById("np-title").value.trim();
  const year    = document.getElementById("np-year").value;
  const doi     = document.getElementById("np-doi").value.trim();
  const raw     = document.getElementById("np-authors").value.trim();
  const authors = raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : [];
  try {
    const paper = await savePaper({ title, publicationYear: year ? parseInt(year) : null, doi, authors });
    allUserPapers.push(paper);
    saveUserPaperToStorage(paper);
    document.getElementById("add-paper-form").classList.remove("open");
    document.getElementById("new-paper-form").reset();
    setResultsList([paper], { showAddAll: true, label: "1 new paper" });
    setStatus(`Created: "${paper.title}"`);
  } catch (err) { setStatus("Save failed: " + err.message); }
});

// ── Bulk import panel ─────────────────────────────────────────────────────────
document.getElementById("bulk-btn").onclick = () => {
  const isOpen = document.getElementById("bulk-panel").classList.contains("open");
  closeAllPanels();
  if (!isOpen) document.getElementById("bulk-panel").classList.add("open");
};
document.getElementById("bulk-cancel").onclick = () => { resetBulkPreview(); closeAllPanels(); };

// ── Bulk preview step ─────────────────────────────────────────────────────────
function updateBulkAddBtn() {
  const n = document.querySelectorAll("#bulk-preview input[type=checkbox]:checked").length;
  const btn = document.getElementById("bulk-add-btn");
  btn.textContent = `Add ${n} paper${n !== 1 ? "s" : ""} to system`;
  btn.disabled = n === 0;
}

function showBulkPreview(results) {
  // results = [{paper, ok: true} | {doi/text, ok: false, error}]
  pendingBulk = results;
  const previewEl  = document.getElementById("bulk-preview");
  const confirmRow = document.getElementById("bulk-confirm-row");
  const statusEl   = document.getElementById("bulk-status");

  const good = results.filter(r => r.ok);
  const bad  = results.filter(r => !r.ok);
  statusEl.textContent = `${good.length} ready to add${bad.length ? `, ${bad.length} failed` : ""}.`;

  previewEl.innerHTML = "";
  previewEl.classList.add("visible");

  results.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "bulk-preview-item" + (r.ok ? "" : " error");
    if (r.ok) {
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = true; cb.dataset.idx = i;
      cb.addEventListener("change", updateBulkAddBtn);
      const info = document.createElement("div");
      info.style.flex = "1";
      info.innerHTML = `<div class="bpi-title">${esc(r.paper.title)}</div>
        <div class="bpi-meta">${r.paper.publicationYear || "—"}${r.paper.doi ? " · " + esc(r.paper.doi) : ""}</div>`;
      div.append(cb, info);
    } else {
      div.innerHTML = `<div class="bpi-title">${esc(r.label || "Unknown")}</div>
        <div class="bpi-meta" style="color:#e57373">${esc(r.error)}</div>`;
    }
    previewEl.appendChild(div);
  });

  if (good.length) {
    confirmRow.style.display = "flex";
    updateBulkAddBtn();
  }
}

function resetBulkPreview() {
  pendingBulk = [];
  document.getElementById("bulk-preview").innerHTML = "";
  document.getElementById("bulk-preview").classList.remove("visible");
  document.getElementById("bulk-confirm-row").style.display = "none";
  document.getElementById("bulk-status").textContent = "";
}

document.getElementById("bulk-add-btn").onclick = async () => {
  const checked = [...document.querySelectorAll("#bulk-preview input[type=checkbox]:checked")]
    .map(cb => pendingBulk[parseInt(cb.dataset.idx)]?.paper).filter(Boolean);
  if (!checked.length) return;
  const btn = document.getElementById("bulk-add-btn");
  btn.textContent = "Saving…"; btn.disabled = true;
  let ok = 0, fail = 0;
  const saved = [];
  for (const p of checked) {
    try {
      const sp = await savePaper(p);
      saved.push(sp);
      if (!allUserPapers.some(existing => existing.paperId === sp.paperId)) {
        allUserPapers.push(sp);
      }
      saveUserPaperToStorage(sp);
      ok++;
    }
    catch (_) { fail++; }
  }
  document.getElementById("bulk-status").textContent = `Done: ${ok} added${fail ? `, ${fail} failed` : ""}.`;
  resetBulkPreview();
  if (saved.length) {
    setResultsList(saved, { showAddAll: true, label: `${saved.length} imported paper${saved.length !== 1 ? "s" : ""}` });
    setStatus(`Imported ${ok} paper${ok !== 1 ? "s" : ""}.`);
  }
  btn.textContent = "Add to system"; btn.disabled = false;
};

document.getElementById("bulk-discard-btn").onclick = () => {
  resetBulkPreview();
  document.getElementById("bulk-doi-input").value = "";
};

document.getElementById("bulk-doi-btn").onclick = async () => {
  const lines = document.getElementById("bulk-doi-input").value
    .split("\n").map(s => s.trim()).filter(Boolean);
  if (!lines.length) return;
  const btn = document.getElementById("bulk-doi-btn");
  btn.textContent = "Fetching…"; btn.disabled = true;
  resetBulkPreview();
  try {
    const settled = await Promise.allSettled(lines.map(fetchByDOI));
    const results = settled.map((r, i) => r.status === "fulfilled"
      ? { ok: true,  paper: r.value }
      : { ok: false, label: lines[i], error: r.reason?.message || "Not found" });
    showBulkPreview(results);
  } catch (e) {
    document.getElementById("bulk-status").textContent = "Error: " + e.message;
  } finally { btn.textContent = "Fetch by DOI (CrossRef)"; btn.disabled = false; }
};

// ── Theme toggle ──────────────────────────────────────────────────────────────
const SVG_SUN = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const SVG_MOON = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  document.getElementById("theme-btn").innerHTML = t === "dark" ? SVG_SUN : SVG_MOON;
  localStorage.setItem("theme", t);
}
document.getElementById("theme-btn").onclick = () => {
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
};
applyTheme(localStorage.getItem("theme") || "dark");

// ── Sidebar collapse ──────────────────────────────────────────────────────────
(function () {
  const sidebar = document.getElementById("sidebar");
  const btn     = document.getElementById("sidebar-collapse-btn");
  let savedWidth = null;

  function setSidebarCollapsed(collapsed) {
    if (collapsed) {
      savedWidth = sidebar.style.width || null;
      sidebar.classList.add("collapsed");
      btn.textContent = "›";
      btn.title = "Show sidebar";
    } else {
      sidebar.classList.remove("collapsed");
      if (savedWidth) { sidebar.style.width = savedWidth; sidebar.style.minWidth = savedWidth; }
      btn.textContent = "‹";
      btn.title = "Hide sidebar";
    }
    setTimeout(centreSimulation, 240);
  }

  btn.addEventListener("click", e => {
    e.stopPropagation();
    setSidebarCollapsed(!sidebar.classList.contains("collapsed"));
  });
})();

// ── Sidebar resize ────────────────────────────────────────────────────────────
(function () {
  const handle  = document.getElementById("sidebar-resize");
  const sidebar = document.getElementById("sidebar");
  let dragging = false, startX = 0, startW = 0;

  handle.addEventListener("mousedown", e => {
    if (e.target.id === "sidebar-collapse-btn") return; // let the button handle its own clicks
    if (sidebar.classList.contains("collapsed")) return; // don't drag when collapsed
    dragging = true;
    startX   = e.clientX;
    startW   = sidebar.getBoundingClientRect().width;
    handle.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const w = Math.min(Math.max(startW + (e.clientX - startX), 220), 620);
    sidebar.style.width    = w + "px";
    sidebar.style.minWidth = w + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    centreSimulation();
  });
})();

// ── Zoom & fit ────────────────────────────────────────────────────────────────
document.getElementById("zoom-in-btn").onclick  = () => svg.transition().call(zoom.scaleBy, 1.4);
document.getElementById("zoom-out-btn").onclick = () => svg.transition().call(zoom.scaleBy, 0.7);
document.getElementById("fit-btn").onclick = fitGraph;
document.getElementById("flow-btn").onclick  = () => flowActive  ? stopFlow()  : startFlow();
document.getElementById("walk-btn").onclick  = () => walkActive  ? stopWalk()  : startWalk();

function fitGraph() {
  const { width, height } = svg.node().getBoundingClientRect();
  const nodes = [...state.nodes.values()];
  if (!nodes.length) return;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const s = Math.min(width / (x1 - x0 + 150), height / (y1 - y0 + 150), 2);
  svg.transition().duration(480)
    .call(zoom.transform, d3.zoomIdentity
      .translate(width / 2 - s * (x0 + x1) / 2, height / 2 - s * (y0 + y1) / 2)
      .scale(s));
}

// ── Drag (with hold-to-draw-citation) ─────────────────────────────────────────
function dragstarted(e, d) {
  holdMoved = false;
  holdStartX = e.sourceEvent.clientX;
  holdStartY = e.sourceEvent.clientY;
  window.addEventListener("pointermove", onHoldMove);

  holdTimer = setTimeout(() => {
    if (!holdMoved) {
      edgeDraw = { src: d };
      svg.classed("edge-drawing", true);
      nodeSel.classed("edge-src", nd => nd.paperId === d.paperId);
      draftLine.attr("x1", d.x).attr("y1", d.y).attr("x2", d.x).attr("y2", d.y)
               .style("display", null);
      d.fx = null; d.fy = null;
      // Cool the simulation so other nodes stop drifting while drawing
      sim.alphaTarget(0);
    }
  }, 400);

  if (!e.active) sim.alphaTarget(0.3).restart();
  d.fx = d.x; d.fy = d.y;
}

function dragged(e, d) {
  if (edgeDraw) {
    draftLine.attr("x2", e.x).attr("y2", e.y);
  } else {
    d.fx = e.x; d.fy = e.y;
    if (tipEl.classList.contains("visible")) moveTip(e.sourceEvent);
  }
}

function dragended(e, d) {
  clearTimeout(holdTimer);
  window.removeEventListener("pointermove", onHoldMove);
  if (!e.active) sim.alphaTarget(0);

  if (edgeDraw) {
    const srcPaperId = edgeDraw.src.paperId;
    const target = findNodeUnderCursor(e.sourceEvent);
    edgeDraw = null;
    draftLine.style("display", "none");
    svg.classed("edge-drawing", false);
    nodeSel.classed("edge-src", false).classed("edge-target", false);
    d.fx = null; d.fy = null;
    if (target && target.paperId !== srcPaperId) createCitation(srcPaperId, target.paperId);
  } else {
    d.fx = null; d.fy = null;
  }
}

function findNodeUnderCursor(event) {
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const g = el?.closest(".node");
  return g ? d3.select(g).datum() : null;
}

async function createCitation(citingId, citedId) {
  try {
    await fetch(`/papers/${citingId}/cites/${citedId}`, { method: "POST" });
    pushLink(citingId, citedId);
    render();
    showToast("Citation link added");
  } catch (_) {
    showToast("Failed to save citation");
  }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function showTip(event, d) {
  const authors = (d.authors || []).map(a => a.name).join(", ");
  tipEl.innerHTML = `<strong>${esc(d.title)}</strong>`
    + (authors        ? `<br><small>${esc(authors)}</small>` : "")
    + (d.publicationYear ? `<br><small>${d.publicationYear}</small>` : "");
  tipEl.classList.add("visible");
  moveTip(event);
}
function hideTip() { tipEl.classList.remove("visible"); }
svg.node().addEventListener("mousemove", e => {
  if (tipEl.classList.contains("visible")) moveTip(e);
  if (edgeDraw?.persistent) {
    const t = d3.zoomTransform(svg.node());
    const rect = svg.node().getBoundingClientRect();
    const [sx, sy] = t.invert([e.clientX - rect.left, e.clientY - rect.top]);
    draftLine.attr("x2", sx).attr("y2", sy);
  }
});
svg.node().addEventListener("click", e => {
  if (edgeDraw?.persistent && !e.target.closest(".node")) cancelEdgeDraw();
});
function moveTip(e) {
  const r = document.getElementById("graph-area").getBoundingClientRect();
  let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
  if (x + 240 > r.width) x -= 256;
  tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
}

// ── Simulation centre on resize ───────────────────────────────────────────────
function centreSimulation() {
  const { width, height } = svg.node().getBoundingClientRect();
  sim.force("center", d3.forceCenter(width / 2, height / 2));
}
new ResizeObserver(centreSimulation).observe(svg.node());
centreSimulation();

// ── Wire up remaining controls ────────────────────────────────────────────────
document.getElementById("search-btn").onclick = search;
document.getElementById("search-input").addEventListener("keydown", e => { if (e.key === "Enter") search(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (edgeDraw) { cancelEdgeDraw(); return; }
    document.getElementById("help-overlay").classList.remove("visible");
    hideContextMenu();
    return;
  }
  // "/" focuses the search input (unless already typing in an input)
  if (e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) {
    e.preventDefault();
    const inp = document.getElementById("search-input");
    inp.focus();
    inp.select();
  }
});
document.getElementById("dp-close").onclick = () => {
  document.getElementById("detail-panel").classList.remove("visible");
  state.selected = null;
  render();
};
document.getElementById("load-sample-btn").onclick = loadSample;
// Empty-state quick-action buttons
document.getElementById("es-load-btn").onclick   = loadSample;
document.getElementById("es-search-btn").onclick = () => {
  document.getElementById("search-input").focus();
  document.getElementById("search-input").select();
};
document.getElementById("clear-btn").onclick = () => {
  state.nodes.clear(); state.links.length = 0; state.selected = null;
  document.getElementById("detail-panel").classList.remove("visible");
  document.getElementById("results-panel").innerHTML = `
    <div class="empty-state">
      <svg class="empty-state-graph" viewBox="0 0 72 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <line x1="36" y1="26" x2="12" y2="14" stroke="var(--border2)" stroke-width="1.5"/>
        <line x1="36" y1="26" x2="60" y2="14" stroke="var(--border2)" stroke-width="1.5"/>
        <line x1="36" y1="26" x2="20" y2="44" stroke="var(--border2)" stroke-width="1.5"/>
        <line x1="36" y1="26" x2="56" y2="42" stroke="var(--border2)" stroke-width="1.5"/>
        <circle cx="36" cy="26" r="8" fill="var(--accent)" opacity="0.85"/>
        <circle cx="12" cy="14" r="5" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1.5"/>
        <circle cx="60" cy="14" r="5" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1.5"/>
        <circle cx="20" cy="44" r="4" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1.5"/>
        <circle cx="56" cy="42" r="4" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1.5"/>
      </svg>
      <div><strong>Graph cleared.</strong><br>Search for papers or press <strong>Load</strong> to continue.</div>
    </div>`;
  render();
};

// ── Source filter tabs ────────────────────────────────────────────────────────
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    setFilter(btn.dataset.filter);
    filterTabActive = true;
    refreshFilterTabView();
  });
});

// Apply persisted graph settings on load
applyGraphSettings(loadGraphSettings());

// ── Help modal ────────────────────────────────────────────────────────────────
document.getElementById("help-btn").onclick = () =>
  document.getElementById("help-overlay").classList.toggle("visible");
document.getElementById("help-close").onclick = () =>
  document.getElementById("help-overlay").classList.remove("visible");
document.getElementById("help-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("help-overlay"))
    document.getElementById("help-overlay").classList.remove("visible");
});

// ── Node context menu ─────────────────────────────────────────────────────────
let ctxTarget = null;

function showContextMenu(event, d) {
  ctxTarget = d;
  selectNode(d);
  document.getElementById("node-ctx-menu").classList.add("visible");
  repositionContextMenu();
}

function hideContextMenu() {
  document.getElementById("node-ctx-menu").classList.remove("visible");
  ctxTarget = null;
}

document.getElementById("ctx-cited-by").onclick = () => {
  if (ctxTarget) { expandCitedBy(ctxTarget.paperId); hideContextMenu(); }
};
document.getElementById("ctx-citing").onclick = () => {
  if (ctxTarget) { expandCiting(ctxTarget.paperId); hideContextMenu(); }
};
document.getElementById("ctx-remove").onclick = () => {
  if (ctxTarget) { const t = ctxTarget; hideContextMenu(); removeNodeWithUndo(t); }
};
document.addEventListener("click", e => {
  if (!document.getElementById("node-ctx-menu").contains(e.target)) hideContextMenu();
  if (!document.getElementById("sidebar-ctx-menu").contains(e.target)) hideSidebarCtxMenu();
});

// ── Sidebar context menu ──────────────────────────────────────────────────────
let sidebarCtxPaper = null;

function showSidebarCtxMenu(event, paper) {
  hideContextMenu();
  sidebarCtxPaper = paper;
  const menu = document.getElementById("sidebar-ctx-menu");
  menu.classList.add("visible");
  let left = event.clientX + 4, top = event.clientY + 4;
  const mw = menu.offsetWidth || 180, mh = menu.offsetHeight || 40;
  if (left + mw > window.innerWidth)  left = event.clientX - mw - 4;
  if (top  + mh > window.innerHeight) top  = event.clientY - mh - 4;
  menu.style.left = left + "px";
  menu.style.top  = top  + "px";
}

function hideSidebarCtxMenu() {
  document.getElementById("sidebar-ctx-menu").classList.remove("visible");
  document.getElementById("sctx-default").style.display = "block";
  document.getElementById("sctx-confirm-state").style.display = "none";
  sidebarCtxPaper = null;
}

async function deletePaperFromDB(paper) {
  try {
    const res = await fetch(`/papers/${paper.paperId}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(res.statusText);
    // Remove from graph silently (no undo — permanent delete)
    if (state.nodes.has(String(paper.paperId))) removeNodes([paper.paperId]);
    // Remove from user papers storage
    allUserPapers = allUserPapers.filter(p => String(p.paperId) !== String(paper.paperId));
    const stored = loadUserPapersFromStorage().filter(p => String(p.paperId) !== String(paper.paperId));
    localStorage.setItem("user-papers", JSON.stringify(stored));
    // Animate sidebar item out
    const el = document.querySelector(`.result-item[data-id="${paper.paperId}"]`);
    if (el) { el.classList.add("removing"); setTimeout(() => el.remove(), 700); }
    currentVisible = currentVisible.filter(p => String(p.paperId) !== String(paper.paperId));
    showToast(`Deleted "${trunc(paper.title, 40)}" from database`);
    if (filterTabActive) setTimeout(refreshFilterTabView, 750);
  } catch (e) {
    showToast("Delete failed: " + e.message);
  }
}

document.getElementById("sctx-delete").onclick = () => {
  document.getElementById("sctx-default").style.display = "none";
  document.getElementById("sctx-confirm-state").style.display = "block";
};
document.getElementById("sctx-confirm").onclick = () => {
  if (sidebarCtxPaper) { const p = sidebarCtxPaper; hideSidebarCtxMenu(); deletePaperFromDB(p); }
};
document.getElementById("sctx-cancel").onclick = () => hideSidebarCtxMenu();

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, { ms = 3200, undoFn = null } = {}) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }

  el.innerHTML = "";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.gap = "10px";
  el.style.overflow = "visible";
  el.style.whiteSpace = "normal";

  const text = document.createElement("span");
  text.textContent = msg;
  text.style.flex = "1 1 auto";
  text.style.minWidth = "0";
  text.style.overflow = "hidden";
  text.style.textOverflow = "ellipsis";
  text.style.whiteSpace = "nowrap";
  el.appendChild(text);

  if (undoFn) {
    const actions = document.createElement("span");
    actions.style.flex = "0 0 auto";

    const btn = document.createElement("button");
    btn.textContent = "Undo";
    btn.style.cssText = "padding:1px 8px;font-size:0.72rem;background:var(--surface2);border:1px solid var(--border2);color:var(--accent-text);border-radius:4px;cursor:pointer";
    btn.onclick = () => { clearTimeout(el._t); el.classList.remove("visible"); undoFn(); };

    actions.appendChild(btn);
    el.appendChild(actions);
  }
  el.classList.add("visible");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("visible"), ms);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : (s || ""); }
function esc(s) {
  return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
                  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
