/**
 * NOTES MODULE (notes.js)
 * Manages the researcher's field notebook:
 * OBSERVATION, QUESTION, IDEA, QUOTE, REFERENCE, CONNECTION, TODO.
 */

let activeNoteTypeFilter = 'ALL';

document.addEventListener('DOMContentLoaded', () => {
  const checkAppReady = setInterval(() => {
    if (window.app && window.app.data && window.app.data.notes.length > 0) {
      clearInterval(checkAppReady);
      initNotesView();
    }
  }, 50);
});

function initNotesView() {
  const container = document.getElementById('notes-view-container');
  if (!container) return;

  renderNoteFilters();
  renderNotesGrid();

  window.addEventListener('archive-data-changed', (e) => {
    if (e.detail && e.detail.entityType === 'notes') {
      renderNotesGrid();
    }
  });

  const btnNew = document.getElementById('btn-create-note-page');
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      window.app.openQuickNoteModal();
    });
  }
}

function renderNoteFilters() {
  const filterBar = document.getElementById('notes-filter-bar');
  if (!filterBar) return;

  const types = ['ALL', 'OBSERVATION', 'QUESTION', 'IDEA', 'QUOTE', 'REFERENCE', 'CONNECTION', 'TODO'];
  filterBar.innerHTML = types.map(t => `
    <button class="filter-tag-btn mono ${activeNoteTypeFilter === t ? 'active' : ''}" data-type="${t}">
      ${t}
    </button>
  `).join('');

  filterBar.querySelectorAll('.filter-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeNoteTypeFilter = btn.getAttribute('data-type');
      renderNoteFilters();
      renderNotesGrid();
    });
  });
}

function renderNotesGrid() {
  const grid = document.getElementById('notes-grid-container');
  if (!grid) return;

  let notes = window.app.getNotes();
  if (activeNoteTypeFilter !== 'ALL') {
    notes = notes.filter(n => n.type === activeNoteTypeFilter);
  }

  if (notes.length === 0) {
    grid.innerHTML = `<div class="mono text-caption" style="padding: 40px; grid-column: 1 / -1;">NO NOTES RECORDED UNDER "${activeNoteTypeFilter}"</div>`;
    return;
  }

  grid.innerHTML = notes.map(note => {
    const relObj = (note.relatedObjects || []).map(id => window.app.getObjectById(id)).filter(Boolean);
    const relRes = (note.relatedResearch || []).map(id => window.app.getResearchById(id)).filter(Boolean);

    return `
      <div class="note-card type-${note.type.toLowerCase()}" id="${note.id}">
        <div class="note-card-header mono">
          <div class="header-left">
            <span class="badge-status status-known">${note.type}</span>
            <span class="text-archive-id" style="margin-left: 6px;">${note.id}</span>
          </div>
          <div class="header-right text-caption">
            ${note.date}
          </div>
        </div>

        <h3 class="note-title">${note.title}</h3>
        <p class="note-text text-body">${note.text}</p>

        <!-- Tags -->
        ${note.tags && note.tags.length ? `
          <div class="note-tags mono text-caption">
            ${note.tags.map(t => `<span class="tag-item">#${t}</span>`).join(' ')}
          </div>
        ` : ''}

        <!-- Cross Links -->
        <div class="note-relations mono text-caption">
          ${relObj.map(o => `
            <a href="archive.html?id=${o.id}" class="relation-badge">&rarr; OBJECT: ${o.title}</a>
          `).join('')}
          ${relRes.map(r => `
            <a href="research.html?id=${r.id}" class="relation-badge">&rarr; RESEARCH: ${r.title}</a>
          `).join('')}
        </div>

        <!-- Footer Actions -->
        <div class="note-card-footer mono">
          <span class="note-timestamp text-caption">
            UPDATED: ${note.updated ? note.updated.slice(0, 10) : note.date}
          </span>
          <div class="note-action-btns">
            <button class="btn-note-action btn-edit-note" data-id="${note.id}">EDIT</button>
            <button class="btn-note-action btn-delete-note" data-id="${note.id}">DEL</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach Edit/Delete
  grid.querySelectorAll('.btn-edit-note').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const note = window.app.getNoteById(id);
      if (note) {
        window.app.openQuickNoteModal(note);
      }
    });
  });

  grid.querySelectorAll('.btn-delete-note').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm(`정말로 연구 메모 [${id}]를 삭제하시겠습니까?`)) {
        window.app.deleteNote(id);
        window.app.showToast(`[NOTE DELETED] ${id}`);
        renderNotesGrid();
      }
    });
  });
}
