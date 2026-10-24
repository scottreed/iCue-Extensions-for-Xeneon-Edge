/* The right-hand pane: an interactive map (pins, legend filters, routes, regions) or a skill tree (allocate points, presets).
   Built on Viewer for pan and zoom. All guide text goes in as text nodes. H is the host: { gs, ctx, isDone, hasItem, itemLabel, toggleItem, say, save }. */
var Side = (function () {
  var NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function sa(b, name, data) { b.setAttribute("data-sa", name); if (data) for (var k in data) b.setAttribute("data-" + k, data[k]); return b; }
  function num(v, d) { return typeof v === "number" && isFinite(v) ? v : d; }

  /* shared frame: title bar, zoom buttons, filter row, viewport, card */
  function frame(title, H, full) {
    var root = R.el("div", "side-in");
    var bar = R.el("div", "sbar");
    bar.appendChild(R.el("div", "stitle", title));
    var bt = R.el("div", "sbtns");
    [["zoomin", "+"], ["zoomout", "−"], ["fit", "Fit"]].forEach(function (b) { bt.appendChild(sa(R.btn("chip sq", b[1]), b[0])); });
    bt.appendChild(sa(R.btn("chip", full ? "Close" : "Full screen"), full ? "exit" : "full"));
    bar.appendChild(bt);
    root.appendChild(bar);
    var filters = R.el("div", "sfilters");
    root.appendChild(filters);
    var vp = R.el("div", "vp"), world = R.el("div", "world");
    vp.appendChild(world); root.appendChild(vp);
    var card = R.el("div", "scard"); card.style.display = "none"; root.appendChild(card);
    return { root: root, filters: filters, vp: vp, world: world, card: card };
  }

  function wire(f, ctl, H) {
    f.root.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-sa]");
      if (!t || !f.root.contains(t)) return;
      var a = t.getAttribute("data-sa");
      if (a === "full") H.openFull(ctl.fullSpec ? ctl.fullSpec() : null);
      else if (a === "exit") H.closeFull();
      else if (!ctl.viewer) return;
      else if (a === "zoomin") ctl.viewer.zoomCenter(1.6);
      else if (a === "zoomout") ctl.viewer.zoomCenter(1 / 1.6);
      else if (a === "fit") { ctl.viewer.animate(); ctl.viewer.fitView(); ctl.viewer.changed(); }
      else if (ctl.action) ctl.action(a, t);
    });
  }

  /* ------------------------------------------------------------------ map */
  function map(m, H, opts) {
    var ui = H.gs.ui;
    ui.mapOff = ui.mapOff || {};
    var off = ui.mapOff[m.id] = ui.mapOff[m.id] || {};
    var w = num(m.size && m.size.w, 1000), h = num(m.size && m.size.h, 1000);
    var full = !!(opts && opts.full);
    var f = frame(m.title, H, full);
    f.world.style.setProperty("--w", w + "px"); f.world.style.setProperty("--h", h + "px");
    f.vp.classList.add("map");

    // background image
    var bg = R.el("img", "mapimg"); bg.alt = "";
    if (m.image && m.image.asset) {
      H.ctx.asset(m.image.asset).then(function (u) { if (u) bg.src = u; else f.world.classList.add("nobg"); }, function () { f.world.classList.add("nobg"); });
      f.world.appendChild(bg);
    } else f.world.classList.add("nobg");

    // regions and routes
    var ov = svgEl("svg", { "class": "ov", viewBox: "0 0 " + w + " " + h, width: w, height: h });
    var geo = {};
    (Array.isArray(m.regions) ? m.regions : []).forEach(function (r) {
      if (!r || !Array.isArray(r.points)) return;
      var p = svgEl("polygon", { "class": "region", points: r.points.map(function (q) { return q[0] + "," + q[1]; }).join(" "), "data-kind": "region", "data-id": r.id });
      ov.appendChild(p); geo["region:" + r.id] = { el: p, item: r };
    });
    (Array.isArray(m.routes) ? m.routes : []).forEach(function (r) {
      if (!r || !Array.isArray(r.points)) return;
      var p = svgEl("polyline", { "class": "route", points: r.points.map(function (q) { return q[0] + "," + q[1]; }).join(" "), "data-kind": "route", "data-id": r.id });
      ov.appendChild(p); geo["route:" + r.id] = { el: p, item: r };
    });
    f.world.appendChild(ov);

    // legend lookup and pins
    var legend = {}, legendList = Array.isArray(m.legend) ? m.legend.filter(Boolean) : [];
    legendList.forEach(function (l) { legend[l.typeId] = l; });
    var pins = {}, pinList = (Array.isArray(m.pins) ? m.pins : []).filter(function (p) { return p && typeof p.id === "string"; });
    pinList.forEach(function (p) {
      var b = R.btn("pin", "");
      b.setAttribute("data-pin", p.id); b.setAttribute("aria-label", p.title || p.id);
      b.style.setProperty("--x", num(p.x, 0) + "px"); b.style.setProperty("--y", num(p.y, 0) + "px");
      b.style.setProperty("--c", (legend[p.type] && legend[p.type].colour) || "#ffffff");
      f.world.appendChild(b); pins[p.id] = { el: b, pin: p };
    });

    // filter chips: legend types, layers, hide found
    var layers = (Array.isArray(m.layers) ? m.layers : []).filter(Boolean);
    function chip(key, label, colour, count) {
      var b = sa(R.btn("fchip", ""), "filter", { key: key });
      if (colour) { var d = R.el("i", "dot"); d.style.setProperty("--c", colour); b.appendChild(d); }
      b.appendChild(document.createTextNode(label + (count !== undefined ? "  " + count : "")));
      f.filters.appendChild(b);
      return b;
    }
    var chips = {};
    legendList.forEach(function (l) {
      var n = pinList.filter(function (p) { return p.type === l.typeId; }).length;
      if (n) chips["t:" + l.typeId] = chip("t:" + l.typeId, l.label, l.colour, n);
    });
    if (layers.length > 1) layers.forEach(function (l) { chips["l:" + l.id] = chip("l:" + l.id, l.title, null); });
    if (pinList.some(function (p) { return p.itemId; })) chips.found = chip("found", "Hide found", null);

    var sel = null; // { kind, id }
    function visible(p) {
      if (off["t:" + p.type]) return false;
      if (p.layer && off["l:" + p.layer]) return false;
      if (off.found && p.itemId && H.isDone(p.itemId)) return false;
      return true;
    }
    function paint() {
      for (var k in chips) { var isOff = k === "found" ? !off.found : !!off[k]; chips[k].classList.toggle("off", isOff); }
      pinList.forEach(function (p) {
        var e = pins[p.id].el, done = !!(p.itemId && H.isDone(p.itemId));
        e.classList.toggle("hid", !visible(p));
        e.classList.toggle("done", done);
        e.classList.toggle("sel", !!sel && sel.kind === "pin" && sel.id === p.id);
        e.textContent = done ? "✓" : "";
      });
      for (var g in geo) geo[g].el.classList.toggle("sel", !!sel && sel.kind + ":" + sel.id === g);
      drawCard();
    }
    function drawCard() {
      var c = f.card; c.textContent = "";
      if (!sel) { c.style.display = "none"; return; }
      var it = sel.kind === "pin" ? (pins[sel.id] && pins[sel.id].pin) : (geo[sel.kind + ":" + sel.id] && geo[sel.kind + ":" + sel.id].item);
      if (!it) { c.style.display = "none"; return; }
      c.style.display = "flex";
      var head = R.el("div", "sc-head");
      if (sel.kind === "pin" && legend[it.type]) { var d = R.el("i", "dot"); d.style.setProperty("--c", legend[it.type].colour); head.appendChild(d); head.appendChild(R.el("span", "sc-kind", legend[it.type].label)); }
      else head.appendChild(R.el("span", "sc-kind", sel.kind === "route" ? "Route" : "Region"));
      head.appendChild(sa(R.btn("chip sq", "×"), "deselect"));
      c.appendChild(head);
      c.appendChild(R.el("b", "sc-title", it.title));
      if (it.description) c.appendChild(R.inline(it.description, H.ctx));
      var row = R.el("div", "sc-row");
      if (sel.kind === "pin" && it.itemId && H.hasItem(it.itemId)) {
        var done = H.isDone(it.itemId);
        row.appendChild(sa(R.btn("chip" + (done ? " solid" : ""), done ? "Found ✓" : "Mark found"), "found", { item: it.itemId }));
        row.appendChild(R.el("span", "sc-item", H.itemLabel(it.itemId)));
      }
      if (it.pageRef) row.appendChild(R.btn("chip", "Open guide page ›", "goto", { type: "page", ref: it.pageRef }));
      if (row.childNodes.length) c.appendChild(row);
    }
    function select(kind, id, pan) {
      sel = kind ? { kind: kind, id: id } : null;
      if (pan && kind === "pin" && pins[id]) ctl.viewer.focus(num(pins[id].pin.x, 0), num(pins[id].pin.y, 0), Math.max(ctl.viewer.k / ctl.viewer.fit, 3));
      paint();
    }

    var ctl = {
      el: f.root, viewer: null,
      mount: function () {
        ctl.viewer = new Viewer(f.vp, f.world, {
          w: w, h: h, maxFit: full ? 8 : 6,
          onTap: function (t) {
            var p = t && t.closest && t.closest(".pin");
            if (p && !p.classList.contains("hid")) { select("pin", p.getAttribute("data-pin")); return; }
            var g = t && t.closest && t.closest("[data-kind]");
            if (g) { select(g.getAttribute("data-kind"), g.getAttribute("data-id")); return; }
            select(null);
          },
          onChange: function (v) { if (full) return; ui.view = ui.view || {}; ui.view[m.id] = { x: Math.round(v.x), y: Math.round(v.y), z: Math.round(v.z * 100) / 100 }; H.save(); },
        });
        ctl.viewer.fitView();
        var iv = full ? null : m.initialView, saved = full ? null : ui.view && ui.view[m.id];
        if (saved && typeof saved.x === "number") ctl.viewer.setView(saved);
        else if (iv && typeof iv.x === "number") { ctl.viewer.focus(iv.x, iv.y, iv.zoom); ctl.viewer.stopAnim(); }
        paint();
        if (opts && opts.pin) ctl.focusPin(opts.pin);
      },
      focusPin: function (id) { if (pins[id]) { if (!visible(pins[id].pin)) { delete off["t:" + pins[id].pin.type]; delete off["l:" + pins[id].pin.layer]; delete off.found; } select("pin", id, true); } },
      refresh: paint,
      fullSpec: function () { return { type: "map", ref: m.id, pin: sel && sel.kind === "pin" ? sel.id : "" }; },
      action: function (a, t) {
        if (a === "filter") { var k = t.getAttribute("data-key"); if (k === "found") off.found = !off.found; else off[k] = !off[k]; H.save(); paint(); }
        else if (a === "deselect") select(null);
        else if (a === "found") H.toggleItem(t.getAttribute("data-item"));
      },
    };
    wire(f, ctl, H);
    return ctl;
  }

  /* ----------------------------------------------------------------- tree */
  function tree(t, H, opts) {
    var gs = H.gs;
    gs.trees = gs.trees || {};
    var alloc = gs.trees[t.id] = gs.trees[t.id] || {};
    var nodes = (Array.isArray(t.nodes) ? t.nodes : []).filter(function (n) { return n && typeof n.id === "string"; });
    var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
    var xs = nodes.map(function (n) { return num(n.x, 0); }), ys = nodes.map(function (n) { return num(n.y, 0); });
    var minX = Math.min.apply(null, xs.concat([0])), minY = Math.min.apply(null, ys.concat([0]));
    if (nodes.length) { minX = Math.min.apply(null, xs); minY = Math.min.apply(null, ys); }
    var PAD = 130, w = Math.max(500, (nodes.length ? Math.max.apply(null, xs) - minX : 0) + PAD * 2), h = Math.max(320, (nodes.length ? Math.max.apply(null, ys) - minY : 0) + PAD * 2);
    var full = !!(opts && opts.full);
    var f = frame(t.title, H, full);
    f.vp.classList.add("tree");
    f.world.style.setProperty("--w", w + "px"); f.world.style.setProperty("--h", h + "px");
    var px = function (n) { return num(n.x, 0) - minX + PAD; }, py = function (n) { return num(n.y, 0) - minY + PAD; };

    if (t.background) { var bg = R.el("img", "mapimg dim"); bg.alt = ""; H.ctx.asset(t.background).then(function (u) { if (u) bg.src = u; }); f.world.appendChild(bg); }

    var ov = svgEl("svg", { "class": "ov", viewBox: "0 0 " + w + " " + h, width: w, height: h });
    var edges = [], seen = {};
    function addEdge(a, b) { var k = a + ">" + b; if (seen[k] || !byId[a] || !byId[b]) return; seen[k] = 1; var l = svgEl("line", { "class": "edge", x1: px(byId[a]), y1: py(byId[a]), x2: px(byId[b]), y2: py(byId[b]) }); ov.appendChild(l); edges.push({ a: a, b: b, el: l }); }
    (Array.isArray(t.edges) ? t.edges : []).forEach(function (e) { if (e) addEdge(e.from, e.to); });
    nodes.forEach(function (n) { (Array.isArray(n.requires) ? n.requires : []).forEach(function (r) { addEdge(r, n.id); }); });
    f.world.appendChild(ov);

    var els = {};
    nodes.forEach(function (n) {
      var b = R.btn("tnode", "");
      b.setAttribute("data-node", n.id);
      b.style.setProperty("--x", px(n) + "px"); b.style.setProperty("--y", py(n) + "px");
      b.appendChild(R.el("span", "tl", n.label));
      b.appendChild(R.el("span", "tp", ""));
      f.world.appendChild(b); els[n.id] = b;
    });

    // toolbar row: points used, presets, reset
    var used = R.el("span", "fchip static", "");
    f.filters.appendChild(used);
    (Array.isArray(t.presets) ? t.presets : []).forEach(function (p) { if (p && p.allocations) f.filters.appendChild(sa(R.btn("fchip", "Preset: " + p.title), "preset", { id: p.id })); });
    f.filters.appendChild(sa(R.btn("fchip", "Reset"), "reset"));

    var sel = null;
    var pts = function (id) { return alloc[id] || 0; };
    var unlocked = function (n) { return (Array.isArray(n.requires) ? n.requires : []).every(function (r) { return !byId[r] || pts(r) > 0; }); };
    function paint() {
      var total = 0;
      nodes.forEach(function (n) {
        var p = pts(n.id), max = n.maxPoints || 1, e = els[n.id];
        total += p;
        e.classList.toggle("has", p > 0); e.classList.toggle("max", p >= max); e.classList.toggle("lock", p === 0 && !unlocked(n)); e.classList.toggle("sel", sel === n.id);
        e.lastChild.textContent = p + "/" + max;
      });
      edges.forEach(function (e) { e.el.classList.toggle("on", pts(e.a) > 0 && pts(e.b) > 0); });
      used.textContent = "Points used: " + total;
      drawCard();
    }
    function drawCard() {
      var c = f.card; c.textContent = "";
      var n = sel && byId[sel];
      if (!n) { c.style.display = "none"; return; }
      c.style.display = "flex";
      var head = R.el("div", "sc-head"); head.appendChild(R.el("span", "sc-kind", unlocked(n) || pts(n.id) ? "Skill" : "Locked"));
      head.appendChild(sa(R.btn("chip sq", "×"), "deselect")); c.appendChild(head);
      c.appendChild(R.el("b", "sc-title", n.label));
      if (n.description) c.appendChild(R.inline(n.description, H.ctx));
      var need = (Array.isArray(n.requires) ? n.requires : []).filter(function (r) { return byId[r] && !pts(r); });
      if (need.length) c.appendChild(R.el("div", "need", "Needs: " + need.map(function (r) { return byId[r].label; }).join(", ")));
      var row = R.el("div", "sc-row");
      row.appendChild(sa(R.btn("chip sq", "−"), "dec", { node: n.id }));
      row.appendChild(R.el("span", "sc-pts", pts(n.id) + " / " + (n.maxPoints || 1)));
      row.appendChild(sa(R.btn("chip solid sq", "+"), "inc", { node: n.id }));
      c.appendChild(row);
    }
    function save() { H.save(); paint(); }

    var ctl = {
      el: f.root, viewer: null,
      mount: function () {
        ctl.viewer = new Viewer(f.vp, f.world, {
          w: w, h: h, maxFit: full ? 3 : 2,
          onTap: function (el) { var n = el && el.closest && el.closest(".tnode"); sel = n ? n.getAttribute("data-node") : null; paint(); },
          onChange: function () {},
        });
        ctl.viewer.fitView(); paint();
      },
      refresh: paint,
      fullSpec: function () { return { type: "tree", ref: t.id }; },
      action: function (a, el) {
        var id = el.getAttribute("data-node");
        if (a === "deselect") { sel = null; paint(); }
        else if (a === "inc") {
          var n = byId[id]; if (!n) return;
          if (!unlocked(n)) { H.say("Locked. Needs: " + n.requires.filter(function (r) { return byId[r] && !pts(r); }).map(function (r) { return byId[r].label; }).join(", ")); return; }
          if (pts(id) < (n.maxPoints || 1)) { alloc[id] = pts(id) + 1; save(); }
        } else if (a === "dec") {
          if (pts(id) <= 0) return;
          if (pts(id) === 1) {
            var dep = nodes.filter(function (o) { return pts(o.id) > 0 && (o.requires || []).indexOf(id) >= 0; })[0];
            if (dep) { H.say("Can't remove it: " + dep.label + " depends on it."); return; }
          }
          alloc[id] = pts(id) - 1; if (!alloc[id]) delete alloc[id]; save();
        } else if (a === "preset") {
          var p = (t.presets || []).filter(function (x) { return x && x.id === el.getAttribute("data-id"); })[0];
          if (p) { Object.keys(alloc).forEach(function (k) { delete alloc[k]; }); Object.keys(p.allocations).forEach(function (k) { if (byId[k] && p.allocations[k] > 0) alloc[k] = Math.min(p.allocations[k], byId[k].maxPoints || 1); }); save(); H.say("Loaded " + p.title, 2000); }
        } else if (a === "reset") { Object.keys(alloc).forEach(function (k) { delete alloc[k]; }); save(); }
      },
    };
    wire(f, ctl, H);
    return ctl;
  }

  /* ---------------------------------------------------------------- image */
  function image(assetId, caption, H) {
    var f = frame(caption || "Image", H, true);
    f.vp.classList.add("map");
    var img = R.el("img", "mapimg"); img.alt = "";
    f.world.appendChild(img);
    var ctl = {
      el: f.root, viewer: null, refresh: function () {},
      mount: function () {
        H.ctx.asset(assetId).then(function (u) {
          if (!u) { f.vp.appendChild(R.el("div", "empty", "This image could not be loaded.")); return; }
          img.onload = function () {
            var w = img.naturalWidth || 1000, h = img.naturalHeight || 1000;
            f.world.style.setProperty("--w", w + "px"); f.world.style.setProperty("--h", h + "px");
            ctl.viewer = new Viewer(f.vp, f.world, { w: w, h: h, maxFit: 8, onChange: function () {} });
            ctl.viewer.fitView();
          };
          img.src = u;
        }, function () { f.vp.appendChild(R.el("div", "empty", "This image could not be loaded.")); });
      },
    };
    wire(f, ctl, H);
    return ctl;
  }

  return { map: map, tree: tree, image: image };
})();
