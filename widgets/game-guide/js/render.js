/* DOM builders for guide content. Guide text is ONLY ever inserted as text nodes (never innerHTML), links only go to guide pages. */
var R = (function () {
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function btn(cls, text, act, data) {
    var b = el("button", cls, text);
    b.type = "button";
    if (act) b.setAttribute("data-act", act);
    if (data) for (var k in data) b.setAttribute("data-" + k, data[k]);
    return b;
  }

  var ICON = {
    page: "M6 3h8l4 4v14H6zM13 3v5h5",
    map: "M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10zM12 8.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z",
    collection: "M4 6.5l2 2 3.5-3.5M12 7h8M4 13.5l2 2 3.5-3.5M12 14h8M4 20.5l2 2",
    tree: "M12 4v6M5 20v-4h14v4M12 10v6M5 16v-3h14v3",
    table: "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
    group: "M3 7h7l2 2h9v10H3z",
  };
  function icon(type) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "ic");
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", ICON[type] || ICON.page);
    p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor"); p.setAttribute("stroke-width", "1.8"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
    s.appendChild(p);
    return s;
  }

  /* **bold**, *italic*, [label](page:id | map:id | collection:id) */
  var TOKEN = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]*)\]\((page|map|collection|tree|table):([a-z0-9._-]+)\)/g;
  function inline(text, ctx) {
    var f = document.createDocumentFragment();
    var s = String(text == null ? "" : text), last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(s))) {
      if (m.index > last) f.appendChild(document.createTextNode(s.slice(last, m.index)));
      if (m[1] !== undefined) f.appendChild(el("strong", "", m[1]));
      else if (m[2] !== undefined) f.appendChild(el("em", "", m[2]));
      else {
        var a = btn("lnk", m[3] || m[5], "goto", { type: m[4], ref: m[5] });
        f.appendChild(a);
      }
      last = TOKEN.lastIndex;
    }
    if (last < s.length) f.appendChild(document.createTextNode(s.slice(last)));
    return f;
  }
  function p(cls, text, ctx) { var n = el("div", cls); n.appendChild(inline(text, ctx)); return n; }

  function image(ctx, assetId, caption) {
    var fig = el("figure", "fig");
    fig.setAttribute("data-act", "viewimg"); fig.setAttribute("data-asset", assetId);
    var img = el("img", "pic");
    img.alt = ctx.alt(assetId);
    img.decoding = "async";
    fig.appendChild(img);
    if (caption) fig.appendChild(el("figcaption", "", caption));
    ctx.asset(assetId).then(function (url) { if (url) img.src = url; else fig.classList.add("missing"); }, function () { fig.classList.add("missing"); });
    return fig;
  }

  function check(ctx, itemId) {
    var on = ctx.isDone(itemId);
    var b = btn("box" + (on ? " on" : ""), "", "toggle", { item: itemId });
    b.setAttribute("role", "checkbox");
    b.setAttribute("aria-checked", on ? "true" : "false");
    b.appendChild(document.createTextNode(on ? "✓" : ""));
    return b;
  }

  var CALLOUT = { tip: "Tip", warning: "Warning", missable: "Missable", boss: "Boss", note: "Note" };

  function block(b, ctx) {
    if (!b || typeof b !== "object") return null;
    switch (b.type) {
      case "text": return p("b-text", b.text, ctx);
      case "heading": return el("div", "b-h b-h" + (b.level === 1 || b.level === 3 ? b.level : 2), b.text);
      case "steps": {
        var ol = el("div", "b-steps");
        (Array.isArray(b.items) ? b.items : []).forEach(function (s, i) {
          if (!s) return;
          var row = el("div", "step");
          if (typeof s.itemRef === "string" && ctx.hasItem(s.itemRef)) row.appendChild(check(ctx, s.itemRef)); else row.appendChild(el("span", "n", i + 1));
          row.appendChild(p("t", s.text, ctx));
          ol.appendChild(row);
        });
        return ol;
      }
      case "callout": {
        var c = el("div", "b-call k-" + (CALLOUT[b.kind] ? b.kind : "note"));
        c.appendChild(el("div", "k", b.title || CALLOUT[b.kind] || "Note"));
        c.appendChild(p("t", b.text, ctx));
        return c;
      }
      case "image": return image(ctx, b.asset, b.caption);
      case "gallery": {
        var g = el("div", "b-gal");
        (Array.isArray(b.images) ? b.images : []).forEach(function (im) { if (im) g.appendChild(image(ctx, im.asset, im.caption)); });
        return g;
      }
      case "table": {
        var t = el("table", "b-table"), cols = Array.isArray(b.columns) ? b.columns : [];
        var hr = el("tr");
        cols.forEach(function (c) { hr.appendChild(el("th", "", c)); });
        t.appendChild(hr);
        (Array.isArray(b.rows) ? b.rows : []).forEach(function (r) {
          var tr = el("tr");
          (Array.isArray(r) ? r : []).forEach(function (cell) { tr.appendChild(el("td", "", cell)); });
          t.appendChild(tr);
        });
        return t;
      }
      case "keyValue": {
        var d = el("div", "b-kv");
        (Array.isArray(b.items) ? b.items : []).forEach(function (kv) { if (kv) { d.appendChild(el("span", "k", kv.key)); d.appendChild(el("span", "v", kv.value)); } });
        return d;
      }
      case "pageLink": return btn("chip link", (b.label || ctx.title("page", b.page) || "Open page") + "  ›", "goto", { type: "page", ref: b.page });
      case "collectionLink": return btn("chip link", (b.label || ctx.title("collection", b.collection) || "Open checklist") + "  ›", "goto", { type: "collection", ref: b.collection });
      case "mapLink": return btn("chip link", (b.label || ctx.title("map", b.map) || "Open map") + "  ›", "goto", { type: "map", ref: b.map, pin: b.pin || "" });
      case "divider": return el("hr", "b-hr");
      default: return null;
    }
  }

  function page(pg, ctx) {
    var d = el("div", "page");
    d.appendChild(el("div", "p-title", pg.title));
    if (pg.summary) d.appendChild(p("p-sum", pg.summary, ctx));
    var body = el("div", "p-body");
    (Array.isArray(pg.blocks) ? pg.blocks : []).forEach(function (b) { var n = block(b, ctx); if (n) body.appendChild(n); });
    d.appendChild(body);
    return d;
  }

  /* Collection (tracker) view: grouped checklist rows with progress and "hide completed". */
  function collection(c, ctx) {
    var d = el("div", "coll");
    var items = Array.isArray(c.items) ? c.items.filter(function (x) { return x && typeof x.id === "string"; }) : [];
    var done = items.filter(function (x) { return ctx.isDone(x.id); }).length;
    var head = el("div", "c-head");
    head.appendChild(el("div", "p-title", c.title));
    head.appendChild(el("div", "c-count", done + " / " + items.length));
    head.appendChild(btn("chip" + (ctx.hideDone ? " solid" : ""), ctx.hideDone ? "Showing open items" : "Hide completed", "hidedone"));
    d.appendChild(head);
    var bar = el("div", "c-bar"); var fill = el("i"); fill.style.setProperty("--p", items.length ? done / items.length : 0); bar.appendChild(fill); d.appendChild(bar);

    var groups = [], idx = {};
    items.forEach(function (it) {
      var g = (c.groupBy && typeof it[c.groupBy] === "string" && it[c.groupBy]) || "";
      if (!(g in idx)) { idx[g] = groups.length; groups.push({ name: g, items: [] }); }
      groups[idx[g]].items.push(it);
    });
    var shown = 0;
    groups.forEach(function (g) {
      var rows = g.items.filter(function (it) { return !(ctx.hideDone && ctx.isDone(it.id)); });
      if (!rows.length) return;
      if (g.name) d.appendChild(el("div", "g-head", g.name + "  ·  " + g.items.filter(function (it) { return ctx.isDone(it.id); }).length + "/" + g.items.length));
      rows.forEach(function (it) {
        shown++;
        var on = ctx.isDone(it.id);
        var row = el("div", "item" + (on ? " done" : ""));
        row.appendChild(check(ctx, it.id));
        var tx = el("div", "tx");
        tx.appendChild(el("b", "", it.label));
        if (it.detail) tx.appendChild(p("d", it.detail, ctx));
        var need = (Array.isArray(it.requires) ? it.requires : []).filter(function (r) { return ctx.hasItem(r) && !ctx.isDone(r); });
        if (need.length) tx.appendChild(el("div", "need", "Needs: " + need.map(function (r) { return ctx.itemLabel(r); }).join(", ")));
        row.appendChild(tx);
        var tags = el("div", "tags");
        if (it.missable) tags.appendChild(el("span", "tag warn", "Missable"));
        if (it.pointOfNoReturn) tags.appendChild(el("span", "tag warn", "Point of no return"));
        if (tags.childNodes.length) row.appendChild(tags);
        var pin0 = Array.isArray(it.pins) && it.pins[0];
        if (pin0 && pin0.mapId) row.appendChild(btn("chip", "Map ›", "goto", { type: "map", ref: pin0.mapId, pin: pin0.pinId || "" }));
        if (typeof it.pageRef === "string") row.appendChild(btn("chip", "Guide ›", "goto", { type: "page", ref: it.pageRef }));
        d.appendChild(row);
      });
    });
    if (!shown) d.appendChild(el("div", "empty", items.length ? "Everything here is done." : "This checklist is empty."));
    return d;
  }

  function table(t, ctx) {
    var d = el("div", "page");
    d.appendChild(el("div", "p-title", t.title));
    var tb = el("table", "b-table"), cols = Array.isArray(t.columns) ? t.columns : [];
    var hr = el("tr");
    cols.forEach(function (c) { hr.appendChild(el("th", c && c.type === "number" ? "num" : "", c && c.label)); });
    tb.appendChild(hr);
    (Array.isArray(t.rows) ? t.rows : []).forEach(function (r) {
      var tr = el("tr");
      (Array.isArray(r) ? r : []).forEach(function (cell, i) {
        var type = cols[i] && cols[i].type;
        tr.appendChild(el("td", type === "number" ? "num" : "", type === "bool" ? (cell ? "✓" : "–") : cell));
      });
      tb.appendChild(tr);
    });
    d.appendChild(tb);
    return d;
  }


  return { el: el, btn: btn, icon: icon, inline: inline, block: block, page: page, collection: collection, table: table };
})();
