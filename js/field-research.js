/**
 * FIELD RESEARCH MODULE (field-research.js)
 * Continuous Vertical Editorial Journal & Research Diary:
 * - Long vertical document stream: Text -> Image -> Caption -> Text -> Image...
 * - No cards, no shadows, no rounded corners, authentic Cargo editorial typography.
 * - Sequential content blocks: 'text', 'image', 'image-caption'
 * - In-situ editor for Title, Date, Location, Related Object link, Intro, and Blocks.
 * - Image uploads with compression via window.app.compressImageFile and direct image URLs.
 * - Storage key: archive_field_research_v1
 */

const resolvePath = (url) => (window.resolveImagePath ? window.resolveImagePath(url) : (url && url.startsWith('/') ? '.' + url : (url && !url.startsWith('./') && !url.startsWith('http') && !url.startsWith('data:') ? './' + url : (url || './assets/images/obj-001-1.svg'))));

let editingResearchId = null;
let editDraft = null;

function isCmsEditMode() {
  try {
    return localStorage.getItem('archive_cms_edit_mode') === 'true';
  } catch (e) {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.app && window.app.isReady) {
    initFieldResearch();
  } else {
    window.addEventListener('archive-ready', () => {
      initFieldResearch();
    }, { once: true });
    const fallback = setInterval(() => {
      if (window.app && window.app.isReady) {
        clearInterval(fallback);
        initFieldResearch();
      }
    }, 30);
  }

  window.addEventListener('archive-updated', () => {
    renderFieldResearchView();
  });
});

function initFieldResearch() {
  renderFieldResearchView();

  // If URL has hash, scroll to target research entry
  if (window.location.hash) {
    const targetId = window.location.hash.substring(1);
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }
}

function renderFieldResearchView() {
  const container = document.getElementById('field-research-main-container');
  if (!container) return;

  const researchList = (window.app && typeof window.app.getResearchList === 'function')
    ? window.app.getResearchList()
    : [];

  const editActive = isCmsEditMode();

  // Top editorial column header matching Cargo reference
  let html = `
    <header class="field-research-header">
      <div class="col-header">
        <div class="col-header-left">
          <span class="col-header-title">Field Research</span>
          <span class="col-header-meta mono" style="opacity:0.4;">${researchList.length}</span>
        </div>
        <div class="col-header-right">
          <button type="button" class="col-header-edit-badge ${editActive ? 'active' : ''} mono" id="btn-fr-toggle-edit" title="편집 모드 전환">
            ${editActive ? '[EDIT: ON]' : '[Edit]'}
          </button>
          ${editActive ? `
            <button type="button" class="col-header-edit-badge mono" id="btn-fr-add-research" title="새 현장 조사 기록 추가">[+ Add Research]</button>
          ` : ''}
          <button type="button" class="col-header-menu-btn" title="Navigation" data-menu="fr">=</button>
        </div>
      </div>
    </header>

    <div class="field-research-stream-wrap">
      <div class="field-research-stream">
  `;

  if (!researchList.length) {
    html += `
      <div class="research-empty-state" style="padding: 60px 0; text-align: center;">
        <p class="doc-empty-text">등록된 현장 조사 기록이 없습니다.</p>
        ${editActive ? `
          <button type="button" class="band-text-action mono" id="btn-empty-add-res" style="margin-top: 12px;">+ 새 현장 조사 작성</button>
        ` : ''}
      </div>
    `;
  } else {
    researchList.forEach((entry, idx) => {
      const isEditing = (editActive && editingResearchId === entry.id);

      if (isEditing && editDraft) {
        html += renderResearchEditor(editDraft, idx);
      } else {
        html += renderResearchArticle(entry, idx, editActive);
      }

      if (idx < researchList.length - 1) {
        html += `<hr class="research-entry-divider" />`;
      }
    });
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Bind Header Controls
  document.getElementById('btn-fr-toggle-edit')?.addEventListener('click', () => {
    if (window.app && typeof window.app.toggleCmsEditMode === 'function') {
      window.app.toggleCmsEditMode();
    }
  });

  const handleAddResearch = () => {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;

    const newEntry = {
      id: `res-${Date.now()}`,
      numStr: String(researchList.length + 1).padStart(2, '0'),
      title: '새 현장 조사 기록',
      date: todayStr,
      location: '서울',
      relatedObjectId: '',
      intro: '현장 조사 개요 및 배경을 기록합니다.',
      blocks: [
        {
          id: `blk-${Date.now()}-1`,
          type: 'text',
          text: '현장에서 관찰한 사물의 상태와 주변 물리적 환경에 대한 상세한 기록을 작성합니다.'
        }
      ]
    };

    const saved = window.app.saveResearch(newEntry);
    editingResearchId = saved.id;
    editDraft = JSON.parse(JSON.stringify(saved));
    renderFieldResearchView();
  };

  document.getElementById('btn-fr-add-research')?.addEventListener('click', handleAddResearch);
  document.getElementById('btn-empty-add-res')?.addEventListener('click', handleAddResearch);

  // Bind Entry Controls
  container.querySelectorAll('.btn-trigger-edit-res').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const target = researchList.find(r => r.id === id);
      if (target) {
        editingResearchId = id;
        editDraft = JSON.parse(JSON.stringify(target));
        renderFieldResearchView();
      }
    });
  });

  container.querySelectorAll('.btn-delete-res').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const target = researchList.find(r => r.id === id);
      if (!target) return;
      if (confirm(`현장 조사 기록 [${target.title}]을(를) 휴지통으로 이동하시겠습니까?`)) {
        if (editingResearchId === id) {
          editingResearchId = null;
          editDraft = null;
        }
        window.app.deleteResearch(id);
      }
    });
  });

  // Bind In-Situ Editor Events
  if (editingResearchId && editDraft) {
    bindEditorEvents(container);
  }

  // Initialize popover menu on '='
  if (window.app && typeof window.app.initMenuPopover === 'function') {
    window.app.initMenuPopover();
  }
}

