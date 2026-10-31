export default function placeholder(id, title, group) {
  return {
    id,
    title,
    group,
    comingSoon: true,
    async render(container) {
      container.innerHTML = `
        <div class="page-head"><h1>${title}</h1></div>
        <div class="card soft">
          <h3>Not built yet</h3>
          <p class="muted">This slot is reserved for a future module. Add a folder under
          <code>src/modules/</code> and register it in <code>src/modules/index.js</code>.</p>
        </div>`;
    },
  };
}
