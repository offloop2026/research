/**
 * CONSTELLATION MODULE (constellation.js)
 * Freeform Relational Workspace for Objects:
 * - Freeform placement space (like memo.html)
 * - Add existing objects directly via [+ 추가] popover
 * - Drag nodes freely by header (no grid, pointer events)
 * - Minimal node representation (Connection Dot, Title, Image, Record Link)
 * - Drag connection dot (●) to connect nodes with random RGB lines
 * - Real-time line tracking on drag
 * - Persistent positions ('archive_constellation_positions_v1')
 * - Persistent connections ('archive_constellation_connections_v1')
 * - Automatic cleanup on object deletion
 * - Pure archival aesthetic (clean white paper, subtle colored lines, no neon)
 */

const CONSTELLATION_POSITIONS_KEY = 'archive_constellation_positions_v1';
const CONSTELLATION_CONNECTIONS_KEY = 'archive_constellation_connections_v1';

// Dragging connection state
let isDraggingConstellationConn = false;
let dragSourceObjId = null;

// Dragging node state
let draggingObjId = null;
let dragPointerStartX = 0;
let dragPointerStartY = 0;
let nodeStartPosX = 0;
let nodeStartPosY = 0;
let highestZIndex = 20;

document.addEventListener('DOMContentLoaded', () => {
  if (window.app && window.app.isReady) {
    initConstellationBoard();
  } else {
    window.addEventListener('archive-ready', () => {
      initConstellationBoard();
    }, { once: true });
    const checkReady = setInterval(() => {
      if (window.app && window.app.isReady) {
        clearInterval(checkReady);
        initConstellationBoard();
      }
    }, 40);
  }

  window.addEventListener('archive-updated', () => {
    pruneConstellationOrphans();
    renderConstellationBoard();
  });

  window.addEventListener('resize', () => {
    requestAnimationFrame(() => renderConstellationConnectionsSvg());
  });
});

function initConstellationBoard() {
  const container = document.getElementById('constellation-main-container');
  if (!container) return;
  pruneConstellationOrphans();
  ensureInitialPositions();
  renderConstellationBoard();
}

