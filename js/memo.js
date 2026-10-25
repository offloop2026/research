/**
 * MEMO MODULE (memo.js)
 * Archival Infinite Canvas Memo Board:
 * - Infinite Canvas Pan (Figma-style drag on background)
 * - Canvas Zoom (25% - 250%, pointer-centered wheel zoom & ⌘+/⌘-/⌘0)
 * - Canvas Navigation Controls: − 100% + [Fit] [Reset]
 * - Memo Selection state with subtle editorial outline
 * - Selected Memo Coordinate Display & Live Direct X/Y Editing (Position X [ ] Y [ ])
 * - Drag Memo in canvas coordinate space (scaled by 1 / zoom)
 * - Vector RGB Connection Lines locked in canvas space (synced across pan, zoom, & move)
 * - Non-destructive storage: 'archive_memo_positions_v1', 'archive_memo_connections_v1', 'archive_memo_canvas_v1'
 */

const CONNECTIONS_STORAGE_KEY = 'archive_memo_connections_v1';
const POSITIONS_STORAGE_KEY = 'archive_memo_positions_v1';
const CANVAS_STORAGE_KEY = 'archive_memo_canvas_v1';

let activeEditMemoId = null;
let isCreatingNewMemo = false;
let selectedMemoId = null;

// Infinite Canvas Viewport State (panX, panY, zoom)
let canvasState = getStoredCanvasState();

// Active composer slip position in canvas coordinates
let composerSlipPos = { x: 80, y: 80 };

// Connection Drag State
let dragSourceMemoId = null;
let isDraggingConnection = false;

// Memo Movement Drag State
let draggingMemoId = null;
let dragPointerStartX = 0;
let dragPointerStartY = 0;
let memoStartPosX = 0;
let memoStartPosY = 0;
let highestZIndex = 20;

// Canvas Pan State
let isPanningCanvas = false;
let panStartCanvasX = 0;
let panStartCanvasY = 0;
let panStartPointerX = 0;
let panStartPointerY = 0;

document.addEventListener('DOMContentLoaded', () => {
  if (window.app && window.app.isReady) {
    initMemoBoard();
  } else {
    window.addEventListener('archive-ready', () => {
      initMemoBoard();
    }, { once: true });
    const checkReady = setInterval(() => {
      if (window.app && window.app.isReady) {
        clearInterval(checkReady);
        initMemoBoard();
      }
    }, 40);
  }

  window.addEventListener('archive-updated', () => {
    pruneOrphanConnections();
    renderMemoBoard();
  });

  window.addEventListener('resize', () => {
    requestAnimationFrame(() => updateConnectionPositions());
  });

  // Global Keyboard shortcuts for Zoom (⌘+, ⌘-, ⌘0)
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomCanvas(1.2);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomCanvas(1 / 1.2);
      } else if (e.key === '0') {
        e.preventDefault();
        resetView();
      }
    }
  });
});

function initMemoBoard() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('id');
  if (targetId) {
    activeEditMemoId = targetId;
    selectedMemoId = targetId;
  }

  pruneOrphanConnections();
  renderMemoBoard();

  if (targetId) {
    setTimeout(() => {
      focusOnMemo(targetId);
    }, 100);
  }
}

// ---------------------------------------------------------------------------
// 1. Storage Helpers
// ---------------------------------------------------------------------------
function getStoredCanvasState() {
  try {
    const raw = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.panX === 'number' && typeof parsed.panY === 'number' && typeof parsed.zoom === 'number') {
        return {
          panX: parsed.panX,
          panY: parsed.panY,
          zoom: Math.min(2.5, Math.max(0.25, parsed.zoom))
        };
      }
    }
  } catch (e) {
    console.warn('[Canvas] Read error:', e);
  }
  return { panX: 0, panY: 0, zoom: 1 };
}

function saveStoredCanvasState(state) {
  try {
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify({
      panX: Math.round(state.panX),
      panY: Math.round(state.panY),
      zoom: parseFloat(state.zoom.toFixed(3))
    }));
  } catch (e) {
    console.warn('[Canvas] Write error:', e);
  }
}

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
  if (stored[memoId] && typeof stored[memoId].x === 'number' && typeof stored[memoId].y === 'number') {
    return stored[memoId];
  }

  // Initial layout: clean, staggered distribution (no stacking)
  const colWidth = 340;
  const rowHeight = 260;
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);

  const jitterX = ((index * 37) % 36) - 18;
  const jitterY = ((index * 23) % 28) - 12;

  const defaultX = Math.max(40, 60 + col * colWidth + jitterX);
  const defaultY = Math.max(40, 60 + row * rowHeight + jitterY);

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
// 2. Connection Storage Management
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
  renderConnectionsSvg();
  return true;
}

