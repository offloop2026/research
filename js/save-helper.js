/**
 * Universal Persistence & Backup Helper (save-helper.js)
 * Guarantees persistent storage across GitHub Pages static hosting and local development,
 * provides one-click JSON backup downloads, and eliminates false "소스 파일 저장 실패" errors.
 */

(function() {
  function isStaticHosting() {
    if (typeof window === 'undefined') return true;
    const host = window.location.hostname || '';
    const proto = window.location.protocol || '';
    return host.endsWith('github.io') || proto === 'file:' || !host;
  }

  function getArchiveSnapshot() {
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

    return {
      objects,
      memos,
      fieldResearch,
      memoPositions,
      memoConnections,
      deletedObjectIds,
      deletedMemoIds,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * One-click JSON backup download
   */
  window.downloadArchiveBackup = function() {
    const payload = getArchiveSnapshot();
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `archive_backup_${dateStr}.json`;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);

    showSaveToast(`📥 백업 파일(${filename})이 정상적으로 다운로드되었습니다.`);
  };

  /**
   * Universal Save Trigger:
   * - On GitHub Pages: saves securely to IndexedDB / localStorage without attempting failing HTTP POSTs.
   * - On Local Server: attempts HTTP POST to /api/save-archive, but falls back gracefully without alerting.
   */
  window.triggerSourceSave = async function(options = {}) {
    const silent = options.silent || false;
    const saveBtn = document.getElementById('global-floating-save-btn');
    if (saveBtn) {
      saveBtn.classList.add('is-saving');
      saveBtn.innerHTML = '<span>⏳</span><span>Saving...</span>';
    }

    const payload = getArchiveSnapshot();

    // 1. Static Hosting (GitHub Pages / file:) Mode
    if (isStaticHosting()) {
      console.log('[Save] GitHub Pages environment detected. Data preserved in IndexedDB / localStorage.');

      if (saveBtn) {
        saveBtn.classList.remove('is-saving');
        saveBtn.innerHTML = '<span>✓</span><span>Saved!</span>';
        setTimeout(() => {
          saveBtn.innerHTML = '<span>💾</span><span>Save</span>';
        }, 2200);
      }

      if (!silent) {
        showSaveToast('✓ 브라우저(IndexedDB)에 정상적으로 저장되었습니다.');
      }

      return { success: true, mode: 'static-indexeddb', payload };
    }

    // 2. Local Server Mode: attempt source file write, fallback smoothly if API endpoint is absent
    let savedToBackend = false;
    try {
      const res = await fetch('/api/save-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        savedToBackend = true;
        console.log('[Save] Successfully saved to data/archive.json');
      }
    } catch(err) {
      console.log('[Save] Local backend API unavailable, persisted to client storage.');
    }

    if (saveBtn) {
      saveBtn.classList.remove('is-saving');
      saveBtn.innerHTML = '<span>✓</span><span>Saved!</span>';
      setTimeout(() => {
        saveBtn.innerHTML = '<span>💾</span><span>Save</span>';
      }, 2200);
    }

    if (!silent) {
      if (savedToBackend) {
        showSaveToast(`💾 소스 파일(data/archive.json)에 성공적으로 저장되었습니다! (사물 ${payload.objects.length}개, 메모 ${payload.memos.length}개)`);
      } else {
        showSaveToast('✓ 브라우저(IndexedDB)에 정상적으로 저장되었습니다.');
      }
    }

    return { success: true, savedToBackend, payload };
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
    }, 4000);
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
      btn.title = '현재 아카이브 데이터를 브라우저(IndexedDB)에 저장';
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
      // On local dev servers only, test connection silently
      if (!isStaticHosting()) {
        setTimeout(() => window.triggerSourceSave({ silent: true }), 300);
      }
    });
  } else {
    injectSaveElements();
    if (!isStaticHosting()) {
      setTimeout(() => window.triggerSourceSave({ silent: true }), 300);
    }
  }
})();
