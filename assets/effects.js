/* Python Mastery: visual polish layer. Independent of app.js; safe to remove. */
(function () {
  "use strict";
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;

  function start() {
    // Spotlight that follows the pointer on cards.
    if (fine) {
      document.addEventListener("pointermove", function (event) {
        var card = event.target.closest && event.target.closest(".card, .source");
        if (!card) return;
        var box = card.getBoundingClientRect();
        card.style.setProperty("--mx", event.clientX - box.left + "px");
        card.style.setProperty("--my", event.clientY - box.top + "px");
      }, { passive: true });
    }

    // Gentle 3D tilt on the hero terminal.
    var terminal = document.querySelector(".hero .terminal");
    if (terminal && fine && !reduced) {
      terminal.addEventListener("pointermove", function (event) {
        var box = terminal.getBoundingClientRect();
        var x = (event.clientX - box.left) / box.width - 0.5;
        var y = (event.clientY - box.top) / box.height - 0.5;
        terminal.style.setProperty("--ry", (x * 5).toFixed(2) + "deg");
        terminal.style.setProperty("--rx", (-y * 5).toFixed(2) + "deg");
      });
      terminal.addEventListener("pointerleave", function () {
        terminal.style.setProperty("--ry", "0deg");
        terminal.style.setProperty("--rx", "0deg");
      });
    }

    // Hero output lines appear one after another, like a program running.
    var outputs = document.querySelectorAll(".hero .term-body .term-out");
    if (outputs.length && !reduced) {
      outputs.forEach(function (line) { line.classList.add("fx-wait"); });
      outputs.forEach(function (line, index) {
        setTimeout(function () { line.classList.remove("fx-wait"); }, 700 + index * 420);
      });
    }

    // Section headings draw their underline when they scroll into view.
    var sections = document.querySelectorAll(".section");
    if ("IntersectionObserver" in window) {
      var seen = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("fx-seen");
            seen.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -15% 0px" });
      sections.forEach(function (section) { seen.observe(section); });
    } else {
      sections.forEach(function (section) { section.classList.add("fx-seen"); });
    }

    // Back-to-top button.
    var top = document.createElement("button");
    top.type = "button";
    top.className = "fx-top";
    top.setAttribute("aria-label", "الرجوع لأعلى الصفحة");
    top.textContent = "↑";
    top.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });
    document.body.appendChild(top);
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        top.classList.toggle("show", window.scrollY > 900);
        ticking = false;
      });
    }, { passive: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
