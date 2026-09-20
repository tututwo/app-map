const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const box = () => document.querySelector("input[role=combobox]");
const text = (el) => (el ? el.innerText.replace(/\s*\n+\s*/g, " / ").trim() : null);
const snap = () => ({
  search_box: box()?.value ?? null,
  search_options: [...document.querySelectorAll("[role=option]")].map(text),
  search_message: text(document.querySelector("#find-note")) || null,
  view_by_pressed: [...document.querySelectorAll("button[aria-pressed=true]")].map(text).join(", "),
  map_message: text(document.querySelector(".map-hint")),
  error_banner: [...document.querySelectorAll("main [role=alert]")].map(text).join(" | ") || null,
  panel: text(document.querySelector("aside"))?.slice(0, 520),
});
const acts = {
  async type(value) {
    const el = box();
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(1200);
  },
  async key(name) {
    box().dispatchEvent(
      new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })
    );
    await sleep(name === "Enter" ? 3500 : 400);
  },
  async press(label) {
    [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === label)?.click();
    await sleep(2500);
  },
  async to(year) {
    const select = document.querySelector("select[name=to]");
    select.value = String(year);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(1500);
  },
};
window.__run = async (id, TASK) => {
  const transcript = [{ action: "opens the page", then: snap() }];
  for (const [verb, value, words] of TASK) {
    await acts[verb](value);
    transcript.push({ action: words, then: snap() });
  }
  localStorage.setItem("ux_" + id, JSON.stringify(transcript));
  return transcript.length + " steps recorded for " + id;
};
