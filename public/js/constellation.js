/* Collaborative Research — background constellation
   A quiet network of drifting points with faint connecting lines.
   Vanilla canvas, no dependencies. Tuned for restraint. */

(function () {
  "use strict";

  var canvas = document.getElementById("bg");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  // --- Tuning knobs -------------------------------------------------------
  var CONFIG = {
    density: 0.000248,   // points per pixel of viewport area
    maxPoints: 320,      // hard cap regardless of screen size
    minPoints: 104,
    speed: 0.32,         // px per frame drift
    sepFactor: 0.72,     // repulsion kicks in within this fraction of natural spacing
    sepPush: 0.5,        // strength of the anti-crowding nudge
    linkDist: 140,       // px — points closer than this get a line
    mouseDist: 170,      // px — cursor links to points within this
    dotColor: "196, 135, 58",   // --amber (rgb)
    lineColor: "196, 135, 58",  // --amber (rgb)
    dotAlpha: 0.24,
    lineAlpha: 0.128,    // max line opacity (fades to 0 with distance)
    mouseAlpha: 0.22
  };
  // ------------------------------------------------------------------------

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  var w = 0, h = 0;
  var points = [];
  var spacing = 0;       // natural even spacing for the current point count
  var mouse = { x: null, y: null };
  var rafId = null;

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function buildPoints() {
    var target = Math.round(w * h * CONFIG.density);
    target = Math.max(CONFIG.minPoints, Math.min(CONFIG.maxPoints, target));

    spacing = Math.sqrt((w * h) / target);   // natural even spacing for this count

    // Seed fully at random (organic, no grid regularity), then relax so the
    // points settle into an even-but-irregular spread — "blue noise". This
    // looks random from frame one, with no clumps and no large voids.
    points = [];
    for (var i = 0; i < target; i++) {
      points.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: rand(-CONFIG.speed, CONFIG.speed),
        vy: rand(-CONFIG.speed, CONFIG.speed),
        r: rand(1.36, 2.38),
        sx: 0, sy: 0
      });
    }
    relax(50);
  }

  // Lloyd-style relaxation: repeatedly push neighbours apart until the random
  // seed settles into an even, organic (non-gridded) spread. Build-time only.
  function relax(iterations) {
    var n = points.length;
    var R = spacing, R2 = R * R;
    var step = R * 0.2, cap = R * 0.6, idx;

    for (var it = 0; it < iterations; it++) {
      var grid = makeGrid(R);
      var cols = grid.cols, rows = grid.rows, cells = grid.cells;

      for (idx = 0; idx < n; idx++) { points[idx].sx = 0; points[idx].sy = 0; }

      for (var cy = 0; cy < rows; cy++) {
        for (var cx = 0; cx < cols; cx++) {
          var bucket = cells[cy * cols + cx];
          for (var a = 0; a < bucket.length; a++) {
            var i = bucket[a], p = points[i];
            for (var ny = cy - 1; ny <= cy + 1; ny++) {
              if (ny < 0 || ny >= rows) continue;
              for (var nx = cx - 1; nx <= cx + 1; nx++) {
                if (nx < 0 || nx >= cols) continue;
                var nbc = cells[ny * cols + nx];
                for (var b = 0; b < nbc.length; b++) {
                  var j = nbc[b];
                  if (j <= i) continue;
                  var q = points[j];
                  var dx = p.x - q.x, dy = p.y - q.y;
                  var d2 = dx * dx + dy * dy;
                  if (d2 >= R2 || d2 <= 0.0001) continue;
                  var d = Math.sqrt(d2);
                  var f = 1 - d / R;
                  var ux = dx / d, uy = dy / d;
                  p.sx += ux * f; p.sy += uy * f;
                  q.sx -= ux * f; q.sy -= uy * f;
                }
              }
            }
          }
        }
      }

      for (idx = 0; idx < n; idx++) {
        var m = points[idx];
        var mx = m.sx * step, my = m.sy * step;
        var ml = Math.sqrt(mx * mx + my * my);
        if (ml > cap) { mx = mx / ml * cap; my = my / ml * cap; }
        m.x += mx; m.y += my;
        if (m.x < 0) m.x = 0; else if (m.x > w) m.x = w;
        if (m.y < 0) m.y = 0; else if (m.y > h) m.y = h;
      }
    }
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildPoints();
    if (reduceMotion) render(false); // single static frame
  }

  // Uniform spatial grid: buckets point indices into cells the size of the
  // largest pairwise radius, so each point only tests neighbours in its own
  // cell and the eight around it — cost grows linearly, not as O(n²).
  function makeGrid(cellSize) {
    var cols = Math.max(1, Math.ceil(w / cellSize));
    var rows = Math.max(1, Math.ceil(h / cellSize));
    var cells = new Array(cols * rows);
    for (var c = 0; c < cells.length; c++) cells[c] = [];
    for (var k = 0; k < points.length; k++) {
      var p = points[k];
      var cx = Math.floor(p.x / cellSize);
      var cy = Math.floor(p.y / cellSize);
      if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
      cells[cy * cols + cx].push(k);
    }
    return { cols: cols, rows: rows, cells: cells };
  }

  // Draws one frame. When move is true it also accumulates the separation
  // nudge and advances the field. Lines and dots are drawn from the same
  // positions, then movement is applied afterwards, so they always match.
  function render(move) {
    ctx.clearRect(0, 0, w, h);

    var n = points.length, i;
    if (move) { for (i = 0; i < n; i++) { points[i].sx = 0; points[i].sy = 0; } }

    var ld = CONFIG.linkDist, ld2 = ld * ld;
    var sd = spacing * CONFIG.sepFactor, sd2 = sd * sd, sp = CONFIG.sepPush;

    var grid = makeGrid(ld);            // cell size = largest pairwise radius
    var cols = grid.cols, rows = grid.rows, cells = grid.cells;
    ctx.lineWidth = 1;

    // single pairwise pass over each point's 3×3 cell neighbourhood —
    // draws connecting lines and accumulates the anti-crowding nudge
    for (var cy = 0; cy < rows; cy++) {
      for (var cx = 0; cx < cols; cx++) {
        var bucket = cells[cy * cols + cx];
        for (var a = 0; a < bucket.length; a++) {
          i = bucket[a];
          var p = points[i];
          for (var ny = cy - 1; ny <= cy + 1; ny++) {
            if (ny < 0 || ny >= rows) continue;
            for (var nx = cx - 1; nx <= cx + 1; nx++) {
              if (nx < 0 || nx >= cols) continue;
              var nb = cells[ny * cols + nx];
              for (var b = 0; b < nb.length; b++) {
                var j = nb[b];
                if (j <= i) continue;       // each pair handled once
                var q = points[j];
                var dx = p.x - q.x, dy = p.y - q.y;
                var d2 = dx * dx + dy * dy;
                if (d2 >= ld2 || d2 <= 0.0001) continue;
                var d = Math.sqrt(d2);

                var la = (1 - d / ld) * CONFIG.lineAlpha;
                ctx.strokeStyle = "rgba(" + CONFIG.lineColor + "," + la + ")";
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.stroke();

                if (move && d2 < sd2) {
                  var f = (1 - d / sd) * sp;
                  var ux = dx / d, uy = dy / d;
                  p.sx += ux * f; p.sy += uy * f;
                  q.sx -= ux * f; q.sy -= uy * f;
                }
              }
            }
          }
        }
      }
    }

    // cursor links + dots
    var hasMouse = mouse.x !== null;
    var mdR = CONFIG.mouseDist, mdR2 = mdR * mdR;
    for (i = 0; i < n; i++) {
      var pt = points[i];
      if (hasMouse) {
        var mdx = pt.x - mouse.x, mdy = pt.y - mouse.y;
        var md2 = mdx * mdx + mdy * mdy;
        if (md2 < mdR2) {
          var md = Math.sqrt(md2);
          var ma = (1 - md / mdR) * CONFIG.mouseAlpha;
          ctx.strokeStyle = "rgba(" + CONFIG.lineColor + "," + ma + ")";
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    ctx.fillStyle = "rgba(" + CONFIG.dotColor + "," + CONFIG.dotAlpha + ")";
    for (i = 0; i < n; i++) {
      var dt = points[i];
      ctx.beginPath();
      ctx.arc(dt.x, dt.y, dt.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // advance for next frame (after drawing, so lines and dots stay matched)
    if (move) {
      for (i = 0; i < n; i++) {
        var m = points[i];
        m.x += m.vx + m.sx;
        m.y += m.vy + m.sy;
        if (m.x < 0 || m.x > w) m.vx *= -1;
        if (m.y < 0 || m.y > h) m.vy *= -1;
      }
    }
  }

  function tick() {
    render(true);
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (reduceMotion || rafId !== null) return;
    rafId = requestAnimationFrame(tick);
  }
  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  // --- Events -------------------------------------------------------------
  window.addEventListener("resize", resize);

  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("mouseout", function () {
    mouse.x = null; mouse.y = null;
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  // --- Go -----------------------------------------------------------------
  resize();
  start();
})();
