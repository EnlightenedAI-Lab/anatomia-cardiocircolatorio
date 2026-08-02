(() => {
  "use strict";

  const data = window.MANUAL_DATA;
  if (!data) {
    document.body.innerHTML = "<p>Impossibile caricare il materiale didattico.</p>";
    return;
  }

  const content = document.getElementById("contenuto");
  const moduleNavigation = document.getElementById("module-navigation");
  const searchDialog = document.getElementById("search-dialog");
  const searchInput = document.getElementById("global-search-input");
  const searchResults = document.getElementById("global-search-results");
  const imageDialog = document.getElementById("image-dialog");
  const lightboxImage = document.getElementById("lightbox-image");
  const imageCanvas = document.getElementById("image-canvas");
  const maskLayer = document.getElementById("mask-layer");
  const toastElement = document.getElementById("toast");

  const modulesById = new Map(data.modules.map((item) => [item.id, item]));
  const lessonsById = new Map(data.lessons.map((item) => [item.id, item]));
  const pagesByNumber = new Map(data.pages.map((item) => [item.number, item]));
  const lessonOrder = data.lessons.map((item) => item.id);
  const storageKey = "anatomiaCardiocircolatorioV1";

  let toastTimer = null;
  let lightbox = { items: [], index: 0, zoom: 1 };
  let ui = {
    flashIndex: 0,
    flashReveal: false,
    flashFilter: "all",
    quizIndex: 0,
    quizModule: "all",
    orderStates: {},
    associationStates: {},
    indexModule: "all",
    indexQuery: "",
    glossaryQuery: "",
    oralModule: "all",
  };

  let state = loadState();

  function defaultState() {
    return {
      visited: [],
      completed: [],
      quizResults: {},
      quizAnswers: {},
      flashKnown: [],
      flashReview: [],
      lastLesson: data.lessons[0].id,
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return { ...defaultState(), ...(saved || {}) };
    } catch (_error) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    updateProgressHeader();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9µ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sourceLabel(bounds) {
    return bounds[0] === bounds[1] ? `p. ${bounds[0]}` : `pp. ${bounds[0]}–${bounds[1]}`;
  }

  function moduleProgress(moduleId) {
    const lessonIds = data.lessons.filter((lesson) => lesson.module === moduleId).map((lesson) => lesson.id);
    const complete = lessonIds.filter((id) => state.completed.includes(id)).length;
    return { complete, total: lessonIds.length, percent: lessonIds.length ? Math.round((complete / lessonIds.length) * 100) : 0 };
  }

  function overallProgress() {
    const complete = state.completed.filter((id) => lessonsById.has(id)).length;
    return { complete, total: data.lessons.length, percent: Math.round((complete / data.lessons.length) * 100) };
  }

  function updateProgressHeader() {
    const progress = overallProgress();
    const ring = document.getElementById("header-progress-ring");
    ring.style.setProperty("--progress", `${progress.percent * 3.6}deg`);
    document.getElementById("header-progress-value").textContent = `${progress.percent}%`;
    document.getElementById("header-progress-lessons").textContent = `${progress.complete} di ${progress.total} lezioni`;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.classList.add("show");
    toastTimer = setTimeout(() => toastElement.classList.remove("show"), 2400);
  }

  function renderSidebar() {
    moduleNavigation.innerHTML = `
      <ol class="module-nav-list">
        ${data.modules
          .map(
            (module, index) => `
              <li>
                <a class="module-nav-link" data-module-link="${module.id}" href="#/modulo/${module.id}">
                  <span class="module-nav-number">${String(index + 1).padStart(2, "0")}</span>
                  <span>${escapeHtml(module.title)}</span>
                  <span class="module-nav-pages">${escapeHtml(module.source)}</span>
                </a>
              </li>`,
          )
          .join("")}
      </ol>`;
  }

  function setActiveModule(moduleId) {
    document.querySelectorAll("[data-module-link]").forEach((link) => {
      link.classList.toggle("active", link.dataset.moduleLink === moduleId);
    });
  }

  function breadcrumb(items) {
    return `<nav class="breadcrumb" aria-label="Percorso">
      <a href="#/">Pagina iniziale</a>
      ${items.map((item) => `<span aria-hidden="true">›</span>${item.href ? `<a href="${item.href}">${escapeHtml(item.label)}</a>` : `<span>${escapeHtml(item.label)}</span>`}`).join("")}
    </nav>`;
  }

  function pageShell(inner, options = {}) {
    return `<div class="content-frame${options.narrow ? " narrow" : ""}">${inner}</div>`;
  }

  function actionLink(href, title, description) {
    return `<a class="home-action" href="${href}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></a>`;
  }

  function renderHome() {
    setActiveModule(null);
    const lastLesson = lessonsById.get(state.lastLesson) || data.lessons[0];
    const lastModule = modulesById.get(lastLesson.module);
    const stats = data.stats;
    const body = `
      <section class="hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">Manuale integrale · 100 pagine · Italiano</p>
          <h1><span>Anatomia 1</span>Apparato cardiocircolatorio</h1>
          <p class="lead">Il contenuto originale della sbobina, comprese immagini, tavole e fotografie, organizzato per studiare, cercare e ripassare senza perdere la fonte.</p>
          <p class="hero-source">${escapeHtml(data.meta.source)}</p>
        </div>
        <figure class="hero-cover">
          <button type="button" data-lightbox data-gallery="copertina" data-src="assets/pages/page-001.jpg" data-title="Copertina originale" data-page="1" aria-label="Ingrandisci la copertina originale">
            <img src="assets/pages/page-001.jpg" alt="Copertina originale della sbobina" loading="eager">
          </button>
          <figcaption>Pagina 1 · Apri e ingrandisci</figcaption>
        </figure>
      </section>

      <nav class="home-actions" aria-label="Strumenti principali">
        ${actionLink(`#/lezione/${lastLesson.id}`, "Continua lo studio", lastLesson.title)}
        ${actionLink("#/indice", "Indice completo", "Naviga le 100 pagine originali")}
        ${actionLink("#/cerca", "Cerca nel manuale", "Testo, figure, termini e didascalie")}
        ${actionLink("#/glossario", "Glossario", `${stats.glossaryTerms} termini tratti dalla fonte`)}
        ${actionLink("#/flashcard", "Flashcard", `${stats.flashcards} schede di memorizzazione`)}
        ${actionLink("#/quiz", "Quiz", `${stats.quizQuestions} verifiche derivate dal manuale`)}
        ${actionLink("#/esame", "Esame orale", `${stats.oralQuestions} domande con checklist`)}
        ${actionLink("#/ripasso", "Ripasso rapido", "Richiami essenziali con link al testo completo")}
      </nav>

      <div class="stats-strip" aria-label="Copertura del manuale">
        <div class="stat"><strong>100/100</strong><span>Pagine rappresentate</span></div>
        <div class="stat"><strong>${stats.modules}</strong><span>Moduli tematici</span></div>
        <div class="stat"><strong>${stats.lessons}</strong><span>Lezioni complete</span></div>
        <div class="stat"><strong>${stats.originalFiguresUsed}</strong><span>Figure originali</span></div>
        <div class="stat"><strong>${stats.glossaryTerms}</strong><span>Termini indicizzati</span></div>
        <div class="stat"><strong>${stats.quizQuestions}</strong><span>Domande di verifica</span></div>
      </div>

      <section class="continue-panel">
        <div>
          <p>Ultimo punto di studio · ${escapeHtml(lastModule.title)}</p>
          <h3>${escapeHtml(lastLesson.title)}</h3>
          <p>${escapeHtml(lastLesson.source)} · Il progresso resta salvato soltanto in questo browser.</p>
        </div>
        <a class="primary-button" href="#/lezione/${lastLesson.id}">Riprendi →</a>
      </section>

      <section>
        <div class="section-heading">
          <div><p class="eyebrow">Percorso per argomenti</p><h2>Moduli del manuale</h2></div>
          <p>L’ordine segue il contenuto effettivo della sbobina. Ogni sezione indica sempre le pagine PDF da cui deriva.</p>
        </div>
        <div class="module-table">
          ${data.modules
            .map((module, index) => {
              const progress = moduleProgress(module.id);
              return `<a class="module-row" href="#/modulo/${module.id}">
                <span class="module-index">${String(index + 1).padStart(2, "0")}</span>
                <span class="module-row-title">${escapeHtml(module.title)}</span>
                <span class="module-row-meta">${escapeHtml(module.source)}</span>
                <span class="module-row-progress">${progress.complete}/${progress.total} lezioni</span>
              </a>`;
            })
            .join("")}
        </div>
      </section>`;
    content.innerHTML = pageShell(body);
    document.title = `${data.meta.title} — Anatomia 1`;
  }

  function renderModule(moduleId) {
    const module = modulesById.get(moduleId);
    if (!module) return renderNotFound();
    setActiveModule(module.id);
    const lessons = data.lessons.filter((lesson) => lesson.module === module.id);
    const progress = moduleProgress(module.id);
    const moduleIndex = data.modules.findIndex((item) => item.id === module.id) + 1;
    const body = `
      ${breadcrumb([{ label: module.title }])}
      <header class="page-heading">
        <div>
          <p class="eyebrow">Modulo ${String(moduleIndex).padStart(2, "0")} · ${escapeHtml(module.source)}</p>
          <h1>${escapeHtml(module.title)}</h1>
          <p>${progress.complete} di ${progress.total} lezioni completate. Tutte le pagine originali del modulo sono disponibili nel testo e come facsimile.</p>
        </div>
        <div class="heading-actions">
          <a class="secondary-button" href="#/ripasso?module=${module.id}">Ripasso rapido</a>
          <a class="primary-button" href="#/quiz?module=${module.id}">Verifica il modulo</a>
        </div>
      </header>
      <section>
        <div class="section-heading"><div><p class="eyebrow">Contenuto completo</p><h2>Lezioni</h2></div></div>
        <div class="lesson-list">
          ${lessons
            .map((lesson) => {
              const complete = state.completed.includes(lesson.id);
              return `<a class="lesson-row" href="#/lezione/${lesson.id}">
                <span class="lesson-status${complete ? " complete" : ""}" aria-label="${complete ? "Completata" : "Non completata"}">✓</span>
                <span><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.pageNumbers.length} ${lesson.pageNumbers.length === 1 ? "pagina" : "pagine"} · testo e immagini originali</small></span>
                <span class="lesson-source">${escapeHtml(lesson.source)}</span>
                <span class="lesson-arrow" aria-hidden="true">→</span>
              </a>`;
            })
            .join("")}
        </div>
      </section>`;
    content.innerHTML = pageShell(body);
    document.title = `${module.title} — ${data.meta.title}`;
  }

  function renderTextBlock(block) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return "";
    const first = lines[0];
    const isHeading = first.length <= 105 && first === first.toUpperCase() && /[A-ZÀ-Ü]/.test(first);
    const callout = /^(ATTENZIONE|IMPORTANTE|NOTA BENE|CONSIGLIO)/i.test(first);
    const startsBullet = lines.some((line) => /^[-•]\s*/.test(line));

    if (isHeading && lines.length === 1) return `<h3>${escapeHtml(first)}</h3>`;
    if (startsBullet) {
      const intro = [];
      const items = [];
      let current = null;
      lines.forEach((line) => {
        if (/^[-•]\s*/.test(line)) {
          if (current) items.push(current);
          current = line.replace(/^[-•]\s*/, "");
        } else if (current) {
          current += ` ${line}`;
        } else {
          intro.push(line);
        }
      });
      if (current) items.push(current);
      return `${intro.length ? `<p>${escapeHtml(intro.join(" "))}</p>` : ""}<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }
    return `<p${callout ? ' class="source-callout"' : ""}>${escapeHtml(lines.join(" "))}</p>`;
  }

  function formatOriginalText(text) {
    if (!text.trim()) return "";
    return text.split(/\n\s*\n/).map(renderTextBlock).join("");
  }

  function lightboxAttributes(path, title, page, gallery) {
    return `data-lightbox data-src="${escapeHtml(path)}" data-title="${escapeHtml(title)}" data-page="${page}" data-gallery="${escapeHtml(gallery)}"`;
  }

  function renderManualPage(page, context = "lesson") {
    const gallery = `pagina-${page.number}`;
    const textContent = page.text.trim();
    const ocr = page.visualIndex.trim();
    const imageOnlyNote = page.imageOnly
      ? `<div class="image-only-note"><strong>Pagina a prevalenza grafica.</strong> Il facsimile integrale e le figure estratte costituiscono la fonte autorevole. Il testo riconosciuto nelle immagini serve soltanto alla ricerca.</div>`
      : "";
    const ocrDetails = page.imageOnly && ocr
      ? `<details class="ocr-details"><summary>Mostra l’indice testuale riconosciuto nelle figure</summary><p>Riconoscimento automatico: verificare sempre il facsimile.</p><pre>${escapeHtml(ocr)}</pre></details>`
      : "";
    const originalText = textContent
      ? `<div class="original-text">${formatOriginalText(textContent)}</div>`
      : `<div class="empty-state">Questa pagina è composta da immagini e schemi. Consulta il facsimile e la galleria originale.</div>`;
    const figures = page.figures.length
      ? `<section class="figure-gallery" aria-labelledby="figure-title-${page.number}">
          <div class="panel-label" id="figure-title-${page.number}">Figure originali della pagina</div>
          <div class="figure-grid">
            ${page.figures
              .map(
                (figure) => `<figure class="figure-card">
                  <button type="button" ${lightboxAttributes(figure.path, `Pagina ${page.number} · Figura ${figure.figure_number}`, page.number, gallery)} aria-label="Ingrandisci la figura ${figure.figure_number} della pagina ${page.number}">
                    <img src="${figure.path}" alt="Figura originale ${figure.figure_number} della pagina ${page.number}" loading="lazy">
                  </button>
                  <figcaption>Figura ${figure.figure_number} · PDF originale, p. ${page.number}</figcaption>
                </figure>`,
              )
              .join("")}
          </div>
        </section>`
      : "";
    return `<article class="manual-page" id="pagina-${page.number}">
      <header class="manual-page-header">
        <h2><span class="page-number-badge">Pagina ${page.number}</span>${escapeHtml(page.title)}</h2>
        <div class="manual-page-tools">
          ${context !== "page" ? `<a class="secondary-button" href="#/pagina/${page.number}">Apri pagina</a>` : ""}
          <button class="secondary-button" type="button" ${lightboxAttributes(page.pageImage, `Facsimile integrale · Pagina ${page.number}`, page.number, gallery)}>Ingrandisci</button>
        </div>
      </header>
      <div class="page-study-grid">
        <section class="transcript-panel">
          <div class="panel-label">Testo della sbobina</div>
          ${imageOnlyNote}
          ${originalText}
          ${ocrDetails}
        </section>
        <figure class="page-facsimile">
          <button class="facsimile-button" type="button" ${lightboxAttributes(page.pageImage, `Facsimile integrale · Pagina ${page.number}`, page.number, gallery)} aria-label="Ingrandisci il facsimile della pagina ${page.number}">
            <img src="${page.pageImage}" alt="Facsimile integrale della pagina ${page.number}" loading="lazy">
          </button>
          <figcaption>Facsimile integrale della pagina ${page.number}. Clicca per zoom, schermo quasi intero e modalità test.</figcaption>
        </figure>
      </div>
      ${figures}
      <footer class="source-note"><span><strong>Fonte</strong> · PDF originale, p. ${page.number}</span><a href="#/lezione/${page.lesson}">Vai alla lezione completa</a></footer>
    </article>`;
  }

  function markVisited(lessonId) {
    if (!state.visited.includes(lessonId)) state.visited.push(lessonId);
    state.lastLesson = lessonId;
    saveState();
  }

  function renderLesson(lessonId) {
    const lesson = lessonsById.get(lessonId);
    if (!lesson) return renderNotFound();
    const module = modulesById.get(lesson.module);
    setActiveModule(module.id);
    markVisited(lesson.id);
    const complete = state.completed.includes(lesson.id);
    const lessonIndex = lessonOrder.indexOf(lesson.id);
    const previous = data.lessons[lessonIndex - 1];
    const next = data.lessons[lessonIndex + 1];
    const pages = lesson.pageNumbers.map((number) => pagesByNumber.get(number));
    const body = `
      ${breadcrumb([{ label: module.title, href: `#/modulo/${module.id}` }, { label: lesson.title }])}
      <header class="page-heading">
        <div>
          <p class="eyebrow">Lezione completa · ${escapeHtml(lesson.source)}</p>
          <h1>${escapeHtml(lesson.title)}</h1>
          <p>Testo e immagini del manuale sono presentati insieme. Gli strumenti di studio sono separati e rimandano sempre alla fonte originale.</p>
        </div>
        <div class="heading-actions">
          <a class="secondary-button" href="#/quiz?module=${module.id}">Quiz del modulo</a>
          <button class="primary-button" type="button" data-action="completa-lezione" data-lesson="${lesson.id}">${complete ? "✓ Lezione completata" : "Segna come completata"}</button>
        </div>
      </header>
      <aside class="study-tool" aria-label="Strumento di studio derivato">
        <div class="study-tool-header"><div><p class="eyebrow">Strumento di studio derivato</p><h2>Punti da tenere presenti</h2></div><a class="text-button" href="#/esame?module=${module.id}">Modalità esame orale →</a></div>
        <p>Le formulazioni sottostanti sono estratti della sbobina; non sostituiscono il contenuto completo.</p>
        <ul>${lesson.studyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
      </aside>
      ${pages.map((page) => renderManualPage(page)).join("")}
      <nav class="lesson-pagination" aria-label="Lezioni precedente e successiva">
        ${previous ? `<a href="#/lezione/${previous.id}"><small>← Lezione precedente</small><strong>${escapeHtml(previous.title)}</strong></a>` : `<span></span>`}
        ${next ? `<a href="#/lezione/${next.id}"><small>Lezione successiva →</small><strong>${escapeHtml(next.title)}</strong></a>` : ""}
      </nav>`;
    content.innerHTML = pageShell(body);
    document.title = `${lesson.title} — ${data.meta.title}`;
  }

  function renderPage(pageNumber) {
    const page = pagesByNumber.get(Number(pageNumber));
    if (!page) return renderNotFound();
    const lesson = lessonsById.get(page.lesson);
    const module = modulesById.get(page.module);
    setActiveModule(module.id);
    markVisited(lesson.id);
    const body = `
      ${breadcrumb([{ label: module.title, href: `#/modulo/${module.id}` }, { label: lesson.title, href: `#/lezione/${lesson.id}` }, { label: `Pagina ${page.number}` }])}
      <header class="page-heading">
        <div><p class="eyebrow">Indice del manuale · Pagina ${page.number} di 100</p><h1>${escapeHtml(page.title)}</h1><p>Questa vista corrisponde direttamente alla pagina originale. Apri la lezione per il contesto completo.</p></div>
        <div class="heading-actions"><a class="primary-button" href="#/lezione/${lesson.id}">Studia la lezione completa</a></div>
      </header>
      ${renderManualPage(page, "page")}`;
    content.innerHTML = pageShell(body);
    document.title = `Pagina ${page.number} — ${data.meta.title}`;
  }

  function renderManualIndex() {
    setActiveModule(null);
    const moduleOptions = data.modules.map((module) => `<option value="${module.id}"${ui.indexModule === module.id ? " selected" : ""}>${escapeHtml(module.title)}</option>`).join("");
    const filtered = data.pages.filter((page) => {
      const moduleMatch = ui.indexModule === "all" || page.module === ui.indexModule;
      const query = normalize(ui.indexQuery);
      const queryMatch = !query || normalize(`${page.title} ${lessonsById.get(page.lesson).title} ${page.text} ${page.visualIndex}`).includes(query);
      return moduleMatch && queryMatch;
    });
    const body = `
      ${breadcrumb([{ label: "Indice del manuale" }])}
      <header class="page-heading"><div><p class="eyebrow">Tracciabilità pagina per pagina</p><h1>Indice del manuale</h1><p>Ogni pagina del PDF è collegata al modulo e alla lezione corrispondenti. Copertura verificata: 100/100.</p></div></header>
      <div class="manual-index-tools">
        <label class="filter-field"><span>Filtra per modulo</span><select id="index-module-filter"><option value="all">Tutti i moduli</option>${moduleOptions}</select></label>
        <label class="filter-field"><span>Cerca nelle pagine</span><input id="index-query-filter" type="search" value="${escapeHtml(ui.indexQuery)}" placeholder="Termine o titolo"></label>
      </div>
      <p class="eyebrow">${filtered.length} pagine visualizzate</p>
      <div class="manual-index-list">
        ${filtered.map((page) => `<a class="manual-index-row" href="#/pagina/${page.number}"><strong>Pagina ${page.number}</strong><span>${escapeHtml(page.title)}</span><small>${escapeHtml(modulesById.get(page.module).title)} · ${escapeHtml(lessonsById.get(page.lesson).title)}</small><span aria-hidden="true">→</span></a>`).join("")}
      </div>`;
    content.innerHTML = pageShell(body);
    document.title = `Indice del manuale — ${data.meta.title}`;
  }

  function bestSnippet(value, query) {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    if (!clean) return "Contenuto presente nella figura originale.";
    const tokens = normalize(query).split(" ").filter(Boolean);
    let position = -1;
    for (const token of tokens) {
      position = normalize(clean).indexOf(token);
      if (position >= 0) break;
    }
    if (position < 0) return clean.slice(0, 220) + (clean.length > 220 ? "…" : "");
    const start = Math.max(0, position - 75);
    const end = Math.min(clean.length, start + 260);
    return `${start ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
  }

  function searchManual(query) {
    const normalizedQuery = normalize(query);
    if (normalizedQuery.length < 2) return [];
    const tokens = normalizedQuery.split(" ").filter(Boolean);
    const results = [];
    data.pages.forEach((page) => {
      const lesson = lessonsById.get(page.lesson);
      const module = modulesById.get(page.module);
      const haystack = normalize(`${page.title} ${lesson.title} ${module.title} ${page.text} ${page.visualIndex}`);
      if (!tokens.every((token) => haystack.includes(token))) return;
      const titleHaystack = normalize(`${page.title} ${lesson.title}`);
      const score = (haystack.includes(normalizedQuery) ? 10 : 0) + tokens.filter((token) => titleHaystack.includes(token)).length * 5;
      results.push({
        type: "Pagina",
        title: page.title,
        snippet: bestSnippet(`${page.text} ${page.visualIndex}`, query),
        source: `PDF originale, p. ${page.number}`,
        href: `#/pagina/${page.number}`,
        score,
      });
    });
    data.glossary.forEach((entry) => {
      const haystack = normalize(`${entry.term} ${entry.definition}`);
      if (!tokens.every((token) => haystack.includes(token))) return;
      results.push({
        type: "Glossario",
        title: entry.term,
        snippet: entry.definition,
        source: `PDF originale, p. ${entry.page}`,
        href: `#/pagina/${entry.page}`,
        score: (normalize(entry.term).includes(normalizedQuery) ? 20 : 4),
      });
    });
    return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "it")).slice(0, 60);
  }

  function searchResultsHtml(query) {
    if (!query || normalize(query).length < 2) return `<div class="search-empty">Scrivi almeno due caratteri. Esempi: <strong>cono arterioso</strong>, <strong>grande safena</strong>, <strong>dotto toracico</strong>.</div>`;
    const results = searchManual(query);
    if (!results.length) return `<div class="search-empty">Nessun risultato per «${escapeHtml(query)}». Prova una variante del termine presente nella sbobina.</div>`;
    return results.map((result) => `<a class="search-result" href="${result.href}"><span class="search-result-type">${escapeHtml(result.type)}</span><span><strong>${escapeHtml(result.title)}</strong><p>${escapeHtml(result.snippet)}</p></span><small>${escapeHtml(result.source)}</small></a>`).join("");
  }

  function openSearch(initial = "") {
    if (!searchDialog.open) searchDialog.showModal();
    document.body.classList.add("dialog-open");
    searchInput.value = initial;
    searchResults.innerHTML = searchResultsHtml(initial);
    requestAnimationFrame(() => searchInput.focus());
  }

  function closeSearch() {
    if (searchDialog.open) searchDialog.close();
    document.body.classList.remove("dialog-open");
  }

  function renderSearchPage(query = "") {
    setActiveModule(null);
    const body = `
      ${breadcrumb([{ label: "Cerca nel manuale" }])}
      <header class="page-heading"><div><p class="eyebrow">Ricerca integrale</p><h1>Cerca nel manuale</h1><p>La ricerca indicizza titoli, testo originale, termini anatomici, glossario e testo riconosciuto nelle figure.</p></div></header>
      <form class="search-page-form" id="search-page-form"><label class="sr-only" for="search-page-input">Termine da cercare</label><input id="search-page-input" type="search" value="${escapeHtml(query)}" placeholder="Es. fossa ovale, arteria poplitea, rete mirabile"><button class="primary-button" type="submit">Cerca</button></form>
      <div class="search-results">${searchResultsHtml(query)}</div>`;
    content.innerHTML = pageShell(body, { narrow: true });
    document.title = `Cerca nel manuale — ${data.meta.title}`;
  }

  function renderGlossary(query = ui.glossaryQuery) {
    setActiveModule(null);
    ui.glossaryQuery = query;
    const normalizedQuery = normalize(query);
    const entries = data.glossary.filter((entry) => !normalizedQuery || normalize(`${entry.term} ${entry.definition}`).includes(normalizedQuery));
    let currentLetter = "";
    const glossaryHtml = entries.map((entry) => {
      const letter = entry.term.charAt(0).toLocaleUpperCase("it");
      const letterHeading = letter !== currentLetter ? `<h2 class="glossary-letter">${escapeHtml(letter)}</h2>` : "";
      currentLetter = letter;
      return `${letterHeading}<dl class="glossary-list"><div class="glossary-entry"><dt>${escapeHtml(entry.term)}</dt><dd>${escapeHtml(entry.definition)}${entry.sourceKind === "figura" ? ` <small>(testo riconosciuto nella figura: verificare il facsimile)</small>` : ""}</dd><a href="#/pagina/${entry.page}">PDF p. ${entry.page} →</a></div></dl>`;
    }).join("");
    const body = `
      ${breadcrumb([{ label: "Glossario" }])}
      <header class="page-heading"><div><p class="eyebrow">Terminologia della fonte</p><h1>Glossario</h1><p>${data.glossary.length} termini individuati nel manuale. Ogni definizione è un estratto della sbobina e rimanda alla pagina originale.</p></div></header>
      <label class="filter-field"><span>Cerca un termine</span><input class="inline-search" id="glossary-filter" type="search" value="${escapeHtml(query)}" placeholder="Es. seno trasverso"></label>
      <p class="eyebrow" style="margin-top:22px">${entries.length} termini visualizzati</p>
      ${glossaryHtml || `<div class="empty-state">Nessun termine corrisponde alla ricerca.</div>`}`;
    content.innerHTML = pageShell(body);
    document.title = `Glossario — ${data.meta.title}`;
  }

  function filteredFlashcards() {
    if (ui.flashFilter === "review") return data.flashcards.filter((card) => state.flashReview.includes(card.id));
    if (ui.flashFilter === "known") return data.flashcards.filter((card) => state.flashKnown.includes(card.id));
    return data.flashcards;
  }

  function renderFlashcards() {
    setActiveModule(null);
    const cards = filteredFlashcards();
    if (ui.flashIndex >= cards.length) ui.flashIndex = Math.max(0, cards.length - 1);
    const card = cards[ui.flashIndex];
    const options = `
      <label class="filter-field"><span>Mazzo</span><select id="flash-filter">
        <option value="all"${ui.flashFilter === "all" ? " selected" : ""}>Tutte le flashcard (${data.flashcards.length})</option>
        <option value="review"${ui.flashFilter === "review" ? " selected" : ""}>Da ripassare (${state.flashReview.length})</option>
        <option value="known"${ui.flashFilter === "known" ? " selected" : ""}>Conosciute (${state.flashKnown.length})</option>
      </select></label>`;
    const cardHtml = card
      ? `<div class="flashcard-shell">
          <div class="flashcard-progress"><span>Scheda ${ui.flashIndex + 1} di ${cards.length}</span><span>PDF originale, p. ${card.page}</span></div>
          <button class="flashcard" type="button" data-action="rivela-flashcard" aria-live="polite">
            <div class="flashcard-face">
              <span class="flashcard-label">${ui.flashReveal ? "Risposta dalla sbobina" : "Termine anatomico"}</span>
              ${ui.flashReveal ? `<div class="flashcard-answer"><h2>${escapeHtml(card.front)}</h2><p>${escapeHtml(card.back)}</p></div>` : `<h2>${escapeHtml(card.front)}</h2><p class="flashcard-hint">Clicca per mostrare la risposta</p>`}
            </div>
          </button>
          <div class="flashcard-controls">
            <button class="secondary-button" type="button" data-action="flash-precedente">← Precedente</button>
            <button class="secondary-button" type="button" data-action="flash-casuale">Casuale</button>
            <button class="secondary-button" type="button" data-action="flash-successiva">Successiva →</button>
            <button class="primary-button" type="button" data-action="flash-conosco">Conosco</button>
            <button class="secondary-button" type="button" data-action="flash-ripasso">Da ripassare</button>
            <a class="text-button" href="#/pagina/${card.page}">Vedi il materiale originale →</a>
          </div>
        </div>`
      : `<div class="empty-state"><h2>Nessuna scheda in questo mazzo</h2><p>Segna alcune flashcard come «Da ripassare» oppure torna al mazzo completo.</p></div>`;
    const body = `
      ${breadcrumb([{ label: "Flashcard" }])}
      <header class="page-heading"><div><p class="eyebrow">Memorizzazione attiva</p><h1>Flashcard</h1><p>Domande e risposte derivate direttamente dal testo del manuale. La pagina originale resta sempre raggiungibile.</p></div>${options}</header>
      ${cardHtml}`;
    content.innerHTML = pageShell(body, { narrow: true });
    document.title = `Flashcard — ${data.meta.title}`;
  }

  function filteredQuizzes() {
    return ui.quizModule === "all" ? data.quizzes : data.quizzes.filter((quiz) => quiz.module === ui.quizModule);
  }

  function answerClass(qid, option) {
    if (!(qid in state.quizResults)) return "";
    const selected = state.quizAnswers[qid];
    const quiz = data.quizzes.find((item) => item.id === qid);
    if (quiz.type === "choice") {
      if (option === quiz.answer) return " correct";
      if (option === selected) return " incorrect";
    }
    if (quiz.type === "boolean") {
      if (option === quiz.answer) return " correct";
      if (option === selected) return " incorrect";
    }
    return "";
  }

  function renderChoiceQuiz(quiz) {
    const answered = quiz.id in state.quizResults;
    return `<div class="quiz-options">${quiz.choices.map((choice, index) => `<button class="quiz-option${answerClass(quiz.id, index)}" type="button" data-action="rispondi-quiz" data-answer="${index}"${answered ? " disabled" : ""}>${escapeHtml(choice)}</button>`).join("")}</div>`;
  }

  function renderBooleanQuiz(quiz) {
    const answered = quiz.id in state.quizResults;
    return `<div class="quiz-options"><button class="quiz-option${answerClass(quiz.id, true)}" type="button" data-action="rispondi-quiz" data-answer="true"${answered ? " disabled" : ""}>Vero</button><button class="quiz-option${answerClass(quiz.id, false)}" type="button" data-action="rispondi-quiz" data-answer="false"${answered ? " disabled" : ""}>Falso</button></div>`;
  }

  function renderOrderingQuiz(quiz) {
    if (!ui.orderStates[quiz.id]) ui.orderStates[quiz.id] = [...quiz.items];
    const current = ui.orderStates[quiz.id];
    const answered = quiz.id in state.quizResults;
    return `<ol class="ordering-list">${current.map((item, index) => `<li class="ordering-item"><span class="ordering-position">${index + 1}</span><span>${escapeHtml(item)}</span><span class="ordering-buttons"><button type="button" data-action="sposta-ordine" data-direction="up" data-index="${index}"${answered || index === 0 ? " disabled" : ""} aria-label="Sposta in alto">↑</button><button type="button" data-action="sposta-ordine" data-direction="down" data-index="${index}"${answered || index === current.length - 1 ? " disabled" : ""} aria-label="Sposta in basso">↓</button></span></li>`).join("")}</ol>${answered ? "" : `<button class="primary-button" type="button" data-action="verifica-ordine">Verifica la sequenza</button>`}`;
  }

  function renderAssociationQuiz(quiz) {
    if (!ui.associationStates[quiz.id]) ui.associationStates[quiz.id] = {};
    const terms = quiz.pairs.map((pair) => pair.term).sort((a, b) => a.localeCompare(b, "it"));
    const answered = quiz.id in state.quizResults;
    return `<div class="association-list">${quiz.pairs.map((pair, index) => `<div class="association-row"><select data-association-index="${index}"${answered ? " disabled" : ""}><option value="">Scegli il termine…</option>${terms.map((term) => `<option value="${escapeHtml(term)}"${ui.associationStates[quiz.id][index] === term ? " selected" : ""}>${escapeHtml(term)}</option>`).join("")}</select><p>${escapeHtml(pair.definition)}</p></div>`).join("")}</div>${answered ? "" : `<button class="primary-button" type="button" data-action="verifica-associazione" style="margin-top:18px">Verifica le associazioni</button>`}`;
  }

  function quizFeedback(quiz) {
    if (!(quiz.id in state.quizResults)) return "";
    const correct = state.quizResults[quiz.id];
    return `<div class="quiz-feedback${correct ? "" : " incorrect"}"><h3>${correct ? "Risposta corretta" : "Da rivedere"}</h3><p>${escapeHtml(quiz.explanation)}</p><a class="text-button" href="#/pagina/${quiz.page}">Vedi il materiale originale, p. ${quiz.page} →</a></div>`;
  }

  function renderQuiz() {
    setActiveModule(ui.quizModule === "all" ? null : ui.quizModule);
    const quizzes = filteredQuizzes();
    if (ui.quizIndex >= quizzes.length) ui.quizIndex = Math.max(0, quizzes.length - 1);
    const quiz = quizzes[ui.quizIndex];
    const moduleOptions = data.modules.map((module) => `<option value="${module.id}"${ui.quizModule === module.id ? " selected" : ""}>${escapeHtml(module.title)}</option>`).join("");
    const answeredCount = quizzes.filter((item) => item.id in state.quizResults).length;
    let questionHtml = "";
    if (quiz) {
      if (quiz.type === "choice") questionHtml = renderChoiceQuiz(quiz);
      if (quiz.type === "boolean") questionHtml = renderBooleanQuiz(quiz);
      if (quiz.type === "ordering") questionHtml = renderOrderingQuiz(quiz);
      if (quiz.type === "association") questionHtml = renderAssociationQuiz(quiz);
    }
    const quizHtml = quiz ? `<div class="quiz-shell">
      <article class="quiz-card">
        <div class="quiz-meta"><span>Domanda ${ui.quizIndex + 1} di ${quizzes.length}</span><span>${escapeHtml(modulesById.get(quiz.module).title)} · p. ${quiz.page}</span></div>
        <h2>${escapeHtml(quiz.question)}</h2>
        ${quiz.prompt ? `<div class="quiz-prompt">${escapeHtml(quiz.prompt)}</div>` : ""}
        ${questionHtml}
        ${quizFeedback(quiz)}
      </article>
      <div class="flashcard-controls"><button class="secondary-button" type="button" data-action="quiz-precedente">← Precedente</button><button class="secondary-button" type="button" data-action="quiz-casuale">Casuale</button><button class="primary-button" type="button" data-action="quiz-successiva">Domanda successiva →</button></div>
    </div>` : `<div class="empty-state">Nessuna domanda disponibile per questo filtro.</div>`;
    const body = `
      ${breadcrumb([{ label: "Quiz" }])}
      <header class="page-heading"><div><p class="eyebrow">Verifica basata sulla fonte</p><h1>Quiz</h1><p>Scelta multipla, vero/falso, associazioni e sequenze. Dopo ogni risposta trovi la formulazione della sbobina e il collegamento alla pagina originale.</p></div><label class="filter-field"><span>Modulo</span><select id="quiz-module-filter"><option value="all">Tutti i moduli</option>${moduleOptions}</select></label></header>
      <p class="eyebrow">${answeredCount} di ${quizzes.length} domande affrontate nel filtro attuale</p>
      ${quizHtml}`;
    content.innerHTML = pageShell(body, { narrow: true });
    document.title = `Quiz — ${data.meta.title}`;
  }

  function renderOral() {
    setActiveModule(ui.oralModule === "all" ? null : ui.oralModule);
    const questions = ui.oralModule === "all" ? data.oral : data.oral.filter((item) => item.module === ui.oralModule);
    const moduleOptions = data.modules.map((module) => `<option value="${module.id}"${ui.oralModule === module.id ? " selected" : ""}>${escapeHtml(module.title)}</option>`).join("");
    const body = `
      ${breadcrumb([{ label: "Esame orale" }])}
      <header class="page-heading"><div><p class="eyebrow">Esposizione guidata</p><h1>Modalità esame orale</h1><p>Apri una domanda, esponi l’argomento a voce e poi verifica i punti presenti nella sbobina. La checklist non sostituisce la lezione completa.</p></div><label class="filter-field"><span>Modulo</span><select id="oral-module-filter"><option value="all">Tutti i moduli</option>${moduleOptions}</select></label></header>
      <div class="oral-list">${questions.map((item, index) => `<details class="oral-card"><summary><span class="oral-number">${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.question)}</strong><small>${escapeHtml(item.source)} · mostra checklist</small></summary><div class="oral-content"><h4>Punti da includere secondo la sbobina</h4><ul>${item.checklist.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul><a class="primary-button" href="#/lezione/${item.lesson}">Studia il contenuto completo</a></div></details>`).join("")}</div>`;
    content.innerHTML = pageShell(body, { narrow: true });
    document.title = `Esame orale — ${data.meta.title}`;
  }

  function renderReview(moduleFilter = "all") {
    setActiveModule(moduleFilter === "all" ? null : moduleFilter);
    const modules = moduleFilter === "all" ? data.modules : data.modules.filter((module) => module.id === moduleFilter);
    const moduleOptions = data.modules.map((module) => `<option value="${module.id}"${moduleFilter === module.id ? " selected" : ""}>${escapeHtml(module.title)}</option>`).join("");
    const body = `
      ${breadcrumb([{ label: "Ripasso rapido" }])}
      <header class="page-heading"><div><p class="eyebrow">Strumento di studio derivato</p><h1>Ripasso rapido</h1><p>Richiami brevi ottenuti dal testo originale. Ogni blocco rimanda alla lezione completa, che resta il riferimento principale.</p></div><label class="filter-field"><span>Modulo</span><select id="review-module-filter"><option value="all">Tutti i moduli</option>${moduleOptions}</select></label></header>
      ${modules.map((module) => {
        const moduleIndex = data.modules.findIndex((item) => item.id === module.id) + 1;
        const lessons = data.lessons.filter((lesson) => lesson.module === module.id);
        return `<section class="review-module"><header class="review-module-header"><span>${String(moduleIndex).padStart(2, "0")}</span><h2>${escapeHtml(module.title)}</h2><a class="text-button" href="#/modulo/${module.id}">Apri modulo →</a></header>${lessons.map((lesson) => `<article class="review-lesson"><h3>${escapeHtml(lesson.title)}</h3><ul>${lesson.studyPoints.slice(0, 2).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul><a class="text-button" href="#/lezione/${lesson.id}">Studia il contenuto completo (${escapeHtml(lesson.source)}) →</a></article>`).join("")}</section>`;
      }).join("")}`;
    content.innerHTML = pageShell(body);
    document.title = `Ripasso rapido — ${data.meta.title}`;
  }

  function renderProgress() {
    setActiveModule(null);
    const progress = overallProgress();
    const quizAttempts = Object.keys(state.quizResults).length;
    const quizCorrect = Object.values(state.quizResults).filter(Boolean).length;
    const body = `
      ${breadcrumb([{ label: "Progresso" }])}
      <header class="page-heading"><div><p class="eyebrow">Salvato in questo browser</p><h1>Progresso dello studente</h1><p>Nessun account e nessun server: lezioni, quiz e flashcard sono memorizzati localmente sul dispositivo.</p></div></header>
      <div class="progress-dashboard"><div class="progress-metric"><strong>${progress.percent}%</strong><span>Avanzamento complessivo</span></div><div class="progress-metric"><strong>${progress.complete}/${progress.total}</strong><span>Lezioni completate</span></div><div class="progress-metric"><strong>${quizCorrect}/${quizAttempts || 0}</strong><span>Risposte quiz corrette</span></div></div>
      <div class="section-heading"><div><p class="eyebrow">Avanzamento per modulo</p><h2>Moduli</h2></div></div>
      <div class="module-progress-list">${data.modules.map((module) => { const item = moduleProgress(module.id); return `<div class="module-progress-row"><a href="#/modulo/${module.id}">${escapeHtml(module.title)}</a><div class="progress-bar" aria-label="${item.percent}% completato"><span style="width:${item.percent}%"></span></div><strong>${item.complete}/${item.total}</strong></div>`; }).join("")}</div>
      <div class="section-heading"><div><p class="eyebrow">Flashcard</p><h2>Memorizzazione</h2></div></div>
      <div class="progress-dashboard"><div class="progress-metric"><strong>${state.flashKnown.length}</strong><span>Conosciute</span></div><div class="progress-metric"><strong>${state.flashReview.length}</strong><span>Da ripassare</span></div><div class="progress-metric"><strong>${data.flashcards.length - new Set([...state.flashKnown, ...state.flashReview]).size}</strong><span>Non ancora classificate</span></div></div>
      <div class="danger-zone"><h3>Ricomincia da capo</h3><p>Questa operazione cancella soltanto il progresso locale; il manuale e il sito non vengono modificati.</p><button class="secondary-button" type="button" data-action="azzera-progresso">Azzera il progresso locale</button></div>`;
    content.innerHTML = pageShell(body, { narrow: true });
    document.title = `Progresso — ${data.meta.title}`;
  }

  function renderNotFound() {
    setActiveModule(null);
    content.innerHTML = pageShell(`<div class="empty-state"><p class="eyebrow">Percorso non trovato</p><h1>Questa pagina non esiste</h1><p>Il materiale completo resta disponibile dall’indice.</p><a class="primary-button" href="#/indice">Apri l’indice del manuale</a></div>`, { narrow: true });
    document.title = `Pagina non trovata — ${data.meta.title}`;
  }

  function parseHash() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, queryString = ""] = raw.split("?");
    return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(queryString) };
  }

  function route() {
    closeMenu();
    const { parts, query } = parseHash();
    const root = parts[0] || "";
    if (!root) renderHome();
    else if (root === "modulo") renderModule(parts[1]);
    else if (root === "lezione") renderLesson(parts[1]);
    else if (root === "pagina") renderPage(parts[1]);
    else if (root === "indice") renderManualIndex();
    else if (root === "cerca") renderSearchPage(query.get("q") || "");
    else if (root === "glossario") renderGlossary(query.get("q") || "");
    else if (root === "flashcard") renderFlashcards();
    else if (root === "quiz") {
      if (query.get("module") && modulesById.has(query.get("module"))) ui.quizModule = query.get("module");
      renderQuiz();
    } else if (root === "esame") {
      if (query.get("module") && modulesById.has(query.get("module"))) ui.oralModule = query.get("module");
      renderOral();
    } else if (root === "ripasso") renderReview(query.get("module") || "all");
    else if (root === "progresso") renderProgress();
    else renderNotFound();
    window.scrollTo({ top: 0, behavior: "instant" });
    content.focus({ preventScroll: true });
  }

  function openMenu() {
    document.body.classList.add("nav-open");
    document.querySelector("[data-action='apri-menu']").setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    document.body.classList.remove("nav-open");
    document.querySelector("[data-action='apri-menu']").setAttribute("aria-expanded", "false");
  }

  function openLightbox(trigger) {
    const gallery = trigger.dataset.gallery;
    const triggers = Array.from(document.querySelectorAll("[data-lightbox]")).filter((item) => item.dataset.gallery === gallery);
    lightbox.items = triggers.map((item) => ({ src: item.dataset.src, title: item.dataset.title, page: item.dataset.page }));
    lightbox.index = Math.max(0, triggers.indexOf(trigger));
    lightbox.zoom = 1;
    updateLightbox();
    imageDialog.showModal();
    document.body.classList.add("dialog-open");
  }

  function updateLightbox() {
    const item = lightbox.items[lightbox.index];
    if (!item) return;
    lightboxImage.src = item.src;
    lightboxImage.alt = item.title;
    document.getElementById("image-dialog-title").textContent = item.title;
    document.getElementById("image-dialog-source").textContent = `PDF originale · Pagina ${item.page}`;
    document.getElementById("image-caption").textContent = `${item.title}. Immagine originale estratta dal PDF, pagina ${item.page}.`;
    clearMasks();
    applyZoom(1);
  }

  function applyZoom(nextZoom) {
    lightbox.zoom = Math.min(3, Math.max(0.6, nextZoom));
    imageCanvas.style.transform = `scale(${lightbox.zoom})`;
    imageCanvas.style.transformOrigin = "center top";
    document.getElementById("zoom-output").textContent = `${Math.round(lightbox.zoom * 100)}%`;
  }

  function closeLightbox() {
    if (imageDialog.open) imageDialog.close();
    lightboxImage.removeAttribute("src");
    clearMasks();
    document.body.classList.remove("dialog-open");
  }

  function stepLightbox(direction) {
    if (!lightbox.items.length) return;
    lightbox.index = (lightbox.index + direction + lightbox.items.length) % lightbox.items.length;
    updateLightbox();
  }

  function clearMasks() {
    maskLayer.innerHTML = "";
  }

  function addMask() {
    const mask = document.createElement("div");
    mask.className = "label-mask";
    const offset = maskLayer.children.length * 26;
    mask.style.left = `${Math.min(65, 18 + offset / 5)}%`;
    mask.style.top = `${Math.min(70, 22 + offset / 6)}%`;
    mask.setAttribute("role", "button");
    mask.setAttribute("aria-label", "Copertura mobile per un’etichetta");
    maskLayer.appendChild(mask);
    makeDraggable(mask);
    toast("Copertura aggiunta: trascinala sopra un’etichetta.");
  }

  function makeDraggable(mask) {
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const move = (event) => {
      const parent = mask.parentElement.getBoundingClientRect();
      const width = mask.getBoundingClientRect().width;
      const height = mask.getBoundingClientRect().height;
      const left = Math.max(0, Math.min(parent.width - width, startLeft + event.clientX - startX));
      const top = Math.max(0, Math.min(parent.height - height, startTop + event.clientY - startY));
      mask.style.left = `${left}px`;
      mask.style.top = `${top}px`;
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    mask.addEventListener("pointerdown", (event) => {
      const maskRect = mask.getBoundingClientRect();
      const parentRect = mask.parentElement.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startLeft = maskRect.left - parentRect.left;
      startTop = maskRect.top - parentRect.top;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop, { once: true });
    });
  }

  function currentFlashcard() {
    return filteredFlashcards()[ui.flashIndex];
  }

  function moveFlash(step) {
    const cards = filteredFlashcards();
    if (!cards.length) return;
    ui.flashIndex = (ui.flashIndex + step + cards.length) % cards.length;
    ui.flashReveal = false;
    renderFlashcards();
  }

  function classifyFlash(kind) {
    const card = currentFlashcard();
    if (!card) return;
    state.flashKnown = state.flashKnown.filter((id) => id !== card.id);
    state.flashReview = state.flashReview.filter((id) => id !== card.id);
    if (kind === "known") state.flashKnown.push(card.id);
    if (kind === "review") state.flashReview.push(card.id);
    saveState();
    toast(kind === "known" ? "Scheda segnata come conosciuta." : "Scheda aggiunta al mazzo da ripassare.");
    moveFlash(1);
  }

  function currentQuiz() {
    return filteredQuizzes()[ui.quizIndex];
  }

  function recordQuiz(quiz, correct, answer) {
    state.quizResults[quiz.id] = correct;
    state.quizAnswers[quiz.id] = answer;
    saveState();
    renderQuiz();
  }

  function answerQuiz(rawAnswer) {
    const quiz = currentQuiz();
    if (!quiz || quiz.id in state.quizResults) return;
    let answer = rawAnswer;
    if (quiz.type === "choice") answer = Number(rawAnswer);
    if (quiz.type === "boolean") answer = rawAnswer === "true";
    recordQuiz(quiz, answer === quiz.answer, answer);
  }

  function moveOrdering(index, direction) {
    const quiz = currentQuiz();
    if (!quiz || quiz.type !== "ordering") return;
    const list = ui.orderStates[quiz.id] || [...quiz.items];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    ui.orderStates[quiz.id] = list;
    renderQuiz();
  }

  function verifyOrdering() {
    const quiz = currentQuiz();
    if (!quiz || quiz.type !== "ordering") return;
    const list = ui.orderStates[quiz.id] || [...quiz.items];
    const correct = list.every((item, index) => item === quiz.answer[index]);
    recordQuiz(quiz, correct, list);
  }

  function verifyAssociation() {
    const quiz = currentQuiz();
    if (!quiz || quiz.type !== "association") return;
    const answers = ui.associationStates[quiz.id] || {};
    const complete = quiz.pairs.every((_pair, index) => answers[index]);
    if (!complete) {
      toast("Completa tutte le associazioni prima di verificare.");
      return;
    }
    const correct = quiz.pairs.every((pair, index) => answers[index] === pair.term);
    recordQuiz(quiz, correct, answers);
  }

  function moveQuiz(step) {
    const quizzes = filteredQuizzes();
    if (!quizzes.length) return;
    ui.quizIndex = (ui.quizIndex + step + quizzes.length) % quizzes.length;
    renderQuiz();
  }

  document.addEventListener("click", (event) => {
    const lightboxTrigger = event.target.closest("[data-lightbox]");
    if (lightboxTrigger) {
      event.preventDefault();
      openLightbox(lightboxTrigger);
      return;
    }
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.action;
    if (action === "apri-menu") openMenu();
    if (action === "chiudi-menu") closeMenu();
    if (action === "apri-ricerca") openSearch();
    if (action === "chiudi-ricerca") closeSearch();
    if (action === "chiudi-immagine") closeLightbox();
    if (action === "immagine-precedente") stepLightbox(-1);
    if (action === "immagine-successiva") stepLightbox(1);
    if (action === "zoom-meno") applyZoom(lightbox.zoom - 0.2);
    if (action === "zoom-piu") applyZoom(lightbox.zoom + 0.2);
    if (action === "zoom-reset") applyZoom(1);
    if (action === "aggiungi-copertura") addMask();
    if (action === "rimuovi-coperture") clearMasks();
    if (action === "completa-lezione") {
      const lessonId = actionElement.dataset.lesson;
      if (state.completed.includes(lessonId)) state.completed = state.completed.filter((id) => id !== lessonId);
      else state.completed.push(lessonId);
      saveState();
      renderLesson(lessonId);
      toast(state.completed.includes(lessonId) ? "Lezione completata." : "Lezione rimessa in studio.");
    }
    if (action === "rivela-flashcard") { ui.flashReveal = !ui.flashReveal; renderFlashcards(); }
    if (action === "flash-precedente") moveFlash(-1);
    if (action === "flash-successiva") moveFlash(1);
    if (action === "flash-casuale") { const cards = filteredFlashcards(); if (cards.length) { ui.flashIndex = Math.floor(Math.random() * cards.length); ui.flashReveal = false; renderFlashcards(); } }
    if (action === "flash-conosco") classifyFlash("known");
    if (action === "flash-ripasso") classifyFlash("review");
    if (action === "rispondi-quiz") answerQuiz(actionElement.dataset.answer);
    if (action === "sposta-ordine") moveOrdering(Number(actionElement.dataset.index), actionElement.dataset.direction);
    if (action === "verifica-ordine") verifyOrdering();
    if (action === "verifica-associazione") verifyAssociation();
    if (action === "quiz-precedente") moveQuiz(-1);
    if (action === "quiz-successiva") moveQuiz(1);
    if (action === "quiz-casuale") { const quizzes = filteredQuizzes(); if (quizzes.length) { ui.quizIndex = Math.floor(Math.random() * quizzes.length); renderQuiz(); } }
    if (action === "azzera-progresso" && window.confirm("Vuoi cancellare tutto il progresso salvato in questo browser?")) {
      state = defaultState();
      saveState();
      renderProgress();
      toast("Progresso locale azzerato.");
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target === searchInput) searchResults.innerHTML = searchResultsHtml(searchInput.value);
    if (event.target.id === "index-query-filter") {
      ui.indexQuery = event.target.value;
      const position = event.target.selectionStart;
      renderManualIndex();
      const nextInput = document.getElementById("index-query-filter");
      nextInput.focus();
      nextInput.setSelectionRange(position, position);
    }
    if (event.target.id === "glossary-filter") {
      const value = event.target.value;
      const position = event.target.selectionStart;
      renderGlossary(value);
      const nextInput = document.getElementById("glossary-filter");
      nextInput.focus();
      nextInput.setSelectionRange(position, position);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "index-module-filter") { ui.indexModule = event.target.value; renderManualIndex(); }
    if (event.target.id === "flash-filter") { ui.flashFilter = event.target.value; ui.flashIndex = 0; ui.flashReveal = false; renderFlashcards(); }
    if (event.target.id === "quiz-module-filter") { ui.quizModule = event.target.value; ui.quizIndex = 0; renderQuiz(); }
    if (event.target.id === "oral-module-filter") { ui.oralModule = event.target.value; renderOral(); }
    if (event.target.id === "review-module-filter") renderReview(event.target.value);
    if (event.target.matches("[data-association-index]")) {
      const quiz = currentQuiz();
      if (!quiz) return;
      if (!ui.associationStates[quiz.id]) ui.associationStates[quiz.id] = {};
      ui.associationStates[quiz.id][Number(event.target.dataset.associationIndex)] = event.target.value;
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "search-page-form") {
      event.preventDefault();
      const query = document.getElementById("search-page-input").value.trim();
      location.hash = `#/cerca?q=${encodeURIComponent(query)}`;
      renderSearchPage(query);
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    } else if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      openSearch();
    }
    if (imageDialog.open && event.key === "ArrowLeft") stepLightbox(-1);
    if (imageDialog.open && event.key === "ArrowRight") stepLightbox(1);
    if (imageDialog.open && event.key === "+") applyZoom(lightbox.zoom + 0.2);
    if (imageDialog.open && event.key === "-") applyZoom(lightbox.zoom - 0.2);
  });

  searchDialog.addEventListener("click", (event) => {
    if (event.target === searchDialog) closeSearch();
    if (event.target.closest(".search-result")) closeSearch();
  });
  imageDialog.addEventListener("click", (event) => {
    if (event.target === imageDialog) closeLightbox();
  });
  searchDialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
  imageDialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
  window.addEventListener("hashchange", route);

  renderSidebar();
  updateProgressHeader();
  if (!location.hash) location.hash = "#/";
  else route();
})();
