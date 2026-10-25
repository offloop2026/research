/**
 * ARCHIVE MODULE (archive.js)
 * Exact Recreation of Attached Cargo Reference Screenshot + Free Position Memo System:
 * - Column 1: "Section 1 =" header, square layered frame (425x427), 2-col caption underneath
 * - Column 2: "Section 2 =" header, tall layered frame (425x677), 2-col caption underneath
 * - Column 3: "Cargo Demo Template" header, Dual-Mode Memo System:
 *   - "Editorial" mode: Profile / Memos / Keywords / Constellation publication document
 *   - "Free Position" mode: Draggable memo slips, real-time random RGB connection lines, live line tracking
 * - Preserves existing LocalStorage keys:
 *   - archive_user_custom_v3
 *   - archive_memo_positions_v1
 *   - archive_memo_connections_v1
 *   - archive_constellation_positions_v1
 *   - archive_constellation_connections_v1
 *   - archive_keywords_v1
 */

const POSITIONS_STORAGE_KEY = 'archive_memo_positions_v1';
const CONNECTIONS_STORAGE_KEY = 'archive_memo_connections_v1';

let selectedObjectId = null;
let memoViewMode = 'editorial'; // 'editorial' (default) or 'board' (Free Position)
let isComposingMemo = false;
let editingMemoId = null;
let composerSlipPos = { x: 30, y: 30 };

// Pointer drag & connection states for Column 3 Board
let draggingMemoId = null;
let dragPointerStartX = 0;
let dragPointerStartY = 0;
let memoStartPosX = 0;
let memoStartPosY = 0;
let highestZIndex = 20;

let isDraggingConnection = false;
let dragSourceMemoId = null;

// In-Situ CMS Edit Mode states
let editingObjectId = null;
let isAddingObject = false;
let isAddingPhoto = false;
let editingProfile = false;
let editingKeywordNorm = null;

function isCmsEditMode() {
  try {
    return localStorage.getItem('archive_cms_edit_mode') === 'true';
  } catch (e) {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Restore view mode from session if present
  try {
    const savedMode = sessionStorage.getItem('archive_memo_view_mode');
    if (savedMode === 'board' || savedMode === 'editorial') {
      memoViewMode = savedMode;
    }
  } catch (e) {}

  if (window.app && window.app.isReady) {
    initArchive3Col();
  } else {
    window.addEventListener('archive-ready', () => {
      initArchive3Col();
    }, { once: true });
    // Fallback polling
    const fallback = setInterval(() => {
      if (window.app && window.app.isReady) {
        clearInterval(fallback);
        initArchive3Col();
      }
    }, 30);
  }

  window.addEventListener('archive-updated', () => {
    pruneOrphanConnections();
    renderArchiveView();
  });

  window.addEventListener('resize', () => {
    if (memoViewMode === 'board') {
      requestAnimationFrame(() => renderCol3ConnectionsSvg());
    }
  });
});

function initArchive3Col() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('id');
  const paramMode = urlParams.get('mode');
  if (paramMode === 'board' || paramMode === 'editorial') {
    memoViewMode = paramMode;
  }

  const objects = window.app.getObjects();

  if (paramId && window.app.getObjectById(paramId)) {
    selectedObjectId = paramId;
  } else if (objects.length > 0) {
    selectedObjectId = objects[0].id;
  }

  pruneOrphanConnections();
  renderArchiveView();
}

// ---------------------------------------------------------------------------
// 1. POSITION STORAGE MANAGEMENT
// ---------------------------------------------------------------------------
function getStoredPositions() {
  try {
    const raw = localStorage.getItem(POSITIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[Positions] Read error:', e);
    return {};
  }
}

function saveStoredPositions(positions) {
  try {
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch (e) {
    console.warn('[Positions] Write error:', e);
  }
}

function getMemoPosition(memoId, index) {
  const stored = getStoredPositions();
  if (stored[memoId]) {
    const p = stored[memoId];
    const x = typeof p.x === 'number' ? p.x : (typeof p.left === 'number' ? p.left : 40);
    const y = typeof p.y === 'number' ? p.y : (typeof p.top === 'number' ? p.top : 40);
    return { x, y };
  }

  // Dynamic initial stagger
  const col = index % 2;
  const row = Math.floor(index / 2);
  const defaultX = Math.max(20, 24 + col * 290 + ((index * 23) % 24));
  const defaultY = Math.max(20, 30 + row * 240 + ((index * 17) % 20));

  const pos = { x: defaultX, y: defaultY };
  stored[memoId] = pos;
  saveStoredPositions(stored);
  return pos;
}

function updateMemoPosition(memoId, x, y) {
  const stored = getStoredPositions();
  stored[memoId] = { x: Math.round(x), y: Math.round(y) };
  saveStoredPositions(stored);
}

function removeMemoPosition(memoId) {
  const stored = getStoredPositions();
  if (stored[memoId]) {
    delete stored[memoId];
    saveStoredPositions(stored);
  }
}

// ---------------------------------------------------------------------------
// 2. CONNECTION STORAGE MANAGEMENT & RANDOM RGB
// ---------------------------------------------------------------------------
function getStoredConnections() {
  try {
    const raw = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[Connections] Storage read error:', e);
    return [];
  }
}

function saveStoredConnections(connections) {
  try {
    localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connections));
  } catch (e) {
    console.warn('[Connections] Storage write error:', e);
  }
}

function pruneOrphanConnections(deletedId = null) {
  const allMemos = window.app.getMemos();
  const validIds = new Set(allMemos.map(m => m.id));
  if (deletedId) validIds.delete(deletedId);

  const conns = getStoredConnections();
  const filtered = conns.filter(c => {
    const fromId = c.fromMemoId || c.sourceId;
    const toId = c.toMemoId || c.targetId;
    return validIds.has(fromId) && validIds.has(toId);
  });

  if (filtered.length !== conns.length) {
    saveStoredConnections(filtered);
  }
}

function addMemoConnection(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return false;

  const conns = getStoredConnections();
  const exists = conns.some(c => {
    const f = c.fromMemoId || c.sourceId;
    const t = c.toMemoId || c.targetId;
    return (f === fromId && t === toId) || (f === toId && t === fromId);
  });
  if (exists) return false;

  const newConn = {
    id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    fromMemoId: fromId,
    toMemoId: toId,
    sourceId: fromId,
    targetId: toId,
    color: generateRandomRGB()
  };

  conns.push(newConn);
  saveStoredConnections(conns);
  renderCol3ConnectionsSvg();
  return true;
}

function deleteMemoConnection(connId) {
  const conns = getStoredConnections();
  const next = conns.filter(c => c.id !== connId);
  saveStoredConnections(next);
  renderCol3ConnectionsSvg();
}

function generateRandomRGB() {
  let r, g, b, brightness;
  do {
    r = Math.floor(Math.random() * 256);
    g = Math.floor(Math.random() * 256);
    b = Math.floor(Math.random() * 256);
    brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  } while (
    brightness > 195 ||
    (r > 215 && g > 215 && b > 215)
  );

  return `rgb(${r}, ${g}, ${b})`;
}

