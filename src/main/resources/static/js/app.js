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

// ── Workspace management ──────────────────────────────────────────────────────
// Two isolated workspaces: "playground" (seed/sample data) and "mine" (real research).
// Each stores a full snapshot of the graph + sidebar state.
const _wsStore = {
  playground: { nodes: new Map(), links: [], selected: null, lastResults: [], filterTabActive: false, currentFilter: "all", seedPapers: [] },
  mine:       { nodes: new Map(), links: [], selected: null, lastResults: [], filterTabActive: false, currentFilter: "all", seedPapers: [] },
};
let activeWorkspace = localStorage.getItem("active-workspace") || "playground";

function _saveWorkspace(ws) {
  _wsStore[ws].nodes          = new Map(state.nodes);
  _wsStore[ws].links          = state.links.map(l => ({ source: l.source?.paperId ?? l.source, target: l.target?.paperId ?? l.target }));
  _wsStore[ws].selected       = state.selected;
  _wsStore[ws].lastResults    = [...lastResults];
  _wsStore[ws].filterTabActive = filterTabActive;
  _wsStore[ws].currentFilter  = currentFilter;
  _wsStore[ws].seedPapers     = [...allSeedPapers];
}

function _restoreWorkspace(ws) {
  const w = _wsStore[ws];
  state.nodes   = new Map(w.nodes);
  state.links   = w.links.slice();
  state.selected = w.selected;
  lastResults   = [...w.lastResults];
  filterTabActive = w.filterTabActive;
  allSeedPapers = [...w.seedPapers];
  // "seed" filter only valid in playground
  setFilter(ws === "mine" && w.currentFilter === "seed" ? "all" : w.currentFilter);
}

