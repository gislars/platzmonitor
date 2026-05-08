/*
 * Ein Skript pro Seite: [data-platzmonitor-chart] erzeugt Iframes auf /embed; Höhe per postMessage.
 * Konferenz: Skript absolut von der deployten Platzmonitor-Frontend-URL laden (Basis = Verzeichnis dieser JS-Datei).
 * Optional data-embed-origin am Platzhalter nur wenn die Basis von der Skript-URL abweichen soll.
 */
(function () {
  /* Muss identisch zu EMBED_IFRAME_RESIZE_MESSAGE in frontend/src/chartEmbed.ts sein. */
  var MSG = "platzmonitor-embed-resize";

  var STYLE_ID = "platzmonitor-embed-style";
  var OVERLAY_ATTR = "data-platzmonitor-loading-overlay";

  function ensureStylesInstalled() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    var css =
      "" +
      "@keyframes pmSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}\n" +
      ".pmEmbedRoot{position:relative}\n" +
      ".pmEmbedOverlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.78);z-index:2147483647}\n" +
      ".pmEmbedSpinner{width:64px;height:64px;color:#ee7f00;display:block;animation:pmSpin 1.1s linear infinite;transform-box:fill-box;transform-origin:50% 50%}\n" +
      ".pmEmbedSrOnly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}\n";
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.type = "text/css";
    el.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(el);
  }

  function buildSpinnerSvg() {
    var compassD =
      "m -52.90816,-124.97141 a 14.363386,14.381615 67.197737 0 0 -4.005734,0.6478 l 3.212674,4.41532 c 0.305427,-0.0331 0.614154,-0.0528 0.927038,-0.0528 2.845302,-0.007 5.402394,1.2301 7.155671,3.1998 l 5.332994,-0.76917 a 14.363386,14.381615 67.197737 0 0 -12.622643,-7.44478 z m -7.510443,2.28801 a 14.363386,14.381615 67.197737 0 0 -6.839293,12.12077 14.363386,14.381615 67.197737 0 0 0.922158,4.84211 l 4.119856,-3.42566 c -0.05277,-0.40701 -0.0818,-0.82467 -0.08246,-1.24646 -0.0059,-2.7484 1.155483,-5.2277 3.015826,-6.97413 z m 21.123586,7.42192 -4.027569,3.36974 c 0.07256,0.47034 0.112804,0.95044 0.114122,1.4408 0.0061,2.88457 -1.27409,5.47888 -3.29856,7.2342 l 0.709806,4.922992 a 14.363386,14.381615 67.197737 0 0 7.297699,-12.356682 14.363386,14.381615 67.197737 0 0 -0.795301,-4.61105 z m -20.760502,10.98452 -5.151256,0.75941 a 14.363386,14.381615 67.197737 0 0 12.36049,7.278882 14.363386,14.381615 67.197737 0 0 4.812119,-0.909623 l -3.263865,-3.847339 c -0.467708,0.0719 -0.947489,0.11083 -1.435054,0.11281 -2.936533,0.007 -5.566583,-1.31256 -7.322434,-3.39367 z";
    var starD =
      "m -60.874505,-128.43721 3.478589,16.29848 -9.721668,8.08078 12.658003,-1.86245 8.080995,9.523146 -1.804073,-12.483156 9.638612,-8.06833 -12.648899,1.82539 z m 5.452132,11.65735 2.699514,4.92617 1.62286,-3.00448 -0.611515,3.37165 5.343021,-1.83078 -4.878942,2.76443 2.966286,1.53388 -3.272111,-0.50863 1.918462,5.52099 -2.946034,-4.97159 -1.61092,2.83464 0.488817,-3.2356 -5.290776,1.78134 4.860339,-2.85073 -3.065236,-1.69103 3.528195,0.70212 z";
    return (
      // ViewBox ist bewusst grosszuegig, damit beim Rotieren nichts geclippt wird.
      '<svg class="pmEmbedSpinner" viewBox="-5.5135874037 -2.0911430689 40 40" overflow="visible" shape-rendering="geometricPrecision" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="translate(-38.720185 -90.125791)">' +
      '<g transform="translate(105.97808 218.563)">' +
      '<path fill="currentColor" d="' +
      compassD +
      '"/>' +
      '<path fill="currentColor" d="' +
      starD +
      '"/>' +
      "</g></g>" +
      "</svg>"
    );
  }

  function createLoadingOverlay(node) {
    ensureStylesInstalled();

    if (!node.classList.contains("pmEmbedRoot")) {
      node.classList.add("pmEmbedRoot");
    }
    node.setAttribute("aria-busy", "true");

    var overlay = document.createElement("div");
    overlay.className = "pmEmbedOverlay";
    overlay.setAttribute(OVERLAY_ATTR, "1");

    overlay.innerHTML = buildSpinnerSvg() + '<span class="pmEmbedSrOnly" role="status">Wird geladen</span>';
    return overlay;
  }

  function removeLoadingOverlayForIframe(iframe) {
    if (!iframe || !iframe.parentNode) {
      return;
    }
    var parent = iframe.parentNode;
    try {
      var ov = parent.querySelector("[" + OVERLAY_ATTR + "='1']");
      if (ov) {
        ov.parentNode.removeChild(ov);
      }
      if (parent && parent.setAttribute) {
        parent.setAttribute("aria-busy", "false");
      }
    } catch (err) {
      // Ignorieren: Host-Seite kann manche DOM Zugriffe einschränken.
    }
  }

  function onMessage(e) {
    var d = e.data;
    if (!d || d.type !== MSG || typeof d.height !== "number" || !isFinite(d.height)) {
      return;
    }
    var list = document.querySelectorAll("[data-platzmonitor-chart] iframe");
    for (var i = 0; i < list.length; i++) {
      var fr = list[i];
      try {
        if (fr.contentWindow === e.source) {
          fr.style.height = Math.max(48, Math.ceil(d.height)) + "px";
          removeLoadingOverlayForIframe(fr);
          return;
        }
      } catch (err) {
        return;
      }
    }
  }

  if (!window.__platzmonitorEmbedInstalled) {
    window.__platzmonitorEmbedInstalled = true;
    ensureStylesInstalled();
    window.addEventListener("message", onMessage);
  }

  /*
   * Basis-URL des Embed-Frontends: beim synchronen Laden dieses Skripts setzen (document.currentScript).
   * Spaetere Aufrufe von platzmonitorEmbedScan() (z. B. nach dynamischem Einfuegen eines Platzhalters)
   * laufen ohne currentScript; ohne Cache wuerde sonst window.location (Host-Seite) genutzt und /embed 404.
   */
  var cachedScriptBaseHref = "";
  (function captureScriptBaseOnce() {
    var cur = document.currentScript;
    if (cur && cur.src) {
      var u = new URL(cur.src);
      u.pathname = u.pathname.replace(/\/[^/]+$/, "/");
      cachedScriptBaseHref = u.href;
    }
  })();

  function scriptBaseHref() {
    if (cachedScriptBaseHref) {
      return cachedScriptBaseHref;
    }
    var cur = document.currentScript;
    if (cur && cur.src) {
      var u = new URL(cur.src);
      u.pathname = u.pathname.replace(/\/[^/]+$/, "/");
      return u.href;
    }
    return "";
  }

  function scan() {
    ensureStylesInstalled();
    var fallbackBase = scriptBaseHref();
    var nodes = document.querySelectorAll("[data-platzmonitor-chart]:not([data-platzmonitor-embed-done])");
    for (var j = 0; j < nodes.length; j++) {
      var node = nodes[j];
      var chart = node.getAttribute("data-platzmonitor-chart");
      if (!chart) {
        continue;
      }
      var eventSlug = (node.getAttribute("data-event") || "").trim();
      if (!eventSlug) {
        // Kein Iframe erzeugen: Fehler direkt im Platzhalter zeigen.
        ensureStylesInstalled();
        while (node.firstChild) {
          node.removeChild(node.firstChild);
        }
        var msg = document.createElement("div");
        msg.style.border = "1px solid rgba(0,0,0,.18)";
        msg.style.borderRadius = "10px";
        msg.style.padding = "12px 14px";
        msg.style.background = "rgba(255,255,255,.92)";
        msg.style.color = "#1a1a1a";
        msg.style.font = "14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        msg.innerHTML =
          "<strong>Platzmonitor Einbettung: data-event fehlt.</strong><br/>" +
          "Bitte den Einbettungscode neu erzeugen oder am Platzhalter <code>data-event</code> setzen.";
        node.appendChild(msg);
        node.setAttribute("data-platzmonitor-embed-done", "1");
        continue;
      }
      var base = node.getAttribute("data-embed-origin") || fallbackBase || window.location.origin + "/";
      if (base.charAt(base.length - 1) !== "/") {
        base += "/";
      }
      var embedU = new URL("embed", base);
      embedU.searchParams.set("chart", chart);
      embedU.searchParams.set("event", eventSlug);
      // Optional: Registrierungen im Embed um Vorjahre / explizite Liste erweitern.
      var regInc = (node.getAttribute("data-registrations-include") || "").trim();
      if (regInc && (chart === "reg-weekly" || chart === "reg-cumulative")) {
        embedU.searchParams.set("include", regInc);
      }
      var qid = node.getAttribute("data-quota-id");
      if (qid) {
        embedU.searchParams.set("quotaId", qid);
      }
      var mw = node.getAttribute("data-max-width");
      var ifr = document.createElement("iframe");
      ifr.src = embedU.href;
      ifr.title = node.getAttribute("data-title") || "Platzmonitor";
      /* Kein loading=lazy: sonst bleiben untere Iframes mit Defaulthoehe, bis sie nachladen */
      ifr.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      ifr.style.width = "100%";
      ifr.style.border = "0";
      ifr.style.display = "block";
      ifr.style.minHeight = "120px";
      ifr.style.height = node.getAttribute("data-initial-height") || "420px";
      if (mw) {
        node.style.maxWidth = /px$/i.test(mw) ? mw : mw + "px";
      }
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
      node.appendChild(ifr);
      node.appendChild(createLoadingOverlay(node));
      (function (frame) {
        frame.addEventListener("load", function () {
          removeLoadingOverlayForIframe(frame);
        });
      })(ifr);
      node.setAttribute("data-platzmonitor-embed-done", "1");
    }
  }

  window.platzmonitorEmbedScan = scan;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
})();
