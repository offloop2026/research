/**
 * PHOTO MODULE (photo.js)
 * Vertical continuous image archive matching Cargo editorial layout:
 * - Column 1: Photo Ledger Index (List of objects & photo counts)
 * - Column 2: Large Vertical Photographs with 2-column captions
 * - Column 3: Photographic Observations & Attached Records
 */

let activePhotoIndex = 0;
let filterObjId = 'all';

document.addEventListener('DOMContentLoaded', () => {
  if (window.app && window.app.isReady) {
    renderPhoto3Col();
  } else {
    window.addEventListener('archive-ready', () => {
      renderPhoto3Col();
    }, { once: true });
    const checkReady = setInterval(() => {
      if (window.app && window.app.isReady) {
        clearInterval(checkReady);
        renderPhoto3Col();
      }
    }, 40);
  }

  window.addEventListener('archive-updated', () => {
    renderPhoto3Col();
  });
});

function renderPhoto3Col() {
  const container = document.getElementById('photo-main-container');
  if (!container) return;

  const objects = window.app.getObjects();
  const seenSrc = new Set();
  const allPhotos = [];

  objects.forEach((obj, objIdx) => {
    const list = (obj.images && obj.images.length)
      ? obj.images
      : (obj.representativeImage ? [obj.representativeImage] : []);

    list.forEach((src, imgIdx) => {
      if (src && !seenSrc.has(src)) {
        seenSrc.add(src);
        allPhotos.push({
          src,
          obj,
          numStr: `${String(objIdx + 1).padStart(2, '0')}.${imgIdx + 1}`
        });
      }
    });
  });

  if (!allPhotos.length) {
    container.innerHTML = `
      <div class="col-scroll-body" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
        <p>기록된 사진이 없습니다.</p>
      </div>
    `;
    return;
  }

  const displayedPhotos = (filterObjId === 'all')
    ? allPhotos
    : allPhotos.filter(p => p.obj.id === filterObjId);

  if (activePhotoIndex >= displayedPhotos.length) {
    activePhotoIndex = 0;
  }

  const activePhoto = displayedPhotos[activePhotoIndex] || displayedPhotos[0];
  const activeObj = activePhoto.obj;
  const activeMemos = window.app.getMemosForObject(activeObj.id);

  const allSrcs = displayedPhotos.map(p => p.src);

  // -------------------------------------------------------------------------
  // COLUMN 1: PHOTO INDEX
  // -------------------------------------------------------------------------
  const col1Html = `
    <div class="editorial-col col-archive">
      <div class="col-header">
        <div class="col-header-left">
          <span class="col-header-title">Photo Index</span>
          <span class="col-header-meta mono" style="opacity:0.4;">${allPhotos.length}</span>
        </div>
        <div class="col-header-right">
          <button class="col-header-menu-btn" title="Navigation">&equiv;</button>
        </div>
      </div>

      <div class="col-scroll-body">
        <div class="archive-ledger-list">
          <div class="archive-ledger-item ${filterObjId === 'all' ? 'active' : ''}" data-filter="all">
            <div class="ledger-item-row">
              <span class="ledger-item-num mono">&infin;</span>
              <div class="ledger-item-content">
                <h2 class="ledger-item-title">All Photographs (${allPhotos.length})</h2>
                <div class="ledger-item-meta">
                  <span>전체 아카이브 연속 사진 스트림</span>
                </div>
              </div>
            </div>
          </div>

          ${objects.map((obj, i) => {
            const num = String(i + 1).padStart(2, '0');
            const count = (obj.images && obj.images.length) ? obj.images.length : (obj.representativeImage ? 1 : 0);
            const isFilterActive = (filterObjId === obj.id);
            return `
              <div class="archive-ledger-item ${isFilterActive ? 'active' : ''}" data-filter="${obj.id}">
                <div class="ledger-item-row">
                  <span class="ledger-item-num mono">${num}</span>
                  <div class="ledger-item-content">
                    <h2 class="ledger-item-title">${escapeHtml(obj.title)}</h2>
                    <div class="ledger-item-meta">
                      <span>${count} photos &middot; ${obj.timestamp || ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // -------------------------------------------------------------------------
  // COLUMN 2: LARGE VERTICAL PHOTO STREAM WITH 2-COLUMN CAPTIONS
  // -------------------------------------------------------------------------
  const col2Html = `
    <div class="editorial-col col-photo">
      <div class="col-header">
        <div class="col-header-left">
          <span class="col-header-title">Photographs</span>
          <span class="col-header-meta mono" style="opacity:0.4;">${displayedPhotos.length}</span>
        </div>
        <div class="col-header-right">
          <button class="col-header-menu-btn" title="Navigation">&equiv;</button>
        </div>
      </div>

      <div class="col-scroll-body">
        <div class="editorial-photo-stream">
          ${displayedPhotos.map((item, idx) => `
            <article class="editorial-photo-entry" data-index="${idx}">
              <div class="editorial-photo-frame" data-src="${item.src}" title="클릭하여 확대">
                <img src="${item.src}" alt="${escapeHtml(item.obj.title)}" class="editorial-photo-img" loading="lazy" />
              </div>

              <div class="editorial-photo-caption">
                <div class="caption-col-num mono">
                  <span>${item.numStr} ${item.obj.id}</span>
                </div>
                <div class="caption-col-content">
                  <h3 class="caption-title serif-italic">${escapeHtml(item.obj.title)}</h3>
                  <div class="caption-spec">
                    ${item.obj.materials ? `${escapeHtml(item.obj.materials)}<br>` : ''}
                    ${item.obj.dimensions ? `${escapeHtml(item.obj.dimensions)}<br>` : ''}
                    ${item.obj.timestamp ? `${escapeHtml(item.obj.timestamp)}` : ''}
                  </div>
                  ${item.obj.description ? `<p class="caption-desc">${escapeHtml(item.obj.description)}</p>` : ''}
                  <div class="caption-actions">
                    <button type="button" class="caption-btn-more mono" data-index="${idx}">[확대 보기..]</button>
                  </div>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // -------------------------------------------------------------------------
  // COLUMN 3: OBSERVATION NOTES & ATTACHED RECORDS FOR FOCUSED PHOTO
  // -------------------------------------------------------------------------
  const col3Html = `
    <div class="editorial-col col-memo">
      <div class="col-header">
        <div class="col-header-left">
          <span class="col-header-title">Photographic Records</span>
        </div>
        <div class="col-header-right">
          <button class="col-header-menu-btn" title="Navigation">&equiv;</button>
        </div>
      </div>

      <div class="col-scroll-body">
        <div class="editorial-memo-bands">
          <!-- Band 1: Active Subject -->
          <section class="editorial-band">
            <div class="band-label-col">
              <div class="band-label-title">Subject</div>
              <div class="band-label-sub mono">${activeObj.id}</div>
            </div>
            <div class="band-content-col">
              <h1 class="band-headline">${escapeHtml(activeObj.title)}</h1>
              <div class="band-spec-meta">
                ${activeObj.timestamp ? `<div>일시: ${escapeHtml(activeObj.timestamp)}</div>` : ''}
                ${activeObj.materials ? `<div>재질: ${escapeHtml(activeObj.materials)}</div>` : ''}
                ${activeObj.dimensions ? `<div>규격: ${escapeHtml(activeObj.dimensions)}</div>` : ''}
              </div>
              <div style="margin-top: 4px;">
                <a href="index.html?id=${activeObj.id}" class="mono" style="font-size:11px; color:#111; text-decoration: underline;">&rarr; 아카이브 상세 열기</a>
              </div>
            </div>
          </section>

          <!-- Band 2: Attached Memos -->
          <section class="editorial-band">
            <div class="band-label-col">
              <div class="band-label-title">Memos</div>
              <div class="band-label-sub mono">(${activeMemos.length})</div>
            </div>
            <div class="band-content-col">
              ${activeMemos.length ? activeMemos.map(m => `
                <article class="editorial-memo-entry display-mode archival-memo-slip" data-id="${m.id}">
                  <div class="memo-entry-header mono">
                    <span>${m.timestamp}</span>
                  </div>
                  <h3 class="memo-entry-title">${escapeHtml(m.title)}</h3>
                  <div class="memo-entry-content slip-content">
                    ${window.keywordService ? window.keywordService.renderAnnotatedHtml(m.id, m.content) : escapeHtml(m.content)}
                  </div>
                </article>
              `).join('') : `
                <p class="band-empty-text">연결된 메모가 없습니다.</p>
              `}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = col1Html + col2Html + col3Html;

  // Bind index filters
  container.querySelectorAll('.archive-ledger-item').forEach(item => {
    item.addEventListener('click', () => {
      filterObjId = item.getAttribute('data-filter');
      activePhotoIndex = 0;
      renderPhoto3Col();
    });
  });

  // Bind photo click & more button for lightbox & active photo update
  container.querySelectorAll('.editorial-photo-entry').forEach(entry => {
    entry.addEventListener('click', (e) => {
      const idx = parseInt(entry.getAttribute('data-index'), 10) || 0;
      activePhotoIndex = idx;
      if (e.target.closest('.caption-btn-more') || e.target.closest('.editorial-photo-frame')) {
        window.app.openLightbox(allSrcs, idx);
      } else {
        // Update Column 3 focus
        renderPhoto3Col();
      }
    });
  });

  // Initialize popover menu on '='
  if (window.app && typeof window.app.initMenuPopover === 'function') {
    window.app.initMenuPopover();
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