function deleteMemoConnection(connId) {
  const conns = getStoredConnections();
  const next = conns.filter(c => c.id !== connId);
  saveStoredConnections(next);
  renderConnectionsSvg();
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
// 3. Selection & Transform Helpers
// ---------------------------------------------------------------------------
function setSelectedMemo(memoId) {
  selectedMemoId = memoId;

  // Update selection outline on slips
  document.querySelectorAll('.archival-memo-slip').forEach(slip => {
    const sId = slip.getAttribute('data-id');
    if (memoId && sId === memoId) {
      slip.classList.add('is-selected-memo');
    } else {
      slip.classList.remove('is-selected-memo');
    }
  });

  const hud = document.getElementById('memo-coord-hud');
  const inputX = document.getElementById('memo-coord-input-x');
  const inputY = document.getElementById('memo-coord-input-y');

  if (hud && inputX && inputY) {
    if (memoId) {
      const stored = getStoredPositions();
      const pos = stored[memoId] || { x: 0, y: 0 };
      inputX.value = Math.round(pos.x);
      inputY.value = Math.round(pos.y);
      hud.style.display = 'flex';
    } else {
      hud.style.display = 'none';
    }
  }
}

function applyCanvasTransform() {
  const canvas = document.getElementById('memo-canvas');
  if (canvas) {
    canvas.style.transform = `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom})`;
  }
}

function updateZoomPctUi() {
  const pctEl = document.getElementById('memo-zoom-pct');
  if (pctEl) {
    pctEl.textContent = `${Math.round(canvasState.zoom * 100)}%`;
  }
}

function zoomCanvas(zoomRatio, clientX, clientY) {
  const minZoom = 0.25;
  const maxZoom = 2.5;
  const oldZoom = canvasState.zoom;
  const nextZoom = Math.min(maxZoom, Math.max(minZoom, oldZoom * zoomRatio));
  if (Math.abs(nextZoom - oldZoom) < 0.001) return;

  const viewport = document.getElementById('memo-viewport');
  const vpRect = viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

  const px = (typeof clientX === 'number' ? clientX : vpRect.left + vpRect.width / 2) - vpRect.left;
  const py = (typeof clientY === 'number' ? clientY : vpRect.top + vpRect.height / 2) - vpRect.top;

  // Zoom centered on cursor position:
  canvasState.panX = px - (px - canvasState.panX) * (nextZoom / oldZoom);
  canvasState.panY = py - (py - canvasState.panY) * (nextZoom / oldZoom);
  canvasState.zoom = nextZoom;

  applyCanvasTransform();
  saveStoredCanvasState(canvasState);
  updateZoomPctUi();
}

function resetView() {
  canvasState.panX = 0;
  canvasState.panY = 0;
  canvasState.zoom = 1;
  applyCanvasTransform();
  saveStoredCanvasState(canvasState);
  updateZoomPctUi();
}

function fitView() {
  const memos = window.app.getMemos();
  if (!memos.length) {
    resetView();
    return;
  }

  const positions = memos.map((m, idx) => getMemoPosition(m.id, idx));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  positions.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + 300);
    maxY = Math.max(maxY, p.y + 240);
  });

  const viewport = document.getElementById('memo-viewport');
  const vpRect = viewport ? viewport.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
  const vpW = vpRect.width || 800;
  const vpH = vpRect.height || 600;

  const contentW = Math.max(100, maxX - minX);
  const contentH = Math.max(100, maxY - minY);

  const padding = 60;
  const scaleX = (vpW - padding * 2) / contentW;
  const scaleY = (vpH - padding * 2) / contentH;
  let fitZoom = Math.min(scaleX, scaleY);
  fitZoom = Math.min(1.5, Math.max(0.3, fitZoom));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  canvasState.zoom = fitZoom;
  canvasState.panX = (vpW / 2) - centerX * fitZoom;
  canvasState.panY = (vpH / 2) - centerY * fitZoom;

  applyCanvasTransform();
  saveStoredCanvasState(canvasState);
  updateZoomPctUi();
}

function focusOnMemo(memoId) {
  const stored = getStoredPositions();
  const pos = stored[memoId];
  if (!pos) return;

  const viewport = document.getElementById('memo-viewport');
  const vpRect = viewport ? viewport.getBoundingClientRect() : { width: 800, height: 600 };
  const vpW = vpRect.width || 800;
  const vpH = vpRect.height || 600;

  canvasState.panX = (vpW / 2) - (pos.x + 140) * canvasState.zoom;
  canvasState.panY = (vpH / 2) - (pos.y + 110) * canvasState.zoom;

  applyCanvasTransform();
  saveStoredCanvasState(canvasState);
  setSelectedMemo(memoId);
}

