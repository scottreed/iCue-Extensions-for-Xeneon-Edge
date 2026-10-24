/* Pan / zoom controller for a "world" element inside a viewport. One finger or mouse drags, two fingers pinch (the Edge supports two touches),
   the mouse wheel zooms. Position and zoom reach CSS through the variables --tx, --ty and --k, so the browser composites the movement.
   A tap (a press that did not move) is reported through opts.onTap(elementUnderFinger). */
function Viewer(vp, world, opts) {
  var self = this;
  this.vp = vp; this.world = world;
  this.w = opts.w; this.h = opts.h;
  this.maxFit = opts.maxFit || 8;       // never fit-zoom a small world beyond this
  this.onTap = opts.onTap || function () {};
  this.onChange = opts.onChange || function () {};
  this.k = 1; this.tx = 0; this.ty = 0; this.fit = 1;
  var ptrs = {}, count = 0, drag = false, multi = false, start = null, last = null;
  var timer = 0;

  function pos(ev) { var r = vp.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function two() { var ids = Object.keys(ptrs); return ids.length >= 2 ? [ptrs[ids[0]], ptrs[ids[1]]] : null; }

  vp.addEventListener("pointerdown", function (ev) {
    var p = pos(ev);
    ptrs[ev.pointerId] = p; count++;
    try { vp.setPointerCapture(ev.pointerId); } catch (e) {}
    if (count === 1) { drag = false; multi = false; start = { x: p.x, y: p.y, t: Date.now(), cx: ev.clientX, cy: ev.clientY }; }
    else { multi = true; last = null; }
    self.stopAnim();
  });
  vp.addEventListener("pointermove", function (ev) {
    if (!ptrs[ev.pointerId]) return;
    var p = pos(ev), prev = ptrs[ev.pointerId];
    var pair = two();
    if (pair) {
      var a = pair[0], b = pair[1];
      var d0 = Math.hypot(a.x - b.x, a.y - b.y), mx0 = (a.x + b.x) / 2, my0 = (a.y + b.y) / 2;
      ptrs[ev.pointerId] = p;
      var np = two();
      var d1 = Math.hypot(np[0].x - np[1].x, np[0].y - np[1].y), mx1 = (np[0].x + np[1].x) / 2, my1 = (np[0].y + np[1].y) / 2;
      if (d0 > 4 && d1 > 4) { self.zoomAt(d1 / d0, mx0, my0, true); }
      self.panBy(mx1 - mx0, my1 - my0);
      drag = true;
      return;
    }
    ptrs[ev.pointerId] = p;
    if (!drag && start && Math.hypot(p.x - start.x, p.y - start.y) > 6) drag = true;
    if (drag) self.panBy(p.x - prev.x, p.y - prev.y);
  });
  function up(ev, cancelled) {
    if (!ptrs[ev.pointerId]) return;
    delete ptrs[ev.pointerId]; count--;
    try { vp.releasePointerCapture(ev.pointerId); } catch (e) {}
    if (count === 0) {
      var ok = !cancelled && !drag && !multi && start && Date.now() - start.t < 700;
      if (ok) self.onTap(document.elementFromPoint(ev.clientX, ev.clientY), ev);
      start = null; multi = false; drag = false;
      self.changed();
    }
  }
  vp.addEventListener("pointerup", function (ev) { up(ev, false); });
  vp.addEventListener("pointercancel", function (ev) { up(ev, true); });
  vp.addEventListener("wheel", function (ev) { ev.preventDefault(); var p = pos(ev); self.zoomAt(Math.exp(-ev.deltaY * 0.0016), p.x, p.y, true); self.changed(); }, { passive: false });
}

Viewer.prototype.box = function () { var r = this.vp.getBoundingClientRect(); return { w: r.width || 1, h: r.height || 1 }; };

Viewer.prototype.clamp = function () {
  var b = this.box(), mw = b.w * 0.3, mh = b.h * 0.3, sw = this.w * this.k, sh = this.h * this.k;
  this.tx = sw <= b.w ? (b.w - sw) / 2 : Math.min(mw, Math.max(b.w - sw - mw, this.tx));
  this.ty = sh <= b.h ? (b.h - sh) / 2 : Math.min(mh, Math.max(b.h - sh - mh, this.ty));
};

Viewer.prototype.apply = function () {
  var s = this.world.style;
  s.setProperty("--k", String(this.k)); s.setProperty("--tx", this.tx + "px"); s.setProperty("--ty", this.ty + "px");
};

Viewer.prototype.limits = function () { return { min: this.fit * 0.8, max: Math.max(this.fit * 10, 3) }; };

Viewer.prototype.fitView = function () {
  var b = this.box();
  this.fit = Math.min(b.w / this.w, b.h / this.h) * 0.98;
  this.k = Math.min(this.fit, this.maxFit);
  this.tx = (b.w - this.w * this.k) / 2; this.ty = (b.h - this.h * this.k) / 2;
  this.clamp(); this.apply();
};

Viewer.prototype.panBy = function (dx, dy) { this.tx += dx; this.ty += dy; this.clamp(); this.apply(); };

Viewer.prototype.zoomAt = function (factor, cx, cy) {
  var l = this.limits(), nk = Math.min(l.max, Math.max(l.min, this.k * factor)), f = nk / this.k;
  this.tx = cx - (cx - this.tx) * f; this.ty = cy - (cy - this.ty) * f; this.k = nk;
  this.clamp(); this.apply();
};

Viewer.prototype.zoomCenter = function (factor) { var b = this.box(); this.animate(); this.zoomAt(factor, b.w / 2, b.h / 2); this.changed(); };

/* Centre world point (x, y) in the viewport; zoomMul is relative to the fit scale. */
Viewer.prototype.focus = function (x, y, zoomMul) {
  var b = this.box(), l = this.limits();
  if (zoomMul) this.k = Math.min(l.max, Math.max(l.min, this.fit * zoomMul));
  this.tx = b.w / 2 - x * this.k; this.ty = b.h / 2 - y * this.k;
  this.animate(); this.clamp(); this.apply(); this.changed();
};

Viewer.prototype.getView = function () { var b = this.box(); return { x: (b.w / 2 - this.tx) / this.k, y: (b.h / 2 - this.ty) / this.k, z: this.k / this.fit }; };
Viewer.prototype.setView = function (v) { this.focus(v.x, v.y, v.z); this.stopAnim(); };

Viewer.prototype.animate = function () { var self = this; this.world.classList.add("anim"); clearTimeout(this._t); this._t = setTimeout(function () { self.world.classList.remove("anim"); }, 300); };
Viewer.prototype.stopAnim = function () { clearTimeout(this._t); this.world.classList.remove("anim"); };
Viewer.prototype.changed = function () { var self = this; clearTimeout(this._c); this._c = setTimeout(function () { self.onChange(self.getView()); }, 300); };
