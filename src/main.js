import './style.css';
import { modules } from './modules/index.js';

const app = document.getElementById('app');
app.innerHTML = `
  <aside class="sidebar" id="sidebar">
    <div class="brand"><span class="logo"></span><span>Growth OS</span></div>
    <nav id="nav"></nav>
    <div class="side-foot">Standalone build · v1.1.0</div>
  </aside>
  <main class="main" id="main"></main>`;

const nav = document.getElementById('nav');
const main = document.getElementById('main');

const groups = {};
modules.forEach((m) => (groups[m.group] ||= []).push(m));
nav.innerHTML = Object.entries(groups)
  .map(
    ([g, ms]) => `<div class="nav-group">${g ? `<div class="nav-title">${g}</div>` : ""}${ms
      .map((m) => `<a href="#/${m.id}" data-id="${m.id}">${m.title}${m.comingSoon ? '<em>soon</em>' : ''}</a>`)
      .join('')}</div>`
  )
  .join('');

async function route() {
  const id = location.hash.replace('#/', '') || modules[0].id;
  const mod = modules.find((m) => m.id === id) || modules[0];
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === mod.id));
  main.innerHTML = '<div class="loading">Loading…</div>';
  try {
    main.innerHTML = '';
    await mod.render(main);
  } catch (e) {
    main.innerHTML = `<div class="card"><h3>Something went wrong</h3><p class="muted">${e.message}</p></div>`;
    console.error(e);
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