/**
 * Render single research entry in clean editorial reading mode
 */
function renderResearchArticle(entry, idx, isEdit) {
  const numStr = entry.numStr || String(idx + 1).padStart(2, '0');
  const relatedObj = entry.relatedObjectId ? window.app.getObjectById(entry.relatedObjectId) : null;

  return `
    <article class="research-journal-article" id="${entry.id}">
      <div class="research-meta-top mono">
        <span class="research-entry-num">Research ${numStr}</span>
        ${isEdit ? `
          <div class="research-entry-actions">
            <button type="button" class="btn-trigger-edit-res mono" data-id="${entry.id}">[Edit Entry]</button>
            <button type="button" class="btn-delete-res text-danger mono" data-id="${entry.id}">[Delete]</button>
          </div>
        ` : ''}
      </div>

      <div class="research-byline mono">
        <span class="research-date">${escapeHtml(entry.date || '')}</span>
        ${entry.location ? `<span class="research-sep">&middot;</span><span class="research-loc">${escapeHtml(entry.location)}</span>` : ''}
        ${relatedObj ? `
          <span class="research-sep">&middot;</span>
          <a href="index.html?id=${relatedObj.id}" class="research-related-link" title="아카이브 사물로 이동">
            &rarr; 사물: ${escapeHtml(relatedObj.title)} (${relatedObj.id})
          </a>
        ` : ''}
      </div>

      <h1 class="research-article-title">${escapeHtml(entry.title)}</h1>

      ${entry.intro ? `
        <div class="research-article-intro serif-italic">
          ${escapeHtml(entry.intro)}
        </div>
      ` : ''}

      <div class="research-blocks-stream">
        ${(entry.blocks || []).map(blk => renderContentBlock(blk)).join('')}
      </div>
    </article>
  `;
}

/**
 * Render individual content block (Text, Image, Image+Caption)
 */