function _updateWorkspaceUI() {
  const isPlay = activeWorkspace === "playground";
  // Tab active states
  document.querySelectorAll(".ws-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.ws === activeWorkspace));
  // Tab aria-selected
  document.getElementById("ws-playground").setAttribute("aria-selected", isPlay ? "true" : "false");
  document.getElementById("ws-mine").setAttribute("aria-selected", isPlay ? "false" : "true");
  // Sidebar data attribute drives CSS (amber tint + badge)
  document.getElementById("sidebar").dataset.workspace = activeWorkspace;
  // Load-sample group only in playground
  document.getElementById("load-sample-group").style.display = isPlay ? "" : "none";
  // "Seed" filter tab only meaningful in playground
  const seedTab = document.querySelector(".filter-btn[data-filter='seed']");
  if (seedTab) seedTab.style.display = isPlay ? "" : "none";
  // Close open cpanels so they don't bleed between workspaces
  ["add-paper-form", "bulk-panel", "settings-panel"].forEach(id =>
    document.getElementById(id)?.classList.remove("open"));
  // Detail panel belongs to whichever node is currently selected
  if (!state.selected) document.getElementById("detail-panel").classList.remove("visible");
  clearAnchorChip();
}

function switchWorkspace(name) {
  if (name === activeWorkspace) return;
  _saveWorkspace(activeWorkspace);
  activeWorkspace = name;
  localStorage.setItem("active-workspace", name);
  _restoreWorkspace(name);
  _updateWorkspaceUI();
  render();
  updateStatus();
  // Restore the sidebar results panel
  if (filterTabActive) {
    refreshFilterTabView();
  } else if (lastResults.length) {
    setResultsList(lastResults, { showAddAll: true, updateBase: false });
  } else {
    _showWorkspaceEmptyState();
  }
}

function _showWorkspaceEmptyState() {
  const isPlay = activeWorkspace === "playground";
  const panel = document.getElementById("results-panel");
  panel.innerHTML = `
    <div class="empty-state">
      <svg class="empty-state-graph" viewBox="0 0 72 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <line x1="36" y1="26" x2="12" y2="14" stroke="var(--border2)" stroke-width="1.5"/>
        <line x1="36" y1="26" x2="60" y2="14" stroke="var(--border2)" stroke-width="1.5"/>
        <line x1="36" y1="26" x2="20" y2="44" stroke="var(--border2)" stroke-width="1.5"/>
        <line x1="36" y1="26" x2="56" y2="42" stroke="var(--border2)" stroke-width="1.5"/>
        <line x1="12" y1="14" x2="60" y2="14" stroke="var(--border2)" stroke-width="1" stroke-dasharray="3 2"/>
        <circle cx="36" cy="26" r="8" fill="${isPlay ? "#f59e0b" : "var(--accent)"}" opacity="0.85"/>
        <circle cx="12" cy="14" r="5" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1.5"/>
        <circle cx="60" cy="14" r="5" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1.5"/>
        <circle cx="20" cy="44" r="4" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1.5"/>
        <circle cx="56" cy="42" r="4" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1.5"/>
      </svg>
      <div>
        ${isPlay
          ? `<strong>Playground</strong><br>Load sample papers to explore the graph — none of this affects your research.`
          : `<strong>My Research</strong><br>Add your own papers via <strong>Bulk</strong> import, <strong>+ New</strong>, or search above.`}
      </div>
      ${isPlay
        ? `<div class="empty-state-actions"><button class="sm" id="es-load-btn">Load sample</button><button class="sm secondary" id="es-search-btn">Search papers</button></div>`
        : `<div class="empty-state-actions"><button class="sm" id="es-search-btn">Search papers</button><button class="sm secondary" id="es-bulk-btn">Bulk import</button></div>`}
      <div class="empty-state-hint">Press <kbd style="background:var(--surface2);border:1px solid var(--border2);border-radius:3px;padding:0 4px;font-size:0.65rem">/</kbd> to focus search</div>
    </div>`;
  // Wire quick-action buttons
  document.getElementById("es-load-btn")?.addEventListener("click", loadSample);
  document.getElementById("es-search-btn")?.addEventListener("click", () => {
    document.getElementById("search-input").focus();
    document.getElementById("search-input").select();
  });
  document.getElementById("es-bulk-btn")?.addEventListener("click", () => {
    document.getElementById("bulk-panel").classList.toggle("open");
  });
}

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

// ── Anchor chip (expand-results back button) ──────────────────────────────────
let _expandAnchorNode = null;      // node whose detail panel was hidden for expansion
let _expandAnchorDir  = null;      // "cited-by" | "citing"

/** Re-create the anchor chip at the top of results-panel (called after panel HTML rebuild). */
function _injectAnchorChip() {
  if (!_expandAnchorNode) return;
  const dirLabel = _expandAnchorDir === "cited-by" ? "References of" : "Cited by";
  const node = _expandAnchorNode;

  const chip = document.createElement("button");
  chip.id = "anchor-chip";
  chip.className = "anchor-chip";
  chip.setAttribute("aria-label", "Back to paper detail");
  chip.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
    <span class="anchor-chip-dir">${dirLabel}:</span>
    <span class="anchor-chip-title">${esc(trunc(node.title, 36))}</span>`;

  chip.onclick = () => {
    clearAnchorChip();
    selectNode(node);
  };

  const panel = document.getElementById("results-panel");
  panel.insertBefore(chip, panel.firstChild);
}

function showAnchorChip(node, direction) {
  _expandAnchorNode = node;
  _expandAnchorDir  = direction;
  document.getElementById("detail-panel").classList.remove("visible");
  // Remove any stale chip then re-inject
  document.getElementById("anchor-chip")?.remove();
  _injectAnchorChip();
}

function clearAnchorChip() {
  document.getElementById("anchor-chip")?.remove();
  _expandAnchorNode = null;
  _expandAnchorDir  = null;
}

// ── Node selection ────────────────────────────────────────────────────────────
function selectNode(d) {
  state.selected = d;
  bfsRipple(d);
  render();
  clearAnchorChip();
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

  // Animate out, then remove from DOM so no ghost elements remain
  document.querySelectorAll(".result-item").forEach(el => {
    if (ids.has(el.dataset.id)) {
      el.classList.add("removing");
      setTimeout(() => { if (el.parentNode) el.remove(); }, 600);
    }
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
        updateStatus();
        // Rebuild the sidebar list so the restored papers reappear
        if (filterTabActive) {
          refreshFilterTabView();
        } else {
          const base = lastResults.length ? lastResults : [...state.nodes.values()];
          setResultsList(base, { showAddAll: !!lastResults.length, updateBase: false });
        }
      },
    });
  }, 650);
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

  // 1 — Connect to papers already in the graph via local DB
  const isS2 = String(paper.paperId).startsWith("s2:");
  if (!isS2) {
    const [citedRes, citingRes] = await Promise.allSettled([
      apiFetch(`/papers/${paper.paperId}/cited-by`),
      apiFetch(`/papers/${paper.paperId}/citing`),
    ]);
    if (citedRes.status === "fulfilled")
      citedRes.value.forEach(p => { if (state.nodes.has(String(p.paperId))) pushLink(paper.paperId, p.paperId); });
    if (citingRes.status === "fulfilled")
      citingRes.value.forEach(p => { if (state.nodes.has(String(p.paperId))) pushLink(p.paperId, paper.paperId); });
  }

  render();
  selectNode(state.nodes.get(String(paper.paperId)));

  // 2 — Fire-and-forget: auto-connect to existing graph nodes via Semantic Scholar
  //     Only adds EDGES to already-in-graph nodes; never adds new nodes here.
  if ((paper.doi || paper._s2Id) && state.nodes.size > 1) {
    const node = state.nodes.get(String(paper.paperId));
    if (!node) return;
    resolveS2Id(node)
      .then(s2Id => {
        if (!s2Id) return;
        return Promise.allSettled([s2GetReferences(s2Id), s2GetCitations(s2Id)])
          .then(([refsRes, citesRes]) => {
            let changed = false;
            if (refsRes.status === "fulfilled") {
              refsRes.value.forEach(p => {
                if (!p) return;
                const target = (p.doi && findNodeByDOI(p.doi)) ||
                               (state.nodes.has(p.paperId) ? state.nodes.get(p.paperId) : null);
                if (target && target.paperId !== paper.paperId) {
                  pushLink(paper.paperId, target.paperId); changed = true;
                }
              });
            }
            if (citesRes.status === "fulfilled") {
              citesRes.value.forEach(p => {
                if (!p) return;
                const source = (p.doi && findNodeByDOI(p.doi)) ||
                               (state.nodes.has(p.paperId) ? state.nodes.get(p.paperId) : null);
                if (source && source.paperId !== paper.paperId) {
                  pushLink(source.paperId, paper.paperId); changed = true;
                }
              });
            }
            if (changed) { render(); updateStatus(); }
          });
      })
      .catch(() => {}); // silent — S2 is optional
  }
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
  if (!allInGraph.length) {
    // Graph is empty — show workspace-aware empty state (same as after Clear).
    // The undo toast remains visible if this was triggered by "Remove all".
    filterTabActive = false;
    _showWorkspaceEmptyState();
    return;
  }
  const n     = allInGraph.length;
  const label = `${n} paper${n !== 1 ? "s" : ""} in graph`;
  setResultsList(allInGraph, { showAddAll: true, label, updateBase: false });
}

function setResultsList(papers, { showAddAll = true, label, updateBase = true } = {}) {
  if (updateBase) { lastResults = papers; filterTabActive = false; clearAnchorChip(); }

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
  _injectAnchorChip(); // re-add back chip if an expand is active
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
    btns.innerHTML = `<button class="sm secondary" id="bar-add-btn">
      ${single ? "Add to graph" : `Add all ${notInGraph.length} to graph`}
    </button>`;
    document.getElementById("bar-add-btn").onclick = () => addAllToGraph(notInGraph);
  } else if (inGraph.length === currentVisible.length) {
    // All in graph — offer to remove all
    btns.innerHTML = `<button class="sm bar-remove-btn" id="bar-remove-btn"
        title="Remove ${inGraph.length === 1 ? "this paper" : `all ${inGraph.length} papers`} from graph (undoable)">
      ${single ? "Remove from graph" : `Remove all ${inGraph.length} from graph`}
    </button>`;
    document.getElementById("bar-remove-btn").onclick = () => removeNodesAnimated(inGraph.map(p => p.paperId));
  } else {
    // Mixed — add unloaded ones + remove loaded ones
    btns.innerHTML = `
      <button class="sm secondary" id="bar-add-btn">Add ${notInGraph.length} to graph</button>
      <button class="sm bar-remove-btn" id="bar-remove-btn"
          title="Remove ${inGraph.length} paper${inGraph.length !== 1 ? "s" : ""} already in graph (undoable)">
        Remove ${inGraph.length} from graph
      </button>`;
    document.getElementById("bar-add-btn").onclick    = () => addAllToGraph(notInGraph);
    document.getElementById("bar-remove-btn").onclick = () => removeNodesAnimated(inGraph.map(p => p.paperId));
  }
}

// ── Merge local-DB and S2 paper lists, deduplicating by DOI ──────────────────
function mergePaperLists(dbPapers, s2Papers) {
  const merged = [...dbPapers];
  const doiSeen = new Set(dbPapers.filter(p => p.doi).map(p => p.doi.toLowerCase()));
  const idSeen  = new Set(dbPapers.map(p => String(p.paperId)));
  for (const p of s2Papers) {
    if (!p) continue;
    if (p.doi && doiSeen.has(p.doi.toLowerCase())) continue;
    if (idSeen.has(String(p.paperId))) continue;
    merged.push(p);
    doiSeen.add(p.doi?.toLowerCase());
    idSeen.add(String(p.paperId));
  }
  return merged;
}

// ── Expand citations — shows suggestions in sidebar rather than adding directly
async function expandCitedBy(paperId) {
  const anchor = state.nodes.get(String(paperId));
  const isS2   = String(paperId).startsWith("s2:");
  setStatus("Searching citations…");

  // 1 — Local DB (skip for pure S2 nodes)
  let dbPapers = [];
  if (!isS2) {
    try { dbPapers = await apiFetch(`/papers/${paperId}/cited-by`); }
    catch (_) {}
  }

  // 2 — Semantic Scholar
  let s2Papers = [], s2Status = null;
  if (anchor) {
    try {
      const s2Id = await resolveS2Id(anchor);
      if (s2Id) {
        setStatus("Checking Semantic Scholar…");
        s2Papers = await s2GetReferences(s2Id);
      } else {
        s2Status = "not found on Semantic Scholar";
      }
    } catch (e) {
      s2Status = e.message.includes("404") ? "not found on Semantic Scholar"
               : "Semantic Scholar unreachable";
    }
  }

  // 3 — Merge and show as sidebar suggestions
  const merged = mergePaperLists(dbPapers, s2Papers);
  updateStatus();

  if (!merged.length) {
    const msg = s2Status
      ? `No citations found (${s2Status}).`
      : "No citations found in database or Semantic Scholar.";
    showToast(msg, { ms: 4000 });
    setStatus(msg);
    return;
  }

  const sourceNote = s2Status  ? ` · ${s2Status}`
    : s2Papers.length ? ` · ${s2Papers.length} from Semantic Scholar`
    : "";
  const label = `${merged.length} paper${merged.length !== 1 ? "s" : ""} cited by "${trunc(anchor?.title ?? "", 28)}"${sourceNote}`;
  setResultsList(merged, { showAddAll: true, label, updateBase: true });
  filterTabActive = false;
  if (anchor) showAnchorChip(anchor, "cited-by");
}

async function expandCiting(paperId) {
  const anchor = state.nodes.get(String(paperId));
  const isS2   = String(paperId).startsWith("s2:");
  setStatus("Searching citing papers…");

  // 1 — Local DB
  let dbPapers = [];
  if (!isS2) {
    try { dbPapers = await apiFetch(`/papers/${paperId}/citing`); }
    catch (_) {}
  }

  // 2 — Semantic Scholar
  let s2Papers = [], s2Status = null;
  if (anchor) {
    try {
      const s2Id = await resolveS2Id(anchor);
      if (s2Id) {
        setStatus("Checking Semantic Scholar…");
        s2Papers = await s2GetCitations(s2Id);
      } else {
        s2Status = "not found on Semantic Scholar";
      }
    } catch (e) {
      s2Status = e.message.includes("404") ? "not found on Semantic Scholar"
               : "Semantic Scholar unreachable";
    }
  }

  // 3 — Merge and show as sidebar suggestions
  const merged = mergePaperLists(dbPapers, s2Papers);
  updateStatus();

  if (!merged.length) {
    const msg = s2Status
      ? `No citing papers found (${s2Status}).`
      : "No citing papers found in database or Semantic Scholar.";
    showToast(msg, { ms: 4000 });
    setStatus(msg);
    return;
  }

  const sourceNote = s2Status  ? ` · ${s2Status}`
    : s2Papers.length ? ` · ${s2Papers.length} from Semantic Scholar`
    : "";
  const label = `${merged.length} paper${merged.length !== 1 ? "s" : ""} citing "${trunc(anchor?.title ?? "", 28)}"${sourceNote}`;
  setResultsList(merged, { showAddAll: true, label, updateBase: true });
  filterTabActive = false;
  if (anchor) showAnchorChip(anchor, "citing");
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

// ── Fetch a single paper from Semantic Scholar by any S2 path ────────────────
async function fetchFromS2ByPath(path) {
  const data = await s2Request(path, { fields: S2_FIELDS });
  if (!data?.paperId) throw new Error("Not found on Semantic Scholar");
  const p = s2Normalize(data);
  // Return in the same shape as fetchByDOI so bulk preview works uniformly
  return {
    title:           p.title,
    publicationYear: p.publicationYear,
    doi:             p.doi,
    authors:         p.authors.map(a => a.name),
    _s2Id:           p._s2Id,
    _source:         "s2",
  };
}

// ── Universal paper lookup: DOI, S2 URL, S2 ID, arXiv ID, or doi.org URL ──────
async function fetchByDOI(line) {
  line = line.trim();

  // semanticscholar.org/paper/Some-Title/649def34f8be52c8b66281af98ae884c09aef38d
  const s2Url = line.match(/semanticscholar\.org\/paper\/[^/]+\/([a-f0-9]{40})/i);
  if (s2Url) return fetchFromS2ByPath(`/paper/${s2Url[1]}`);

  // Raw 40-char hex S2 ID
  if (/^[a-f0-9]{40}$/i.test(line)) return fetchFromS2ByPath(`/paper/${line}`);

  // arXiv: 1706.03762  or  arXiv:1706.03762v2
  const arxiv = line.match(/^(?:arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?)$/i);
  if (arxiv) return fetchFromS2ByPath(`/paper/arXiv:${arxiv[1]}`);

  // Regular DOI (bare or with doi.org prefix) — fetch via CrossRef for rich metadata
  const doi = line.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!r.ok) throw new Error(`Not found: ${doi}`);
  const m = (await r.json()).message;
  return {
    title:           Array.isArray(m.title) ? m.title[0] : (m.title || doi),
    publicationYear: m.published?.["date-parts"]?.[0]?.[0] || null,
    doi:             m.DOI || doi,
    authors:         (m.author || []).map(a => [a.given, a.family].filter(Boolean).join(" ")),
  };
}

// ── Semantic Scholar API ──────────────────────────────────────────────────────
// All requests go through /api/s2/* on the local server (proxy) to avoid
// browser CORS restrictions and shared-IP rate-limit drops.
const S2_BASE   = "/api/s2";
const S2_FIELDS = "paperId,title,year,authors,externalIds";

function getS2Key() {
  return (localStorage.getItem("setting-s2-key") || "").trim();
}

async function s2Request(path, params = {}, { _attempt = 1 } = {}) {
  const qs  = new URLSearchParams(params).toString();
  const url = S2_BASE + path + (qs ? "?" + qs : "");
  const headers = {};
  const key = getS2Key();
  if (key) headers["x-api-key"] = key;

  const r = await fetch(url, { headers });

  if (r.status === 429) {
    const maxRetries = 4;
    if (_attempt > maxRetries) throw new Error("S2 rate limit — try again in a minute or add an API key in Settings ⚙");
    // Exponential backoff: 5s, 10s, 20s, 40s
    const waitMs = 5000 * Math.pow(2, _attempt - 1);
    setStatus(`S2 rate limit — retrying in ${Math.round(waitMs / 1000)}s… (${_attempt}/${maxRetries})`);
    await new Promise(res => setTimeout(res, waitMs));
    return s2Request(path, params, { _attempt: _attempt + 1 });
  }
  if (r.status === 404) throw new Error("S2 404");
  if (!r.ok) throw new Error(`S2 ${r.status}`);
  return r.json();
}

function s2Normalize(s2p) {
  if (!s2p?.paperId) return null;
  return {
    paperId:         "s2:" + s2p.paperId,
    title:           s2p.title || "(Untitled)",
    publicationYear: s2p.year  || null,
    doi:             s2p.externalIds?.DOI || null,
    authors:         (s2p.authors || []).map(a => ({ name: a.name })),
    _s2Id:           s2p.paperId,
    _source:         "s2",
  };
}

// Find an existing graph node by DOI (case-insensitive)
function findNodeByDOI(doi) {
  if (!doi) return null;
  const d = doi.toLowerCase();
  for (const n of state.nodes.values()) {
    if (n.doi && n.doi.toLowerCase() === d) return n;
  }
  return null;
}

async function s2LookupDOI(doi) {
  const data = await s2Request(`/paper/DOI:${encodeURIComponent(doi)}`, { fields: S2_FIELDS });
  return s2Normalize(data);
}

async function s2GetReferences(s2Id) {
  const data = await s2Request(`/paper/${s2Id}/references`, { fields: S2_FIELDS, limit: "100" });
  return (data.data || []).map(r => s2Normalize(r.citedPaper)).filter(Boolean);
}

async function s2GetCitations(s2Id) {
  const data = await s2Request(`/paper/${s2Id}/citations`, { fields: S2_FIELDS, limit: "100" });
  return (data.data || []).map(r => s2Normalize(r.citingPaper)).filter(Boolean);
}

// Resolve an S2 ID from a node's existing _s2Id or via DOI lookup
async function resolveS2Id(node) {
  if (node._s2Id) return node._s2Id;
  if (node.doi) {
    const p = await s2LookupDOI(node.doi);
    if (p?._s2Id) { node._s2Id = p._s2Id; return p._s2Id; }
  }
  return null;
}

// Merge S2 papers into the graph, deduplicating by DOI.
// direction: "cited-by" means paperId→s2paper, "citing" means s2paper→paperId
function mergeS2Papers(papers, anchor, paperId, direction) {
  let added = 0;
  papers.forEach(p => {
    if (!p) return;
    // Check DOI collision with existing node
    const existing = p.doi ? findNodeByDOI(p.doi) : null;
    if (existing) {
      if (direction === "cited-by") pushLink(paperId, existing.paperId);
      else                          pushLink(existing.paperId, paperId);
      return;
    }
    // Check S2 node already added
    if (state.nodes.has(p.paperId)) {
      if (direction === "cited-by") pushLink(paperId, p.paperId);
      else                          pushLink(p.paperId, paperId);
      return;
    }
    addNodeToGraph(p, anchor);
    if (direction === "cited-by") pushLink(paperId, p.paperId);
    else                          pushLink(p.paperId, paperId);
    added++;
  });
  return added;
}

// ── BibTeX parser ─────────────────────────────────────────────────────────────
function parseBibTeX(text) {
  const entries = [];
  const blocks = text.split(/(?=@\w+\s*\{)/);
  for (const block of blocks) {
    if (!/^@\w+\s*\{/i.test(block.trim())) continue;
    if (/^@(string|preamble|comment)\s*\{/i.test(block.trim())) continue;
    const fields = {};
    const fieldRe = /(\w+)\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\d+))/gi;
    let m;
    while ((m = fieldRe.exec(block)) !== null) {
      const k = m[1].toLowerCase();
      if (!fields[k]) fields[k] = (m[2] ?? m[3] ?? m[4] ?? "").trim();
    }
    const title = fields.title || fields.booktitle;
    if (!title) continue;
    const authors = fields.author
      ? fields.author.split(/\s+and\s+/i).map(a => a.trim()).filter(Boolean)
      : [];
    entries.push({
      title,
      publicationYear: fields.year ? parseInt(fields.year) : null,
      doi:             fields.doi  ? fields.doi.replace(/\s/g, "") : null,
      authors,
    });
  }
  return entries;
}

// ── RIS parser ────────────────────────────────────────────────────────────────
function parseRIS(text) {
  const entries = [];
  const records = text.split(/^ER\s*-\s*$/m);
  for (const record of records) {
    const authors = [];
    const fields  = {};
    for (const line of record.split("\n")) {
      const m = line.match(/^([A-Z][A-Z0-9])\s{1,3}-\s*(.+)/);
      if (!m) continue;
      const [, tag, val] = m;
      const v = val.trim();
      switch (tag) {
        case "TI": case "T1": case "CT":
          if (!fields.title) fields.title = v; break;
        case "PY": case "Y1":
          if (!fields.year) fields.year = v.split("/")[0]; break;
        case "DO":
          if (!fields.doi) fields.doi = v.replace(/\s/g, ""); break;
        case "AU": case "A1": case "A2":
          authors.push(v); break;
      }
    }
    if (!fields.title) continue;
    entries.push({
      title:           fields.title,
      publicationYear: fields.year ? parseInt(fields.year) : null,
      doi:             fields.doi  || null,
      authors,
    });
  }
  return entries;
}

// ── Enrich parsed bibliography entries via Semantic Scholar ───────────────────
async function enrichWithS2(entries, onProgress) {
  const hasKey  = !!getS2Key();
  const delay   = hasKey ? 250 : 1100;  // ms between requests
  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    // Convert string author names to {name} objects
    let paper = {
      ...entry,
      authors: entry.authors.map(a => typeof a === "string" ? { name: a } : a),
    };
    if (entry.doi) {
      try {
        const s2p = await s2LookupDOI(entry.doi);
        if (s2p) {
          paper = {
            ...paper,
            _s2Id:           s2p._s2Id,
            authors:         paper.authors.length ? paper.authors : s2p.authors,
            publicationYear: paper.publicationYear || s2p.publicationYear,
          };
        }
      } catch (_) { /* S2 unreachable or paper not found — use parsed data */ }
      if (delay > 0 && i < entries.length - 1) {
        await new Promise(r => setTimeout(r, delay));
      }
    }
    results.push({ ok: true, paper });
    onProgress?.(i + 1, entries.length);
  }
  return results;
}

// ── Handle .bib / .ris file ───────────────────────────────────────────────────
async function handleBibFile(file) {
  const bibStatusEl = document.getElementById("bib-status");
  bibStatusEl.textContent = "Parsing file…";
  let text;
  try { text = await file.text(); } catch (e) {
    bibStatusEl.textContent = "Could not read file.";
    return;
  }

  let entries = [];
  try {
    entries = file.name.toLowerCase().endsWith(".ris")
      ? parseRIS(text)
      : parseBibTeX(text);
  } catch (e) {
    bibStatusEl.textContent = "Parse error: " + e.message;
    return;
  }

  if (!entries.length) {
    bibStatusEl.textContent = "No entries found in file.";
    return;
  }

  const withDOI = entries.filter(e => !!e.doi).length;
  bibStatusEl.textContent = withDOI
    ? `Found ${entries.length} entries — enriching ${withDOI} via Semantic Scholar…`
    : `Found ${entries.length} entries…`;

  resetBulkPreview();

  const results = await enrichWithS2(entries, (done, total) => {
    if (withDOI) bibStatusEl.textContent = `Enriching ${done}/${total}…`;
  });

  bibStatusEl.textContent = "";
  showBulkPreview(results);
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
  document.getElementById("walk-speed-val").textContent  = s.walkSpeed + " ms";
  document.getElementById("charge-val").textContent      = s.charge;
  document.getElementById("link-dist-val").textContent   = s.linkDist + " px";
  document.getElementById("setting-s2-key").value        = getS2Key();
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
  // S2 API key — save immediately on change
  document.getElementById("setting-s2-key").addEventListener("input", function () {
    localStorage.setItem("setting-s2-key", this.value.trim());
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
  document.getElementById("bib-status").textContent  = "";
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
  document.getElementById("bulk-doi-input").value   = "";
  document.getElementById("bib-text-input").value   = "";
  document.getElementById("bib-status").textContent = "";
};

// ── Bibliography file upload (drop zone) ─────────────────────────────────────
(function () {
  const zone    = document.getElementById("bib-drop-zone");
  const input   = document.getElementById("bib-file-input");
  const browse  = document.getElementById("bib-browse-btn");

  // Open file picker when clicking "browse" or the zone itself
  browse.addEventListener("click", e => { e.stopPropagation(); input.click(); });
  zone.addEventListener("click",   () => input.click());
  zone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });

  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) handleBibFile(f);
    input.value = ""; // reset so re-uploading the same file fires change again
  });

  // Drag-and-drop
  zone.addEventListener("dragover",  e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("drag-over"); });
  zone.addEventListener("drop",      e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    if (!f.name.match(/\.(bib|ris)$/i)) {
      document.getElementById("bib-status").textContent = "Please drop a .bib or .ris file.";
      return;
    }
    handleBibFile(f);
  });
})();

// ── Pasted BibTeX / RIS text ──────────────────────────────────────────────────
document.getElementById("bib-text-btn").onclick = async () => {
  const text = document.getElementById("bib-text-input").value.trim();
  if (!text) return;
  const bibStatusEl = document.getElementById("bib-status");
  bibStatusEl.textContent = "Parsing…";
  resetBulkPreview();

  let entries = [];
  try {
    // Auto-detect format: BibTeX starts with @, RIS has "TY  -" lines
    entries = /^TY\s+-/m.test(text) ? parseRIS(text) : parseBibTeX(text);
  } catch (e) {
    bibStatusEl.textContent = "Parse error: " + e.message;
    return;
  }

  if (!entries.length) {
    bibStatusEl.textContent = "No entries found — check the pasted text.";
    return;
  }

  const withDOI = entries.filter(e => !!e.doi).length;
  bibStatusEl.textContent = withDOI
    ? `Found ${entries.length} entr${entries.length !== 1 ? "ies" : "y"} — enriching via Semantic Scholar…`
    : `Found ${entries.length} entr${entries.length !== 1 ? "ies" : "y"}…`;

  const results = await enrichWithS2(entries, (done, total) => {
    if (withDOI) bibStatusEl.textContent = `Enriching ${done}/${total}…`;
  });
  bibStatusEl.textContent = "";
  showBulkPreview(results);
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
  } finally { btn.textContent = "Fetch papers"; btn.disabled = false; }
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
// Empty-state quick-action buttons (in the initial HTML; also re-wired by _showWorkspaceEmptyState)
document.getElementById("es-load-btn")?.addEventListener("click", loadSample);
document.getElementById("es-search-btn")?.addEventListener("click", () => {
  document.getElementById("search-input").focus();
  document.getElementById("search-input").select();
});
document.getElementById("clear-btn").onclick = () => {
  state.nodes.clear(); state.links.length = 0; state.selected = null;
  allSeedPapers = [];
  lastResults = []; filterTabActive = false;
  document.getElementById("detail-panel").classList.remove("visible");
  clearAnchorChip();
  render();
  _showWorkspaceEmptyState();
  updateStatus();
};

// ── Source filter tabs ────────────────────────────────────────────────────────
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    setFilter(btn.dataset.filter);
    filterTabActive = true;
    refreshFilterTabView();
  });
});

// ── Workspace tab click handlers ──────────────────────────────────────────────
document.querySelectorAll(".ws-tab").forEach(btn => {
  btn.addEventListener("click", () => switchWorkspace(btn.dataset.ws));
});

// Apply persisted workspace on load
_updateWorkspaceUI();
_showWorkspaceEmptyState();

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

// ── Onboarding tour ───────────────────────────────────────────────────────────
const TOUR_STORAGE_KEY = "cn-tour-v1";

const TOUR_STEPS = [
  {
    target:    null,
    placement: "center",
    title:     "Welcome to Citation Network 👋",
    body:      "This quick tour shows you the main features. It takes about a minute — or skip anytime and explore on your own.",
  },
  {
    target:    "#workspace-tabs",
    placement: "bottom",
    title:     "Two isolated workspaces",
    body:      "You're in the <strong>Playground</strong> — a safe sandbox with sample data. Switch to <strong>My Research</strong> for your real papers. The two workspaces never share data.",
  },
  {
    target:    "#load-sample-group",
    placement: "bottom",
    title:     "Load sample papers",
    body:      "Press <strong>Load</strong> to fill the graph with 20 sample academic papers and their citation edges. Great for exploring the graph before adding your own work.",
  },
  {
    target:    "#graph-area",
    placement: "left",
    title:     "The citation graph",
    body:      "<strong>Click</strong> a node to select a paper · <strong>Scroll</strong> to zoom · <strong>Drag</strong> to pan · <strong>Right-click</strong> a node for quick actions.",
  },
  {
    target:    "#search-area",
    placement: "bottom",
    title:     "Search &amp; filter",
    body:      "Search by title, author, year, or institution. Results appear below and can be added to the graph with a single click.",
  },
  {
    target:    "#bulk-btn",
    placement: "bottom",
    title:     "Import your bibliography",
    body:      "Use <strong>Bulk</strong> to import a <strong>.bib</strong> or <strong>.ris</strong> export from Zotero or Mendeley, paste DOIs, or fetch papers directly from Semantic Scholar.",
  },
  {
    target:    "#ws-mine",
    placement: "bottom",
    title:     "Ready to start your research?",
    body:      "Switch to <strong>My Research</strong> to work with your actual papers in a clean, isolated workspace.",
    isLast:    true,
  },
];

let _tourStep = 0;
let _tourRoot = null;

function tourShouldShow() {
  return !localStorage.getItem(TOUR_STORAGE_KEY);
}

function tourInit() {
  if (!tourShouldShow()) return;
  setTimeout(tourStart, 900); // small delay so page fully settles
}

function tourStart() {
  // Build DOM
  const root = document.createElement("div");
  root.id = "tour-overlay";
  root.innerHTML = `
    <div id="tour-spotlight"></div>
    <div id="tour-tooltip" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div id="tour-progress"></div>
      <h3 id="tour-title"></h3>
      <p id="tour-body"></p>
      <div id="tour-actions">
        <button id="tour-skip">Skip tour</button>
        <div id="tour-nav">
          <button id="tour-back" class="tour-nav-btn secondary sm">← Back</button>
          <button id="tour-next" class="tour-nav-btn sm">Next →</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
  _tourRoot = root;
  _tourStep = 0;

  document.getElementById("tour-skip").onclick  = tourEnd;
  document.getElementById("tour-back").onclick  = () => tourGo(_tourStep - 1);
  document.getElementById("tour-next").onclick  = tourAdvance;

  document.addEventListener("keydown", _tourKeyHandler);
  window.addEventListener("resize", _tourReposition);

  tourGo(0);
  requestAnimationFrame(() => root.classList.add("visible"));
}

function _tourKeyHandler(e) {
  if (e.key === "Escape")     { tourEnd(); return; }
  if (e.key === "ArrowRight") { tourAdvance(); return; }
  if (e.key === "ArrowLeft" && _tourStep > 0) tourGo(_tourStep - 1);
}

function _tourReposition() {
  if (_tourRoot) tourGo(_tourStep);
}

function tourAdvance() {
  const step = TOUR_STEPS[_tourStep];
  if (step.isLast) {
    tourEnd();
    switchWorkspace("mine");
  } else {
    tourGo(_tourStep + 1);
  }
}

function tourGo(idx) {
  _tourStep = Math.max(0, Math.min(idx, TOUR_STEPS.length - 1));
  const step    = TOUR_STEPS[_tourStep];
  const isFirst = _tourStep === 0;
  const isLast  = step.isLast;

  // Content
  document.getElementById("tour-title").innerHTML = step.title;
  document.getElementById("tour-body").innerHTML  = step.body;
  document.getElementById("tour-back").style.visibility = isFirst ? "hidden" : "";

  const nextBtn = document.getElementById("tour-next");
  nextBtn.textContent = isLast ? "Go to My Research →" : "Next →";
  nextBtn.classList.toggle("tour-finish", !!isLast);

  // Progress dots
  document.getElementById("tour-progress").innerHTML =
    TOUR_STEPS.map((_, i) =>
      `<span class="tour-dot${i === _tourStep ? " active" : ""}"></span>`
    ).join("");

  // Position spotlight + tooltip
  _tourPositionStep(step);
}

function _tourPositionStep(step) {
  const spotlight = document.getElementById("tour-spotlight");
  const tooltip   = document.getElementById("tour-tooltip");
  const overlay   = document.getElementById("tour-overlay");
  if (!spotlight || !tooltip) return;

  const PAD = 10, GAP = 16, TW = 290;

  if (!step.target) {
    // Welcome step — full-dim, tooltip centered, no spotlight
    overlay.classList.add("dim");
    spotlight.style.display = "none";
    tooltip.style.cssText   = "left:50%;top:50%;transform:translate(-50%,-50%)";
    return;
  }

  overlay.classList.remove("dim");
  const el = document.querySelector(step.target);
  if (!el) {
    // Fallback to center if target missing
    overlay.classList.add("dim");
    spotlight.style.display = "none";
    tooltip.style.cssText   = "left:50%;top:50%;transform:translate(-50%,-50%)";
    return;
  }

  const r  = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Spotlight over target
  spotlight.style.cssText = `
    display: block;
    left:   ${r.left   - PAD}px;
    top:    ${r.top    - PAD}px;
    width:  ${r.width  + PAD * 2}px;
    height: ${r.height + PAD * 2}px;`;

  // Tooltip placement
  let left, top;
  const estimatedH = 200;

  switch (step.placement) {
    case "bottom":
      top  = r.bottom + PAD + GAP;
      left = clamp(r.left + r.width / 2 - TW / 2, 12, vw - TW - 12);
      break;
    case "top":
      top  = r.top - PAD - GAP - estimatedH;
      left = clamp(r.left + r.width / 2 - TW / 2, 12, vw - TW - 12);
      break;
    case "right":
      left = r.right + PAD + GAP;
      top  = clamp(r.top + r.height / 2 - estimatedH / 2, 12, vh - estimatedH - 12);
      break;
    case "left":
      left = clamp(r.left - PAD - GAP - TW, 12, vw - TW - 12);
      top  = clamp(r.top + r.height / 2 - estimatedH / 2, 12, vh - estimatedH - 12);
      break;
    default:
      overlay.classList.add("dim");
      spotlight.style.display = "none";
      tooltip.style.cssText   = "left:50%;top:50%;transform:translate(-50%,-50%)";
      return;
  }

  tooltip.style.cssText = `left:${left}px; top:${clamp(top, 12, vh - estimatedH - 12)}px;`;
}

function tourEnd() {
  localStorage.setItem(TOUR_STORAGE_KEY, "1");
  document.removeEventListener("keydown", _tourKeyHandler);
  window.removeEventListener("resize", _tourReposition);
  if (_tourRoot) {
    _tourRoot.classList.remove("visible");
    const el = _tourRoot;
    setTimeout(() => el.remove(), 350);
    _tourRoot = null;
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(v, hi)); }

// Start the tour now that all functions are declared
tourInit();

// ── Helpers ───────────────────────────────────────────────────────────────────
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : (s || ""); }
function esc(s) {
  return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
                  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
