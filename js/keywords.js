/**
 * KEYWORD ANNOTATION MODULE (keywords.js)
 * Inspired by SeMA Coral's archival text annotation system:
 * - Annotate specific words directly inside memo sentences
 * - Preserves raw text without data corruption
 * - Groups records sharing the same normalized keyword
 * - Displays in-place Keyword Relationship Drawer (sliding overlay)
 * - Navigation: Keyword → Sentence → Source Memo → Connected Object
 * - Storage Key: 'archive_keywords_v1'
 */

const KEYWORDS_STORAGE_KEY = 'archive_keywords_v1';

class KeywordService {
  constructor() {
    this.annotations = [];
    this.floatingPill = null;
    this.promptPopover = null;
    this.drawerEl = null;
    this.currentSelectionData = null;

    this.init();
  }

  init() {
    this.loadAnnotations();
    this.createFloatingPill();
    this.createPromptPopover();
    this.createRelationshipDrawer();
    this.bindGlobalSelectionEvents();
  }

  loadAnnotations() {
    try {
      const raw = localStorage.getItem(KEYWORDS_STORAGE_KEY);
      if (raw) {
        this.annotations = JSON.parse(raw);
      } else {
        // Seed initial sample annotations so the relationship feature is immediately apparent
        this.annotations = [
          {
            id: 'kw-seed-001',
            memoId: 'memo-001',
            text: '회전축',
            normalized: '회전축',
            sentence: '회전축 세 번째 톱니 표면에 미세한 마모선이 남아있다.'
          },
          {
            id: 'kw-seed-002',
            memoId: 'memo-002',
            text: '스프링',
            normalized: '스프링',
            sentence: '나선형 강철 스프링을 분리하자 직경이 22mm에서 64mm로 팽창했다.'
          }
        ];
        this.saveAnnotations();
      }
    } catch (e) {
      console.warn('[Keywords] Storage error:', e);
      this.annotations = [];
    }
  }