// ---------------------------------------------------------------------------
// 1. Position Storage Management
// ---------------------------------------------------------------------------
function getStoredPositions() {
  try {
    const raw = localStorage.getItem(CONSTELLATION_POSITIONS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[Constellation] Positions read error:', e);
    return null;
  }
}

function saveStoredPositions(positions) {
  try {
    localStorage.setItem(CONSTELLATION_POSITIONS_KEY, JSON.stringify(positions));
  } catch (e) {
    console.warn('[Constellation] Positions write error:', e);
  }
}

function ensureInitialPositions() {
  let stored = getStoredPositions();
  if (!stored) {
    stored = {
      'obj-001': { x: 120, y: 100 },
      'obj-002': { x: 560, y: 140 },
      'obj-003': { x: 260, y: 440 },
      'obj-004': { x: 740, y: 380 }
    };
    saveStoredPositions(stored);
  }
  return stored;
}

function getObjectPosition(objId, index = 0) {
  const stored = getStoredPositions() || {};
  if (stored[objId] && typeof stored[objId].x === 'number' && typeof stored[objId].y === 'number') {
    return stored[objId];
  }

  const col = index % 3;
  const row = Math.floor(index / 3);
  const defX = Math.max(40, 100 + col * 320);
  const defY = Math.max(40, 90 + row * 320);
  const pos = { x: defX, y: defY };
  stored[objId] = pos;
  saveStoredPositions(stored);
  return pos;
}

function updateObjectPosition(objId, x, y) {
  const stored = getStoredPositions() || {};
  stored[objId] = { x: Math.round(x), y: Math.round(y) };
  saveStoredPositions(stored);
}

function removeObjectPosition(objId) {
  const stored = getStoredPositions() || {};
  if (stored[objId]) {
    delete stored[objId];
    saveStoredPositions(stored);
  }
}

// ---------------------------------------------------------------------------
// 2. Connection Storage Management
// ---------------------------------------------------------------------------
function getStoredConnections() {
  try {
    const raw = localStorage.getItem(CONSTELLATION_CONNECTIONS_KEY);
    if (raw) return JSON.parse(raw);

    // Initial seed from existing object constellation links
    const objects = window.app.getObjects();
    const seeded = [];
    const seen = new Set();

    objects.forEach(obj => {
      (obj.constellation || []).forEach(targetId => {
        const pairKey = [obj.id, targetId].sort().join(':::');
        if (!seen.has(pairKey)) {
          seen.add(pairKey);
          seeded.push({
            id: `c-conn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            fromObjectId: obj.id,
            toObjectId: targetId,
            color: generateRandomRGB()
          });
        }
      });
    });

    if (seeded.length) {
      saveStoredConnections(seeded);
    }
    return seeded;
  } catch (e) {
    console.warn('[Constellation] Connections read error:', e);
    return [];
  }
}

function saveStoredConnections(connections) {
  try {
    localStorage.setItem(CONSTELLATION_CONNECTIONS_KEY, JSON.stringify(connections));
  } catch (e) {
    console.warn('[Constellation] Connections write error:', e);
  }
}

function pruneConstellationOrphans(deletedObjId = null) {
  const allObjects = window.app ? window.app.getObjects() : [];
  const validIds = new Set(allObjects.map(o => o.id));
  if (deletedObjId) validIds.delete(deletedObjId);

  // Prune orphan positions
  const pos = getStoredPositions();
  if (pos) {
    let posChanged = false;
    Object.keys(pos).forEach(id => {
      if (!validIds.has(id)) {
        delete pos[id];
        posChanged = true;
      }
    });
    if (posChanged) saveStoredPositions(pos);
  }

  // Prune orphan connections
  const rawConns = localStorage.getItem(CONSTELLATION_CONNECTIONS_KEY);
  if (rawConns) {
    try {
      const conns = JSON.parse(rawConns);
      const filtered = conns.filter(c => validIds.has(c.fromObjectId) && validIds.has(c.toObjectId));
      if (filtered.length !== conns.length) {
        saveStoredConnections(filtered);
      }
    } catch (e) {}
  }
}

function addConstellationConnection(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return false;

  const conns = getStoredConnections();

  // Prevent duplicates (undirected: A-B and B-A are identical)
  const exists = conns.some(c =>
    (c.fromObjectId === fromId && c.toObjectId === toId) ||
    (c.fromObjectId === toId && c.toObjectId === fromId)
  );
  if (exists) return false;

  const newConn = {
    id: `c-conn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    fromObjectId: fromId,
    toObjectId: toId,
    color: generateRandomRGB()
  };

  conns.push(newConn);
  saveStoredConnections(conns);
  renderConstellationConnectionsSvg();
  return true;
}

function deleteConstellationConnection(connId) {
  const conns = getStoredConnections();
  const next = conns.filter(c => c.id !== connId);
  saveStoredConnections(next);
  renderConstellationConnectionsSvg();
}

/**
 * Random RGB line generator
 * Brightness clamped so lines are crisp & visible on light archival background
 */
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
// 3. Render Constellation Board
// ---------------------------------------------------------------------------
function renderConstellationBoard() {
  const container = document.getElementById('constellation-main-container');
  if (!container) return;

  const allObjects = window.app.getObjects();
  const positions = getStoredPositions() || {};

  // Placed objects are those present in positions
  const placedIds = Object.keys(positions);
  const placedObjects = placedIds
    .map(id => window.app.getObjectById(id))
    .filter(Boolean);

  // Determine stage dimensions
  let maxRight = 1200;
  let maxBottom = 900;

  placedObjects.forEach((obj, idx) => {
    const pos = getObjectPosition(obj.id, idx);
    if (pos.x + 320 > maxRight) maxRight = pos.x + 320;
    if (pos.y + 360 > maxBottom) maxBottom = pos.y + 360;
  });

  container.innerHTML = `
    <div class="constellation-board-wrapper">
      <div class="col-header">
        <div class="col-header-left">
          <span class="col-header-title">Constellation</span>
          <span class="col-header-meta mono" style="opacity:0.4;">${placedObjects.length}</span>
        </div>
        <div class="col-header-right">
          <div class="constellation-add-wrap">
            <button type="button" class="col-header-action-text" id="btn-constellation-add">+ Add Object</button>
            <div class="constellation-add-popover mono" id="constellation-add-popover" style="display: none;">
              <div class="add-popover-header">
                <span>사물 선택 (OBJECT)</span>
                <button class="add-popover-close" id="btn-close-add-popover">&times;</button>
              </div>
              <div class="add-popover-list" id="popover-objects-list">
                ${allObjects.map(obj => {
                  const isPlaced = Boolean(positions[obj.id]);
                  return `
                    <button type="button" class="popover-obj-item ${isPlaced ? 'is-placed' : ''}" data-id="${obj.id}">
                      <span class="obj-item-title">${escapeHtml(obj.title)}</span>
                      <span class="obj-item-id">[${obj.id}]</span>
                      ${isPlaced ? '<span class="obj-item-tag">배치됨</span>' : '<span class="obj-item-action">+ 배치</span>'}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
          <button class="col-header-menu-btn" title="Navigation">&equiv;</button>
        </div>
      </div>

      <!-- FREEFORM CONSTELLATION STAGE -->
      <div class="constellation-stage" id="constellation-stage" style="min-width: ${maxRight}px; min-height: ${maxBottom}px;">
        <!-- SVG Connection Lines Layer (Underneath Nodes) -->
        <svg class="constellation-connections-layer" id="constellation-connections-svg" width="${maxRight}" height="${maxBottom}">
          <g id="constellation-connections-group"></g>
          <line id="constellation-temp-line" x1="0" y1="0" x2="0" y2="0" class="temp-connection-line" style="display: none;"></line>
        </svg>

        <!-- Placed Object Nodes -->
        <div class="constellation-nodes-container" id="constellation-nodes-container">
          ${placedObjects.map((obj, idx) => {
            const pos = getObjectPosition(obj.id, idx);
            const repImg = (window.resolveImagePath ? window.resolveImagePath(obj.representativeImage || (obj.images && obj.images[0])) : null) || './assets/images/obj-001-1.svg';

            return `
              <div class="constellation-object-node" id="c-node-${obj.id}" data-id="${obj.id}" style="left: ${pos.x}px; top: ${pos.y}px;">
                <!-- Drag Handle Header -->
                <div class="c-node-header mono" data-id="${obj.id}" title="상단을 잡고 원하는 위치로 이동">
                  <div class="c-node-header-left">
                    <span class="c-node-num">${String(idx + 1).padStart(2, '0')}</span>
                    <span class="c-node-id">${obj.id}</span>
                  </div>
                  <div class="c-node-header-right">
                    <!-- Connection Handle & Dot -->
                    <div class="c-node-connect-handle" data-id="${obj.id}" title="드래그하여 다른 사물과 연결">
                      <span class="connect-dot"></span>
                    </div>
                    <button type="button" class="c-node-btn-remove" data-id="${obj.id}" title="성좌에서 제거">&times;</button>
                  </div>
                </div>

                <!-- Node Body (Image) -->
                <div class="c-node-body">
                  <a href="index.html?id=${obj.id}" class="c-node-img-link" title="${escapeHtml(obj.title)}">
                    <img src="${repImg}" alt="${escapeHtml(obj.title)}" class="c-node-img" loading="lazy" onerror="if(!this.dataset.failed){this.dataset.failed='1';this.src='./assets/images/obj-001-1.svg';}" />
                  </a>
                </div>

                <!-- Minimal Footer -->
                <div class="c-node-footer mono">
                  <span class="c-node-timestamp">${obj.timestamp}</span>
                  <a href="index.html?id=${obj.id}" class="c-node-jump-link">&rarr; 기록</a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  bindBoardEvents();
  bindDragEvents();
  bindConnectionEvents();
  if (window.app && typeof window.app.initMenuPopover === 'function') {
    window.app.initMenuPopover();
  }
  renderConstellationConnectionsSvg();
}

// ---------------------------------------------------------------------------
// 4. SVG Lines Rendering
// ---------------------------------------------------------------------------
function renderConstellationConnectionsSvg() {
  const svg = document.getElementById('constellation-connections-svg');
  const group = document.getElementById('constellation-connections-group');
  if (!svg || !group) return;

  const conns = getStoredConnections();
  const stage = document.getElementById('constellation-stage');
  if (!stage) return;

  const stageRect = stage.getBoundingClientRect();
  let linesHtml = '';

  conns.forEach(conn => {
    const nodeFrom = document.getElementById(`c-node-${conn.fromObjectId}`);
    const nodeTo = document.getElementById(`c-node-${conn.toObjectId}`);

    if (!nodeFrom || !nodeTo) return;

    const dotFrom = nodeFrom.querySelector('.connect-dot');
    const dotTo = nodeTo.querySelector('.connect-dot');

    if (!dotFrom || !dotTo) return;

    const fromRect = dotFrom.getBoundingClientRect();
    const toRect = dotTo.getBoundingClientRect();

    const x1 = (fromRect.left + fromRect.width / 2) - stageRect.left;
    const y1 = (fromRect.top + fromRect.height / 2) - stageRect.top;
    const x2 = (toRect.left + toRect.width / 2) - stageRect.left;
    const y2 = (toRect.top + toRect.height / 2) - stageRect.top;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    linesHtml += `
      <g class="constellation-conn-edge" data-conn-id="${conn.id}">
        <!-- Invisible wide click/hover zone -->
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
              class="conn-hitbox" stroke="transparent" stroke-width="14" />
        <!-- Visible random RGB line -->
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
              class="conn-line" stroke="${conn.color}" stroke-width="1.6" stroke-linecap="round" />
        <!-- Midpoint delete badge on hover -->
        <circle cx="${midX}" cy="${midY}" r="7" class="conn-del-badge" data-conn-id="${conn.id}" />
        <text x="${midX}" y="${midY + 3.5}" text-anchor="middle" class="conn-del-text mono" data-conn-id="${conn.id}">&times;</text>
      </g>
    `;
  });

  group.innerHTML = linesHtml;

  // Bind deletion of lines on click
  group.querySelectorAll('.conn-del-badge, .conn-del-text').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const connId = el.getAttribute('data-conn-id');
      if (confirm('이 성좌 연결선을 삭제하시겠습니까?')) {
        deleteConstellationConnection(connId);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 5. Board UI Events
// ---------------------------------------------------------------------------
function bindBoardEvents() {
  const addBtn = document.getElementById('btn-constellation-add');
  const popover = document.getElementById('constellation-add-popover');
  const closeBtn = document.getElementById('btn-close-add-popover');

  if (addBtn && popover) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = popover.style.display === 'block';
      popover.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== addBtn) {
        popover.style.display = 'none';
      }
    });
  }

  if (closeBtn && popover) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.style.display = 'none';
    });
  }

  // Popover object selection
  document.querySelectorAll('.popover-obj-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const objId = btn.getAttribute('data-id');
      const positions = getStoredPositions() || {};

      if (positions[objId]) {
        // Already placed: highlight and scroll into view
        if (popover) popover.style.display = 'none';
        const nodeEl = document.getElementById(`c-node-${objId}`);
        if (nodeEl) {
          nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          nodeEl.classList.add('node-nudge-highlight');
          setTimeout(() => nodeEl.classList.remove('node-nudge-highlight'), 1200);
        }
      } else {
        // Place new node near current viewport
        const stage = document.getElementById('constellation-stage');
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;

        const newX = Math.max(60, scrollLeft + 160 + ((Object.keys(positions).length * 40) % 240));
        const newY = Math.max(60, scrollTop + 140 + ((Object.keys(positions).length * 30) % 200));

        updateObjectPosition(objId, newX, newY);
        if (popover) popover.style.display = 'none';
        renderConstellationBoard();

        setTimeout(() => {
          const nodeEl = document.getElementById(`c-node-${objId}`);
          if (nodeEl) {
            nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          }
        }, 60);
      }
    });
  });

  // Node removal from constellation
  document.querySelectorAll('.c-node-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const objId = btn.getAttribute('data-id');
      if (confirm('이 사물 노드를 성좌 공간에서 제외하시겠습니까? (사물 원본 데이터는 보존됩니다)')) {
        removeObjectPosition(objId);
        // Also prune connections attached to this node
        const conns = getStoredConnections().filter(c => c.fromObjectId !== objId && c.toObjectId !== objId);
        saveStoredConnections(conns);
        renderConstellationBoard();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 6. Free Movement Drag via Pointer Events (Windows-Style Drag Header)
// ---------------------------------------------------------------------------
function bindDragEvents() {
  const headers = document.querySelectorAll('.c-node-header');

  headers.forEach(header => {
    header.addEventListener('pointerdown', (e) => {
      // Don't drag if clicking connection handle or remove button
      if (e.target.closest('.c-node-connect-handle') || e.target.closest('.c-node-remove')) {
        return;
      }

      e.preventDefault();
      const objId = header.getAttribute('data-id');
      const nodeEl = document.getElementById(`c-node-${objId}`);
      if (!nodeEl) return;

      draggingObjId = objId;
      dragPointerStartX = e.clientX;
      dragPointerStartY = e.clientY;

      nodeStartPosX = parseFloat(nodeEl.style.left) || 0;
      nodeStartPosY = parseFloat(nodeEl.style.top) || 0;

      highestZIndex += 1;
      nodeEl.style.zIndex = highestZIndex;
      nodeEl.classList.add('is-dragging-node');

      function onPointerMove(ev) {
        if (!draggingObjId || draggingObjId !== objId) return;

        const dx = ev.clientX - dragPointerStartX;
        const dy = ev.clientY - dragPointerStartY;

        let newX = nodeStartPosX + dx;
        let newY = nodeStartPosY + dy;

        newX = Math.max(-100, newX);
        newY = Math.max(10, newY);

        nodeEl.style.left = `${newX}px`;
        nodeEl.style.top = `${newY}px`;

        expandConstellationStageIfNeeded(newX, newY);
        renderConstellationConnectionsSvg();
      }

      function onPointerUp() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        if (nodeEl) {
          nodeEl.classList.remove('is-dragging-node');
          const finalX = parseFloat(nodeEl.style.left) || 0;
          const finalY = parseFloat(nodeEl.style.top) || 0;
          updateObjectPosition(objId, finalX, finalY);
        }

        draggingObjId = null;
        renderConstellationConnectionsSvg();
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  });
}

function expandConstellationStageIfNeeded(x, y) {
  const stage = document.getElementById('constellation-stage');
  const svg = document.getElementById('constellation-connections-svg');
  if (!stage) return;

  const currentW = stage.offsetWidth;
  const currentH = stage.offsetHeight;
  const neededW = Math.max(currentW, x + 340);
  const neededH = Math.max(currentH, y + 360);

  if (neededW > currentW) {
    stage.style.minWidth = `${neededW}px`;
    if (svg) svg.setAttribute('width', neededW);
  }
  if (neededH > currentH) {
    stage.style.minHeight = `${neededH}px`;
    if (svg) svg.setAttribute('height', neededH);
  }
}

// ---------------------------------------------------------------------------
// 7. Connection Dot Drag & Drop (Random RGB)
// ---------------------------------------------------------------------------
function bindConnectionEvents() {
  const handles = document.querySelectorAll('.c-node-connect-handle');
  const stage = document.getElementById('constellation-stage');
  const tempLine = document.getElementById('constellation-temp-line');

  if (!stage || !tempLine) return;

  handles.forEach(handle => {
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      dragSourceObjId = handle.getAttribute('data-id');
      isDraggingConstellationConn = true;

      handle.classList.add('is-dragging-source');

      const stageRect = stage.getBoundingClientRect();
      const dot = handle.querySelector('.connect-dot');
      const dotRect = dot.getBoundingClientRect();

      const startX = (dotRect.left + dotRect.width / 2) - stageRect.left;
      const startY = (dotRect.top + dotRect.height / 2) - stageRect.top;

      tempLine.setAttribute('x1', startX);
      tempLine.setAttribute('y1', startY);
      tempLine.setAttribute('x2', startX);
      tempLine.setAttribute('y2', startY);
      tempLine.style.display = 'block';

      function onPointerMove(ev) {
        if (!isDraggingConstellationConn) return;

        const curStageRect = stage.getBoundingClientRect();
        const px = ev.clientX - curStageRect.left;
        const py = ev.clientY - curStageRect.top;

        tempLine.setAttribute('x2', px);
        tempLine.setAttribute('y2', py);

        // Visual hover cue over target handle
        const elemBelow = document.elementFromPoint(ev.clientX, ev.clientY);
        const targetHandle = elemBelow ? elemBelow.closest('.c-node-connect-handle') : null;

        document.querySelectorAll('.c-node-connect-handle').forEach(h => {
          if (h !== handle) h.classList.remove('is-drag-target-candidate');
        });

        if (targetHandle && targetHandle !== handle) {
          targetHandle.classList.add('is-drag-target-candidate');
        }
      }

      function onPointerUp(ev) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        tempLine.style.display = 'none';
        handle.classList.remove('is-dragging-source');

        document.querySelectorAll('.c-node-connect-handle').forEach(h => {
          h.classList.remove('is-drag-target-candidate');
        });

        const elemBelow = document.elementFromPoint(ev.clientX, ev.clientY);
        const targetHandle = elemBelow ? elemBelow.closest('.c-node-connect-handle') : null;
        const targetNode = (!targetHandle && elemBelow) ? elemBelow.closest('.constellation-object-node') : null;

        const targetObjId = targetHandle
          ? targetHandle.getAttribute('data-id')
          : (targetNode ? targetNode.getAttribute('data-id') : null);

        if (targetObjId && targetObjId !== dragSourceObjId) {
          addConstellationConnection(dragSourceObjId, targetObjId);
        }

        isDraggingConstellationConn = false;
        dragSourceObjId = null;
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
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
