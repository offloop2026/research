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

const resolvePath = (url) => (window.resolveImagePath ? window.resolveImagePath(url) : (url && url.startsWith('/') ? '.' + url : (url && !url.startsWith('./') && !url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:') ? './' + url : (url || './assets/images/obj-001-1.svg'))));

let editingResearchId = null;
let editDraft = null;

function isCmsEditMode() {
  try {
    return localStorage.getItem('archive_cms_edit_mode') === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Process uploaded files into blocks with Blobs saved in IndexedDB
 */
async function processFilesToBlocks(files) {
  const blocks = [];
  const idb = (typeof window !== 'undefined' && window.idbStorage) ? window.idbStorage : null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name);
    let mediaUrl = '';
    let mediaId = null;

    if (idb && idb.isSupported) {
      try {
        const saved = await idb.saveMediaBlob(file);
        mediaId = saved.id;
        mediaUrl = saved.url;
      } catch (err) {
        console.warn('[Field Research] saveMediaBlob failed, using object URL:', err);
        mediaUrl = URL.createObjectURL(file);
      }
    } else {
      mediaUrl = URL.createObjectURL(file);
    }

    if (isVideo) {
      blocks.push({
        id: `blk-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'video',
        video: mediaUrl,
        mediaUrl: mediaUrl,
        mediaId: mediaId,
        _file: file,
        caption: ''
      });
    } else {
      blocks.push({
        id: `blk-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'image',
        image: mediaUrl,
        mediaUrl: mediaUrl,
        mediaId: mediaId,
        _file: file
      });
    }
  }
  return blocks;
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
          <button type="button" class="col-header-edit-badge mono" id="btn-fr-quick-upload-photo" title="사진·동영상 파일 다중 선택 및 즉시 등록" style="background:#000; color:#FFF; font-weight:bold;">
            [📷/🎥 + 미디어 등록]
          </button>
          <input type="file" id="fr-global-photo-input" accept="image/*,video/*" multiple style="display:none;" />
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
        <div style="display:flex; gap:10px; justify-content:center; margin-top:16px;">
          <button type="button" class="band-text-action mono" id="btn-empty-upload-photos" style="font-weight:bold;">📷/🎥 미디어 바로 등록 (다중 선택)</button>
          ${editActive ? `
            <button type="button" class="band-text-action mono" id="btn-empty-add-res">+ 새 현장 조사 작성</button>
          ` : ''}
        </div>
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

  // Global Quick Media Upload Handler (supports multiple photos & videos, zero text required)
  const handleGlobalPhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      const newBlocks = await processFilesToBlocks(files);

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;

      // If editor is active, append directly to blocks
      if (editingResearchId && editDraft) {
        syncDraftMeta();
        syncBlocks();
        editDraft.blocks.push(...newBlocks);
        renderFieldResearchView();
        return;
      }

      // If not editing, create a new research entry containing all media immediately
      const currentList = (window.app && typeof window.app.getResearchList === 'function')
        ? window.app.getResearchList()
        : [];

      const newEntry = {
        id: `res-${Date.now()}`,
        numStr: String(currentList.length + 1).padStart(2, '0'),
        title: `현장 사진 기록 (${todayStr})`,
        date: todayStr,
        location: '',
        relatedObjectId: '',
        intro: '',
        blocks: newBlocks
      };

      const saved = await window.app.saveResearch(newEntry);
      if (window.triggerSourceSave) {
        window.triggerSourceSave({ silent: true });
      }

      renderFieldResearchView();

      setTimeout(() => {
        const el = document.getElementById(saved.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error('[Field Research] Photo registration failed:', err);
      if (window.showSaveToast) {
        window.showSaveToast('⚠️ 등록 실패: ' + err.message, true);
      }
      alert('사진 등록 처리 중 오류가 발생했습니다: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  const triggerGlobalPhotoUpload = () => {
    const fileInp = document.getElementById('fr-global-photo-input');
    if (fileInp) fileInp.click();
  };

  document.getElementById('btn-fr-quick-upload-photo')?.addEventListener('click', triggerGlobalPhotoUpload);
  document.getElementById('btn-empty-upload-photos')?.addEventListener('click', triggerGlobalPhotoUpload);
  document.getElementById('fr-global-photo-input')?.addEventListener('change', handleGlobalPhotoSelect);

  const handleAddResearch = () => {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;

    const newEntry = {
      id: `res-${Date.now()}`,
      numStr: String(researchList.length + 1).padStart(2, '0'),
      title: `현장 사진 기록 (${todayStr})`,
      date: todayStr,
      location: '',
      relatedObjectId: '',
      intro: '',
      blocks: [
        {
          id: `blk-${Date.now()}-1`,
          type: 'image',
          image: './assets/images/obj-001-1.svg'
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

  // Click on any photo to view in lightbox
  container.querySelectorAll('.research-journal-article .editorial-framed-img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.app && typeof window.app.openLightbox === 'function') {
        window.app.openLightbox([img.src], 0);
      }
    });
  });

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
 * Render individual content block (Text, Image, Image+Caption, Video, Video+Caption)
 */
function renderContentBlock(blk) {
  if (blk.type === 'text') {
    const formatted = escapeHtml(blk.text || '')
      .split('\n\n')
      .map(p => `<p class="research-text-p">${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
    return `<div class="research-block research-block-text">${formatted}</div>`;
  }

  if (blk.type === 'video' || blk.type === 'video-caption') {
    const src = resolvePath(blk.video || blk.mediaUrl || blk.image);
    return `
      <div class="research-block research-block-video">
        <div class="editorial-frame-outer">
          <div class="editorial-frame-border">
            <div class="editorial-frame-inner" style="background:#000;">
              <video src="${src}" controls playsinline preload="metadata" class="editorial-framed-video" style="width:100%; display:block; max-height:640px; background:#000;"></video>
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

  if (blk.type === 'image') {
    const src = resolvePath(blk.image || blk.mediaUrl);
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
    const src = resolvePath(blk.image || blk.mediaUrl);
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
          <button type="button" class="btn-add-block" id="btn-add-img-block">[+ Add Image Block]</button>
          <button type="button" class="btn-add-block" id="btn-add-imgcap-block">[+ Add Image + Caption]</button>
          <button type="button" class="btn-add-block" id="btn-add-video-block">[+ Add Video Block]</button>
          <button type="button" class="btn-add-block" id="btn-editor-upload-multi-photos" style="font-weight:bold; color:#000; background:#FAFAFA; border:1px solid #000;">[📷/🎥 미디어 다중 추가 (사진·동영상)]</button>
          <input type="file" id="editor-multi-photo-input" accept="image/*,video/*" multiple style="display:none;" />
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
  } else if (blk.type === 'video' || blk.type === 'video-caption') {
    const src = resolvePath(blk.video || blk.mediaUrl || blk.image);
    innerHtml = `
      <div class="block-field-body">
        <div class="block-image-edit-wrap">
          <div class="block-image-preview-box" style="background:#000; min-height:120px; display:flex; align-items:center; justify-content:center;">
            <video src="${src}" controls class="block-video-preview" id="preview-video-${bIdx}" style="max-width:100%; max-height:160px;"></video>
          </div>
          <div class="block-image-inputs">
            <label class="mono" style="font-size:11px; display:block; margin-bottom:4px; font-weight:bold;">동영상/사진 파일 업로드:</label>
            <input type="file" accept="video/*,image/*" multiple class="block-file-input mono" data-bidx="${bIdx}" />
            <label class="mono" style="font-size:11px; display:block; margin:6px 0 4px 0;">Or Video URL / Path:</label>
            <input type="text" class="block-url-input mono" data-bidx="${bIdx}" value="${escapeHtml(blk.video || blk.mediaUrl || '')}" placeholder="https://... or ./assets/videos/..." />
          </div>
        </div>
        <div style="margin-top:8px;">
          <label class="mono" style="font-size:11px; display:block; margin-bottom:4px;">Caption (선택):</label>
          <input type="text" class="block-caption-input" data-bidx="${bIdx}" value="${escapeHtml(blk.caption || '')}" placeholder="동영상에 대한 설명 또는 캡션..." />
        </div>
      </div>
    `;
  } else if (blk.type === 'image' || blk.type === 'image-caption') {
    const src = resolvePath(blk.image || blk.mediaUrl);
    innerHtml = `
      <div class="block-field-body">
        <div class="block-image-edit-wrap">
          <div class="block-image-preview-box">
            <img src="${src}" class="block-img-preview" id="preview-img-${bIdx}" onerror="if(!this.dataset.failed){this.dataset.failed='1';this.src='./assets/images/obj-001-1.svg';}" />
          </div>
          <div class="block-image-inputs">
            <label class="mono" style="font-size:11px; display:block; margin-bottom:4px; font-weight:bold;">사진/동영상 파일 업로드 (다중 선택 가능):</label>
            <input type="file" accept="image/*,video/*" multiple class="block-file-input mono" data-bidx="${bIdx}" />
            <label class="mono" style="font-size:11px; display:block; margin:6px 0 4px 0;">Or Image URL / Path:</label>
            <input type="text" class="block-url-input mono" data-bidx="${bIdx}" value="${escapeHtml(blk.image || blk.mediaUrl || '')}" placeholder="./assets/images/... or https://..." />
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
        if (editDraft.blocks[idx].type === 'video' || editDraft.blocks[idx].type === 'video-caption') {
          editDraft.blocks[idx].video = val ? resolvePath(val) : '';
          editDraft.blocks[idx].mediaUrl = editDraft.blocks[idx].video;
        } else {
          editDraft.blocks[idx].image = val ? resolvePath(val) : '';
          editDraft.blocks[idx].mediaUrl = editDraft.blocks[idx].image;
        }
      }
    });
    container.querySelectorAll('.block-caption-input').forEach(inp => {
      const idx = parseInt(inp.getAttribute('data-bidx'), 10);
      if (editDraft.blocks[idx]) editDraft.blocks[idx].caption = inp.value.trim();
    });
  };

  // Save buttons (allows photo/video only saving without mandatory title or text)
  const handleSave = async () => {
    syncDraftMeta();
    syncBlocks();

    // Relaxed validation: default title if user provides only media
    if (!editDraft.title) {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
      editDraft.title = `현장 사진 기록 (${editDraft.date || todayStr})`;
    }

    const saveBtns = [
      document.getElementById('btn-save-res-edit'),
      document.getElementById('btn-save-res-edit-bottom')
    ].filter(Boolean);

    saveBtns.forEach(btn => {
      btn.innerText = '[⏳ 저장 중...]';
      btn.disabled = true;
    });

    try {
      const saved = await window.app.saveResearch(editDraft);
      console.log('[Field Research] Successfully saved:', saved.id);

      if (window.showSaveToast) {
        window.showSaveToast('✓ 정상적으로 저장되었습니다.');
      }

      editingResearchId = null;
      editDraft = null;
      renderFieldResearchView();

      if (window.triggerSourceSave) {
        window.triggerSourceSave({ silent: true });
      }
    } catch (err) {
      console.error('[Field Research] Save error:', err);
      if (window.showSaveToast) {
        window.showSaveToast('⚠️ 저장 실패: ' + err.message, true);
      }
      alert('저장 중 오류가 발생했습니다: ' + err.message);
      saveBtns.forEach(btn => {
        btn.innerText = '[저장 (Save)]';
        btn.disabled = false;
      });
    }
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

  document.getElementById('btn-add-video-block')?.addEventListener('click', () => {
    syncDraftMeta();
    syncBlocks();
    editDraft.blocks.push({
      id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'video',
      video: '',
      mediaUrl: '',
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

  // File Upload with multi-media support for image/video blocks
  container.querySelectorAll('.block-file-input').forEach(fileInp => {
    fileInp.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const bIdx = parseInt(fileInp.getAttribute('data-bidx'), 10);

      syncDraftMeta();
      syncBlocks();

      try {
        const newBlocks = await processFilesToBlocks(files);
        if (newBlocks.length > 0) {
          // Replace current block with first uploaded item
          editDraft.blocks[bIdx] = newBlocks[0];

          // If multiple files selected, splice remaining blocks right after bIdx
          if (newBlocks.length > 1) {
            editDraft.blocks.splice(bIdx + 1, 0, ...newBlocks.slice(1));
          }
        }

        renderFieldResearchView();
      } catch (err) {
        console.error('[Field Research] File upload failed:', err);
        if (window.showSaveToast) {
          window.showSaveToast('⚠️ 파일 업로드 실패: ' + err.message, true);
        }
        alert('미디어 파일 업로드 실패: ' + err.message);
      }
    });
  });

  // Editor toolbar multi-media upload button
  document.getElementById('btn-editor-upload-multi-photos')?.addEventListener('click', () => {
    document.getElementById('editor-multi-photo-input')?.click();
  });

  document.getElementById('editor-multi-photo-input')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    syncDraftMeta();
    syncBlocks();

    try {
      const newBlocks = await processFilesToBlocks(files);
      editDraft.blocks.push(...newBlocks);
      renderFieldResearchView();
    } catch (err) {
      console.error('[Field Research] Editor multi-media upload failed:', err);
      if (window.showSaveToast) {
        window.showSaveToast('⚠️ 다중 업로드 실패: ' + err.message, true);
      }
      alert('다중 미디어 업로드 실패: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });

  // URL input preview update
  container.querySelectorAll('.block-url-input').forEach(urlInp => {
    urlInp.addEventListener('input', () => {
      const bIdx = parseInt(urlInp.getAttribute('data-bidx'), 10);
      const val = resolvePath(urlInp.value.trim());
      const prevImg = document.getElementById(`preview-img-${bIdx}`);
      if (prevImg) prevImg.src = val;
      const prevVid = document.getElementById(`preview-video-${bIdx}`);
      if (prevVid) prevVid.src = val;
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
