/**
 * TIMELINE MODULE (timeline.js)
 * Visualizes the chronological continuum of observation, research,
 * dissection, interrogation, sealing delegation, and 35-day metabolic alteration.
 */

document.addEventListener('DOMContentLoaded', () => {
  const checkAppReady = setInterval(() => {
    if (window.app && window.app.data && window.app.data.objects.length > 0) {
      clearInterval(checkAppReady);
      initTimelineView();
    }
  }, 50);
});

let timelineFilter = 'ALL';

function initTimelineView() {
  const container = document.getElementById('timeline-stream-container');
  if (!container) return;

  renderTimelineFilters();
  renderTimelineStream();

  window.addEventListener('archive-data-changed', () => {
    renderTimelineStream();
  });
}

function renderTimelineFilters() {
  const filterBar = document.getElementById('timeline-filter-bar');
  if (!filterBar) return;

  const filters = ['ALL', 'OBJECT', 'DISSECTION', 'RESEARCH', 'INTERROGATION', 'SEALING', 'NOTE'];
  filterBar.innerHTML = filters.map(f => `
    <button class="filter-tag-btn mono ${timelineFilter === f ? 'active' : ''}" data-filter="${f}">
      ${f}
    </button>
  `).join('');

  filterBar.querySelectorAll('.filter-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      timelineFilter = btn.getAttribute('data-filter');
      renderTimelineFilters();
      renderTimelineStream();
    });
  });
}

function renderTimelineStream() {
  const container = document.getElementById('timeline-stream-container');
  if (!container) return;

  const events = [];

  // 1. Objects
  window.app.getObjects().forEach(obj => {
    events.push({
      date: obj.date,
      type: 'OBJECT',
      category: 'ACQUISITION',
      title: `${obj.id} ${obj.title} 최초 수거 및 관찰`,
      desc: `원산지: ${obj.origin} &middot; 상태: ${obj.conditionAtReceipt}`,
      url: `archive.html?id=${obj.id}`,
      id: obj.id
    });

    if (obj.phases && obj.phases.dissection) {
      events.push({
        date: obj.phases.dissection.date,
        type: 'DISSECTION',
        category: 'ANATOMY',
        title: `${obj.id} 분해 및 부품 매니페스트 작성`,
        desc: `${obj.phases.dissection.description} (총 ${obj.phases.dissection.partsCount}개 부품 분리)`,
        url: `archive.html?id=${obj.id}#phase-dissection`,
        id: obj.id
      });
    }

    if (obj.phases && obj.phases.after) {
      events.push({
        date: obj.phases.after.date,
        type: 'SEALING',
        category: 'METABOLISM',
        title: `${obj.id} 5주 후 봉인 해제 (DAY 35 결산)`,
        desc: `${obj.phases.after.description} &middot; 질량 변화: ${obj.phases.after.weightDelta}`,
        url: `archive.html?id=${obj.id}#phase-after`,
        id: obj.id
      });
    }
  });

  // 2. Interrogations
  (window.app.data.interrogations || []).forEach(act => {
    events.push({
      date: act.date || '2026.03.07',
      type: 'INTERROGATION',
      category: act.action,
      title: `[${act.action}] ${act.material} 물리적 심문`,
      desc: `조건: ${act.condition} &middot; 결과: ${act.sensoryLog.color || act.hypothesis}`,
      url: `archive.html?id=${act.objectId}#phase-interrogation`,
      id: act.id
    });
  });

  // 3. Research
  window.app.getResearch().forEach(res => {
    events.push({
      date: res.dateAccessed || '2026.03.01',
      type: 'RESEARCH',
      category: res.type,
      title: `[${res.type}] 《${res.title}》 문헌 및 작가 연구`,
      desc: `저자/작가: ${res.author || res.artist} &middot; ${res.summary ? res.summary.slice(0, 110) + '...' : ''}`,
      url: `research.html?id=${res.id}`,
      id: res.id
    });
  });

  // 4. Notes
  window.app.getNotes().forEach(note => {
    events.push({
      date: note.date,
      type: 'NOTE',
      category: note.type,
      title: `[NOTE] ${note.title}`,
      desc: note.text.slice(0, 120) + '...',
      url: `notes.html?id=${note.id}`,
      id: note.id
    });
  });

  // 5. Sealing Milestones (Day 00, 07, 14, 21, 35)
  (window.app.data.sealings || []).forEach(seal => {
    seal.timeline.forEach(step => {
      events.push({
        date: step.date,
        type: 'SEALING',
        category: step.day,
        title: `[봉인 ${step.day}] ${seal.conditionKr} 경과 기록`,
        desc: `${step.color} &middot; 무게: ${step.weight} &middot; 소리: ${step.sound}`,
        url: `archive.html?id=${seal.associatedObject}#phase-sealing`,
        id: seal.id
      });
    });
  });

  // Sort chronologically ascending
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Filter
  const filtered = timelineFilter === 'ALL' ? events : events.filter(e => e.type === timelineFilter);

  container.innerHTML = `
    <div class="timeline-stream-track">
      ${filtered.map(item => `
        <div class="timeline-entry-row">
          <div class="entry-date-column mono">
            <span class="entry-date">${item.date}</span>
            <span class="badge-pill">${item.category}</span>
          </div>
          <div class="entry-bullet-column">
            <div class="timeline-bullet ${item.type.toLowerCase()}"></div>
            <div class="timeline-stem"></div>
          </div>
          <div class="entry-card-column">
            <a href="${item.url}" class="timeline-entry-card">
              <div class="card-meta mono text-caption">
                <span class="badge-status status-known">${item.type}</span>
                <span class="text-archive-id">[${item.id}]</span>
              </div>
              <h3 class="card-entry-title">${item.title}</h3>
              <p class="card-entry-desc mono text-caption">${item.desc}</p>
            </a>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
