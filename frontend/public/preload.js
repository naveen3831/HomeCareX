(function () {
  var path = window.location.pathname;
  if (path === "/") {
    var l = document.createElement("link");
    l.rel = "preload";
    l.as = "image";
    l.type = "image/webp";
    l.setAttribute(
      "imagesrcset",
      "/images/background-800.webp 800w, /images/background-1280.webp 1280w, /images/background.webp 1672w"
    );
    l.setAttribute("imagesizes", "100vw");
    l.setAttribute("fetchpriority", "high");
    document.head.appendChild(l);

    var insertShell = function () {
      if (!document.body || document.getElementById("hcx-shell")) return;
      document.body.insertAdjacentHTML(
        "beforeend",
        '<div id="hcx-shell" aria-hidden="true">' +
          '<div class="sp"></div>' +
          '<img src="/images/background.webp"' +
          ' srcset="/images/background-800.webp 800w, /images/background-1280.webp 1280w, /images/background.webp 1672w"' +
          ' sizes="100vw" width="1672" height="941" alt=""' +
          ' fetchpriority="high" decoding="async" />' +
          '<div class="ov"></div>' +
          "</div>"
      );
      setTimeout(function () {
        var s = document.getElementById("hcx-shell");
        if (s) s.remove();
      }, 8000);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", insertShell, { once: true });
    } else {
      insertShell();
    }
  } else if (path === "/services") {
    var l = document.createElement("link");
    l.rel = "preload";
    l.as = "image";
    l.type = "image/webp";
    l.href = "/images/appliance-repair.webp";
    l.setAttribute("fetchpriority", "high");
    document.head.appendChild(l);
  }
})();

