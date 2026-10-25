/**
 * Universal Persistence Helper (save-helper.js)
 * Guarantees that the [💾 Save] button is always visible in the top-right
 * across ALL pages and handles instant saving to data/archive.json with toast feedback.
 */

(function() {
  window.triggerSourceSave = async function(options = {}) {
    const silent = options.silent || false;
    const saveBtn = document.getElementById('global-floating-save-btn');
    if (saveBtn) {
      saveBtn.classList.add('is-saving');
      saveBtn.innerHTML = '<span>⏳</span><span>Saving...</span>';
    }

    try {
      let objects = [];
      let memos = [];
      let fieldResearch = [];
      let memoPositions = {};
      let memoConnections = [];
      let deletedObjectIds = [];
      let deletedMemoIds = [];

      // Prefer window.app if ready
      if (window.app && typeof window.app.getObjects === 'function' && window.app.isReady) {
        objects = window.app.getObjects();
        memos = window.app.getMemos();
        fieldResearch = (typeof window.app.getResearchList === 'function') ? window.app.getResearchList() : [];
        deletedObjectIds = window.app.deletedObjectIds || [];
        deletedMemoIds = window.app.deletedMemoIds || [];
      } else {
        // Fallback directly to localStorage
        try {
          const rawCustom = localStorage.getItem('archive_user_custom_v3');
          if (rawCustom) {
            const parsed = JSON.parse(rawCustom);
            objects = parsed.objects || [];
            memos = parsed.memos || [];
            deletedObjectIds = parsed.deletedObjectIds || [];
            deletedMemoIds = parsed.deletedMemoIds || [];
          }
        } catch(e){}
        try {
          const rawFr = localStorage.getItem('archive_field_research_v1');
          if (rawFr) fieldResearch = JSON.parse(rawFr);
        } catch(e){}
      }

      try {
        memoPositions = JSON.parse(localStorage.getItem('archive_memo_positions_v1') || '{}');
      } catch(e){}
      try {
        memoConnections = JSON.parse(localStorage.getItem('archive_memo_connections_v1') || '[]');
      } catch(e){}

      const payload = {
        objects,
        memos,
        fieldResearch,
        memoPositions,
        memoConnections,
        deletedObjectIds,
        deletedMemoIds
      };

      const res = await fetch('/api/save-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      console.log('[Save] Successfully saved to data/archive.json:', data);

      if (saveBtn) {
        saveBtn.classList.remove('is-saving');
        saveBtn.innerHTML = '<span>✓</span><span>Saved!</span>';
        setTimeout(() => {
          saveBtn.innerHTML = '<span>💾</span><span>Save</span>';
        }, 2500);
      }

      if (!silent) {
        showSaveToast(`💾 소스 파일(data/archive.json)에 성공적으로 저장되었습니다! (사물 ${payload.objects.length}개, 메모 ${payload.memos.length}개)`);
      }

      return data;
    } catch(err) {
      console.error('[Save] Save failed:', err);
      if (saveBtn) {
        saveBtn.classList.remove('is-saving');
        saveBtn.innerHTML = '<span>⚠️</span><span>Error</span>';
        setTimeout(() => {
          saveBtn.innerHTML = '<span>💾</span><span>Save</span>';
        }, 3000);
      }
      if (!silent) {
        showSaveToast(`⚠️ 소스 파일 저장 실패: ${err.message}`, true);
      }
    }
  };

  function showSaveToast(msg, isError = false) {
    let toast = document.getElementById('archive-save-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'archive-save-toast';
      toast.className = 'archive-save-toast';
      document.body.appendChild(toast);
    }

    toast.className = `archive-save-toast ${isError ? 'is-error' : ''}`;
    toast.textContent = msg;

    // Direct inline styles to eliminate any CSS cascade or caching issues
    toast.style.position = 'fixed';
    toast.style.top = '36px';
    toast.style.right = '24px';
    toast.style.background = '#111111';
    toast.style.color = '#FFFFFF';
    toast.style.padding = '12px 20px';
    toast.style.fontSize = '13px';
    toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    toast.style.borderLeft = isError ? '4px solid #dc3545' : '4px solid #28a745';
    toast.style.borderRadius = '3px';
    toast.style.boxShadow = '0 6px 24px rgba(0,0,0,0.4)';
    toast.style.zIndex = '2147483647';
    toast.style.pointerEvents = 'none';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.opacity = '1';
    toast.style.visibility = 'visible';
    toast.style.transform = 'translateY(0)';
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease, visibility 0.25s ease';

    toast.classList.add('show');

    if (window._saveToastTimer) clearTimeout(window._saveToastTimer);
    window._saveToastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toast.style.opacity = '0';
      toast.style.visibility = 'hidden';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (!toast.classList.contains('show')) {
          toast.style.display = 'none';
        }
      }, 300);
    }, 4500);
  }
  window.showSaveToast = showSaveToast;

  function cleanupLegacySaveButtons() {
    const oldBtnIds = ['btn-save-to-file', 'btn-col1-save-file', 'btn-photo-save-file', 'btn-fr-save-file', 'btn-memo-save-file'];
    oldBtnIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('.col-header-edit-badge.save-btn, .col-header-action-text.save-btn, .header-side-tools .save-btn').forEach(el => el.remove());
  }

  function injectSaveElements() {
    cleanupLegacySaveButtons();

    if (!document.getElementById('global-floating-save-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'global-floating-save-btn';
      btn.className = 'global-floating-save-btn mono';
      btn.title = '현재 아카이브 데이터를 소스 파일(data/archive.json)에 영구 저장';
      btn.innerHTML = '<span>💾</span><span>Save</span>';
      btn.onclick = () => window.triggerSourceSave();
      document.body.appendChild(btn);
    }

    if (!document.getElementById('archive-save-toast')) {
      const toast = document.createElement('div');
      toast.id = 'archive-save-toast';
      toast.className = 'archive-save-toast';
      document.body.appendChild(toast);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectSaveElements();
      // Auto-sync in background on page load
      setTimeout(() => window.triggerSourceSave({ silent: true }), 300);
    });
  } else {
    injectSaveElements();
    setTimeout(() => window.triggerSourceSave({ silent: true }), 300);
  }
})();