function renderContentBlock(blk) {
  if (blk.type === 'text') {
    const formatted = escapeHtml(blk.text || '')
      .split('\n\n')
      .map(p => `<p class="research-text-p">${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
    return `<div class="research-block research-block-text">${formatted}</div>`;
  }

  if (blk.type === 'image') {
    const src = resolvePath(blk.image);
    return `
      <div class="research-block research-block-image">
        <div class="editorial-frame-outer">
          <div class="editorial-frame-border">
            <div class="editorial-frame-inner">
              <img src="${src}" alt="현장 조사 사진" class="editorial-framed-img" loading="lazy" onerror="if(!this.dataset.failed){this.dataset.failed='1';this.src='./assets/images/obj-001-1.svg';}" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (blk.type === 'image-caption') {
    const src = resolvePath(blk.image);
    return `
      <div class="research-block research-block-image-caption">
        <div class="editorial-frame-outer">
          <div class="editorial-frame-border">
            <div class="editorial-frame-inner">
              <img src="${src}" alt="현장 조사 사진" class="editorial-framed-img" loading="lazy" onerror="if(!this.dataset.failed){this.dataset.failed='1';this.src='./assets/images/obj-001-1.svg';}" />
            </div>
          </div>
        </div>
        ${blk.caption ? `
          <div class="research-block-caption serif-italic">
            ${escapeHtml(blk.caption)}
          </div>
        ` : ''}
      </div>
    `;
  }

  return '';
}

/**
 * Render In-Situ Editor for a research entry
 */
function renderResearchEditor(draft, idx) {
  const allObjects = (window.app && typeof window.app.getObjects === 'function')
    ? window.app.getObjects()
    : [];

  return `
    <div class="research-editor-card" id="${draft.id}">
      <div class="editor-header-bar mono">
        <span>Editing Research ${draft.numStr || String(idx + 1).padStart(2, '0')}</span>
        <div class="editor-header-actions">
          <button type="button" class="btn-cancel-edit-res mono" id="btn-cancel-res-edit">[Cancel]</button>
          <button type="button" class="btn-save-edit-res mono" id="btn-save-res-edit" style="color:#C00000; font-weight:bold;">[저장 (Save)]</button>
        </div>
      </div>

      <div class="editor-meta-fields">
        <div class="editor-field-row">
          <label class="editor-label mono">Title</label>
          <input type="text" id="draft-title" class="editor-input" value="${escapeHtml(draft.title)}" placeholder="현장 조사 제목..." />
        </div>

        <div class="editor-field-row-grid">
          <div class="editor-field-col">
            <label class="editor-label mono">Date</label>
            <input type="text" id="draft-date" class="editor-input mono" value="${escapeHtml(draft.date || '')}" placeholder="YYYY.MM.DD" />
          </div>
          <div class="editor-field-col">
            <label class="editor-label mono">Location</label>
            <input type="text" id="draft-location" class="editor-input" value="${escapeHtml(draft.location || '')}" placeholder="조사 장소..." />
          </div>
          <div class="editor-field-col">
            <label class="editor-label mono">Related Object (선택)</label>
            <select id="draft-related-obj" class="editor-select mono">
              <option value="">(연결 사물 없음)</option>
              ${allObjects.map(o => `
                <option value="${o.id}" ${draft.relatedObjectId === o.id ? 'selected' : ''}>
                  ${escapeHtml(o.title)} (${o.id})
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="editor-field-row">
          <label class="editor-label mono">Description / Intro</label>
          <textarea id="draft-intro" class="editor-textarea" rows="2" placeholder="현장 조사의 맥락 및 사전 개요...">${escapeHtml(draft.intro || '')}</textarea>
        </div>
      </div>

      <!-- Sequential Blocks Editor -->
      <div class="editor-blocks-section">
        <div class="editor-blocks-header mono">
          <span>Content Blocks (${(draft.blocks || []).length})</span>
        </div>

        <div class="editor-blocks-list" id="editor-blocks-container">
          ${(draft.blocks || []).map((blk, bIdx) => renderBlockEditorItem(blk, bIdx, draft.blocks.length)).join('')}
        </div>

        <div class="editor-add-block-toolbar mono">
          <button type="button" class="btn-add-block" id="btn-add-text-block">[+ Add Text]</button>
          <button type="button" class="btn-add-block" id="btn-add-img-block">[+ Add Image]</button>
          <button type="button" class="btn-add-block" id="btn-add-imgcap-block">[+ Add Image + Caption]</button>
        </div>
      </div>

      <div class="editor-bottom-bar mono">
        <button type="button" class="btn-cancel-edit-res mono" id="btn-cancel-res-edit-bottom">[Cancel]</button>
        <button type="button" class="btn-save-edit-res mono" id="btn-save-res-edit-bottom" style="color:#C00000; font-weight:bold;">[저장 (Save)]</button>
      </div>
    </div>
  `;
}

/**
 * Render single block editor item
 */
function renderBlockEditorItem(blk, bIdx, totalBlocks) {
  let innerHtml = '';

  if (blk.type === 'text') {
    innerHtml = `
      <div class="block-field-body">
        <textarea class="editor-block-textarea" data-bidx="${bIdx}" placeholder="본문 텍스트 내용을 작성합니다...">${escapeHtml(blk.text || '')}</textarea>
      </div>
    `;
  } else if (blk.type === 'image' || blk.type === 'image-caption') {
    innerHtml = `
      <div class="block-field-body">
        <div class="block-image-edit-wrap">
          <div class="block-image-preview-box">
            <img src="${resolvePath(blk.image)}" class="block-img-preview" id="preview-img-${bIdx}" onerror="if(!this.dataset.failed){this.dataset.failed='1';this.src='./assets/images/obj-001-1.svg';}" />
          </div>
          <div class="block-image-inputs">
            <label class="mono" style="font-size:11px; display:block; margin-bottom:4px;">Upload File:</label>
            <input type="file" accept="image/*" class="block-file-input mono" data-bidx="${bIdx}" />
            <label class="mono" style="font-size:11px; display:block; margin:6px 0 4px 0;">Or Image URL / Path:</label>
            <input type="text" class="block-url-input mono" data-bidx="${bIdx}" value="${escapeHtml(blk.image || '')}" placeholder="./assets/images/... or https://..." />
          </div>
        </div>
        ${blk.type === 'image-caption' ? `
          <div style="margin-top:8px;">
            <label class="mono" style="font-size:11px; display:block; margin-bottom:4px;">Caption:</label>
            <input type="text" class="block-caption-input" data-bidx="${bIdx}" value="${escapeHtml(blk.caption || '')}" placeholder="사진에 대한 짧은 캡션..." />
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="editor-block-item" data-bidx="${bIdx}">
      <div class="editor-block-top mono">
        <span class="block-type-tag">[Block ${bIdx + 1}: ${blk.type}]</span>
        <div class="editor-block-order-actions">
          <button type="button" class="btn-blk-up mono" data-bidx="${bIdx}" ${bIdx === 0 ? 'disabled' : ''} title="위로 이동">[&uarr; Up]</button>
          <button type="button" class="btn-blk-down mono" data-bidx="${bIdx}" ${bIdx === totalBlocks - 1 ? 'disabled' : ''} title="아래로 이동">[&darr; Down]</button>
          <button type="button" class="btn-blk-del text-danger mono" data-bidx="${bIdx}" title="블록 삭제">[Delete]</button>
        </div>
      </div>
      ${innerHtml}
    </div>
  `;
}

/**
 * Bind In-Situ Editor Events
 */
function bindEditorEvents(container) {
  // Sync top fields into draft
  const syncDraftMeta = () => {
    if (!editDraft) return;
    editDraft.title = (document.getElementById('draft-title')?.value || '').trim();
    editDraft.date = (document.getElementById('draft-date')?.value || '').trim();
    editDraft.location = (document.getElementById('draft-location')?.value || '').trim();
    editDraft.relatedObjectId = (document.getElementById('draft-related-obj')?.value || '').trim();
    editDraft.intro = (document.getElementById('draft-intro')?.value || '').trim();
  };

  // Sync block values into draft
  const syncBlocks = () => {
    if (!editDraft || !editDraft.blocks) return;
    container.querySelectorAll('.editor-block-textarea').forEach(ta => {
      const idx = parseInt(ta.getAttribute('data-bidx'), 10);
      if (editDraft.blocks[idx]) editDraft.blocks[idx].text = ta.value;
    });
    container.querySelectorAll('.block-url-input').forEach(inp => {
      const idx = parseInt(inp.getAttribute('data-bidx'), 10);
      if (editDraft.blocks[idx]) {
        const val = inp.value.trim();
        editDraft.blocks[idx].image = val ? resolvePath(val) : '';
      }
    });
    container.querySelectorAll('.block-caption-input').forEach(inp => {
      const idx = parseInt(inp.getAttribute('data-bidx'), 10);
      if (editDraft.blocks[idx]) editDraft.blocks[idx].caption = inp.value.trim();
    });
  };

  // Save buttons
  const handleSave = () => {
    syncDraftMeta();
    syncBlocks();
    if (!editDraft.title) {
      alert('현장 조사 제목을 입력해 주세요.');
      document.getElementById('draft-title')?.focus();
      return;
    }

    const saved = window.app.saveResearch(editDraft);
    editingResearchId = null;
    editDraft = null;
    renderFieldResearchView();
  };

  document.getElementById('btn-save-res-edit')?.addEventListener('click', handleSave);
  document.getElementById('btn-save-res-edit-bottom')?.addEventListener('click', handleSave);

  // Cancel buttons
  const handleCancel = () => {
    editingResearchId = null;
    editDraft = null;
    renderFieldResearchView();
  };

  document.getElementById('btn-cancel-res-edit')?.addEventListener('click', handleCancel);
  document.getElementById('btn-cancel-res-edit-bottom')?.addEventListener('click', handleCancel);

  // Add block buttons
  document.getElementById('btn-add-text-block')?.addEventListener('click', () => {
    syncDraftMeta();
    syncBlocks();
    editDraft.blocks.push({
      id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'text',
      text: ''
    });
    renderFieldResearchView();
  });

  document.getElementById('btn-add-img-block')?.addEventListener('click', () => {
    syncDraftMeta();
    syncBlocks();
    editDraft.blocks.push({
      id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'image',
      image: './assets/images/obj-001-1.svg'
    });
    renderFieldResearchView();
  });

  document.getElementById('btn-add-imgcap-block')?.addEventListener('click', () => {
    syncDraftMeta();
    syncBlocks();
    editDraft.blocks.push({
      id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'image-caption',
      image: './assets/images/obj-001-1.svg',
      caption: ''
    });
    renderFieldResearchView();
  });

  // Reorder & Delete Block buttons
  container.querySelectorAll('.btn-blk-up').forEach(btn => {
    btn.addEventListener('click', () => {
      syncDraftMeta();
      syncBlocks();
      const idx = parseInt(btn.getAttribute('data-bidx'), 10);
      if (idx > 0) {
        const tmp = editDraft.blocks[idx];
        editDraft.blocks[idx] = editDraft.blocks[idx - 1];
        editDraft.blocks[idx - 1] = tmp;
        renderFieldResearchView();
      }
    });
  });

  container.querySelectorAll('.btn-blk-down').forEach(btn => {
    btn.addEventListener('click', () => {
      syncDraftMeta();
      syncBlocks();
      const idx = parseInt(btn.getAttribute('data-bidx'), 10);
      if (idx < editDraft.blocks.length - 1) {
        const tmp = editDraft.blocks[idx];
        editDraft.blocks[idx] = editDraft.blocks[idx + 1];
        editDraft.blocks[idx + 1] = tmp;
        renderFieldResearchView();
      }
    });
  });

  container.querySelectorAll('.btn-blk-del').forEach(btn => {
    btn.addEventListener('click', () => {
      syncDraftMeta();
      syncBlocks();
      const idx = parseInt(btn.getAttribute('data-bidx'), 10);
      if (confirm('이 블록을 삭제하시겠습니까?')) {
        editDraft.blocks.splice(idx, 1);
        renderFieldResearchView();
      }
    });
  });

  // File Upload with compression for image blocks
  container.querySelectorAll('.block-file-input').forEach(fileInp => {
    fileInp.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const bIdx = parseInt(fileInp.getAttribute('data-bidx'), 10);
      try {
        const compressed = await window.app.compressImageFile(file);
        syncDraftMeta();
        syncBlocks();
        if (editDraft.blocks[bIdx]) {
          editDraft.blocks[bIdx].image = compressed;
        }
        renderFieldResearchView();
      } catch (err) {
        console.error('Image compression failed:', err);
      }
    });
  });

  // URL input preview update
  container.querySelectorAll('.block-url-input').forEach(urlInp => {
    urlInp.addEventListener('input', () => {
      const bIdx = parseInt(urlInp.getAttribute('data-bidx'), 10);
      const prevImg = document.getElementById(`preview-img-${bIdx}`);
      if (prevImg) prevImg.src = resolvePath(urlInp.value.trim());
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