// ---------------------------------------------------------------------------
// 4. Main Board Rendering (Infinite Canvas Architecture)
// ---------------------------------------------------------------------------
function renderMemoBoard() {
  const container = document.getElementById('memo-main-container');
  if (!container) return;

  const memos = window.app.getMemos();
  const objects = window.app.getObjects();

  const sorted = [...memos].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  // Calculate selected memo coordinate values for initial render
  let selectedPos = null;
  if (selectedMemoId) {
    const stored = getStoredPositions();
    selectedPos = stored[selectedMemoId] || null;
  }

  container.innerHTML = `
    <div class="memo-board-wrapper">
      <div class="col-header memo-col-header">
        <div class="col-header-left">
          <span class="col-header-title">Memo Board</span>
          <span class="col-header-meta mono" style="opacity:0.4;">${sorted.length}</span>

          <!-- Selected Memo Coordinates HUD -->
          <div class="memo-coord-hud mono" id="memo-coord-hud" style="${selectedMemoId && selectedPos ? 'display:flex;' : 'display:none;'}">
            <span class="coord-label">Pos</span>
            <label class="coord-label-field">X <input type="number" id="memo-coord-input-x" class="coord-input mono" value="${selectedPos ? Math.round(selectedPos.x) : 0}" step="10" /></label>
            <label class="coord-label-field">Y <input type="number" id="memo-coord-input-y" class="coord-input mono" value="${selectedPos ? Math.round(selectedPos.y) : 0}" step="10" /></label>
          </div>
        </div>

        <div class="col-header-right">
          <!-- Canvas Navigation Controls: − 100% + [Fit] [Reset] -->
          <div class="memo-canvas-nav mono">
            <button type="button" class="memo-zoom-btn" id="btn-zoom-out" title="Zoom Out (⌘−)">−</button>
            <span class="memo-zoom-pct" id="memo-zoom-pct" title="Zoom Level">${Math.round(canvasState.zoom * 100)}%</span>
            <button type="button" class="memo-zoom-btn" id="btn-zoom-in" title="Zoom In (⌘+)">+</button>
            <button type="button" class="memo-nav-text-btn" id="btn-zoom-fit" title="Fit all memos inside viewport">[Fit]</button>
            <button type="button" class="memo-nav-text-btn" id="btn-zoom-reset" title="Reset view">[Reset]</button>
          </div>

          <div class="memo-header-divider"></div>

          ${!isCreatingNewMemo ? `
            <button type="button" class="col-header-action-text" id="btn-trigger-new-memo">+ New Memo</button>
          ` : `
            <span class="mono" style="font-size:11px; opacity:0.5;">작성 중...</span>
          `}
          <button class="col-header-menu-btn" title="Navigation">&equiv;</button>
        </div>
      </div>

      <!-- INFINITE CANVAS VIEWPORT -->
      <div class="memo-viewport" id="memo-viewport">
        <!-- TRANSFORMED CANVAS LAYER -->
        <div class="memo-canvas" id="memo-canvas" style="transform: translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom});">
          <!-- SVG Connection Lines Layer in Canvas Coordinates -->
          <svg class="memo-connections-layer" id="memo-connections-svg">
            <g id="connections-saved-group"></g>
            <line id="connection-temp-line" x1="0" y1="0" x2="0" y2="0" class="temp-connection-line" style="display: none;"></line>
          </svg>

          <!-- Absolute Memo Slips Surface -->
          <div class="memo-board-surface" id="memo-board-surface">
            <!-- 1. Active New Composer Slip -->
            ${isCreatingNewMemo ? renderNewMemoSlipHtml(objects, composerSlipPos) : ''}

            <!-- 2. Positioned Memo Slips -->
            ${sorted.map((m, idx) => {
              const pos = getMemoPosition(m.id, idx);
              const isEditing = (m.id === activeEditMemoId);
              const isSelected = (m.id === selectedMemoId);
              return isEditing ? renderEditMemoSlipHtml(m, objects, pos, isSelected) : renderDisplayMemoSlipHtml(m, pos, isSelected);
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  bindBoardEvents(container, objects);
  bindCanvasPanAndZoom();
  bindMemoDragEvents();
  bindConnectionEvents();

  if (window.app && typeof window.app.initMenuPopover === 'function') {
    window.app.initMenuPopover();
  }

  setTimeout(() => {
    renderConnectionsSvg();
  }, 20);
}

// ---------------------------------------------------------------------------
// 5. Templates (Absolute Slips)
// ---------------------------------------------------------------------------
function renderNewMemoSlipHtml(objects, pos) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const nowTimestamp = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return `
    <div class="archival-memo-slip editing is-new-slip freeform-slip" id="active-new-slip"
         style="left: ${pos.x}px; top: ${pos.y}px; z-index: 60;">
      <!-- Drag Handle Header -->
      <div class="slip-header slip-drag-header mono" id="new-slip-drag-header" title="상단을 잡고 원하는 위치로 이동">
        <div class="slip-header-left">
          <span class="slip-tag">새 메모</span>
        </div>
        <div class="slip-header-right">
          <input type="text" id="new-slip-time" class="slip-time-input mono" value="${nowTimestamp}" />
        </div>
      </div>

      <div class="slip-edit-form">
        <div class="slip-field-group">
          <input type="text" id="new-slip-title" class="slip-title-input" placeholder="메모 제목을 입력하세요..." required />
        </div>

        <div class="slip-field-group">
          <textarea id="new-slip-content" class="slip-content-textarea" rows="5" placeholder="사물에 대한 관찰 기록이나 메모를 입력하세요..." required></textarea>
        </div>

        <div class="slip-field-group slip-obj-row mono">
          <label class="slip-field-label">연결 사물:</label>
          <select id="new-slip-obj" class="slip-select-input mono">
            ${objects.map(o => `
              <option value="${o.id}">${o.title} [${o.id}]</option>
            `).join('')}
          </select>
        </div>

        <div class="slip-actions-bar mono">
          <div class="actions-left">
            <button type="button" class="slip-btn-cancel" id="btn-cancel-new-slip">취소</button>
          </div>
          <div class="actions-right">
            <button type="button" class="slip-btn-save" id="btn-save-new-slip">저장</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDisplayMemoSlipHtml(memo, pos, isSelected) {
  const obj = window.app.getObjectById(memo.objectId);
  const objTitle = obj ? obj.title : (memo.objectId || '미지정');

  return `
    <div class="archival-memo-slip display-mode freeform-slip ${isSelected ? 'is-selected-memo' : ''}" id="slip-${memo.id}" data-id="${memo.id}"
         style="left: ${pos.x}px; top: ${pos.y}px;">
      <!-- Window-style Drag Handle Header -->
      <div class="slip-header slip-drag-header mono" data-id="${memo.id}" title="상단을 잡고 원하는 위치로 이동">
        <div class="slip-header-left">
          <!-- Connection Handle & Dot -->
          <div class="slip-connect-handle" data-id="${memo.id}" title="드래그하여 다른 메모와 연결">
            <span class="connect-dot"></span>
          </div>
          <span class="slip-timestamp">${memo.timestamp}</span>
        </div>
        <div class="slip-header-right">
          <button class="slip-quick-del mono" data-id="${memo.id}" title="메모 삭제">&times;</button>
        </div>
      </div>

      <!-- Main Body (Click triggers in-place edit) -->
      <div class="slip-main-body" data-id="${memo.id}">
        <h2 class="slip-title">${escapeMemoHtml(memo.title)}</h2>
        <div class="slip-content">${window.keywordService ? window.keywordService.renderAnnotatedHtml(memo.id, memo.content) : escapeMemoHtml(memo.content)}</div>
      </div>

      <div class="slip-footer mono">
        ${obj ? `
          <a href="index.html?id=${obj.id}" class="slip-obj-link" title="사물 상세 페이지로 이동">
            &rarr; ${escapeMemoHtml(objTitle)}
          </a>
        ` : `
          <span class="slip-obj-unlinked">&rarr; ${escapeMemoHtml(objTitle)}</span>
        `}
        <span class="slip-edit-hint">클릭하여 편집</span>
      </div>
    </div>
  `;
}

function renderEditMemoSlipHtml(memo, objects, pos, isSelected) {
  return `
    <div class="archival-memo-slip editing in-place-edit freeform-slip ${isSelected ? 'is-selected-memo' : ''}" id="slip-${memo.id}" data-id="${memo.id}"
         style="left: ${pos.x}px; top: ${pos.y}px; z-index: 50;">
      <!-- Drag Handle Header -->
      <div class="slip-header slip-drag-header mono" data-id="${memo.id}" title="상단을 잡고 원하는 위치로 이동">
        <div class="slip-header-left">
          <div class="slip-connect-handle" data-id="${memo.id}" title="드래그하여 다른 메모와 연결">
            <span class="connect-dot"></span>
          </div>
          <span class="slip-tag">메모 편집</span>
        </div>
        <div class="slip-header-right">
          <input type="text" id="edit-slip-time-${memo.id}" class="slip-time-input mono" value="${memo.timestamp}" />
        </div>
      </div>

      <div class="slip-edit-form">
        <div class="slip-field-group">
          <input type="text" id="edit-slip-title-${memo.id}" class="slip-title-input" value="${escapeMemoHtml(memo.title)}" required />
        </div>

        <div class="slip-field-group">
          <textarea id="edit-slip-content-${memo.id}" class="slip-content-textarea" rows="5" required>${escapeMemoHtml(memo.content)}</textarea>
        </div>

        <div class="slip-field-group slip-obj-row mono">
          <label class="slip-field-label">연결 사물:</label>
          <select id="edit-slip-obj-${memo.id}" class="slip-select-input mono">
            ${objects.map(o => `
              <option value="${o.id}" ${o.id === memo.objectId ? 'selected' : ''}>${escapeMemoHtml(o.title)} [${o.id}]</option>
            `).join('')}
          </select>
        </div>

        <div class="slip-actions-bar mono">
          <div class="actions-left">
            <button type="button" class="slip-btn-del" data-id="${memo.id}">삭제</button>
            <button type="button" class="slip-btn-cancel" data-id="${memo.id}">취소</button>
          </div>
          <div class="actions-right">
            <button type="button" class="slip-btn-save" data-id="${memo.id}">저장</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function escapeMemoHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// 6. Canvas Pan & Zoom Events (Figma-style)
// ---------------------------------------------------------------------------
function bindCanvasPanAndZoom() {
  const viewport = document.getElementById('memo-viewport');
  const canvas = document.getElementById('memo-canvas');
  if (!viewport || !canvas) return;

  // 1. Wheel Zoom centered on cursor
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.002);
    zoomCanvas(factor, e.clientX, e.clientY);
  }, { passive: false });

  // 2. Navigation Zoom Buttons
  document.getElementById('btn-zoom-in')?.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomCanvas(1.25);
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomCanvas(1 / 1.25);
  });
  document.getElementById('btn-zoom-pct')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetView();
  });
  document.getElementById('btn-zoom-fit')?.addEventListener('click', (e) => {
    e.stopPropagation();
    fitView();
  });
  document.getElementById('btn-zoom-reset')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetView();
  });

  // 3. Canvas Pan (Click & drag empty space)
  viewport.addEventListener('pointerdown', (e) => {
    // Only pan if clicking on empty viewport/canvas/surface background
    const isBackground = (e.target === viewport || e.target === canvas || e.target.id === 'memo-board-surface' || e.target.id === 'memo-connections-svg');
    if (!isBackground) return;

    // Deselect active memo on empty space click
    setSelectedMemo(null);

    isPanningCanvas = true;
    panStartPointerX = e.clientX;
    panStartPointerY = e.clientY;
    panStartCanvasX = canvasState.panX;
    panStartCanvasY = canvasState.panY;

    viewport.classList.add('is-panning');

    function onPanMove(ev) {
      if (!isPanningCanvas) return;
      const dx = ev.clientX - panStartPointerX;
      const dy = ev.clientY - panStartPointerY;

      canvasState.panX = panStartCanvasX + dx;
      canvasState.panY = panStartCanvasY + dy;

      applyCanvasTransform();
    }

    function onPanUp() {
      window.removeEventListener('pointermove', onPanMove);
      window.removeEventListener('pointerup', onPanUp);
      window.removeEventListener('pointercancel', onPanUp);

      isPanningCanvas = false;
      viewport.classList.remove('is-panning');
      saveStoredCanvasState(canvasState);
    }

    window.addEventListener('pointermove', onPanMove);
    window.addEventListener('pointerup', onPanUp);
    window.addEventListener('pointercancel', onPanUp);
  });
}

// ---------------------------------------------------------------------------
// 7. Board Form & Note Events
// ---------------------------------------------------------------------------
function bindBoardEvents(container, objects) {
  // Direct Coordinate Editing in HUD
  const inputX = document.getElementById('memo-coord-input-x');
  const inputY = document.getElementById('memo-coord-input-y');

  function applyCoordInput() {
    if (!selectedMemoId) return;
    const x = parseFloat(inputX.value);
    const y = parseFloat(inputY.value);
    if (!isNaN(x) && !isNaN(y)) {
      updateMemoPosition(selectedMemoId, x, y);
      const slip = document.getElementById(`slip-${selectedMemoId}`);
      if (slip) {
        slip.style.left = `${Math.round(x)}px`;
        slip.style.top = `${Math.round(y)}px`;
      }
      renderConnectionsSvg();
    }
  }

  if (inputX && inputY) {
    inputX.addEventListener('input', applyCoordInput);
    inputY.addEventListener('input', applyCoordInput);
    inputX.addEventListener('change', applyCoordInput);
    inputY.addEventListener('change', applyCoordInput);
    inputX.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyCoordInput(); });
    inputY.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyCoordInput(); });
  }

  // Trigger New Memo button
  const btnTrigger = document.getElementById('btn-trigger-new-memo');
  if (btnTrigger) {
    btnTrigger.addEventListener('click', () => {
      isCreatingNewMemo = true;
      activeEditMemoId = null;

      // Place composer slip centered in current viewport
      const viewport = document.getElementById('memo-viewport');
      const vpW = viewport ? viewport.clientWidth : 800;
      const vpH = viewport ? viewport.clientHeight : 600;

      const canvasCenterPointX = (vpW / 2 - canvasState.panX) / canvasState.zoom - 140;
      const canvasCenterPointY = (vpH / 2 - canvasState.panY) / canvasState.zoom - 100;

      composerSlipPos = {
        x: Math.round(canvasCenterPointX),
        y: Math.round(canvasCenterPointY)
      };

      renderMemoBoard();
      const titleInput = document.getElementById('new-slip-title');
      if (titleInput) titleInput.focus();
    });
  }

  // Cancel New Memo
  const btnCancelNew = document.getElementById('btn-cancel-new-slip');
  if (btnCancelNew) {
    btnCancelNew.addEventListener('click', () => {
      isCreatingNewMemo = false;
      renderMemoBoard();
    });
  }

  // Save New Memo
  const btnSaveNew = document.getElementById('btn-save-new-slip');
  if (btnSaveNew) {
    btnSaveNew.addEventListener('click', () => {
      const title = (document.getElementById('new-slip-title').value || '').trim();
      const content = (document.getElementById('new-slip-content').value || '').trim();
      const timestamp = (document.getElementById('new-slip-time').value || '').trim();
      const objectId = document.getElementById('new-slip-obj').value;

      if (!title) {
        alert('메모 제목을 입력해 주세요.');
        document.getElementById('new-slip-title').focus();
        return;
      }

      const activeSlipEl = document.getElementById('active-new-slip');
      const finalX = activeSlipEl ? (parseFloat(activeSlipEl.style.left) || composerSlipPos.x) : composerSlipPos.x;
      const finalY = activeSlipEl ? (parseFloat(activeSlipEl.style.top) || composerSlipPos.y) : composerSlipPos.y;

      isCreatingNewMemo = false;
      activeEditMemoId = null;

      const saved = window.app.saveMemo({
        objectId,
        title,
        content,
        timestamp
      });

      if (saved && saved.id) {
        updateMemoPosition(saved.id, finalX, finalY);
        selectedMemoId = saved.id;
        if (window.keywordService) {
          window.keywordService.validateMemoAnnotations(saved.id, content);
        }
      }

      renderMemoBoard();
    });
  }

  // Click slip main body: select memo and toggle in-place edit mode
  container.querySelectorAll('.archival-memo-slip.display-mode .slip-main-body').forEach(body => {
    body.addEventListener('click', (e) => {
      if (e.target.closest('.archival-keyword-annotation')) return;
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;

      const memoId = body.getAttribute('data-id');
      setSelectedMemo(memoId);
      activeEditMemoId = memoId;
      isCreatingNewMemo = false;
      renderMemoBoard();

      setTimeout(() => {
        const titleEl = document.getElementById(`edit-slip-title-${memoId}`);
        if (titleEl) {
          titleEl.focus();
          titleEl.select();
        }
      }, 50);
    });
  });

  // Explicit edit hint click
  container.querySelectorAll('.archival-memo-slip.display-mode .slip-edit-hint').forEach(hint => {
    hint.addEventListener('click', (e) => {
      e.stopPropagation();
      const slip = hint.closest('.archival-memo-slip');
      const memoId = slip ? slip.getAttribute('data-id') : null;
      if (memoId) {
        setSelectedMemo(memoId);
        activeEditMemoId = memoId;
        isCreatingNewMemo = false;
        renderMemoBoard();
        setTimeout(() => {
          const titleEl = document.getElementById(`edit-slip-title-${memoId}`);
          if (titleEl) {
            titleEl.focus();
            titleEl.select();
          }
        }, 50);
      }
    });
  });

  // Quick delete on display slip (moves to Trash via app.deleteMemo)
  container.querySelectorAll('.slip-quick-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const memoId = btn.getAttribute('data-id');
      if (confirm('이 메모를 휴지통으로 이동하시겠습니까?')) {
        removeMemoPosition(memoId);
        pruneOrphanConnections(memoId);
        if (window.keywordService) {
          window.keywordService.deleteMemoAnnotations(memoId);
        }
        window.app.deleteMemo(memoId);
        if (activeEditMemoId === memoId) activeEditMemoId = null;
        if (selectedMemoId === memoId) setSelectedMemo(null);
        renderMemoBoard();
      }
    });
  });

  // Save in-place edited memo
  container.querySelectorAll('.editing.in-place-edit .slip-btn-save').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const memoId = btn.getAttribute('data-id');
      const title = (document.getElementById(`edit-slip-title-${memoId}`).value || '').trim();
      const content = (document.getElementById(`edit-slip-content-${memoId}`).value || '').trim();
      const timestamp = (document.getElementById(`edit-slip-time-${memoId}`).value || '').trim();
      const objectId = document.getElementById(`edit-slip-obj-${memoId}`).value;

      if (!title) {
        alert('메모 제목을 입력해 주세요.');
        document.getElementById(`edit-slip-title-${memoId}`).focus();
        return;
      }

      const slipEl = document.getElementById(`slip-${memoId}`);
      if (slipEl) {
        const curX = parseFloat(slipEl.style.left) || 0;
        const curY = parseFloat(slipEl.style.top) || 0;
        updateMemoPosition(memoId, curX, curY);
      }

      activeEditMemoId = null;

      window.app.saveMemo({
        id: memoId,
        objectId,
        title,
        content,
        timestamp
      });

      if (window.keywordService) {
        window.keywordService.validateMemoAnnotations(memoId, content);
      }

      renderMemoBoard();
    });
  });

  // Cancel in-place edited memo
  container.querySelectorAll('.editing.in-place-edit .slip-btn-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeEditMemoId = null;
      renderMemoBoard();
    });
  });

  // Delete in-place edited memo
  container.querySelectorAll('.editing.in-place-edit .slip-btn-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const memoId = btn.getAttribute('data-id');
      if (confirm('이 메모를 휴지통으로 이동하시겠습니까?')) {
        removeMemoPosition(memoId);
        pruneOrphanConnections(memoId);
        window.app.deleteMemo(memoId);
        activeEditMemoId = null;
        if (selectedMemoId === memoId) setSelectedMemo(null);
        renderMemoBoard();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 8. Memo Movement Drag & Drop in Canvas Coordinates (Pointer Events)
// ---------------------------------------------------------------------------
function bindMemoDragEvents() {
  const slips = document.querySelectorAll('.archival-memo-slip');

  slips.forEach(slip => {
    slip.addEventListener('pointerdown', (e) => {
      // Exclude connection handle, quick del, inputs, or edit controls
      if (e.target.closest('.slip-connect-handle') ||
          e.target.closest('.slip-quick-del') ||
          e.target.closest('.archival-keyword-annotation') ||
          ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName)) {
        return;
      }

      const memoId = slip.getAttribute('data-id');
      const isNew = slip.id === 'active-new-slip';

      e.stopPropagation();

      // Select this memo
      if (!isNew && memoId) {
        setSelectedMemo(memoId);
      }

      draggingMemoId = isNew ? '__new__' : memoId;
      dragPointerStartX = e.clientX;
      dragPointerStartY = e.clientY;

      memoStartPosX = parseFloat(slip.style.left) || 0;
      memoStartPosY = parseFloat(slip.style.top) || 0;

      highestZIndex += 1;
      slip.style.zIndex = highestZIndex;
      slip.classList.add('is-dragging-slip');

      const coordInputX = document.getElementById('memo-coord-input-x');
      const coordInputY = document.getElementById('memo-coord-input-y');

      function onPointerMove(ev) {
        if (!draggingMemoId) return;

        // Scale movement delta by 1 / zoom to match canvas coordinates
        const zoom = canvasState.zoom || 1;
        const dx = (ev.clientX - dragPointerStartX) / zoom;
        const dy = (ev.clientY - dragPointerStartY) / zoom;

        const newX = Math.round(memoStartPosX + dx);
        const newY = Math.round(memoStartPosY + dy);

        slip.style.left = `${newX}px`;
        slip.style.top = `${newY}px`;

        if (isNew) {
          composerSlipPos.x = newX;
          composerSlipPos.y = newY;
        } else if (coordInputX && coordInputY && memoId === selectedMemoId) {
          coordInputX.value = newX;
          coordInputY.value = newY;
        }

        renderConnectionsSvg();
      }

      function onPointerUp() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        slip.classList.remove('is-dragging-slip');
        const finalX = parseFloat(slip.style.left) || 0;
        const finalY = parseFloat(slip.style.top) || 0;

        if (!isNew && memoId) {
          updateMemoPosition(memoId, finalX, finalY);
        } else if (isNew) {
          composerSlipPos.x = finalX;
          composerSlipPos.y = finalY;
        }

        draggingMemoId = null;
        renderConnectionsSvg();
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  });
}

// ---------------------------------------------------------------------------
// 9. Connection Drag & Drop via Pointer Events
// ---------------------------------------------------------------------------
function bindConnectionEvents() {
  const handles = document.querySelectorAll('.slip-connect-handle');
  const canvas = document.getElementById('memo-canvas');
  const tempLine = document.getElementById('connection-temp-line');

  if (!canvas || !tempLine) return;

  handles.forEach(handle => {
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      dragSourceMemoId = handle.getAttribute('data-id');
      isDraggingConnection = true;

      handle.classList.add('is-dragging-source');

      const startPt = getDotCenterInCanvas(dragSourceMemoId);
      if (!startPt) return;

      tempLine.setAttribute('x1', startPt.x);
      tempLine.setAttribute('y1', startPt.y);
      tempLine.setAttribute('x2', startPt.x);
      tempLine.setAttribute('y2', startPt.y);
      tempLine.style.display = 'block';

      function onGlobalPointerMove(ev) {
        if (!isDraggingConnection) return;

        const canvasRect = canvas.getBoundingClientRect();
        const zoom = canvasState.zoom || 1;
        const px = (ev.clientX - canvasRect.left) / zoom;
        const py = (ev.clientY - canvasRect.top) / zoom;

        tempLine.setAttribute('x2', px);
        tempLine.setAttribute('y2', py);

        const elemBelow = document.elementFromPoint(ev.clientX, ev.clientY);
        const targetHandle = elemBelow ? elemBelow.closest('.slip-connect-handle') : null;

        document.querySelectorAll('.slip-connect-handle').forEach(h => {
          if (h !== handle) h.classList.remove('is-hover-target');
        });

        if (targetHandle && targetHandle !== handle) {
          targetHandle.classList.add('is-hover-target');
        }
      }

      function onGlobalPointerUp(ev) {
        window.removeEventListener('pointermove', onGlobalPointerMove);
        window.removeEventListener('pointerup', onGlobalPointerUp);
        window.removeEventListener('pointercancel', onGlobalPointerUp);

        tempLine.style.display = 'none';
        handle.classList.remove('is-dragging-source');

        const elemBelow = document.elementFromPoint(ev.clientX, ev.clientY);
        const targetHandle = elemBelow ? elemBelow.closest('.slip-connect-handle') : null;

        document.querySelectorAll('.slip-connect-handle').forEach(h => {
          h.classList.remove('is-hover-target');
        });

        if (targetHandle) {
          const targetMemoId = targetHandle.getAttribute('data-id');
          if (targetMemoId && targetMemoId !== dragSourceMemoId) {
            addMemoConnection(dragSourceMemoId, targetMemoId);
          }
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
// 10. SVG Connection Lines Rendering in Canvas Coordinates
// ---------------------------------------------------------------------------
function getDotCenterInCanvas(memoId) {
  const slip = document.getElementById(`slip-${memoId}`);
  const canvas = document.getElementById('memo-canvas');
  if (!slip || !canvas) return null;

  const dot = slip.querySelector('.connect-dot');
  if (!dot) return null;

  const dotRect = dot.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const zoom = canvasState.zoom || 1;

  return {
    x: (dotRect.left + dotRect.width / 2 - canvasRect.left) / zoom,
    y: (dotRect.top + dotRect.height / 2 - canvasRect.top) / zoom
  };
}

function renderConnectionsSvg() {
  const canvas = document.getElementById('memo-canvas');
  const group = document.getElementById('connections-saved-group');
  if (!canvas || !group) return;

  const conns = getStoredConnections();
  let html = '';

  conns.forEach(conn => {
    const fromId = conn.fromMemoId || conn.sourceId;
    const toId = conn.toMemoId || conn.targetId;
    const ptA = getDotCenterInCanvas(fromId);
    const ptB = getDotCenterInCanvas(toId);

    if (!ptA || !ptB) return;

    html += `
      <g class="connection-line-group" data-conn-id="${conn.id}">
        <!-- Wide transparent stroke for reliable hit testing -->
        <line x1="${ptA.x}" y1="${ptA.y}" x2="${ptB.x}" y2="${ptB.y}"
              class="connection-hit-line" stroke="transparent" stroke-width="14"></line>
        <!-- Crisp 1.2px colored connection line -->
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

function updateConnectionPositions() {
  renderConnectionsSvg();
}
