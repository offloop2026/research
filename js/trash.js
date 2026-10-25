/**
 * TRASH CONTROLLER (trash.js)
 * Clean, minimal editorial list for managing deleted items:
 * Objects, Photos, Field Research, and Memos.
 * Supports: Restore to exact original state, Delete Permanently, and Empty Trash.
 */

(function () {
  function timeAgo(dateString) {
    if (!dateString) return 'recently';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 30) return `${diffDay} days ago`;
    return past.toLocaleDateString();
  }

  function getTypeLabel(type) {
    switch (type) {
      case 'object': return 'Object';
      case 'photo': return 'Photo';
      case 'field-research': return 'Field Research';
      case 'memo': return 'Memo';
      default: return 'Item';
    }
  }

  function renderTrashView() {
    const container = document.getElementById('trash-main-container');
    if (!container || !window.app) return;

    const items = window.app.getTrashItems ? window.app.getTrashItems() : [];

    const metaCount = document.getElementById('trash-meta-count');
    if (metaCount) metaCount.textContent = items.length;

    let html = `
      <div class="trash-stream-wrap">
        <header class="trash-header-bar">
          <div class="trash-title-row">
            <h1 class="trash-editorial-heading">TRASH =</h1>
            <span class="trash-count-badge mono">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
          </div>
          <div class="trash-header-actions mono">
            ${items.length > 0 ? `<button type="button" id="btn-empty-trash" class="editorial-trash-btn text-danger">[Empty Trash]</button>` : ''}
          </div>
        </header>

        <div class="trash-content-section">
    `;

    if (items.length === 0) {
      html += `
        <div class="trash-empty-state mono">
          <p>휴지통이 비어 있습니다.</p>
          <span class="trash-empty-sub">삭제된 사물, 사진, 리서치, 메모가 이곳에 안전하게 보관됩니다.</span>
        </div>
      `;
    } else {
      html += `
        <div class="trash-subheading mono">Recently Deleted</div>
        <div class="trash-list-wrap">
      `;

      items.forEach(item => {
        const typeLabel = getTypeLabel(item.type);
        const relTime = timeAgo(item.deletedAt);
        const title = item.title || (item.data && (item.data.title || (item.data.object && item.data.object.title))) || 'Untitled Record';
        const origId = item.originalId || (item.data && (item.data.id || (item.data.object && item.data.object.id))) || '';
        const previewSrc = item.preview || (item.data && (item.data.imageSrc || item.data.image));

        html += `
          <article class="trash-list-item" data-id="${item.id}">
            <div class="trash-item-left">
              ${previewSrc ? `
                <div class="trash-thumb-frame">
                  <img src="${previewSrc}" alt="" class="trash-thumb-img" />
                </div>
              ` : `
                <div class="trash-thumb-frame empty mono"><span>&mdash;</span></div>
              `}
              <div class="trash-item-meta-col">
                <div class="trash-item-title-row">
                  <span class="trash-type-badge mono">[${typeLabel}]</span>
                  <span class="trash-item-title">${escapeTrashHtml(title)}</span>
                  ${origId ? `<span class="trash-item-id mono">${escapeTrashHtml(origId)}</span>` : ''}
                </div>
                <div class="trash-item-time mono">Deleted ${relTime}</div>
              </div>
            </div>

            <div class="trash-item-actions mono">
              <button type="button" class="editorial-trash-btn btn-trash-restore" data-id="${item.id}">[Restore]</button>
              <button type="button" class="editorial-trash-btn btn-trash-delete-perm text-danger" data-id="${item.id}">[Delete Permanently]</button>
            </div>
          </article>
        `;
      });

      html += `</div>`;
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
    bindTrashEvents(container);
    if (window.app && typeof window.app.initMenuPopover === 'function') {
      window.app.initMenuPopover();
    }
  }

  function escapeTrashHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bindTrashEvents(container) {
    // Empty Trash
    const btnEmpty = container.querySelector('#btn-empty-trash');
    if (btnEmpty) {
      btnEmpty.addEventListener('click', () => {
        const confirmed = window.confirm("Empty Trash?\n\nAll deleted items will be permanently removed.\nThis action cannot be undone.");
        if (confirmed) {
          window.app.emptyTrash();
          renderTrashView();
        }
      });
    }

    // Restore item
    container.querySelectorAll('.btn-trash-restore').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id) {
          window.app.restoreTrashItem(id);
          renderTrashView();
        }
      });
    });

    // Delete Permanently
    container.querySelectorAll('.btn-trash-delete-perm').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id) {
          const confirmed = window.confirm("Delete Permanently?\n\nThis item will be permanently removed and cannot be recovered.");
          if (confirmed) {
            window.app.deleteTrashPermanently(id);
            renderTrashView();
          }
        }
      });
    });
  }

  window.addEventListener('archive-ready', () => {
    renderTrashView();
  });

  window.addEventListener('archive-updated', (e) => {
    if (e.detail && (e.detail.type === 'trash' || e.detail.type === 'trash-restored')) {
      renderTrashView();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (window.app && window.app.isReady) {
      renderTrashView();
    }
  });
})();
