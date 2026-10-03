export function getDisplayMode(nav, standaloneMedia = false) {
  const standalone = nav.standalone === true || standaloneMedia;
  return { standalone };
}
export function watchDisplayMode(win = window, doc = document) {
  const media = win.matchMedia("(display-mode: standalone)");
  const update = () => {
    const mode = getDisplayMode(win.navigator, media.matches);
    doc.documentElement.classList.toggle("standalone-app", mode.standalone);
  };
  update();
  media.addEventListener("change", update);
  win.addEventListener("pageshow", update);
  return () => {
    media.removeEventListener("change", update);
    win.removeEventListener("pageshow", update);
  };
}
