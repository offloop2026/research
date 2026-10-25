/**
 * TIME MODULE (time.js)
 * Archive viewed along the axis of time.
 * Hierarchical accumulation: Year → Month → Date → Objects.
 * Most recent at the top.
 */

document.addEventListener('DOMContentLoaded', () => {
  const checkReady = setInterval(() => {
    if (window.app && window.app.data && window.app.data.objects) {
      clearInterval(checkReady);
      renderTimeView();
    }
  }, 40);

  window.addEventListener('archive-updated', () => {
    renderTimeView();
  });
});

function renderTimeView() {
  const container = document.getElementById('time-tree-container');
  if (!container) return;

  const objects = window.app.getObjects();

  // Sort descending by timestamp (most recent first)
  const sorted = [...objects].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  // Build tree: Year -> Month -> Date -> [objects]
  const tree = {};

  sorted.forEach(obj => {
    // timestamp e.g. "2026.09.17 10:30"
    const datePart = (obj.timestamp || '2026.09.17').split(' ')[0];
    const [y, m, d] = datePart.split('.');
    const yearKey = y || '2026';
    const monthKey = m || '09';
    const dayKey = d || '17';

    if (!tree[yearKey]) tree[yearKey] = {};
    if (!tree[yearKey][monthKey]) tree[yearKey][monthKey] = {};
    if (!tree[yearKey][monthKey][dayKey]) tree[yearKey][monthKey][dayKey] = [];

    tree[yearKey][monthKey][dayKey].push(obj);
  });

  const years = Object.keys(tree).sort((a, b) => b.localeCompare(a));

  container.innerHTML = `
    <div class="time-axis-ledger">
      <div class="time-axis-stream">
        ${years.map(y => `
          <div class="time-year-block">
            <div class="time-year-heading mono">${y}</div>

            <div class="time-month-stream">
              ${Object.keys(tree[y]).sort((a, b) => b.localeCompare(a)).map(m => `
                <div class="time-month-block">
                  <div class="time-month-heading mono">${m}</div>

                  <div class="time-day-stream">
                    ${Object.keys(tree[y][m]).sort((a, b) => b.localeCompare(a)).map(d => `
                      <div class="time-day-entry">
                        <div class="time-day-num mono">${d}</div>
                        <div class="time-objects-list">
                          ${tree[y][m][d].map(obj => `
                            <div class="time-object-row">
                              <a href="index.html?id=${obj.id}" class="time-obj-link">
                                <span class="time-obj-title">${obj.title}</span>
                                <span class="time-obj-sub mono">${obj.timestamp.split(' ')[1] || ''} [${obj.id}]</span>
                              </a>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
