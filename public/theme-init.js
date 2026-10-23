// Apply the saved theme before first paint; the system theme applies otherwise.
try {
  var t = localStorage.getItem("chemsisy.theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
