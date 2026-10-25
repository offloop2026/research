/**
 * PHOTO MODULE (photo.js)
 * Continuous photographic ledger & observation viewer matching Cargo editorial layout:
 * - Column 1: Photo Ledger Index (List of objects & research entries with photo counts)
 * - Column 2: Large Vertical Photographs with 2-column captions & zoom
 * - Column 3: Photographic Observations & Attached Records
 * Fully integrates with IndexedDB media blobs, object images, and field research assets.
 */

let activePhotoIndex = 0;
let filterObjId = 'all';

function initPhotoModule() {
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
}

// Resilient DOM ready listener (handles both early and late script execution)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPhotoModule);
} else {
  initPhotoModule();
}

async function renderPhoto3Col() {
  const container = document.getElementById('photo-main-container');
  if (!container) return;

  try {
    const objects = (window.app && typeof window.app.getObjects === 'function')
      ? window.app.getObjects()
      : [];
    const researchList = (window.app && typeof window.app.getResearchList === 'function')
      ? window.app.getResearchList()
      : [];

    const seenSrc = new Set();
    const allPhotos = [];

    // 1. Collect all photos from Archive Objects
    objects.forEach((obj, objIdx) => {
      if (!obj) return;
      const list = (obj.images && Array.isArray(obj.images) && obj.images.length)
        ? obj.images
        : (obj.representativeImage ? [obj.representativeImage] : []);

      list.forEach((rawSrc, imgIdx) => {
        if (!rawSrc) return;
        const src = (window.resolveImagePath ? window.resolveImagePath(rawSrc) : rawSrc);
        if (src && !seenSrc.has(src)) {
          seenSrc.add(src);
          allPhotos.push({
            src,
            rawSrc,
            obj: {
              id: obj.id || `obj-${objIdx + 1}`,
              title: obj.title || '무제 사물',
              materials: obj.materials || '',
              dimensions: obj.dimensions || '',
              timestamp: obj.timestamp || '',
              description: obj.description || '',
              isResearch: false
            },
            numStr: `${String(objIdx + 1).padStart(2, '0')}.${imgIdx + 1}`
          });
        }
      });
    });

    // 2. Collect photos from Field Research entries (including IndexedDB Blobs)
    researchList.forEach((entry, rIdx) => {
      if (!entry) return;
      const rTitle = entry.title || `리서치 #${entry.numStr || rIdx + 1}`;
      const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
      blocks.forEach((blk, bIdx) => {
        if (!blk) return;
        const rawSrc = blk.image || blk.mediaUrl || (blk.type === 'photo' ? blk.src : null);
        if (!rawSrc) return;
        const src = (window.resolveImagePath ? window.resolveImagePath(rawSrc) : rawSrc);
        if (src && !seenSrc.has(src)) {
          seenSrc.add(src);
          allPhotos.push({
            src,
            rawSrc,
            obj: {
              id: entry.id || `res-${rIdx + 1}`,
              title: rTitle,
              materials: entry.location || '필드 리서치',
              dimensions: entry.weather || '',
              timestamp: entry.date || entry.updatedAt || '',
              description: blk.caption || blk.text || entry.summary || '',
              isResearch: true
            },
            numStr: `R${String(rIdx + 1).padStart(2, '0')}.${bIdx + 1}`
          });
        }
      });
    });

    // Empty state if totally no photos in archive or research
    if (!allPhotos.length) {
      container.innerHTML = `
        <div class="col-scroll-body" style="grid-column: 1 / -1; padding: 60px 20px; text-align: center;">
          <h2 class="band-headline" style="margin-bottom: 8px;">기록된 사진이 없습니다.</h2>
          <p class="text-caption mono" style="margin-bottom: 16px;">아카이브 또는 필드 리서치에서 사진을 등록해 주세요.</p>
          <a href="index.html" class="mono" style="font-size: 12px; color: #111; text-decoration: underline;">&rarr; 아카이브로 이동</a>
        </div>
      `;
      return;
    }

    // Filter photos based on selection
    const displayedPhotos = (filterObjId === 'all')
      ? allPhotos
      : allPhotos.filter(p => p && p.obj && String(p.obj.id) === String(filterObjId));

    if (activePhotoIndex >= displayedPhotos.length || activePhotoIndex < 0) {
      activePhotoIndex = 0;
    }

    const hasPhotos = displayedPhotos.length > 0;
    const activePhoto = hasPhotos ? (displayedPhotos[activePhotoIndex] || displayedPhotos[0]) : null;
    const activeObj = activePhoto ? (activePhoto.obj || {}) : {};
    const activeMemos = (activeObj.id && !activeObj.isResearch && window.app && typeof window.app.getMemosForObject === 'function')
      ? window.app.getMemosForObject(activeObj.id)
      : [];

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
                    <span>전체 아카이브 및 리서치 사진 스트림</span>
                  </div>
                </div>
              </div>
            </div>

            ${objects.map((obj, i) => {
              if (!obj) return '';
              const num = String(i + 1).padStart(2, '0');
              const count = (obj.images && Array.isArray(obj.images) && obj.images.length)
                ? obj.images.length
                : (obj.representativeImage ? 1 : 0);
              const isFilterActive = (filterObjId === obj.id);
              return `
                <div class="archive-ledger-item ${isFilterActive ? 'active' : ''}" data-filter="${obj.id}">
                  <div class="ledger-item-row">
                    <span class="ledger-item-num mono">${num}</span>
                    <div class="ledger-item-content">
                      <h2 class="ledger-item-title">${escapeHtml(obj.title || '무제 사물')}</h2>
                      <div class="ledger-item-meta">
                        <span>${count} photos &middot; ${escapeHtml(obj.timestamp || '')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}

            ${researchList.filter(r => r && r.blocks && r.blocks.some(b => b && (b.image || b.mediaUrl || b.type === 'photo'))).map((r, ri) => {
              const photoCount = r.blocks.filter(b => b && (b.image || b.mediaUrl || b.type === 'photo')).length;
              const isFilterActive = (filterObjId === r.id);
              return `
                <div class="archive-ledger-item ${isFilterActive ? 'active' : ''}" data-filter="${r.id}">
                  <div class="ledger-item-row">
                    <span class="ledger-item-num mono" style="color:#2a7ae2;">R${r.numStr || ri+1}</span>
                    <div class="ledger-item-content">
                      <h2 class="ledger-item-title">${escapeHtml(r.title || '필드 리서치')}</h2>
                      <div class="ledger-item-meta">
                        <span>${photoCount} photos &middot; ${escapeHtml(r.date || '')}</span>
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
    let col2BodyHtml = '';
    if (!hasPhotos) {
      col2BodyHtml = `
        <div style="padding: 48px 24px; text-align: center;">
          <p class="text-caption mono" style="margin-bottom: 12px;">선택한 항목에 등록된 사진이 없습니다.</p>
          <button type="button" class="btn-more-minimal mono reset-filter-btn" style="cursor: pointer; padding: 6px 12px; border: 1px solid #ccc; background: #fff;">[전체 사진 보기]</button>
        </div>
      `;
    } else {
      col2BodyHtml = `
        <div class="editorial-photo-stream">
          ${displayedPhotos.map((item, idx) => `
            <article class="editorial-photo-entry ${idx === activePhotoIndex ? 'focused' : ''}" data-index="${idx}">
              <div class="editorial-photo-frame" data-src="${escapeHtml(item.src)}" title="클릭하여 확대">
                <img src="${escapeHtml(item.src)}" alt="${escapeHtml((item.obj && item.obj.title) || '사진')}" class="editorial-photo-img" loading="lazy" onerror="if(!this.dataset.failed){this.dataset.failed='1';this.src='./assets/images/obj-001-1.svg';}" />
              </div>

              <div class="editorial-photo-caption">
                <div class="caption-col-num mono">
                  <span>${item.numStr || ''} ${(item.obj && item.obj.id) || ''}</span>
                </div>
                <div class="caption-col-content">
                  <h3 class="caption-title serif-italic">${escapeHtml((item.obj && item.obj.title) || '무제')}</h3>
                  <div class="caption-spec">
                    ${item.obj && item.obj.materials ? `${escapeHtml(item.obj.materials)}<br>` : ''}
                    ${item.obj && item.obj.dimensions ? `${escapeHtml(item.obj.dimensions)}<br>` : ''}
                    ${item.obj && item.obj.timestamp ? `${escapeHtml(item.obj.timestamp)}` : ''}
                  </div>
                  ${item.obj && item.obj.description ? `<p class="caption-desc">${escapeHtml(item.obj.description)}</p>` : ''}
                  <div class="caption-actions">
                    <button type="button" class="caption-btn-more mono" data-index="${idx}">[확대 보기..]</button>
                  </div>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      `;
    }

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
          ${col2BodyHtml}
        </div>
      </div>
    `;

    // -------------------------------------------------------------------------
    // COLUMN 3: OBSERVATION NOTES & ATTACHED RECORDS FOR FOCUSED PHOTO
    // -------------------------------------------------------------------------
    let col3ContentHtml = '';
    if (!activePhoto || !activeObj || !activeObj.id) {
      col3ContentHtml = `
        <div class="editorial-memo-bands">
          <section class="editorial-band">
            <div class="band-label-col">
              <div class="band-label-title">Notice</div>
            </div>
            <div class="band-content-col">
              <p class="band-empty-text">선택된 사진 정보가 없습니다.</p>
            </div>
          </section>
        </div>
      `;
    } else {
      const linkTarget = activeObj.isResearch
        ? `field-research.html#${activeObj.id}`
        : `index.html?id=${activeObj.id}`;
      const linkText = activeObj.isResearch
        ? '&rarr; 필드 리서치 기록 열기'
        : '&rarr; 아카이브 상세 열기';

      let attachedMemosHtml = '';
      if (activeObj.isResearch) {
        attachedMemosHtml = `
          <div class="editorial-memo-entry display-mode archival-memo-slip">
            <div class="memo-entry-header mono">
              <span>FIELD RESEARCH JOURNAL</span>
            </div>
            <h3 class="memo-entry-title">${escapeHtml(activeObj.title)}</h3>
            <div class="memo-entry-content slip-content">
              ${escapeHtml(activeObj.description || '현장 리서치 관찰 기록입니다.')}
            </div>
          </div>
        `;
      } else if (activeMemos.length) {
        attachedMemosHtml = activeMemos.map(m => `
          <article class="editorial-memo-entry display-mode archival-memo-slip" data-id="${m.id}">
            <div class="memo-entry-header mono">
              <span>${escapeHtml(m.timestamp || '')}</span>
            </div>
            <h3 class="memo-entry-title">${escapeHtml(m.title || '메모')}</h3>
            <div class="memo-entry-content slip-content">
              ${window.keywordService && typeof window.keywordService.renderAnnotatedHtml === 'function'
                ? window.keywordService.renderAnnotatedHtml(m.id, m.content)
                : escapeHtml(m.content || '')}
            </div>
          </article>
        `).join('');
      } else {
        attachedMemosHtml = `<p class="band-empty-text">연결된 메모가 없습니다.</p>`;
      }

      col3ContentHtml = `
        <div class="editorial-memo-bands">
          <!-- Band 1: Active Subject -->
          <section class="editorial-band">
            <div class="band-label-col">
              <div class="band-label-title">Subject</div>
              <div class="band-label-sub mono">${escapeHtml(activeObj.id || '')}</div>
            </div>
            <div class="band-content-col">
              <h1 class="band-headline">${escapeHtml(activeObj.title || '무제')}</h1>
              <div class="band-spec-meta">
                ${activeObj.timestamp ? `<div>일시: ${escapeHtml(activeObj.timestamp)}</div>` : ''}
                ${activeObj.materials ? `<div>재질/위치: ${escapeHtml(activeObj.materials)}</div>` : ''}
                ${activeObj.dimensions ? `<div>규격/날씨: ${escapeHtml(activeObj.dimensions)}</div>` : ''}
              </div>
              <div style="margin-top: 6px;">
                <a href="${linkTarget}" class="mono" style="font-size:11px; color:#111; text-decoration: underline;">${linkText}</a>
              </div>
            </div>
          </section>

          <!-- Band 2: Attached Memos / Research Notes -->
          <section class="editorial-band">
            <div class="band-label-col">
              <div class="band-label-title">${activeObj.isResearch ? 'Notes' : 'Memos'}</div>
              <div class="band-label-sub mono">(${activeObj.isResearch ? '1' : activeMemos.length})</div>
            </div>
            <div class="band-content-col">
              ${attachedMemosHtml}
            </div>
          </section>
        </div>
      `;
    }

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
          ${col3ContentHtml}
        </div>
      </div>
    `;

    container.innerHTML = col1Html + col2Html + col3Html;

    // Bind ledger index filters
    container.querySelectorAll('.archive-ledger-item').forEach(item => {
      item.addEventListener('click', () => {
        filterObjId = item.getAttribute('data-filter') || 'all';
        activePhotoIndex = 0;
        renderPhoto3Col();
      });
    });

    // Reset filter button
    container.querySelectorAll('.reset-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterObjId = 'all';
        activePhotoIndex = 0;
        renderPhoto3Col();
      });
    });

    // Bind photo click & zoom button for lightbox & active photo update
    container.querySelectorAll('.editorial-photo-entry').forEach(entry => {
      entry.addEventListener('click', (e) => {
        const idx = parseInt(entry.getAttribute('data-index'), 10) || 0;
        activePhotoIndex = idx;
        if (e.target.closest('.caption-btn-more') || e.target.closest('.editorial-photo-frame')) {
          if (window.app && typeof window.app.openLightbox === 'function') {
            window.app.openLightbox(allSrcs, idx);
          }
        } else {
          // Update Column 3 focus
          renderPhoto3Col();
        }
      });
    });

    // Initialize popover menu on '=' buttons
    if (window.app && typeof window.app.initMenuPopover === 'function') {
      try {
        window.app.initMenuPopover();
      } catch (e) {
        console.warn('[Photo] Popover init warning:', e);
      }
    }
  } catch (err) {
    console.error('[Photo] Fatal rendering error caught and handled:', err);
    if (container && !container.children.length) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center;">
          <h2 class="band-headline" style="margin-bottom: 8px;">사진 아카이브 로딩 중 문제가 발생했습니다.</h2>
          <p class="text-caption mono" style="margin-bottom: 16px;">${escapeHtml(err.message)}</p>
          <button type="button" class="btn-more-minimal mono" onclick="location.reload();" style="cursor: pointer; padding: 6px 12px; border: 1px solid #ccc; background: #fff;">[새로고침]</button>
        </div>
      `;
    }
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