  saveAnnotations() {
    try {
      localStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(this.annotations));
      window.dispatchEvent(new CustomEvent('keywords-updated'));
    } catch (e) {
      console.warn('[Keywords] Save error:', e);
    }
  }

  getAnnotationsForMemo(memoId) {
    return this.annotations.filter(a => a.memoId === memoId);
  }

  getAnnotationsByNormalized(normalized) {
    return this.annotations.filter(a => a.normalized === normalized);
  }

  getAllUniqueKeywords() {
    const set = new Set();
    this.annotations.forEach(a => {
      if (a.normalized) set.add(a.normalized);
    });
    return Array.from(set);
  }

  addAnnotation(arg1, arg2, arg3, arg4) {
    let memoId, text, normalized, sentence;
    if (typeof arg1 === 'object' && arg1 !== null) {
      memoId = arg1.memoId;
      text = arg1.text;
      normalized = arg1.normalized;
      sentence = arg1.sentence;
    } else {
      memoId = arg1;
      text = arg2;
      normalized = arg3;
      sentence = arg4;
    }
    if (!memoId || !text) return null;
    const cleanNorm = String(normalized || text).trim();

    // Check duplicate annotation on same memo and text
    const exists = this.annotations.find(a =>
      a.memoId === memoId && a.text === text && a.normalized === cleanNorm
    );
    if (exists) return exists;

    const newAnn = {
      id: `kw-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      memoId,
      text: String(text).trim(),
      normalized: cleanNorm,
      sentence: String(sentence || text).trim()
    };

    this.annotations.push(newAnn);
    this.saveAnnotations();
    return newAnn;
  }

  removeAnnotation(annotationId) {
    this.annotations = this.annotations.filter(a => a.id !== annotationId);
    this.saveAnnotations();
  }

  deleteMemoAnnotations(memoId) {
    this.annotations = this.annotations.filter(a => a.memoId !== memoId);
    this.saveAnnotations();
  }

  renameKeyword(oldNorm, newNorm) {
    if (!oldNorm || !newNorm) return;
    const cleanNew = newNorm.trim();
    if (!cleanNew) return;
    let changed = false;
    this.annotations.forEach(a => {
      if (a.normalized === oldNorm) {
        a.normalized = cleanNew;
        changed = true;
      }
    });
    if (changed) {
      this.saveAnnotations();
    }
  }

  removeKeyword(norm) {
    if (!norm) return;
    this.annotations = this.annotations.filter(a => a.normalized !== norm);
    this.saveAnnotations();
  }

  /**
   * Validate annotations when memo content is edited
   * Ensures nonexistent text never carries stale keyword highlights
   */
  validateMemoAnnotations(memoId, updatedContent) {
    const existing = this.getAnnotationsForMemo(memoId);
    let changed = false;

    existing.forEach(ann => {
      if (!updatedContent.includes(ann.text)) {
        // Text was removed, prune annotation
        this.annotations = this.annotations.filter(a => a.id !== ann.id);
        changed = true;
      } else {
        // Update sentence excerpt
        const sentence = this.extractSentence(updatedContent, ann.text);
        if (sentence && sentence !== ann.sentence) {
          ann.sentence = sentence;
          changed = true;
        }
      }
    });

    if (changed) {
      this.saveAnnotations();
    }
  }

  extractSentence(fullText, phrase) {
    if (!fullText || !phrase) return '';
    // Find sentence containing phrase
    const sentences = fullText.split(/[\n.!?]+/);
    for (const s of sentences) {
      if (s.includes(phrase)) {
        return s.trim();
      }
    }
    return phrase;
  }

  /**
   * Render annotated text with quiet, delicate underline spans
   * Leaves raw text unchanged in storage
   */
  renderAnnotatedHtml(memoId, rawContent) {
    if (!rawContent) return '';
    const memoAnnotations = this.getAnnotationsForMemo(memoId);

    if (!memoAnnotations.length) {
      return this.escapeHtml(rawContent);
    }

    // Sort annotations by length descending so longer phrases match first
    const sorted = [...memoAnnotations].sort((a, b) => b.text.length - a.text.length);

    let html = this.escapeHtml(rawContent);

    sorted.forEach(ann => {
      const escapedText = this.escapeHtml(ann.text);
      // Replace instances that haven't been wrapped yet
      const regex = new RegExp(`(?<!<[^>]*)${this.escapeRegex(escapedText)}(?![^<]*>)`, 'g');
      html = html.replace(regex, (match) => {
        return `<span class="archival-keyword-annotation" data-kw-id="${ann.id}" data-kw-norm="${this.escapeHtml(ann.normalized)}" title="키워드: ${this.escapeHtml(ann.normalized)} (클릭하여 관계 탐색)">${match}</span>`;
      });
    });

    return html;
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // -------------------------------------------------------------------------
  // Floating Action Pill: [+ 키워드]
  // -------------------------------------------------------------------------
  createFloatingPill() {
    this.floatingPill = document.createElement('div');
    this.floatingPill.id = 'kw-floating-action-pill';
    this.floatingPill.className = 'kw-floating-pill mono';
    this.floatingPill.style.display = 'none';
    this.floatingPill.innerHTML = `+ KEYWORD`;
    document.body.appendChild(this.floatingPill);

    this.floatingPill.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openPromptPopover();
    });
  }

  // -------------------------------------------------------------------------
  // Keyword Assignment Popover
  // -------------------------------------------------------------------------
  createPromptPopover() {
    this.promptPopover = document.createElement('div');
    this.promptPopover.id = 'kw-assign-popover';
    this.promptPopover.className = 'kw-assign-card mono';
    this.promptPopover.style.display = 'none';
    document.body.appendChild(this.promptPopover);
  }

  openPromptPopover() {
    if (!this.currentSelectionData) return;
    const { text, memoId, sentence, rect } = this.currentSelectionData;

    this.floatingPill.style.display = 'none';

    const existingKws = this.getAllUniqueKeywords();

    this.promptPopover.innerHTML = `
      <div class="kw-card-top">
        <span class="kw-card-label">키워드 지정</span>
        <button class="kw-card-close" id="kw-popover-close">&times;</button>
      </div>

      <div class="kw-card-body">
        <div class="kw-form-row">
          <label class="kw-form-label">단어: <strong style="color:#000;">"${this.escapeHtml(text)}"</strong></label>
        </div>

        <div class="kw-form-row">
          <label class="kw-form-label">키워드 명칭 (정규화):</label>
          <input type="text" id="kw-input-norm" class="kw-input" value="${this.escapeHtml(text)}" />
        </div>

        ${existingKws.length ? `
          <div class="kw-existing-row">
            <span class="kw-existing-label">기존 키워드 연결:</span>
            <div class="kw-chips-list">
              ${existingKws.map(kw => `
                <button type="button" class="kw-chip-btn ${kw === text ? 'active' : ''}" data-kw="${this.escapeHtml(kw)}">
                  ${this.escapeHtml(kw)}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="kw-card-actions">
          <button type="button" class="kw-btn-cancel" id="kw-popover-cancel">취소</button>
          <button type="button" class="kw-btn-confirm" id="kw-popover-confirm">지정</button>
        </div>
      </div>
    `;

    // Position popover near selection rect
    const top = Math.max(10, rect.bottom + window.scrollY + 8);
    const left = Math.max(10, Math.min(window.innerWidth - 300, rect.left + window.scrollX - 40));

    this.promptPopover.style.top = `${top}px`;
    this.promptPopover.style.left = `${left}px`;
    this.promptPopover.style.display = 'block';

    const normInput = document.getElementById('kw-input-norm');
    if (normInput) {
      normInput.focus();
      normInput.select();
    }

    // Existing keyword chip click
    this.promptPopover.querySelectorAll('.kw-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (normInput) normInput.value = btn.getAttribute('data-kw');
      });
    });

    document.getElementById('kw-popover-close').addEventListener('click', () => {
      this.promptPopover.style.display = 'none';
    });

    document.getElementById('kw-popover-cancel').addEventListener('click', () => {
      this.promptPopover.style.display = 'none';
    });

    document.getElementById('kw-popover-confirm').addEventListener('click', () => {
      const normVal = (normInput.value || text).trim();
      if (!normVal) return;

      this.addAnnotation({
        memoId,
        text,
        normalized: normVal,
        sentence
      });

      this.promptPopover.style.display = 'none';
      window.getSelection()?.removeAllRanges();

      // Trigger refresh of the current memo display
      if (typeof window.renderMemoBoard === 'function') {
        window.renderMemoBoard();
      }
      if (typeof window.renderArchiveView === 'function') {
        window.renderArchiveView();
      }
    });
  }

  // -------------------------------------------------------------------------
  // Text Selection Handling
  // -------------------------------------------------------------------------
  bindGlobalSelectionEvents() {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        if (this.floatingPill && !this.promptPopover.contains(document.activeElement)) {
          this.floatingPill.style.display = 'none';
        }
        return;
      }

      const text = sel.toString().trim();
      if (text.length < 1 || text.length > 35) {
        this.floatingPill.style.display = 'none';
        return;
      }

      // Check if selection is inside a memo body
      const range = sel.getRangeAt(0);
      let container = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }

      const slipContentEl = container.closest('.slip-content') || container.closest('.memo-record-body');
      if (!slipContentEl) {
        this.floatingPill.style.display = 'none';
        return;
      }

      // Find memo ID
      const memoSlip = slipContentEl.closest('.archival-memo-slip') || slipContentEl.closest('[data-memo-id]');
      const memoId = memoSlip ? memoSlip.getAttribute('data-id') || memoSlip.getAttribute('data-memo-id') : null;

      if (!memoId) {
        this.floatingPill.style.display = 'none';
        return;
      }

      const rect = range.getBoundingClientRect();
      const sentence = this.extractSentence(slipContentEl.textContent, text);

      this.currentSelectionData = {
        memoId,
        text,
        sentence,
        rect
      };

      // Show floating pill right above selection
      const pillTop = Math.max(10, rect.top + window.scrollY - 30);
      const pillLeft = Math.max(10, rect.left + window.scrollX + (rect.width / 2) - 45);

      this.floatingPill.style.top = `${pillTop}px`;
      this.floatingPill.style.left = `${pillLeft}px`;
      this.floatingPill.style.display = 'flex';
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);

    // Global click listener for annotated keyword spans
    document.addEventListener('click', (e) => {
      const kwSpan = e.target.closest('.archival-keyword-annotation');
      if (kwSpan) {
        e.stopPropagation();
        e.preventDefault();
        const norm = kwSpan.getAttribute('data-kw-norm');
        if (norm) {
          this.openRelationshipDrawer(norm);
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Keyword Relationship Drawer (SeMA Coral Inspired)
  // -------------------------------------------------------------------------
  createRelationshipDrawer() {
    this.drawerEl = document.createElement('aside');
    this.drawerEl.id = 'kw-relationship-drawer';
    this.drawerEl.className = 'kw-drawer-panel';
    this.drawerEl.style.display = 'none';
    document.body.appendChild(this.drawerEl);
  }

  openRelationshipDrawer(normalizedKeyword) {
    const matches = this.getAnnotationsByNormalized(normalizedKeyword);
    const uniqueObjects = new Set();

    const entriesHtml = matches.map(ann => {
      const memo = window.app ? window.app.getMemoById(ann.memoId) : null;
      const obj = memo && window.app ? window.app.getObjectById(memo.objectId) : null;
      if (obj) uniqueObjects.add(obj.id);

      const objTitle = obj ? obj.title : '사물';
      const memoTitle = memo ? memo.title : '기록';
      const memoTime = memo ? memo.timestamp : '';

      // Highlight keyword in sentence excerpt
      const sentenceExcerpt = ann.sentence || ann.text;
      const highlightedSentence = this.escapeHtml(sentenceExcerpt).replace(
        new RegExp(this.escapeRegex(this.escapeHtml(ann.text)), 'g'),
        match => `<mark class="kw-sentence-highlight">${match}</mark>`
      );

      return `
        <article class="kw-drawer-entry" data-memo-id="${ann.memoId}">
          <div class="kw-entry-meta mono">
            <span class="kw-entry-time">${memoTime}</span>
            ${obj ? `
              <a href="index.html?id=${obj.id}" class="kw-entry-obj-link">&rarr; ${this.escapeHtml(objTitle)}</a>
            ` : ''}
          </div>

          <h3 class="kw-entry-title">
            <a href="memo.html?id=${ann.memoId}" class="kw-entry-title-link">${this.escapeHtml(memoTitle)}</a>
          </h3>

          <div class="kw-entry-quote">
            &ldquo;${highlightedSentence}&rdquo;
          </div>

          <div class="kw-entry-footer mono">
            <a href="memo.html?id=${ann.memoId}" class="kw-entry-jump-link">원본 메모 보기 &rarr;</a>
            <button type="button" class="kw-btn-unlink mono" data-ann-id="${ann.id}" title="이 문장에서 키워드 해제">키워드 해제</button>
          </div>
        </article>
      `;
    }).join('');

    this.drawerEl.innerHTML = `
      <div class="kw-drawer-inner">
        <div class="kw-drawer-header">
          <div class="kw-header-left">
            <span class="kw-header-badge mono">KEYWORD RELATION</span>
            <h2 class="kw-header-title">${this.escapeHtml(normalizedKeyword)}</h2>
            <div class="kw-header-stats mono">
              <span>기록 ${matches.length}건</span>
              <span>&middot;</span>
              <span>연결 사물 ${uniqueObjects.size}점</span>
            </div>
          </div>
          <button class="kw-drawer-close mono" id="kw-drawer-close-btn" title="닫기">&times;</button>
        </div>

        <div class="kw-drawer-stream">
          ${entriesHtml || '<div class="mono text-caption" style="padding: 40px 0; color: #888;">연결된 기록이 없습니다.</div>'}
        </div>
      </div>
    `;

    this.drawerEl.style.display = 'block';
    setTimeout(() => this.drawerEl.classList.add('is-open'), 10);

    // Bind Close
    document.getElementById('kw-drawer-close-btn').addEventListener('click', () => {
      this.closeRelationshipDrawer();
    });

    // Bind Unlink Buttons
    this.drawerEl.querySelectorAll('.kw-btn-unlink').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const annId = btn.getAttribute('data-ann-id');
        if (confirm(`'${normalizedKeyword}' 키워드 지정을 해제하시겠습니까? (원문 텍스트는 보존됩니다)`)) {
          this.removeAnnotation(annId);
          // Re-open drawer or close if empty
          const remaining = this.getAnnotationsByNormalized(normalizedKeyword);
          if (remaining.length) {
            this.openRelationshipDrawer(normalizedKeyword);
          } else {
            this.closeRelationshipDrawer();
          }

          // Refresh underlying view
          if (typeof window.renderMemoBoard === 'function') window.renderMemoBoard();
          if (typeof window.renderArchiveView === 'function') window.renderArchiveView();
        }
      });
    });
  }

  closeRelationshipDrawer() {
    this.drawerEl.classList.remove('is-open');
    setTimeout(() => {
      this.drawerEl.style.display = 'none';
    }, 200);
  }
}

window.keywordService = new KeywordService();