// ---------------------------------------------------------------------------
// 3. MAIN 3-COLUMN VIEW RENDERING
// ---------------------------------------------------------------------------
function renderArchiveView() {
  const container = document.getElementById('archive-main-container');
  if (!container) return;

  const objects = window.app.getObjects();
  const sorted = [...objects].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  if (!sorted.length) {
    container.innerHTML = `
      <div class="col-scroll-body" style="grid-column: 1 / -1; padding: 40px; text-align: center; font-family: var(--font-serif);">
        <p>기록된 사물이 없습니다.</p>
        <button type="button" class="band-text-action" onclick="window.app.openRegistrationModal()" style="display:inline-block; margin-top: 12px;">+ 새 사물 등록</button>
      </div>
    `;
    return;
  }

  // Ensure selected object is valid
  if (!selectedObjectId || !window.app.getObjectById(selectedObjectId)) {
    selectedObjectId = sorted[0].id;
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const nowTimestamp = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const selectedObj = window.app.getObjectById(selectedObjectId) || sorted[0];
  const selectedIndex = sorted.findIndex(o => o.id === selectedObj.id);
  const selectedFormattedNum = String(selectedIndex >= 0 ? selectedIndex + 1 : 1).padStart(2, '0');

  // -------------------------------------------------------------------------
  // COLUMN 1: ARCHIVE (Matches Reference Column 1: "Section 1 =")
  // -------------------------------------------------------------------------
  const col1Html = `
    <div class="editorial-col col-archive">
      <div class="col-header">
        <div class="col-header-left">
          <span class="col-header-title">Section 1</span>
        </div>
        <div class="col-header-right">
          <button type="button" class="col-header-edit-badge ${isCmsEditMode() ? 'active' : ''} mono" id="btn-col1-toggle-edit" title="편집 모드 전환">
            ${isCmsEditMode() ? '[EDIT: ON]' : '[Edit]'}
          </button>
          ${isCmsEditMode() ? `
            <button type="button" class="col-header-edit-badge mono" id="btn-col1-add-obj" title="새 사물 등록">[+ Add]</button>
          ` : ''}
          <button type="button" class="col-header-menu-btn" title="Navigation" data-menu="col1">=</button>
        </div>
      </div>

      <div class="col-scroll-body" id="col-archive-scroll">
        <div class="editorial-column-stream">
          <!-- Inline New Object Form -->
          ${isAddingObject ? `
            <div class="editorial-inline-editor" style="margin: 12px 16px;">
              <div class="inline-editor-header mono">
                <span>+ New Object (새 사물 등록)</span>
              </div>
              <div class="inline-editor-body">
                <div class="cms-input-group">
                  <label class="cms-input-label mono">사물 명칭 / Title</label>
                  <input type="text" id="new-obj-title" class="cms-text-input" placeholder="사물 명칭..." required />
                </div>
                <div class="cms-input-group">
                  <label class="cms-input-label mono">일시 / Date</label>
                  <input type="text" id="new-obj-time" class="cms-text-input mono" value="${nowTimestamp}" />
                </div>
                <div class="cms-input-group">
                  <label class="cms-input-label mono">재질 / Material</label>
                  <input type="text" id="new-obj-mat" class="cms-text-input" placeholder="예: 백자토, 유약, 금속" />
                </div>
                <div class="cms-input-group">
                  <label class="cms-input-label mono">규격 / Dimensions</label>
                  <input type="text" id="new-obj-dim" class="cms-text-input" placeholder="예: 120 x 85 x 4 mm" />
                </div>
                <div class="cms-input-group">
                  <label class="cms-input-label mono">설명 / Description</label>
                  <textarea id="new-obj-desc" class="cms-textarea" rows="3" placeholder="사물에 대한 설명..."></textarea>
                </div>
                <div class="cms-input-group">
                  <label class="cms-input-label mono">대표 사진 파일 (선택)</label>
                  <input type="file" id="new-obj-file" accept="image/*" class="cms-file-input" />
                  <input type="text" id="new-obj-file-url" class="cms-text-input" placeholder="또는 이미지 URL..." style="margin-top:4px;" />
                </div>
                <div class="inline-editor-actions mono">
                  <button type="button" class="composer-text-action" id="btn-cancel-add-obj">취소</button>
                  <button type="button" class="composer-text-action" id="btn-save-add-obj">등록</button>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Object Stream -->
          ${sorted.map((obj, i) => {
            const num = String(i + 1).padStart(2, '0');
            const isSelected = (obj.id === selectedObj.id);
            const isEditingThis = (editingObjectId === obj.id);
            const repImg = obj.representativeImage || (obj.images && obj.images[0]);
            const dateStr = obj.timestamp ? obj.timestamp.split(' ')[0] : '';

            if (isEditingThis) {
              return `
                <article class="editorial-project-entry active-selection active-editing" data-id="${obj.id}">
                  <div class="editorial-inline-editor" style="margin: 12px 16px;">
                    <div class="inline-editor-header mono">
                      <span>Edit Object &middot; ${escapeHtml(obj.id)}</span>
                    </div>
                    <div class="inline-editor-body">
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">사물 명칭 / Title</label>
                        <input type="text" id="edit-obj-title-${obj.id}" class="cms-text-input" value="${escapeHtml(obj.title)}" required />
                      </div>
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">일시 / Date</label>
                        <input type="text" id="edit-obj-time-${obj.id}" class="cms-text-input mono" value="${escapeHtml(obj.timestamp || '')}" />
                      </div>
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">재질 / Material</label>
                        <input type="text" id="edit-obj-mat-${obj.id}" class="cms-text-input" value="${escapeHtml(obj.materials || '')}" />
                      </div>
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">규격 / Dimensions</label>
                        <input type="text" id="edit-obj-dim-${obj.id}" class="cms-text-input" value="${escapeHtml(obj.dimensions || '')}" />
                      </div>
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">설명 / Description</label>
                        <textarea id="edit-obj-desc-${obj.id}" class="cms-textarea" rows="3">${escapeHtml(obj.description || '')}</textarea>
                      </div>
                      ${obj.images && obj.images.length > 1 ? `
                        <div class="cms-input-group">
                          <label class="cms-input-label mono">대표 이미지 선택</label>
                          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                            ${obj.images.map(im => `
                              <div class="thumb-cell ${im === repImg ? 'primary' : ''} btn-select-inline-cover" style="width:50px; height:50px; border:1px solid ${im === repImg ? '#000000' : '#ECECEC'}; position:relative; cursor:pointer;" data-obj-id="${obj.id}" data-img-src="${im}" title="대표 이미지로 지정">
                                <img src="${im}" style="width:100%; height:100%; object-fit:cover;" />
                                ${im === repImg ? '<span class="mono" style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); color:#FFF; font-size:9px; text-align:center;">Cover</span>' : ''}
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      ` : ''}
                      <div class="inline-editor-actions mono">
                        <button type="button" class="composer-text-action btn-del-edit-obj" data-id="${obj.id}" style="color:#C00000; margin-right:auto;">삭제</button>
                        <button type="button" class="composer-text-action btn-cancel-edit-obj" data-id="${obj.id}">취소</button>
                        <button type="button" class="composer-text-action btn-save-edit-obj" data-id="${obj.id}">저장</button>
                      </div>
                    </div>
                  </div>
                </article>
              `;
            }

            return `
              <article class="editorial-project-entry ${isSelected ? 'active-selection' : ''}" data-id="${obj.id}">
                <!-- Layered Frame: Square proportion (425x427, 83% col width) -->
                <div class="editorial-frame-outer editorial-frame-col1" data-id="${obj.id}">
                  <div class="editorial-frame-border">
                    <div class="editorial-frame-inner">
                      ${repImg ? `
                        <img src="${repImg}" alt="${escapeHtml(obj.title)}" class="editorial-framed-img" loading="lazy" />
                      ` : `
                        <div class="cargo-placeholder-canvas">
                          <svg class="cargo-placeholder-diagonal" preserveAspectRatio="none" viewBox="0 0 100 100">
                            <line x1="0" y1="0" x2="100" y2="100" stroke="#888888" stroke-width="0.75" />
                          </svg>
                          <span class="cargo-placeholder-text">Cargo&reg; Placeholder Image &middot; cargo.site</span>
                        </div>
                      `}
                    </div>
                  </div>
                </div>

                <!-- Two-Column Caption matching Reference Layout -->
                <div class="editorial-2col-caption">
                  <div class="caption-left-col">
                    <div class="caption-project-name">${num}. Object</div>
                  </div>

                  <div class="caption-right-col">
                    <h3 class="caption-title">${escapeHtml(obj.title)}</h3>
                    <div class="caption-spec">
                      ${obj.materials ? `<span>${escapeHtml(obj.materials)}</span>` : ''}
                      ${obj.materials && dateStr ? `<span>, </span>` : ''}
                      ${dateStr ? `<span>${escapeHtml(dateStr)}</span>` : ''}
                      ${obj.dimensions ? `<br><span>${escapeHtml(obj.dimensions)}</span>` : ''}
                    </div>
                    ${obj.description ? `<p class="caption-desc">${escapeHtml(obj.description)}</p>` : ''}
                    <div class="caption-actions mono" style="display:flex; gap:8px; align-items:center;">
                      <button type="button" class="btn-caption-more" data-id="${obj.id}">[More..]</button>
                      ${isCmsEditMode() ? `
                        <button type="button" class="cms-action-btn btn-trigger-edit-obj" data-id="${obj.id}">[Edit]</button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // -------------------------------------------------------------------------
  // COLUMN 2: PHOTO (Matches Reference Column 2: "Section 2 =")
  // -------------------------------------------------------------------------
  const detailImages = (selectedObj.images && selectedObj.images.length)
    ? selectedObj.images
    : (selectedObj.representativeImage ? [selectedObj.representativeImage] : ['assets/images/obj-001-1.svg']);

  const objectMemos = window.app.getMemosForObject(selectedObj.id);
  const allPhotoSrcs = detailImages;

  const col2Html = `
    <div class="editorial-col col-photo">
      <div class="col-header">
        <div class="col-header-left">
          <span class="col-header-title">Section 2</span>
          <span class="col-header-meta mono" style="opacity:0.5; font-size:11px; margin-left:6px;">(${detailImages.length})</span>
        </div>
        <div class="col-header-right">
          ${isCmsEditMode() ? `
            <button type="button" class="col-header-edit-badge mono" id="btn-col2-trigger-add" title="새 사진 추가">[+ Add Photo]</button>
          ` : ''}
          <button type="button" class="col-header-menu-btn" title="Navigation" data-menu="col2">=</button>
        </div>
      </div>

      <div class="col-scroll-body" id="col-photo-scroll">
        <div class="editorial-column-stream">
          <!-- Inline Photo Adder -->
          ${isAddingPhoto ? `
            <div class="editorial-inline-editor photo-composer" style="margin: 12px 16px;">
              <div class="inline-editor-header mono">
                <span>+ Add Photo &middot; ${escapeHtml(selectedObj.title)}</span>
              </div>
              <div class="inline-editor-body">
                <div class="cms-input-group">
                  <label class="cms-input-label mono">사진 파일 (File Upload)</label>
                  <input type="file" id="col2-new-photo-file" accept="image/*" class="cms-file-input" />
                  <div id="col2-preview-box" style="margin-top:6px; display:none; max-width:140px;">
                    <img id="col2-preview-img" style="width:100%; border:1px solid #ECECEC;" />
                  </div>
                </div>
                <div class="cms-input-group">
                  <label class="cms-input-label mono">또는 이미지 URL</label>
                  <input type="text" id="col2-new-photo-url" class="cms-text-input" placeholder="assets/images/... 또는 https://..." />
                </div>
                <div class="cms-input-group mono" style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                  <input type="checkbox" id="col2-photo-set-rep" />
                  <label for="col2-photo-set-rep" style="cursor:pointer; font-size:11px;">대표 이미지(Cover)로 지정</label>
                </div>
                <div class="inline-editor-actions mono">
                  <button type="button" class="composer-text-action" id="btn-cancel-add-photo">취소</button>
                  <button type="button" class="composer-text-action" id="btn-save-add-photo">추가</button>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Photos Stream -->
          ${detailImages.map((src, imgIdx) => {
            const memoForImg = objectMemos[imgIdx];
            const excerpt = memoForImg ? memoForImg.content : (selectedObj.description || '');
            const isRep = (src === selectedObj.representativeImage);

            return `
              <article class="editorial-project-entry" data-index="${imgIdx}">
                <!-- Layered Frame: Tall proportion (425x677, 83% col width) -->
                <div class="editorial-frame-outer editorial-frame-col2 photo-click-target" data-index="${imgIdx}" title="클릭하여 확대">
                  <div class="editorial-frame-border">
                    <div class="editorial-frame-inner">
                      ${src ? `
                        <img src="${src}" alt="${escapeHtml(selectedObj.title)}" class="editorial-framed-img" loading="lazy" />
                      ` : `
                        <div class="cargo-placeholder-canvas">
                          <svg class="cargo-placeholder-diagonal" preserveAspectRatio="none" viewBox="0 0 100 100">
                            <line x1="0" y1="0" x2="100" y2="100" stroke="#888888" stroke-width="0.75" />
                          </svg>
                          <span class="cargo-placeholder-text">Cargo&reg; Placeholder Image &middot; cargo.site</span>
                        </div>
                      `}
                    </div>
                  </div>
                </div>

                <!-- Two-Column Caption matching Reference Layout -->
                <div class="editorial-2col-caption">
                  <div class="caption-left-col">
                    <div class="caption-project-name">${selectedFormattedNum}.${imgIdx + 1} Photo</div>
                  </div>

                  <div class="caption-right-col">
                    <h3 class="caption-title">${escapeHtml(selectedObj.title)} &middot; ${imgIdx + 1}</h3>
                    <div class="caption-spec">
                      ${selectedObj.materials ? `<span>${escapeHtml(selectedObj.materials)}</span>` : ''}
                      ${selectedObj.materials && selectedObj.timestamp ? `<span>, </span>` : ''}
                      ${selectedObj.timestamp ? `<span>${escapeHtml(selectedObj.timestamp.split(' ')[0])}</span>` : ''}
                      ${selectedObj.dimensions ? `<br><span>${escapeHtml(selectedObj.dimensions)}</span>` : ''}
                    </div>
                    ${excerpt ? `<p class="caption-desc">${escapeHtml(excerpt)}</p>` : ''}
                    <div class="caption-actions mono" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px;">
                      <button type="button" class="btn-caption-more" data-index="${imgIdx}">[More..]</button>
                      ${isCmsEditMode() ? `
                        ${isRep ? `
                          <span class="cms-badge-rep mono">[Cover]</span>
                        ` : `
                          <button type="button" class="cms-action-btn btn-set-photo-rep mono" data-idx="${imgIdx}" title="대표 사진으로 지정">[Set Cover]</button>
                        `}
                        ${imgIdx > 0 ? `
                          <button type="button" class="cms-action-btn btn-move-photo-up mono" data-idx="${imgIdx}" title="위로 순서 이동">[&uarr; Up]</button>
                        ` : ''}
                        ${imgIdx < detailImages.length - 1 ? `
                          <button type="button" class="cms-action-btn btn-move-photo-down mono" data-idx="${imgIdx}" title="아래로 순서 이동">[&darr; Down]</button>
                        ` : ''}
                        <button type="button" class="cms-action-btn text-danger btn-del-photo mono" data-idx="${imgIdx}" title="사진 삭제">[Delete]</button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // -------------------------------------------------------------------------
  // COLUMN 3: CARGO DEMO TEMPLATE (Information & Dual-Mode Memo System)
  // -------------------------------------------------------------------------
  const sortedMemos = [...objectMemos].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  // Unique keywords for this object
  let objectKeywords = [];
  if (window.keywordService) {
    const kwSet = new Set();
    sortedMemos.forEach(m => {
      const anns = window.keywordService.getAnnotationsForMemo(m.id);
      anns.forEach(a => { if (a.normalized) kwSet.add(a.normalized); });
    });
    objectKeywords = Array.from(kwSet);
  }

  const allResearchList = (window.app && typeof window.app.getResearchList === 'function')
    ? window.app.getResearchList()
    : [];
  const linkedResearch = allResearchList.filter(r => r.relatedObjectId === selectedObj.id);

  // Column 3 Header with mode switcher
  const col3HeaderHtml = `
    <div class="col-header">
      <div class="col-header-left">
        <span class="col-header-title">Cargo Demo Template</span>
      </div>
      <div class="col-header-right">
        <div class="col-header-mode-toggle mono">
          <button type="button" class="mode-switch-btn ${memoViewMode === 'editorial' ? 'active' : ''}" data-mode="editorial" title="에디토리얼 읽기 모드">Editorial</button>
          <span>&middot;</span>
          <button type="button" class="mode-switch-btn ${memoViewMode === 'board' ? 'active' : ''}" data-mode="board" title="메모 자유 배치 및 연결 보드">Board</button>
        </div>
        <button type="button" class="col-header-menu-btn" title="Navigation" data-menu="col3">=</button>
      </div>
    </div>
  `;

  let col3BodyHtml = '';

  if (memoViewMode === 'editorial') {
    // -----------------------------------------------------------------------
    // A. EDITORIAL READ MODE (Reference Document Layout)
    // -----------------------------------------------------------------------
    col3BodyHtml = `
      <div class="col-scroll-body" id="col-memo-scroll">
        <div class="editorial-col3-doc">

          <!-- 1. PROFILE SECTION -->
          <section class="doc-band-section">
            <div class="doc-band-grid">
              <div class="doc-band-label-col">
                <div class="band-main-label">Profile</div>
                <div class="band-sub-label mono">${selectedObj.id}</div>
                <div class="band-sub-label mono">${selectedObj.timestamp ? selectedObj.timestamp.split(' ')[0] : ''}</div>
                ${isCmsEditMode() && !editingProfile ? `
                  <button type="button" class="band-text-action mono" id="btn-trigger-edit-profile" style="margin-top:6px; font-size:11px;">[Edit Profile]</button>
                ` : ''}
              </div>

              <div class="doc-band-content-col">
                ${editingProfile ? `
                  <div class="editorial-inline-editor" style="margin-bottom: 16px;">
                    <div class="inline-editor-header mono">
                      <span>Edit Profile &middot; ${escapeHtml(selectedObj.id)}</span>
                    </div>
                    <div class="inline-editor-body">
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">사물 명칭 / Title</label>
                        <input type="text" id="prof-edit-title" class="cms-text-input" value="${escapeHtml(selectedObj.title)}" required />
                      </div>
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">일시 / Date</label>
                        <input type="text" id="prof-edit-time" class="cms-text-input mono" value="${escapeHtml(selectedObj.timestamp || '')}" />
                      </div>
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">재질 / Material</label>
                        <input type="text" id="prof-edit-mat" class="cms-text-input" value="${escapeHtml(selectedObj.materials || '')}" />
                      </div>
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">규격 / Dimensions</label>
                        <input type="text" id="prof-edit-dim" class="cms-text-input" value="${escapeHtml(selectedObj.dimensions || '')}" />
                      </div>
                      <div class="cms-input-group">
                        <label class="cms-input-label mono">설명 / Description</label>
                        <textarea id="prof-edit-desc" class="cms-textarea" rows="4">${escapeHtml(selectedObj.description || '')}</textarea>
                      </div>
                      <div class="inline-editor-actions mono">
                        <button type="button" class="composer-text-action" id="btn-prof-cancel">취소</button>
                        <button type="button" class="composer-text-action" id="btn-prof-save">저장</button>
                      </div>
                    </div>
                  </div>
                ` : `
                  <h2 class="doc-profile-title">${escapeHtml(selectedObj.title)}</h2>
                  <div class="doc-profile-specs">
                    ${selectedObj.timestamp ? `<div>일시: ${escapeHtml(selectedObj.timestamp)}</div>` : ''}
                    ${selectedObj.materials ? `<div>재질: ${escapeHtml(selectedObj.materials)}</div>` : ''}
                    ${selectedObj.dimensions ? `<div>규격: ${escapeHtml(selectedObj.dimensions)}</div>` : ''}
                  </div>
                  ${selectedObj.description ? `<p class="doc-body-para">${escapeHtml(selectedObj.description)}</p>` : ''}

                  <div class="doc-band-tools">
                    ${isCmsEditMode() ? `
                      <button type="button" class="doc-tool-link-btn mono" id="btn-edit-active-profile">[프로필 수정]</button>
                      &middot;
                    ` : ''}
                    <button type="button" class="doc-tool-link-btn text-danger mono" id="btn-delete-active-obj">사물 삭제</button>
                  </div>
                `}
              </div>
            </div>
          </section>

          <!-- 2. MEMOS SECTION -->
          <section class="doc-band-section">
            <div class="doc-band-grid">
              <div class="doc-band-label-col">
                <div class="band-main-label">Memos (${sortedMemos.length})</div>
                <button type="button" class="band-text-action" id="btn-trigger-new-note">+ New Note</button>
                <button type="button" class="band-text-action mono" id="btn-switch-to-board" style="font-size:11px; color:#555555; margin-top:8px;">&rarr; Board</button>
              </div>

              <div class="doc-band-content-col">
                <!-- In-place New Memo Composer -->
                ${isComposingMemo ? `
                  <div class="doc-memo-composer" id="doc-memo-composer-box">
                    <div class="composer-top-row mono">
                      <span>새 메모 작성</span>
                      <input type="text" id="new-memo-time" class="composer-time-input mono" value="${nowTimestamp}" />
                    </div>
                    <div class="composer-body">
                      <input type="text" id="new-memo-title" class="composer-title-input" placeholder="메모 제목을 입력하세요..." required />
                      <textarea id="new-memo-content" class="composer-content-textarea" rows="4" placeholder="사물에 대한 관찰 기록이나 메모를 입력하세요..." required></textarea>
                    </div>
                    <div class="composer-actions-row">
                      <button type="button" class="composer-text-action" id="btn-new-memo-cancel">취소</button>
                      <button type="button" class="composer-text-action" id="btn-new-memo-save">저장</button>
                    </div>
                  </div>
                ` : ''}

                <!-- Memos Stream -->
                ${sortedMemos.length ? sortedMemos.map(m => {
                  const isEditing = (m.id === editingMemoId);

                  if (isEditing) {
                    return `
                      <div class="doc-memo-composer editing" id="memo-edit-box-${m.id}">
                        <div class="composer-top-row mono">
                          <span>메모 수정</span>
                          <input type="text" id="edit-memo-time-${m.id}" class="composer-time-input mono" value="${m.timestamp}" />
                        </div>
                        <div class="composer-body">
                          <input type="text" id="edit-memo-title-${m.id}" class="composer-title-input" value="${escapeHtml(m.title)}" required />
                          <textarea id="edit-memo-content-${m.id}" class="composer-content-textarea" rows="4" required>${escapeHtml(m.content)}</textarea>
                        </div>
                        <div class="composer-actions-row">
                          <button type="button" class="composer-text-action btn-del-edit-memo" data-id="${m.id}">삭제</button>
                          <button type="button" class="composer-text-action" id="btn-cancel-edit-memo">취소</button>
                          <button type="button" class="composer-text-action btn-save-edit-memo" data-id="${m.id}">저장</button>
                        </div>
                      </div>
                    `;
                  }

                  return `
                    <article class="doc-memo-item archival-memo-slip" data-id="${m.id}">
                      <h4 class="memo-item-title">${escapeHtml(m.title)}</h4>
                      <div class="memo-item-content slip-content">
                        ${window.keywordService ? window.keywordService.renderAnnotatedHtml(m.id, m.content) : escapeHtml(m.content)}
                      </div>
                      <div class="memo-item-footer mono">
                        <span class="memo-meta-date">${m.timestamp ? m.timestamp.split(' ')[0] : ''}</span>
                        <div class="memo-actions-group">
                          <button type="button" class="memo-text-link btn-trigger-memo-edit" data-id="${m.id}">Edit</button>
                          &middot;
                          <button type="button" class="memo-text-link btn-trigger-memo-del" data-id="${m.id}">Delete</button>
                        </div>
                      </div>
                    </article>
                  `;
                }).join('') : (
                  !isComposingMemo ? `
                    <div class="doc-empty-hint">
                      <span>No memo yet.</span>
                      <button type="button" class="band-text-action" id="btn-empty-new-note" style="margin-top:0;">+ New Note</button>
                    </div>
                  ` : ''
                )}
              </div>
            </div>
          </section>

          <!-- 3. KEYWORDS SECTION -->
          <section class="doc-band-section">
            <div class="doc-band-grid">
              <div class="doc-band-label-col">
                <div class="band-main-label">Keywords</div>
                <div class="band-sub-label mono">주석 탐색</div>
                ${isCmsEditMode() ? `<div class="band-sub-label mono" style="font-size:10px; color:#888; margin-top:4px;">[클릭: 수정, &times;: 삭제]</div>` : ''}
              </div>

              <div class="doc-band-content-col">
                ${objectKeywords.length ? `
                  <div class="doc-keywords-cloud">
                    ${objectKeywords.map(kw => `
                      <div class="cms-keyword-chip-wrap">
                        <button type="button" class="doc-keyword-chip archival-keyword-annotation ${isCmsEditMode() ? 'cms-editable-chip' : ''}" data-kw-norm="${escapeHtml(kw)}" title="${isCmsEditMode() ? '클릭하여 키워드 이름 변경' : '키워드로 필터링'}">
                          ${escapeHtml(kw)}
                        </button>
                        ${isCmsEditMode() ? `
                          <button type="button" class="cms-keyword-del-btn mono" data-kw="${escapeHtml(kw)}" title="이 키워드 전체 삭제">&times;</button>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <p class="doc-empty-text">키워드 없음 &middot; 본문 텍스트를 드래그하여 지정 가능</p>
                `}
              </div>
            </div>
          </section>

          <!-- 4. FIELD RESEARCH SECTION -->
          <section class="doc-band-section">
            <div class="doc-band-grid">
              <div class="doc-band-label-col">
                <div class="band-main-label">Field Research</div>
                <div class="band-sub-label mono">기록 (${linkedResearch.length})</div>
              </div>

              <div class="doc-band-content-col">
                ${linkedResearch.length ? `
                  <div class="doc-constellation-list">
                    ${linkedResearch.map(res => `
                      <div class="constellation-row" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 6px;">
                        <a href="field-research.html#${res.id}" class="doc-nav-link" style="text-decoration:none;">
                          <span class="jump-title" style="text-decoration:underline;">${escapeHtml(res.title)}</span>
                          <span class="jump-id mono" style="margin-left:6px; opacity:0.5;">[${escapeHtml(res.date || res.numStr || '')}]</span>
                        </a>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <p class="doc-empty-text">연결된 현장 조사 기록이 없습니다.</p>
                `}

                <div class="doc-constellation-footer mono" style="margin-top:12px;">
                  <a href="field-research.html" class="doc-nav-link">&rarr; Field Research 아카이브 열기</a>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    `;
  } else {
    // -----------------------------------------------------------------------
    // B. FREE POSITION BOARD MODE (Draggable Slips & Random RGB Connection Lines)
    // -----------------------------------------------------------------------
    let maxRight = 1000;
    let maxBottom = 800;

    sortedMemos.forEach((m, idx) => {
      const pos = getMemoPosition(m.id, idx);
      if (pos.x + 360 > maxRight) maxRight = pos.x + 360;
      if (pos.y + 360 > maxBottom) maxBottom = pos.y + 360;
    });

    if (isComposingMemo) {
      if (composerSlipPos.x + 360 > maxRight) maxRight = composerSlipPos.x + 360;
      if (composerSlipPos.y + 360 > maxBottom) maxBottom = composerSlipPos.y + 360;
    }

    col3BodyHtml = `
      <div class="col3-board-subbar mono">
        <span>${escapeHtml(selectedObj.title)} &middot; Memos (${sortedMemos.length})</span>
        <div>
          <button type="button" class="band-text-action mono" id="btn-trigger-board-new" style="margin:0; font-size:11px;">+ New Note</button>
        </div>
      </div>

      <div class="col3-board-stage" id="col3-memo-board-stage">
        <div class="col3-board-canvas" id="col3-memo-board-canvas" style="width: ${maxRight}px; height: ${maxBottom}px;">
          <!-- SVG Connections Layer -->
          <svg class="col3-board-svg" id="col3-memo-connections-svg" width="${maxRight}" height="${maxBottom}">
            <g id="col3-connections-saved-group"></g>
            <line id="col3-connection-temp-line" x1="0" y1="0" x2="0" y2="0" class="temp-connection-line" style="display: none;"></line>
          </svg>

          <!-- Positioned Slips -->
          <div class="col3-board-surface" id="col3-memo-board-surface">
            <!-- Active New Composer Slip -->
            ${isComposingMemo ? `
              <div class="archival-memo-slip editing is-new-slip freeform-slip" id="col3-active-new-slip"
                   style="left: ${composerSlipPos.x}px; top: ${composerSlipPos.y}px; z-index: 60;">
                <div class="slip-header slip-drag-header mono" id="col3-new-slip-drag-header" title="상단을 잡고 자유롭게 이동">
                  <span class="slip-tag">새 메모 작성</span>
                  <input type="text" id="col3-new-slip-time" class="composer-time-input mono" value="${nowTimestamp}" style="width:110px;" />
                </div>
                <div style="padding: 10px 12px; display:flex; flex-direction:column; gap:6px;">
                  <input type="text" id="col3-new-slip-title" class="composer-title-input" placeholder="메모 제목..." required />
                  <textarea id="col3-new-slip-content" class="composer-content-textarea" rows="4" placeholder="내용을 입력하세요..." required></textarea>
                  <div class="composer-actions-row">
                    <button type="button" class="composer-text-action" id="btn-col3-new-cancel">취소</button>
                    <button type="button" class="composer-text-action" id="btn-col3-new-save">저장</button>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Positioned Memo Slips -->
            ${sortedMemos.length ? sortedMemos.map((m, idx) => {
              const pos = getMemoPosition(m.id, idx);
              const isEditing = (m.id === editingMemoId);

              if (isEditing) {
                return `
                  <div class="archival-memo-slip editing in-place-edit freeform-slip" id="col3-slip-${m.id}" data-id="${m.id}"
                       style="left: ${pos.x}px; top: ${pos.y}px; z-index: 50;">
                    <div class="slip-header slip-drag-header mono" data-id="${m.id}" title="상단을 잡고 자유롭게 이동">
                      <div style="display:flex; align-items:center;">
                        <div class="slip-connect-handle" data-id="${m.id}" title="연결선 만들기">
                          <span class="connect-dot"></span>
                        </div>
                        <span class="slip-tag">메모 수정</span>
                      </div>
                      <input type="text" id="col3-edit-time-${m.id}" class="composer-time-input mono" value="${m.timestamp}" style="width:110px;" />
                    </div>
                    <div style="padding: 10px 12px; display:flex; flex-direction:column; gap:6px;">
                      <input type="text" id="col3-edit-title-${m.id}" class="composer-title-input" value="${escapeHtml(m.title)}" required />
                      <textarea id="col3-edit-content-${m.id}" class="composer-content-textarea" rows="4" required>${escapeHtml(m.content)}</textarea>
                      <div class="composer-actions-row">
                        <button type="button" class="composer-text-action btn-del-edit-memo" data-id="${m.id}">삭제</button>
                        <button type="button" class="composer-text-action" id="btn-col3-edit-cancel">취소</button>
                        <button type="button" class="composer-text-action btn-save-edit-memo" data-id="${m.id}">저장</button>
                      </div>
                    </div>
                  </div>
                `;
              }

              return `
                <div class="archival-memo-slip display-mode freeform-slip" id="col3-slip-${m.id}" data-id="${m.id}"
                     style="left: ${pos.x}px; top: ${pos.y}px;">
                  <!-- Drag Header with Connection Dot & Delete -->
                  <div class="slip-header slip-drag-header mono" data-id="${m.id}" title="상단을 잡고 원하는 위치로 이동">
                    <div style="display:flex; align-items:center;">
                      <div class="slip-connect-handle" data-id="${m.id}" title="드래그하여 다른 메모와 연결">
                        <span class="connect-dot"></span>
                      </div>
                      <span>${m.timestamp ? m.timestamp.split(' ')[0] : ''}</span>
                    </div>
                    <button type="button" class="slip-quick-del mono" data-id="${m.id}" title="메모 삭제">&times;</button>
                  </div>

                  <!-- Main Body -->
                  <div class="slip-main-body" data-id="${m.id}">
                    <h4 class="slip-title">${escapeHtml(m.title)}</h4>
                    <div class="slip-content">
                      ${window.keywordService ? window.keywordService.renderAnnotatedHtml(m.id, m.content) : escapeHtml(m.content)}
                    </div>
                  </div>

                  <div class="slip-footer mono">
                    <span style="opacity:0.7;">&rarr; ${escapeHtml(selectedObj.title)}</span>
                    <button type="button" class="memo-text-link btn-trigger-memo-edit" data-id="${m.id}">Edit</button>
                  </div>
                </div>
              `;
            }).join('') : (
              !isComposingMemo ? `
                <div style="padding: 60px 40px; text-align: center; color: #888888; font-family: var(--font-serif); width: 100%; box-sizing: border-box;">
                  <p style="margin-bottom: 12px;">기록된 메모가 없습니다.</p>
                  <button type="button" class="band-text-action mono" id="btn-col3-empty-add">+ New Note</button>
                </div>
              ` : ''
            )}
          </div>
        </div>
      </div>
    `;
  }

  const col3Html = `
    <div class="editorial-col col-memo">
      ${col3HeaderHtml}
      ${col3BodyHtml}
    </div>
  `;

  container.innerHTML = col1Html + col2Html + col3Html;

  // Bind interactive events
  bindArchiveEvents(container, sorted, selectedObj, allPhotoSrcs);

  // Initialize popover menu on '=' buttons
  if (window.app && typeof window.app.initMenuPopover === 'function') {
    window.app.initMenuPopover();
  }

  // If in Board Mode, render SVG connections and bind drag & drop
  if (memoViewMode === 'board') {
    bindCol3MemoDragEvents();
    bindCol3ConnectionEvents();
    setTimeout(() => {
      renderCol3ConnectionsSvg();
    }, 20);
  }
}

// ---------------------------------------------------------------------------
// 4. BOARD SVG RENDERING & REAL-TIME TRACKING
// ---------------------------------------------------------------------------
function getCol3DotCenter(memoId, canvasRect) {
  const slip = document.getElementById(`col3-slip-${memoId}`);
  if (!slip) return null;
  const dot = slip.querySelector('.connect-dot');
  if (!dot) return null;
  const dotRect = dot.getBoundingClientRect();
  return {
    x: (dotRect.left + dotRect.width / 2) - canvasRect.left,
    y: (dotRect.top + dotRect.height / 2) - canvasRect.top
  };
}

function renderCol3ConnectionsSvg() {
  const canvas = document.getElementById('col3-memo-board-canvas');
  const svg = document.getElementById('col3-memo-connections-svg');
  const group = document.getElementById('col3-connections-saved-group');
  if (!canvas || !svg || !group) return;

  const conns = getStoredConnections();
  const canvasRect = canvas.getBoundingClientRect();

  let html = '';
  conns.forEach(conn => {
    const fromId = conn.fromMemoId || conn.sourceId;
    const toId = conn.toMemoId || conn.targetId;

    const ptA = getCol3DotCenter(fromId, canvasRect);
    const ptB = getCol3DotCenter(toId, canvasRect);

    if (!ptA || !ptB) return;

    html += `
      <g class="connection-line-group" data-conn-id="${conn.id}">
        <line x1="${ptA.x}" y1="${ptA.y}" x2="${ptB.x}" y2="${ptB.y}"
              class="connection-hit-line" stroke="transparent" stroke-width="14"></line>
        <line x1="${ptA.x}" y1="${ptA.y}" x2="${ptB.x}" y2="${ptB.y}"
              class="connection-visible-line" stroke="${conn.color}" stroke-width="1.2"></line>
      </g>
    `;
  });

  group.innerHTML = html;

  group.querySelectorAll('.connection-line-group').forEach(grp => {
    grp.addEventListener('click', (e) => {
      e.stopPropagation();
      const connId = grp.getAttribute('data-conn-id');
      if (confirm('이 연결선을 삭제하시겠습니까?')) {
        deleteMemoConnection(connId);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 5. DRAG HANDLING FOR MEMO SLIPS IN BOARD MODE
// ---------------------------------------------------------------------------
function bindCol3MemoDragEvents() {
  const headers = document.querySelectorAll('#col3-memo-board-stage .slip-drag-header');
  const canvas = document.getElementById('col3-memo-board-canvas');
  const svg = document.getElementById('col3-memo-connections-svg');

  headers.forEach(header => {
    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.slip-connect-handle') ||
          e.target.closest('.slip-quick-del') ||
          e.target.tagName === 'INPUT') {
        return;
      }

      const memoId = header.getAttribute('data-id');
      const isNew = header.id === 'col3-new-slip-drag-header';
      const slipEl = isNew ? document.getElementById('col3-active-new-slip') : document.getElementById(`col3-slip-${memoId}`);

      if (!slipEl) return;

      e.preventDefault();
      try { header.setPointerCapture(e.pointerId); } catch (err) {}
      document.body.style.userSelect = 'none';

      draggingMemoId = isNew ? '__new__' : memoId;
      dragPointerStartX = e.clientX;
      dragPointerStartY = e.clientY;

      memoStartPosX = parseFloat(slipEl.style.left) || 0;
      memoStartPosY = parseFloat(slipEl.style.top) || 0;

      highestZIndex += 1;
      slipEl.style.zIndex = highestZIndex;
      slipEl.classList.add('is-dragging-slip');

      function onPointerMove(ev) {
        if (!draggingMemoId) return;

        const dx = ev.clientX - dragPointerStartX;
        const dy = ev.clientY - dragPointerStartY;

        let newX = Math.max(10, memoStartPosX + dx);
        let newY = Math.max(10, memoStartPosY + dy);

        slipEl.style.left = `${newX}px`;
        slipEl.style.top = `${newY}px`;

        if (isNew) {
          composerSlipPos.x = newX;
          composerSlipPos.y = newY;
        }

        // Dynamically expand canvas bounds if dragging towards edges
        if (canvas && svg) {
          const curW = parseFloat(canvas.style.width) || canvas.offsetWidth;
          const curH = parseFloat(canvas.style.height) || canvas.offsetHeight;
          if (newX + 360 > curW) {
            const nextW = Math.round(newX + 420);
            canvas.style.width = `${nextW}px`;
            svg.setAttribute('width', nextW);
          }
          if (newY + 360 > curH) {
            const nextH = Math.round(newY + 420);
            canvas.style.height = `${nextH}px`;
            svg.setAttribute('height', nextH);
          }
        }

        // Real-time update of connection lines
        renderCol3ConnectionsSvg();
      }

      function onPointerUp(ev) {
        try { header.releasePointerCapture(ev.pointerId); } catch (err) {}
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        document.body.style.userSelect = '';

        if (slipEl) {
          slipEl.classList.remove('is-dragging-slip');
          const finalX = parseFloat(slipEl.style.left) || 0;
          const finalY = parseFloat(slipEl.style.top) || 0;

          if (!isNew && memoId) {
            updateMemoPosition(memoId, finalX, finalY);
          } else if (isNew) {
            composerSlipPos.x = finalX;
            composerSlipPos.y = finalY;
          }
        }

        draggingMemoId = null;
        renderCol3ConnectionsSvg();
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  });
}

// ---------------------------------------------------------------------------
// 6. CONNECTION DRAG HANDLING VIA DOT
// ---------------------------------------------------------------------------
function bindCol3ConnectionEvents() {
  const handles = document.querySelectorAll('#col3-memo-board-stage .slip-connect-handle');
  const canvas = document.getElementById('col3-memo-board-canvas');
  const tempLine = document.getElementById('col3-connection-temp-line');

  if (!canvas || !tempLine) return;

  handles.forEach(handle => {
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      dragSourceMemoId = handle.getAttribute('data-id');
      if (!dragSourceMemoId) return;

      isDraggingConnection = true;
      handle.classList.add('is-dragging-source');
      document.body.style.userSelect = 'none';

      const canvasRect = canvas.getBoundingClientRect();
      const dot = handle.querySelector('.connect-dot');
      const dotRect = dot ? dot.getBoundingClientRect() : handle.getBoundingClientRect();

      const startX = (dotRect.left + dotRect.width / 2) - canvasRect.left;
      const startY = (dotRect.top + dotRect.height / 2) - canvasRect.top;

      tempLine.setAttribute('x1', startX);
      tempLine.setAttribute('y1', startY);
      tempLine.setAttribute('x2', startX);
      tempLine.setAttribute('y2', startY);
      tempLine.style.display = 'block';

      function onGlobalPointerMove(ev) {
        if (!isDraggingConnection) return;

        const currentCanvasRect = canvas.getBoundingClientRect();
        const px = ev.clientX - currentCanvasRect.left;
        const py = ev.clientY - currentCanvasRect.top;

        tempLine.setAttribute('x2', px);
        tempLine.setAttribute('y2', py);

        // Detect hover target (either dot handle or memo slip)
        const elemBelow = document.elementFromPoint(ev.clientX, ev.clientY);
        let targetId = null;
        if (elemBelow) {
          const targetHandle = elemBelow.closest('.slip-connect-handle');
          if (targetHandle) {
            targetId = targetHandle.getAttribute('data-id');
          } else {
            const targetSlip = elemBelow.closest('.archival-memo-slip.freeform-slip');
            if (targetSlip) {
              targetId = targetSlip.getAttribute('data-id');
            }
          }
        }

        // Highlight dot or slip
        document.querySelectorAll('#col3-memo-board-stage .slip-connect-handle').forEach(h => {
          const hId = h.getAttribute('data-id');
          if (targetId && hId === targetId && targetId !== dragSourceMemoId) {
            h.classList.add('is-hover-target');
          } else {
            h.classList.remove('is-hover-target');
          }
        });

        document.querySelectorAll('#col3-memo-board-stage .archival-memo-slip.freeform-slip').forEach(s => {
          const sId = s.getAttribute('data-id');
          if (targetId && sId === targetId && targetId !== dragSourceMemoId) {
            s.classList.add('is-connect-target');
          } else {
            s.classList.remove('is-connect-target');
          }
        });
      }

      function onGlobalPointerUp(ev) {
        window.removeEventListener('pointermove', onGlobalPointerMove);
        window.removeEventListener('pointerup', onGlobalPointerUp);
        window.removeEventListener('pointercancel', onGlobalPointerUp);

        tempLine.style.display = 'none';
        handle.classList.remove('is-dragging-source');
        document.body.style.userSelect = '';

        document.querySelectorAll('#col3-memo-board-stage .slip-connect-handle').forEach(h => {
          h.classList.remove('is-hover-target');
        });
        document.querySelectorAll('#col3-memo-board-stage .archival-memo-slip.freeform-slip').forEach(s => {
          s.classList.remove('is-connect-target');
        });

        const elemBelow = document.elementFromPoint(ev.clientX, ev.clientY);
        let targetId = null;
        if (elemBelow) {
          const targetHandle = elemBelow.closest('.slip-connect-handle');
          if (targetHandle) {
            targetId = targetHandle.getAttribute('data-id');
          } else {
            const targetSlip = elemBelow.closest('.archival-memo-slip.freeform-slip');
            if (targetSlip) {
              targetId = targetSlip.getAttribute('data-id');
            }
          }
        }

        if (targetId && targetId !== dragSourceMemoId && targetId !== '__new__') {
          addMemoConnection(dragSourceMemoId, targetId);
        }

        isDraggingConnection = false;
        dragSourceMemoId = null;
      }

      window.addEventListener('pointermove', onGlobalPointerMove);
      window.addEventListener('pointerup', onGlobalPointerUp);
      window.addEventListener('pointercancel', onGlobalPointerUp);
    });
  });
}

// ---------------------------------------------------------------------------
// 7. GENERAL EVENT BINDINGS (Object Selection, Lightbox, CRUD)
// ---------------------------------------------------------------------------
function bindArchiveEvents(container, sorted, selectedObj, allPhotoSrcs) {
  // 1. CMS Edit Mode Toggle (Col 1 header)
  const btnToggleEdit = container.querySelector('#btn-col1-toggle-edit');
  if (btnToggleEdit) {
    btnToggleEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      window.app.toggleCmsEditMode();
      renderArchiveView();
    });
  }

  // 2. Mode Switchers (Col 3 header)
  container.querySelectorAll('.mode-switch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetMode = btn.getAttribute('data-mode');
      if (targetMode && targetMode !== memoViewMode) {
        memoViewMode = targetMode;
        try { sessionStorage.setItem('archive_memo_view_mode', targetMode); } catch (err) {}
        renderArchiveView();
      }
    });
  });

  const btnSwitchToBoard = container.querySelector('#btn-switch-to-board');
  if (btnSwitchToBoard) {
    btnSwitchToBoard.addEventListener('click', () => {
      memoViewMode = 'board';
      try { sessionStorage.setItem('archive_memo_view_mode', 'board'); } catch (err) {}
      renderArchiveView();
    });
  }

  // 3. Column 1: Object Selection Click
  container.querySelectorAll('.editorial-project-entry[data-id]').forEach(entry => {
    entry.addEventListener('click', (e) => {
      if (e.target.closest('.editorial-inline-editor') ||
          e.target.closest('.cms-action-btn') ||
          e.target.closest('input') ||
          e.target.closest('textarea') ||
          e.target.closest('button')) {
        return;
      }
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;

      const objId = entry.getAttribute('data-id');
      if (objId && objId !== selectedObjectId) {
        selectedObjectId = objId;
        isComposingMemo = false;
        editingMemoId = null;
        editingObjectId = null;
        editingProfile = false;
        isAddingObject = false;
        isAddingPhoto = false;
        history.replaceState(null, '', `?id=${objId}${memoViewMode === 'board' ? '&mode=board' : ''}`);
        renderArchiveView();
      }
    });
  });

  // 4. Column 1: Add New Object
  const btnCol1Add = container.querySelector('#btn-col1-add-obj');
  if (btnCol1Add) {
    btnCol1Add.addEventListener('click', (e) => {
      e.stopPropagation();
      isAddingObject = true;
      editingObjectId = null;
      renderArchiveView();
      setTimeout(() => {
        const inp = document.getElementById('new-obj-title');
        if (inp) {
          inp.focus();
          inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 30);
    });
  }

  const btnCancelAddObj = container.querySelector('#btn-cancel-add-obj');
  if (btnCancelAddObj) {
    btnCancelAddObj.addEventListener('click', (e) => {
      e.stopPropagation();
      isAddingObject = false;
      renderArchiveView();
    });
  }

  const btnSaveAddObj = container.querySelector('#btn-save-add-obj');
  if (btnSaveAddObj) {
    btnSaveAddObj.addEventListener('click', async (e) => {
      e.stopPropagation();
      const title = (document.getElementById('new-obj-title').value || '').trim();
      if (!title) {
        alert('사물 명칭을 입력해 주세요.');
        document.getElementById('new-obj-title').focus();
        return;
      }

      const timestamp = (document.getElementById('new-obj-time').value || '').trim();
      const materials = (document.getElementById('new-obj-mat').value || '').trim();
      const dimensions = (document.getElementById('new-obj-dim').value || '').trim();
      const description = (document.getElementById('new-obj-desc').value || '').trim();
      const fileInput = document.getElementById('new-obj-file');
      const urlInput = (document.getElementById('new-obj-file-url').value || '').trim();

      let imageSrc = urlInput || '';
      if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
          imageSrc = await window.app.compressImageFile(fileInput.files[0]);
        } catch (err) {
          console.error('Image upload failed:', err);
        }
      }

      const images = imageSrc ? [imageSrc] : [];
      isAddingObject = false;

      const newObj = window.app.saveObject({
        title,
        timestamp,
        materials,
        dimensions,
        description,
        representativeImage: imageSrc || '',
        images
      });

      if (newObj && newObj.id) {
        selectedObjectId = newObj.id;
      }
      renderArchiveView();
    });
  }

  // 5. Column 1: Edit Existing Object
  container.querySelectorAll('.btn-trigger-edit-obj').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const objId = btn.getAttribute('data-id');
      editingObjectId = objId;
      isAddingObject = false;
      renderArchiveView();
      setTimeout(() => {
        const inp = document.getElementById(`edit-obj-title-${objId}`);
        if (inp) {
          inp.focus();
          inp.select();
        }
      }, 30);
    });
  });

  container.querySelectorAll('.btn-cancel-edit-obj').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editingObjectId = null;
      renderArchiveView();
    });
  });

  container.querySelectorAll('.btn-save-edit-obj').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const objId = btn.getAttribute('data-id');
      const obj = window.app.getObjectById(objId);
      if (!obj) return;

      const titleInput = document.getElementById(`edit-obj-title-${objId}`);
      const timeInput = document.getElementById(`edit-obj-time-${objId}`);
      const matInput = document.getElementById(`edit-obj-mat-${objId}`);
      const dimInput = document.getElementById(`edit-obj-dim-${objId}`);
      const descInput = document.getElementById(`edit-obj-desc-${objId}`);

      const title = (titleInput ? titleInput.value : '').trim();
      if (!title) {
        alert('사물 명칭을 입력해 주세요.');
        if (titleInput) titleInput.focus();
        return;
      }

      obj.title = title;
      if (timeInput) obj.timestamp = timeInput.value.trim();
      if (matInput) obj.materials = matInput.value.trim();
      if (dimInput) obj.dimensions = dimInput.value.trim();
      if (descInput) obj.description = descInput.value.trim();

      editingObjectId = null;
      window.app.saveObject(obj);
      renderArchiveView();
    });
  });

  container.querySelectorAll('.btn-del-edit-obj').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const objId = btn.getAttribute('data-id');
      const obj = window.app.getObjectById(objId);
      if (!obj) return;
      if (confirm(`사물 [${obj.title}]을(를) 휴지통으로 이동하시겠습니까?\n언제든 Trash 메뉴에서 원상태로 복원할 수 있습니다.`)) {
        window.app.deleteObject(objId);
        editingObjectId = null;
        const remaining = window.app.getObjects();
        selectedObjectId = remaining.length ? remaining[0].id : null;
        renderArchiveView();
      }
    });
  });

  container.querySelectorAll('.btn-select-inline-cover').forEach(cell => {
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      const objId = cell.getAttribute('data-obj-id');
      const imgSrc = cell.getAttribute('data-img-src');
      const obj = window.app.getObjectById(objId);
      if (obj && imgSrc) {
        obj.representativeImage = imgSrc;
        window.app.saveObject(obj);
        renderArchiveView();
      }
    });
  });

  // 6. Column 2: Lightbox clicks on photos
  container.querySelectorAll('.photo-click-target').forEach(box => {
    box.addEventListener('click', () => {
      const idx = parseInt(box.getAttribute('data-index'), 10) || 0;
      window.app.openLightbox(allPhotoSrcs, idx);
    });
  });

  container.querySelectorAll('.btn-caption-more').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10) || 0;
      window.app.openLightbox(allPhotoSrcs, idx);
    });
  });

  // 7. Column 2: Photo Management (Add Photo, Reorder, Set Cover, Delete)
  const btnCol2Add = container.querySelector('#btn-col2-trigger-add');
  if (btnCol2Add) {
    btnCol2Add.addEventListener('click', (e) => {
      e.stopPropagation();
      isAddingPhoto = true;
      renderArchiveView();
      setTimeout(() => {
        const fileInput = document.getElementById('col2-new-photo-file');
        if (fileInput) fileInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 30);
    });
  }

  const btnCancelAddPhoto = container.querySelector('#btn-cancel-add-photo');
  if (btnCancelAddPhoto) {
    btnCancelAddPhoto.addEventListener('click', (e) => {
      e.stopPropagation();
      isAddingPhoto = false;
      renderArchiveView();
    });
  }

  const col2FileInput = container.querySelector('#col2-new-photo-file');
  if (col2FileInput) {
    col2FileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const previewBox = document.getElementById('col2-preview-box');
          const previewImg = document.getElementById('col2-preview-img');
          if (previewBox && previewImg) {
            previewImg.src = ev.target.result;
            previewBox.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const btnSaveAddPhoto = container.querySelector('#btn-save-add-photo');
  if (btnSaveAddPhoto) {
    btnSaveAddPhoto.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fileInput = document.getElementById('col2-new-photo-file');
      const urlInput = (document.getElementById('col2-new-photo-url').value || '').trim();
      const setAsRep = document.getElementById('col2-photo-set-rep') ? document.getElementById('col2-photo-set-rep').checked : false;

      let imgSrc = urlInput || null;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
          imgSrc = await window.app.compressImageFile(fileInput.files[0]);
        } catch (err) {
          console.error('Image compression failed:', err);
        }
      }

      if (!imgSrc) {
        alert('추가할 사진 파일 또는 이미지 URL을 입력해 주세요.');
        return;
      }

      if (!selectedObj.images) selectedObj.images = [];
      selectedObj.images.push(imgSrc);

      if (setAsRep || !selectedObj.representativeImage) {
        selectedObj.representativeImage = imgSrc;
      }

      isAddingPhoto = false;
      window.app.saveObject(selectedObj);
      renderArchiveView();
    });
  }

  container.querySelectorAll('.btn-set-photo-rep').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (selectedObj.images && selectedObj.images[idx]) {
        selectedObj.representativeImage = selectedObj.images[idx];
        window.app.saveObject(selectedObj);
        renderArchiveView();
      }
    });
  });

  container.querySelectorAll('.btn-move-photo-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (selectedObj.images && idx > 0) {
        const temp = selectedObj.images[idx];
        selectedObj.images[idx] = selectedObj.images[idx - 1];
        selectedObj.images[idx - 1] = temp;
        window.app.saveObject(selectedObj);
        renderArchiveView();
      }
    });
  });

  container.querySelectorAll('.btn-move-photo-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (selectedObj.images && idx < selectedObj.images.length - 1) {
        const temp = selectedObj.images[idx];
        selectedObj.images[idx] = selectedObj.images[idx + 1];
        selectedObj.images[idx + 1] = temp;
        window.app.saveObject(selectedObj);
        renderArchiveView();
      }
    });
  });

  container.querySelectorAll('.btn-del-photo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (selectedObj.images && selectedObj.images[idx]) {
        if (confirm('이 사진을 휴지통으로 이동하시겠습니까?')) {
          window.app.deletePhoto(selectedObj.id, idx);
          renderArchiveView();
        }
      }
    });
  });

  // 8. Column 3: Profile Editing
  const editProfileButtons = [
    container.querySelector('#btn-trigger-edit-profile'),
    container.querySelector('#btn-edit-active-profile')
  ].filter(Boolean);

  editProfileButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editingProfile = true;
      renderArchiveView();
      setTimeout(() => {
        const inp = document.getElementById('prof-edit-title');
        if (inp) {
          inp.focus();
          inp.select();
        }
      }, 30);
    });
  });

  const btnProfCancel = container.querySelector('#btn-prof-cancel');
  if (btnProfCancel) {
    btnProfCancel.addEventListener('click', (e) => {
      e.stopPropagation();
      editingProfile = false;
      renderArchiveView();
    });
  }

  const btnProfSave = container.querySelector('#btn-prof-save');
  if (btnProfSave) {
    btnProfSave.addEventListener('click', (e) => {
      e.stopPropagation();
      const title = (document.getElementById('prof-edit-title').value || '').trim();
      if (!title) {
        alert('사물 명칭을 입력해 주세요.');
        document.getElementById('prof-edit-title').focus();
        return;
      }
      selectedObj.title = title;
      selectedObj.timestamp = (document.getElementById('prof-edit-time').value || '').trim();
      selectedObj.materials = (document.getElementById('prof-edit-mat').value || '').trim();
      selectedObj.dimensions = (document.getElementById('prof-edit-dim').value || '').trim();
      selectedObj.description = (document.getElementById('prof-edit-desc').value || '').trim();

      editingProfile = false;
      window.app.saveObject(selectedObj);
      renderArchiveView();
    });
  }

  // Column 3: Delete active object
  const btnDelObj = container.querySelector('#btn-delete-active-obj');
  if (btnDelObj) {
    btnDelObj.addEventListener('click', () => {
      if (confirm(`사물 [${selectedObj.title}]을(를) 휴지통으로 이동하시겠습니까?\n언제든 Trash 메뉴에서 원래대로 복원할 수 있습니다.`)) {
        window.app.deleteObject(selectedObj.id);
        const remaining = window.app.getObjects();
        selectedObjectId = remaining.length ? remaining[0].id : null;
        isComposingMemo = false;
        editingMemoId = null;
        editingObjectId = null;
        editingProfile = false;
        renderArchiveView();
      }
    });
  }

  // 9. Column 3: Keywords Management (Delete keyword annotation, rename keyword)
  container.querySelectorAll('.cms-keyword-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const kw = btn.getAttribute('data-kw');
      if (!kw) return;
      if (confirm(`키워드 "${kw}"의 모든 주석을 삭제하시겠습니까?`)) {
        if (window.keywordService && typeof window.keywordService.removeKeyword === 'function') {
          window.keywordService.removeKeyword(kw);
          renderArchiveView();
        }
      }
    });
  });

  container.querySelectorAll('.doc-keyword-chip.cms-editable-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      if (!isCmsEditMode()) return;
      e.stopPropagation();
      e.preventDefault();
      const oldNorm = chip.getAttribute('data-kw-norm');
      if (!oldNorm) return;
      const newName = prompt(`키워드 "${oldNorm}"의 새로운 이름을 입력하세요:`, oldNorm);
      if (newName && newName.trim() && newName.trim() !== oldNorm) {
        if (window.keywordService && typeof window.keywordService.renameKeyword === 'function') {
          window.keywordService.renameKeyword(oldNorm, newName.trim());
          renderArchiveView();
        }
      }
    });
  });

  // 10. Column 3: Field Research links
  // (Navigation to field-research.html is handled by standard anchor tags)

  // 11. Column 3: Memo Management (Trigger, Cancel, Save in Editorial & Board modes)
  const triggerNewButtons = [
    container.querySelector('#btn-trigger-new-note'),
    container.querySelector('#btn-empty-new-note'),
    container.querySelector('#btn-trigger-board-new'),
    container.querySelector('#btn-col3-empty-add')
  ].filter(Boolean);

  triggerNewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      isComposingMemo = true;
      editingMemoId = null;
      if (memoViewMode === 'board') {
        const stage = document.getElementById('col3-memo-board-stage');
        const scrollX = stage ? stage.scrollLeft : 0;
        const scrollY = stage ? stage.scrollTop : 0;
        composerSlipPos = { x: Math.max(30, scrollX + 40), y: Math.max(30, scrollY + 40) };
      }
      renderArchiveView();
      setTimeout(() => {
        const titleInput = document.getElementById('new-memo-title') || document.getElementById('col3-new-slip-title');
        if (titleInput) {
          titleInput.focus();
          titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 30);
    });
  });

  const cancelNewButtons = [
    container.querySelector('#btn-new-memo-cancel'),
    container.querySelector('#btn-col3-new-cancel')
  ].filter(Boolean);

  cancelNewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      isComposingMemo = false;
      renderArchiveView();
    });
  });

  const btnSaveNewEditorial = container.querySelector('#btn-new-memo-save');
  if (btnSaveNewEditorial) {
    btnSaveNewEditorial.addEventListener('click', () => {
      const title = (document.getElementById('new-memo-title').value || '').trim();
      const content = (document.getElementById('new-memo-content').value || '').trim();
      const timestamp = (document.getElementById('new-memo-time').value || '').trim();

      if (!title) {
        alert('메모 제목을 입력해 주세요.');
        document.getElementById('new-memo-title').focus();
        return;
      }

      isComposingMemo = false;
      editingMemoId = null;

      const saved = window.app.saveMemo({
        objectId: selectedObj.id,
        title,
        content,
        timestamp
      });

      if (window.keywordService && saved && saved.id) {
        window.keywordService.validateMemoAnnotations(saved.id, content);
      }

      renderArchiveView();
    });
  }

  const btnSaveNewBoard = container.querySelector('#btn-col3-new-save');
  if (btnSaveNewBoard) {
    btnSaveNewBoard.addEventListener('click', () => {
      const title = (document.getElementById('col3-new-slip-title').value || '').trim();
      const content = (document.getElementById('col3-new-slip-content').value || '').trim();
      const timestamp = (document.getElementById('col3-new-slip-time').value || '').trim();

      if (!title) {
        alert('메모 제목을 입력해 주세요.');
        document.getElementById('col3-new-slip-title').focus();
        return;
      }

      const activeSlipEl = document.getElementById('col3-active-new-slip');
      const finalX = activeSlipEl ? (parseFloat(activeSlipEl.style.left) || composerSlipPos.x) : composerSlipPos.x;
      const finalY = activeSlipEl ? (parseFloat(activeSlipEl.style.top) || composerSlipPos.y) : composerSlipPos.y;

      isComposingMemo = false;
      editingMemoId = null;

      let maxNum = 0;
      const allMemos = window.app.getMemos();
      allMemos.forEach(m => {
        const match = m.id && m.id.match(/^memo-(\d+)$/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
      });
      const newMemoId = `memo-${String(maxNum + 1).padStart(3, '0')}`;

      updateMemoPosition(newMemoId, finalX, finalY);

      const saved = window.app.saveMemo({
        id: newMemoId,
        objectId: selectedObj.id,
        title,
        content,
        timestamp
      });

      if (window.keywordService && saved && saved.id) {
        window.keywordService.validateMemoAnnotations(saved.id, content);
      }

      renderArchiveView();
    });
  }

  container.querySelectorAll('.btn-trigger-memo-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const memoId = btn.getAttribute('data-id');
      editingMemoId = memoId;
      isComposingMemo = false;
      renderArchiveView();
      setTimeout(() => {
        const titleEl = document.getElementById(`edit-memo-title-${memoId}`) || document.getElementById(`col3-edit-title-${memoId}`);
        if (titleEl) {
          titleEl.focus();
          titleEl.select();
        }
      }, 30);
    });
  });

  const cancelEditButtons = [
    container.querySelector('#btn-cancel-edit-memo'),
    container.querySelector('#btn-col3-edit-cancel')
  ].filter(Boolean);

  cancelEditButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      editingMemoId = null;
      renderArchiveView();
    });
  });

  container.querySelectorAll('.btn-save-edit-memo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const memoId = btn.getAttribute('data-id');
      const titleInput = document.getElementById(`edit-memo-title-${memoId}`) || document.getElementById(`col3-edit-title-${memoId}`);
      const contentInput = document.getElementById(`edit-memo-content-${memoId}`) || document.getElementById(`col3-edit-content-${memoId}`);
      const timeInput = document.getElementById(`edit-memo-time-${memoId}`) || document.getElementById(`col3-edit-time-${memoId}`);

      const title = (titleInput ? titleInput.value : '').trim();
      const content = (contentInput ? contentInput.value : '').trim();
      const timestamp = (timeInput ? timeInput.value : '').trim();

      if (!title) {
        alert('메모 제목을 입력해 주세요.');
        if (titleInput) titleInput.focus();
        return;
      }

      const slipEl = document.getElementById(`col3-slip-${memoId}`);
      if (slipEl) {
        const curX = parseFloat(slipEl.style.left) || 0;
        const curY = parseFloat(slipEl.style.top) || 0;
        updateMemoPosition(memoId, curX, curY);
      }

      editingMemoId = null;
      isComposingMemo = false;

      window.app.saveMemo({
        id: memoId,
        objectId: selectedObj.id,
        title,
        content,
        timestamp
      });

      if (window.keywordService) {
        window.keywordService.validateMemoAnnotations(memoId, content);
      }

      renderArchiveView();
    });
  });

  container.querySelectorAll('.btn-del-edit-memo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const memoId = btn.getAttribute('data-id');
      if (confirm('이 메모를 휴지통으로 이동하시겠습니까?')) {
        editingMemoId = null;
        removeMemoPosition(memoId);
        pruneOrphanConnections(memoId);
        window.app.deleteMemo(memoId);
        renderArchiveView();
      }
    });
  });

  container.querySelectorAll('.btn-trigger-memo-del, .slip-quick-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const memoId = btn.getAttribute('data-id');
      if (confirm('이 메모를 휴지통으로 이동하시겠습니까?')) {
        if (editingMemoId === memoId) editingMemoId = null;
        removeMemoPosition(memoId);
        pruneOrphanConnections(memoId);
        window.app.deleteMemo(memoId);
        renderArchiveView();
      }
    });
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
