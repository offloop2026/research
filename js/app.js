/**
 * OBJECT ARCHIVE - CORE CONTROLLER
 * Simple, dry, photographic object repository:
 * - 4 Navigation tabs: 아카이브 / 성좌 / 시간 / 메모
 * - Object: id, title, images[], representativeImage, timestamp, constellation[]
 * - Memo: id, objectId, title, content, timestamp
 */

const LOCAL_OVERRIDE_KEY = 'archive_user_custom_v3';
const CMS_EDIT_MODE_KEY = 'archive_cms_edit_mode';
const FIELD_RESEARCH_KEY = 'archive_field_research_v1';
const TRASH_STORAGE_KEY = 'archive_trash_v1';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const DEFAULT_BASELINE = {
  objects: [
    {
      id: "obj-001",
      title: "타이머 메커니즘",
      images: [
        "assets/images/obj-001-1.svg",
        "assets/images/obj-001-2.svg",
        "assets/images/obj-001-3.svg"
      ],
      representativeImage: "assets/images/obj-001-1.svg",
      timestamp: "2026.09.17 10:30",
      materials: "황동, 탄소강, 루비 베어링",
      dimensions: "Ø 52mm × 14mm",
      description: "정밀 태엽 회전축과 탈진기 어셈블리. 세 번째 황동 기어에 주기적인 마모 패턴 관찰.",
      constellation: ["obj-002", "obj-003"]
    },
    {
      id: "obj-002",
      title: "다이내믹 트랜스듀서",
      images: [
        "assets/images/obj-002-1.svg",
        "assets/images/obj-002-2.svg"
      ],
      representativeImage: "assets/images/obj-002-1.svg",
      timestamp: "2026.09.17 14:15",
      materials: "알루미늄 하우징, 네오디뮴 자석, 마일러 진동판",
      dimensions: "38mm × 38mm × 19mm",
      description: "고주파 진동 감쇠용 다이어프램 모듈. 중심부 코일의 저항값 32.4Ω 측정.",
      constellation: ["obj-001"]
    },
    {
      id: "obj-003",
      title: "리프 셔터 어셈블리",
      images: [
        "assets/images/obj-003-1.svg",
        "assets/images/obj-003-2.svg"
      ],
      representativeImage: "assets/images/obj-003-1.svg",
      timestamp: "2026.09.15 11:00",
      materials: "흑색 산화 피막 강철 날개 5매, 황동 구동 링",
      dimensions: "Ø 44mm × 8mm",
      description: "5매의 블레이드가 겹쳐지는 조리개 기구. 1/500초 작동 스프링 장력 정상 유지.",
      constellation: ["obj-001", "obj-004"]
    },
    {
      id: "obj-004",
      title: "카본 마이크로폰 캡슐",
      images: [
        "assets/images/obj-004-1.svg"
      ],
      representativeImage: "assets/images/obj-004-1.svg",
      timestamp: "2026.09.12 16:40",
      materials: "베이클라이트 외장, 탄소 과립실, 황동 전극판",
      dimensions: "Ø 48mm × 26mm",
      description: "미세 탄소 분말이 봉입된 음향 변환 소자. 압력 변화에 따른 저항 변화 감지.",
      constellation: ["obj-003"]
    }
  ],
  memos: [
    {
      id: "memo-001",
      objectId: "obj-001",
      title: "황동 톱니 마모선",
      content: "회전축 세 번째 톱니 표면에 미세한 마모선이 남아있다. 태엽이 풀리며 발생한 마찰 흔적.",
      timestamp: "2026.09.17 11:20"
    },
    {
      id: "memo-002",
      objectId: "obj-001",
      title: "스프링 잔여 장력",
      content: "나선형 강철 스프링을 분리하자 직경이 22mm에서 64mm로 팽창했다.",
      timestamp: "2026.09.17 11:35"
    },
    {
      id: "memo-003",
      objectId: "obj-002",
      title: "알루미늄 하우징 산화막",
      content: "모서리 접합부에 얇은 백색 산화 피막이 형성되어 있음.",
      timestamp: "2026.09.17 14:30"
    },
    {
      id: "memo-004",
      objectId: "obj-003",
      title: "셔터 블레이드 유막",
      content: "5매의 강철 블레이드 사이에 건조된 윤활유 피막이 얇게 남아있음.",
      timestamp: "2026.09.15 11:40"
    }
  ]
};

const DEFAULT_RESEARCH = [
  {
    id: "res-001",
    numStr: "01",
    title: "을지로 3가 공구상가와 정밀 태엽 조사",
    date: "2026.09.18",
    location: "서울시 중구 을지로 3가 일대",
    relatedObjectId: "obj-001",
    intro: "을지로 공구상가 골목에서 수집한 시계 태엽 탈진기 부품과 주변 가공 환경에 대한 현장 기록.",
    blocks: [
      {
        id: "blk-1",
        type: "text",
        text: "오늘 을지로의 공구상가 골목을 걸었다. 골목마다 금속을 깎고 연마하는 서로 다른 기계음과 기름 냄새가 섞여 있었다. 손바닥만 한 황동 톱니 부품을 다루는 장인의 작업대 위에는 수십 년 동안 손때가 묻은 돋보기와 미세 핀셋이 놓여 있었다."
      },
      {
        id: "blk-2",
        type: "image-caption",
        image: "assets/images/obj-001-1.svg",
        caption: "을지로 3가 골목 작업대에서 관찰한 탈진기 황동 기어의 맞물림 흔적."
      },
      {
        id: "blk-3",
        type: "text",
        text: "부품의 표면을 가까이 들여다보면 미세한 마모선이 보인다. 지도 위에서 기호로만 표기된 지점과 실제 현장의 거친 질감 사이에는 항상 물리적인 시간의 축적이 개입되어 있다."
      },
      {
        id: "blk-4",
        type: "image",
        image: "assets/images/obj-001-2.svg"
      },
      {
        id: "blk-5",
        type: "text",
        text: "금속 표면의 산화 피막은 공기 중의 습도와 장인의 지문이 남긴 염분이 결합하여 만들어낸 자연적인 기록 층위다. 이는 사물이 단순히 기계 부품에 머무르지 않고 하나의 역사적 매체로 변화하는 과정을 증명한다."
      }
    ]
  },
  {
    id: "res-002",
    numStr: "02",
    title: "세운상가 오디오 수리점과 음향 진동판 관측",
    date: "2026.09.19",
    location: "서울시 종로구 세운상가 3층",
    relatedObjectId: "obj-002",
    intro: "진공관 앰프와 스피커 트랜스듀서를 수리하는 작업실에서 관찰한 음향 부품의 내부 구조.",
    blocks: [
      {
        id: "blk-1",
        type: "text",
        text: "세운상가 3층 데크를 지나 좁은 수리점 내부로 들어서자 수백 개의 코일과 마그넷이 선반을 가득 메우고 있었다. 기술자는 오래된 다이내믹 트랜스듀서의 코일을 조심스럽게 풀며 진동판의 탄성을 점검하고 있었다."
      },
      {
        id: "blk-2",
        type: "image-caption",
        image: "assets/images/obj-002-1.svg",
        caption: "네오디뮴 마그넷 중심부에 장착된 극박 마일러 필름 진동판."
      },
      {
        id: "blk-3",
        type: "text",
        text: "보이지 않는 공기의 파동을 물리적 전류로 바꾸는 과정은 극도로 얇은 진동판의 떨림에서 시작된다. 미세한 먼지 하나가 음색의 왜곡을 일으킨다는 설명에서 물리적 사물의 예민함을 실감했다."
      }
    ]
  }
];

function isCmsEditMode() {
  try {
    return localStorage.getItem(CMS_EDIT_MODE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

function setCmsEditMode(enable) {
  try {
    localStorage.setItem(CMS_EDIT_MODE_KEY, enable ? 'true' : 'false');
  } catch (e) {}
  window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'cms-edit-mode', value: enable } }));
}

function toggleCmsEditMode() {
  const current = isCmsEditMode();
  setCmsEditMode(!current);
  return !current;
}

function compressImageFile(file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve(e.target.result);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl;
        try {
          dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch (err) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

class ArchiveApp {
  constructor() {
    this.data = {
      objects: [],
      memos: []
    };
    this.activePage = this.detectActivePage();
    this.lightbox = {
      images: [],
      currentIndex: 0
    };
    this.isReady = false;
  }

  isEditMode() {
    try {
      return localStorage.getItem(CMS_EDIT_MODE_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  isCmsEditMode() {
    return this.isEditMode();
  }

  toggleEditMode() {
    const next = !this.isEditMode();
    this.setEditMode(next);
    return next;
  }

  toggleCmsEditMode() {
    return this.toggleEditMode();
  }

  setEditMode(enable) {
    try {
      localStorage.setItem(CMS_EDIT_MODE_KEY, enable ? 'true' : 'false');
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'cms-edit-mode', value: enable } }));
  }

  setCmsEditMode(enable) {
    this.setEditMode(enable);
  }

  compressImageFile(file, maxWidth, maxHeight, quality) {
    return compressImageFile(file, maxWidth, maxHeight, quality);
  }

  detectActivePage() {
    const path = window.location.pathname;
    if (path.includes('trash.html')) return 'trash';
    if (path.includes('field-research.html') || path.includes('research.html')) return 'field-research';
    if (path.includes('photo.html')) return 'photo';
    if (path.includes('memo.html') || path.includes('notes.html')) return 'memo';
    return 'archive';
  }

  async init() {
    await this.loadData();
    this.isReady = true;
    this.renderHeader();
    this.initRegistrationModal();
    this.initLightbox();
    this.initMenuPopover();
    this.initGlobalSaveButton();
    window.dispatchEvent(new CustomEvent('archive-ready'));
    console.log('[Archive] Initialized. Objects:', this.data.objects.length, 'Memos:', this.data.memos.length);

    // Auto-sync custom local modifications to source file (archive.json) on init
    try {
      const customStr = localStorage.getItem(LOCAL_OVERRIDE_KEY);
      const frStr = localStorage.getItem(FIELD_RESEARCH_KEY);
      if (customStr || frStr) {
        this.saveToSourceFile({ silent: true });
      }
    } catch (e) {}
  }

  async loadData() {
    // 0. Initialize from reliable baseline
    this.data.objects = JSON.parse(JSON.stringify(DEFAULT_BASELINE.objects));
    this.data.memos = JSON.parse(JSON.stringify(DEFAULT_BASELINE.memos));

    try {
      // 1. Fetch remote baseline if available
      const res = await fetch('data/archive.json');
      if (res.ok) {
        const base = await res.json();
        if (base && Array.isArray(base.objects) && base.objects.length > 0) {
          this.data.objects = base.objects;
        }
        if (base && Array.isArray(base.memos)) {
          this.data.memos = base.memos;
        }
        if (base && Array.isArray(base.fieldResearch) && base.fieldResearch.length > 0) {
          this.data.fieldResearch = base.fieldResearch;
        }
        if (base && base.memoPositions) {
          try {
            if (!localStorage.getItem('archive_memo_positions_v1')) {
              localStorage.setItem('archive_memo_positions_v1', JSON.stringify(base.memoPositions));
            }
          } catch (e) {}
        }
        if (base && base.memoConnections) {
          try {
            if (!localStorage.getItem('archive_memo_connections_v1')) {
              localStorage.setItem('archive_memo_connections_v1', JSON.stringify(base.memoConnections));
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[Archive] Offline / fallback baseline in use:', e);
    }

    try {
      // 2. Merge local custom additions if any exist
      const customStr = localStorage.getItem(LOCAL_OVERRIDE_KEY);
      if (customStr) {
        const custom = JSON.parse(customStr);
        this.deletedMemoIds = custom.deletedMemoIds || [];
        this.deletedObjectIds = custom.deletedObjectIds || [];

        // Filter out any baseline items that were explicitly deleted by the user
        if (this.deletedMemoIds.length) {
          this.data.memos = this.data.memos.filter(m => !this.deletedMemoIds.includes(m.id));
        }
        if (this.deletedObjectIds.length) {
          this.data.objects = this.data.objects.filter(o => !this.deletedObjectIds.includes(o.id));
        }

        if (custom.objects && custom.objects.length) {
          custom.objects.forEach(cObj => {
            if (this.deletedObjectIds.includes(cObj.id)) return;
            const idx = this.data.objects.findIndex(o => o.id === cObj.id);
            if (idx >= 0) this.data.objects[idx] = cObj;
            else this.data.objects.unshift(cObj);
          });
        }
        if (custom.memos && custom.memos.length) {
          custom.memos.forEach(cMemo => {
            if (this.deletedMemoIds.includes(cMemo.id)) return;
            const idx = this.data.memos.findIndex(m => m.id === cMemo.id);
            if (idx >= 0) this.data.memos[idx] = cMemo;
            else this.data.memos.unshift(cMemo);
          });
        }
      } else {
        this.deletedMemoIds = [];
        this.deletedObjectIds = [];
      }
    } catch (e) {
      console.error('[Archive] Data merge error:', e);
    }
  }

  persistCustom() {
    try {
      const payload = {
        objects: this.data.objects,
        memos: this.data.memos,
        deletedMemoIds: this.deletedMemoIds || [],
        deletedObjectIds: this.deletedObjectIds || []
      };
      localStorage.setItem(LOCAL_OVERRIDE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[Archive] Storage warning:', e);
    }
  }

  // --- OBJECTS ---
  getObjects() {
    return this.data.objects || [];
  }

  getAllObjects() {
    return this.getObjects();
  }

  getObjectById(id) {
    return this.getObjects().find(o => o.id === id);
  }

  // --- FIELD RESEARCH ---
  getResearchList() {
    try {
      const raw = localStorage.getItem(FIELD_RESEARCH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('[Field Research] Read warning:', e);
    }
    if (this.data && Array.isArray(this.data.fieldResearch) && this.data.fieldResearch.length > 0) {
      return JSON.parse(JSON.stringify(this.data.fieldResearch));
    }
    return JSON.parse(JSON.stringify(DEFAULT_RESEARCH));
  }

  saveResearch(entry) {
    let list = this.getResearchList();
    if (!entry.id) {
      let maxNum = 0;
      list.forEach(r => {
        const m = r.id && r.id.match(/^res-(\d+)$/);
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
      });
      const num = String(maxNum + 1).padStart(3, '0');
      entry.id = `res-${num}`;
      entry.numStr = String(maxNum + 1).padStart(2, '0');
    }

    const idx = list.findIndex(r => r.id === entry.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...entry };
    } else {
      list.unshift(entry);
    }

    try {
      localStorage.setItem(FIELD_RESEARCH_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[Field Research] Write warning:', e);
    }

    window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'field-research', id: entry.id } }));
    return entry;
  }

  deleteResearch(id, skipTrash = false) {
    let list = this.getResearchList();
    const target = list.find(r => r.id === id);
    if (!target) return;

    if (!skipTrash) {
      this.moveToTrash('field-research', target, JSON.parse(JSON.stringify(target)));
    }

    list = list.filter(r => r.id !== id);
    try {
      localStorage.setItem(FIELD_RESEARCH_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[Field Research] Delete warning:', e);
    }
    window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'field-research-deleted', id } }));
  }

  // --- TRASH SYSTEM ---
  getTrashItems() {
    try {
      const raw = localStorage.getItem(TRASH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('[Trash] Read error:', e);
    }
    return [];
  }

  saveTrashItems(items) {
    try {
      localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('[Trash] Write error:', e);
    }
    window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'trash' } }));
  }

  moveToTrash(type, item, dataSnapshot) {
    const trashItem = {
      id: `trash-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type, // 'object' | 'photo' | 'field-research' | 'memo'
      originalId: item.id || (dataSnapshot && dataSnapshot.originalId) || '',
      title: item.title || (dataSnapshot && dataSnapshot.title) || '기록',
      preview: (dataSnapshot && dataSnapshot.imageSrc) || item.representativeImage || (item.images && item.images[0]) || '',
      deletedAt: new Date().toISOString(),
      data: dataSnapshot || item
    };

    const items = this.getTrashItems();
    items.unshift(trashItem);
    this.saveTrashItems(items);
    this.showUndoToast(trashItem);
    return trashItem;
  }

  restoreTrashItem(trashId) {
    const items = this.getTrashItems();
    const item = items.find(t => t.id === trashId);
    if (!item) return false;

    if (item.type === 'object') {
      const snap = item.data;
      if (snap && snap.object) {
        if (this.deletedObjectIds) {
          this.deletedObjectIds = this.deletedObjectIds.filter(id => id !== snap.object.id);
        }
        const existingIdx = this.data.objects.findIndex(o => o.id === snap.object.id);
        if (existingIdx >= 0) this.data.objects[existingIdx] = snap.object;
        else this.data.objects.unshift(snap.object);

        if (snap.attachedMemos && snap.attachedMemos.length) {
          snap.attachedMemos.forEach(m => {
            if (this.deletedMemoIds) {
              this.deletedMemoIds = this.deletedMemoIds.filter(id => id !== m.id);
            }
            const mIdx = this.data.memos.findIndex(existingM => existingM.id === m.id);
            if (mIdx >= 0) this.data.memos[mIdx] = m;
            else this.data.memos.push(m);
          });
        }

        if (snap.memoPositions) {
          try {
            const posRaw = localStorage.getItem('archive_memo_positions_v1');
            const positions = posRaw ? JSON.parse(posRaw) : {};
            Object.assign(positions, snap.memoPositions);
            localStorage.setItem('archive_memo_positions_v1', JSON.stringify(positions));
          } catch (e) {}
        }

        if (snap.memoConnections && snap.memoConnections.length) {
          try {
            const connRaw = localStorage.getItem('archive_memo_connections_v1');
            const conns = connRaw ? JSON.parse(connRaw) : [];
            snap.memoConnections.forEach(c => {
              if (!conns.some(existing => existing.id === c.id)) {
                conns.push(c);
              }
            });
            localStorage.setItem('archive_memo_connections_v1', JSON.stringify(conns));
          } catch (e) {}
        }

        this.persistCustom();
      }
    } else if (item.type === 'memo') {
      const snap = item.data;
      if (snap && snap.memo) {
        if (this.deletedMemoIds) {
          this.deletedMemoIds = this.deletedMemoIds.filter(id => id !== snap.memo.id);
        }
        const mIdx = this.data.memos.findIndex(existingM => existingM.id === snap.memo.id);
        if (mIdx >= 0) this.data.memos[mIdx] = snap.memo;
        else this.data.memos.unshift(snap.memo);

        if (snap.position) {
          try {
            const posRaw = localStorage.getItem('archive_memo_positions_v1');
            const positions = posRaw ? JSON.parse(posRaw) : {};
            positions[snap.memo.id] = snap.position;
            localStorage.setItem('archive_memo_positions_v1', JSON.stringify(positions));
          } catch (e) {}
        }

        if (snap.connections && snap.connections.length) {
          try {
            const connRaw = localStorage.getItem('archive_memo_connections_v1');
            const conns = connRaw ? JSON.parse(connRaw) : [];
            snap.connections.forEach(c => {
              if (!conns.some(existing => existing.id === c.id)) {
                conns.push(c);
              }
            });
            localStorage.setItem('archive_memo_connections_v1', JSON.stringify(conns));
          } catch (e) {}
        }

        this.persistCustom();
      }
    } else if (item.type === 'field-research') {
      const snap = item.data;
      if (snap) {
        this.saveResearch(snap);
      }
    } else if (item.type === 'photo') {
      const snap = item.data;
      if (snap && snap.objectId && snap.imageSrc) {
        const obj = this.getObjectById(snap.objectId);
        if (obj) {
          if (!obj.images) obj.images = [];
          if (typeof snap.index === 'number' && snap.index <= obj.images.length) {
            obj.images.splice(snap.index, 0, snap.imageSrc);
          } else {
            obj.images.push(snap.imageSrc);
          }
          if (snap.wasRepresentative || !obj.representativeImage) {
            obj.representativeImage = snap.imageSrc;
          }
          this.saveObject(obj);
        }
      }
    }

    const remaining = items.filter(t => t.id !== trashId);
    this.saveTrashItems(remaining);
    window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'trash-restored', id: trashId } }));
    return true;
  }

  deleteTrashPermanently(trashId) {
    const items = this.getTrashItems().filter(t => t.id !== trashId);
    this.saveTrashItems(items);
  }

  emptyTrash() {
    this.saveTrashItems([]);
  }

  showUndoToast(trashItem) {
    let toast = document.getElementById('archive-undo-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'archive-undo-toast';
      toast.className = 'archive-undo-toast';
      document.body.appendChild(toast);
    }

    const displayTitle = trashItem.title ? (trashItem.title.length > 25 ? trashItem.title.substring(0, 24) + '…' : trashItem.title) : '항목';
    toast.innerHTML = `
      <span>"${escapeHtml(displayTitle)}" 항목이 휴지통으로 이동되었습니다.</span>
      <button type="button" class="btn-undo-action mono" id="toast-undo-btn">[Undo]</button>
    `;
    toast.style.display = 'flex';

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 6000);

    document.getElementById('toast-undo-btn')?.addEventListener('click', () => {
      toast.style.display = 'none';
      this.restoreTrashItem(trashItem.id);
    });
  }

  initGlobalSaveButton() {
    let btn = document.getElementById('global-floating-save-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'global-floating-save-btn';
      btn.className = 'global-floating-save-btn mono';
      btn.title = '현재 아카이브 데이터를 소스 파일(data/archive.json)에 영구 저장';
      btn.innerHTML = `<span>💾</span><span>Save</span>`;
      document.body.appendChild(btn);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.saveToSourceFile();
      });
    }
  }

  showSaveToast(msg, isError = false) {
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

    if (this._saveToastTimer) clearTimeout(this._saveToastTimer);
    this._saveToastTimer = setTimeout(() => {
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

  async saveToSourceFile(options = {}) {
    const silent = options.silent || false;
    const saveBtn = document.getElementById('global-floating-save-btn');
    if (saveBtn) {
      saveBtn.classList.add('is-saving');
      saveBtn.innerHTML = `<span>⏳</span><span>Saving...</span>`;
    }

    try {
      const objects = this.getObjects();
      const memos = this.getMemos();
      const fieldResearch = this.getResearchList ? this.getResearchList() : [];
      let memoPositions = {};
      let memoConnections = [];
      try {
        memoPositions = JSON.parse(localStorage.getItem('archive_memo_positions_v1') || '{}');
      } catch (e) {}
      try {
        memoConnections = JSON.parse(localStorage.getItem('archive_memo_connections_v1') || '[]');
      } catch (e) {}

      const payload = {
        objects,
        memos,
        fieldResearch,
        memoPositions,
        memoConnections,
        deletedObjectIds: this.deletedObjectIds || [],
        deletedMemoIds: this.deletedMemoIds || []
      };

      const res = await fetch('/api/save-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log('[Archive] Source file saved successfully:', data);

      if (saveBtn) {
        saveBtn.classList.remove('is-saving');
        saveBtn.innerHTML = `<span>✓</span><span>Saved!</span>`;
        setTimeout(() => {
          saveBtn.innerHTML = `<span>💾</span><span>Save</span>`;
        }, 2500);
      }

      if (!silent) {
        const objCount = objects.length;
        const memoCount = memos.length;
        this.showSaveToast(`💾 소스 파일(data/archive.json)에 영구 저장되었습니다! (사물 ${objCount}개, 메모 ${memoCount}개)`);
      }
      return data;
    } catch (err) {
      console.error('[Archive] Save error:', err);
      if (saveBtn) {
        saveBtn.classList.remove('is-saving');
        saveBtn.innerHTML = `<span>⚠️</span><span>Error</span>`;
        setTimeout(() => {
          saveBtn.innerHTML = `<span>💾</span><span>Save</span>`;
        }, 3000);
      }
      if (!silent) {
        this.showSaveToast(`⚠️ 소스 파일 저장 실패: ${err.message}`, true);
      }
      return null;
    }
  }

  deletePhoto(objId, photoIdx, skipTrash = false) {
    const obj = this.getObjectById(objId);
    if (!obj || !obj.images || !obj.images[photoIdx]) return null;
    const removedSrc = obj.images[photoIdx];
    const wasRep = (obj.representativeImage === removedSrc);

    if (!skipTrash) {
      this.moveToTrash('photo', { id: `${objId}-photo-${photoIdx}`, title: `${obj.title} 사진` }, {
        objectId: objId,
        index: photoIdx,
        imageSrc: removedSrc,
        wasRepresentative: wasRep
      });
    }

    obj.images.splice(photoIdx, 1);
    if (wasRep) {
      obj.representativeImage = obj.images.length ? obj.images[0] : '';
    }
    this.saveObject(obj);
    return obj;
  }

  saveObject(obj) {
    if (!obj.id) {
      let maxNum = 0;
      this.data.objects.forEach(o => {
        const match = o.id && o.id.match(/^obj-(\d+)$/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
      });
      const num = String(maxNum + 1).padStart(3, '0');
      obj.id = `obj-${num}`;
    }

    const idx = this.data.objects.findIndex(o => o.id === obj.id);
    if (idx >= 0) {
      this.data.objects[idx] = { ...this.data.objects[idx], ...obj };
    } else {
      this.data.objects.unshift(obj);
    }

    this.persistCustom();
    window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'object', id: obj.id } }));
    return obj;
  }

  deleteObject(id, skipTrash = false) {
    const obj = this.getObjectById(id);
    if (!obj) return;

    if (!skipTrash) {
      const attachedMemos = this.data.memos.filter(m => m.objectId === id);
      const memoPosMap = {};
      try {
        const posRaw = localStorage.getItem('archive_memo_positions_v1');
        if (posRaw) {
          const parsed = JSON.parse(posRaw);
          attachedMemos.forEach(m => { if (parsed[m.id]) memoPosMap[m.id] = parsed[m.id]; });
        }
      } catch (e) {}

      let memoConns = [];
      try {
        const connRaw = localStorage.getItem('archive_memo_connections_v1');
        if (connRaw) {
          const parsed = JSON.parse(connRaw);
          memoConns = parsed.filter(c => {
            const f = c.fromMemoId || c.sourceId;
            const t = c.toMemoId || c.targetId;
            return attachedMemos.some(m => m.id === f || m.id === t);
          });
        }
      } catch (e) {}

      this.moveToTrash('object', obj, {
        object: JSON.parse(JSON.stringify(obj)),
        attachedMemos: JSON.parse(JSON.stringify(attachedMemos)),
        memoPositions: memoPosMap,
        memoConnections: memoConns
      });
    }

    if (!this.deletedObjectIds) this.deletedObjectIds = [];
    if (!this.deletedObjectIds.includes(id)) this.deletedObjectIds.push(id);
    this.data.objects = this.data.objects.filter(o => o.id !== id);
    this.data.objects.forEach(o => {
      if (o.constellation) {
        o.constellation = o.constellation.filter(cId => cId !== id);
      }
    });

    // Also mark all attached memos as deleted so they do not resurrect on reload
    if (!this.deletedMemoIds) this.deletedMemoIds = [];
    const attachedMemos = this.data.memos.filter(m => m.objectId === id);
    attachedMemos.forEach(m => {
      if (!this.deletedMemoIds.includes(m.id)) this.deletedMemoIds.push(m.id);
      if (window.keywordService) {
        window.keywordService.deleteMemoAnnotations(m.id);
      }
      try {
        const posRaw = localStorage.getItem('archive_memo_positions_v1');
        if (posRaw) {
          const positions = JSON.parse(posRaw);
          if (positions[m.id]) {
            delete positions[m.id];
            localStorage.setItem('archive_memo_positions_v1', JSON.stringify(positions));
          }
        }
      } catch (e) {}
      try {
        const connRaw = localStorage.getItem('archive_memo_connections_v1');
        if (connRaw) {
          let conns = JSON.parse(connRaw);
          conns = conns.filter(c => c.fromMemoId !== m.id && c.toMemoId !== m.id && c.sourceId !== m.id && c.targetId !== m.id);
          localStorage.setItem('archive_memo_connections_v1', JSON.stringify(conns));
        }
      } catch (e) {}
    });
    this.data.memos = this.data.memos.filter(m => m.objectId !== id);
    this.persistCustom();

    // Clean up constellation positions and connections when object is deleted
    try {
      const posRaw = localStorage.getItem('archive_constellation_positions_v1');
      if (posRaw) {
        const positions = JSON.parse(posRaw);
        if (positions[id]) {
          delete positions[id];
          localStorage.setItem('archive_constellation_positions_v1', JSON.stringify(positions));
        }
      }
    } catch (e) {
      console.warn('[Constellation] Position cleanup error:', e);
    }

    try {
      const connRaw = localStorage.getItem('archive_constellation_connections_v1');
      if (connRaw) {
        let conns = JSON.parse(connRaw);
        conns = conns.filter(c => c.fromObjectId !== id && c.toObjectId !== id);
        localStorage.setItem('archive_constellation_connections_v1', JSON.stringify(conns));
      }
    } catch (e) {
      console.warn('[Constellation] Connection cleanup error:', e);
    }

    window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'object-deleted', id } }));
  }

  // --- MEMOS ---
  getMemos() {
    return this.data.memos || [];
  }

  getMemoById(id) {
    return this.getMemos().find(m => m.id === id);
  }

  getMemosForObject(objId) {
    return this.getMemos().filter(m => m.objectId === objId);
  }

  saveMemo(memo) {
    if (!memo.id) {
      let maxNum = 0;
      this.data.memos.forEach(m => {
        const match = m.id && m.id.match(/^memo-(\d+)$/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
      });
      const num = String(maxNum + 1).padStart(3, '0');
      memo.id = `memo-${num}`;
    }

    // Ensure it is not in deletedMemoIds
    if (this.deletedMemoIds && this.deletedMemoIds.includes(memo.id)) {
      this.deletedMemoIds = this.deletedMemoIds.filter(dId => dId !== memo.id);
    }

    const idx = this.data.memos.findIndex(m => m.id === memo.id);
    if (idx >= 0) {
      this.data.memos[idx] = { ...this.data.memos[idx], ...memo };
    } else {
      this.data.memos.unshift(memo);
    }

    this.persistCustom();
    window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'memo', id: memo.id } }));
    return memo;
  }

  deleteMemo(id, skipTrash = false) {
    const memo = this.getMemoById(id);
    if (!memo) return;

    if (!skipTrash) {
      let memoPos = null;
      try {
        const posRaw = localStorage.getItem('archive_memo_positions_v1');
        if (posRaw) {
          const parsed = JSON.parse(posRaw);
          if (parsed[id]) memoPos = parsed[id];
        }
      } catch (e) {}

      let memoConns = [];
      try {
        const connRaw = localStorage.getItem('archive_memo_connections_v1');
        if (connRaw) {
          const parsed = JSON.parse(connRaw);
          memoConns = parsed.filter(c => (c.fromMemoId || c.sourceId) === id || (c.toMemoId || c.targetId) === id);
        }
      } catch (e) {}

      this.moveToTrash('memo', memo, {
        memo: JSON.parse(JSON.stringify(memo)),
        position: memoPos,
        connections: memoConns
      });
    }

    if (!this.deletedMemoIds) this.deletedMemoIds = [];
    if (!this.deletedMemoIds.includes(id)) this.deletedMemoIds.push(id);
    this.data.memos = this.data.memos.filter(m => m.id !== id);
    this.persistCustom();

    // Clean up memo positions
    try {
      const posRaw = localStorage.getItem('archive_memo_positions_v1');
      if (posRaw) {
        const positions = JSON.parse(posRaw);
        if (positions[id]) {
          delete positions[id];
          localStorage.setItem('archive_memo_positions_v1', JSON.stringify(positions));
        }
      }
    } catch (e) {
      console.warn('[Memo] Position cleanup warning:', e);
    }

    // Clean up memo connections
    try {
      const connRaw = localStorage.getItem('archive_memo_connections_v1');
      if (connRaw) {
        let conns = JSON.parse(connRaw);
        conns = conns.filter(c => c.fromMemoId !== id && c.toMemoId !== id);
        localStorage.setItem('archive_memo_connections_v1', JSON.stringify(conns));
      }
    } catch (e) {
      console.warn('[Memo] Connection cleanup warning:', e);
    }

    if (window.keywordService) {
      window.keywordService.deleteMemoAnnotations(id);
    }

    window.dispatchEvent(new CustomEvent('archive-updated', { detail: { type: 'memo-deleted', id } }));
  }

  // --- HEADER (EXACT 4 NAV ITEMS) ---
  renderHeader() {
    const header = document.querySelector('.app-header');
    if (!header) return;

    const editActive = isCmsEditMode();

    header.innerHTML = `
      <div class="header-container">
        <nav class="primary-nav mono">
          <a href="index.html" class="nav-link ${this.activePage === 'archive' ? 'active' : ''}">Archive</a>
          <a href="photo.html" class="nav-link ${this.activePage === 'photo' ? 'active' : ''}">Photo</a>
          <a href="field-research.html" class="nav-link ${this.activePage === 'field-research' ? 'active' : ''}">Field Research</a>
          <a href="memo.html" class="nav-link ${this.activePage === 'memo' ? 'active' : ''}">Memo</a>
          <a href="trash.html" class="nav-link nav-link-trash ${this.activePage === 'trash' ? 'active' : ''}" style="font-size: 11px; opacity: 0.7;">Trash</a>
        </nav>

        <div class="header-side-tools">
          <button id="btn-cms-edit-toggle" class="btn-add-discreet mono ${editActive ? 'active' : ''}" style="${editActive ? 'color:#C00000; font-weight:500;' : ''}" title="사이트 인라인 편집 모드 전환">
            ${editActive ? '[Edit: ON]' : '[Edit]'}
          </button>
          <button id="btn-add-object-trigger" class="btn-add-discreet mono" title="새 사물 기록 추가">+ Add</button>
        </div>
      </div>
    `;

    document.getElementById('btn-cms-edit-toggle')?.addEventListener('click', () => {
      toggleCmsEditMode();
      this.renderHeader();
    });

    document.getElementById('btn-add-object-trigger')?.addEventListener('click', () => {
      this.openRegistrationModal();
    });
  }

  // --- REGISTRATION MODAL ---
  initRegistrationModal() {
    let modal = document.getElementById('register-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'register-modal';
      modal.className = 'aom-modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="aom-modal-card">
          <div class="modal-top mono">
            <span>사물 등록</span>
            <button class="modal-close" id="reg-modal-close">&times;</button>
          </div>

          <form id="reg-form" class="modal-body-form">
            <div class="field-block">
              <label class="field-label mono">제목</label>
              <input type="text" id="reg-title" class="field-input" placeholder="사물 명칭..." required />
            </div>

            <div class="field-block">
              <label class="field-label mono">사진 (여러 장 선택 가능 &middot; 클릭하여 대표 이미지 지정)</label>
              <input type="file" id="reg-files" class="field-input" multiple accept="image/*" />
              <div id="reg-thumbs-preview" class="thumbs-preview-row"></div>
            </div>

            <div class="field-block">
              <label class="field-label mono">시간</label>
              <input type="text" id="reg-time" class="field-input mono" required />
            </div>

            <div class="field-block">
              <label class="field-label mono">연결 사물 (선택)</label>
              <div id="reg-constellation-checks" class="checks-box mono"></div>
            </div>

            <div class="field-block" style="border-top: 1px dotted #ccc; padding-top: 12px;">
              <label class="field-label mono">메모 (선택)</label>
              <input type="text" id="reg-memo-title" class="field-input" placeholder="메모 제목..." style="margin-bottom: 6px;" />
              <textarea id="reg-memo-content" class="field-textarea" rows="3" placeholder="메모 내용..."></textarea>
            </div>

            <div class="modal-bottom mono">
              <button type="button" class="btn-cancel" id="reg-modal-cancel">취소</button>
              <button type="submit" class="btn-submit">저장</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    }

    document.getElementById('reg-modal-close').addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('reg-modal-cancel').addEventListener('click', () => modal.style.display = 'none');

    this.regImages = [];
    this.regRepIndex = 0;

    const fileInput = document.getElementById('reg-files');
    const previewRow = document.getElementById('reg-thumbs-preview');

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;

      for (const file of files) {
        try {
          const compressed = await compressImageFile(file);
          this.regImages.push(compressed);
          this.renderRegThumbs(previewRow);
        } catch (err) {
          console.warn('[Image] Compression fallback:', err);
        }
      }
    });

    document.getElementById('reg-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('reg-title').value.trim();
      const timestamp = document.getElementById('reg-time').value.trim();

      const checkedConns = Array.from(document.querySelectorAll('#reg-constellation-checks input[type="checkbox"]:checked'))
                               .map(cb => cb.value);

      const images = this.regImages.length > 0 ? this.regImages : ['assets/images/obj-001-1.svg'];
      const representativeImage = images[this.regRepIndex] || images[0];

      const newObj = {
        title,
        images,
        representativeImage,
        timestamp,
        constellation: checkedConns
      };

      const saved = this.saveObject(newObj);

      // Optional memo
      const mTitle = document.getElementById('reg-memo-title').value.trim();
      const mContent = document.getElementById('reg-memo-content').value.trim();
      if (mTitle || mContent) {
        this.saveMemo({
          objectId: saved.id,
          title: mTitle || '기록',
          content: mContent,
          timestamp
        });
      }

      modal.style.display = 'none';
      if (this.activePage === 'archive') {
        window.location.href = `index.html?id=${saved.id}`;
      } else {
        window.location.reload();
      }
    });
  }

  renderRegThumbs(container) {
    if (!container) return;
    container.innerHTML = this.regImages.map((src, i) => `
      <div class="thumb-cell ${i === this.regRepIndex ? 'primary' : ''}">
        <img src="${src}" class="thumb-img-crop" />
        <span class="tag-rep mono">${i === this.regRepIndex ? '대표' : ''}</span>
        <button type="button" class="thumb-btn-set mono" data-idx="${i}">대표</button>
        <button type="button" class="thumb-btn-del mono" data-idx="${i}">&times;</button>
      </div>
    `).join('');

    container.querySelectorAll('.thumb-btn-set').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.regRepIndex = parseInt(b.getAttribute('data-idx'), 10);
        this.renderRegThumbs(container);
      });
    });

    container.querySelectorAll('.thumb-btn-del').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(b.getAttribute('data-idx'), 10);
        this.regImages.splice(idx, 1);
        if (this.regRepIndex >= this.regImages.length) {
          this.regRepIndex = Math.max(0, this.regImages.length - 1);
        }
        this.renderRegThumbs(container);
      });
    });
  }

  openRegistrationModal() {
    const modal = document.getElementById('register-modal');
    if (!modal) return;

    this.regImages = [];
    this.regRepIndex = 0;
    document.getElementById('reg-form').reset();
    document.getElementById('reg-thumbs-preview').innerHTML = '';

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('reg-time').value = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const checksBox = document.getElementById('reg-constellation-checks');
    checksBox.innerHTML = this.getObjects().map(o => `
      <label class="check-item">
        <input type="checkbox" value="${o.id}">
        <span>${o.title} (${o.id})</span>
      </label>
    `).join('') || '<span class="text-caption">연결 가능한 다른 사물이 없습니다.</span>';

    modal.style.display = 'flex';
    document.getElementById('reg-title').focus();
  }

  // --- LIGHTBOX ---
  initLightbox() {
    let lb = document.getElementById('global-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'global-lightbox';
      lb.className = 'lightbox-frame';
      lb.style.display = 'none';
      lb.innerHTML = `
        <button class="lb-button close mono" id="lb-close">&times;</button>
        <button class="lb-button prev mono" id="lb-prev">&lang;</button>
        <div class="lb-center">
          <img id="lb-img" class="lb-image" src="" />
          <div class="lb-counter mono" id="lb-counter">1 / 1</div>
        </div>
        <button class="lb-button next mono" id="lb-next">&rang;</button>
      `;
      document.body.appendChild(lb);
    }

    document.getElementById('lb-close').addEventListener('click', () => lb.style.display = 'none');
    document.getElementById('lb-prev').addEventListener('click', () => this.stepLightbox(-1));
    document.getElementById('lb-next').addEventListener('click', () => this.stepLightbox(1));

    document.addEventListener('keydown', (e) => {
      if (lb.style.display === 'flex') {
        if (e.key === 'Escape') lb.style.display = 'none';
        if (e.key === 'ArrowLeft') this.stepLightbox(-1);
        if (e.key === 'ArrowRight') this.stepLightbox(1);
      }
    });

    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.classList.contains('lb-center')) lb.style.display = 'none';
    });
  }

  openLightbox(images, startIndex = 0) {
    if (!images || !images.length) return;
    this.lightbox.images = images;
    this.lightbox.currentIndex = startIndex;

    const lb = document.getElementById('global-lightbox');
    this.updateLightboxDisplay();
    lb.style.display = 'flex';
  }

  stepLightbox(delta) {
    const total = this.lightbox.images.length;
    this.lightbox.currentIndex = (this.lightbox.currentIndex + delta + total) % total;
    this.updateLightboxDisplay();
  }

  updateLightboxDisplay() {
    const imgEl = document.getElementById('lb-img');
    const counterEl = document.getElementById('lb-counter');
    const src = this.lightbox.images[this.lightbox.currentIndex];

    imgEl.src = src;
    counterEl.textContent = `${this.lightbox.currentIndex + 1} / ${this.lightbox.images.length}`;
  }

  initMenuPopover() {
    let menu = document.getElementById('editorial-global-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'editorial-global-menu';
      menu.className = 'editorial-menu-dropdown';
      document.body.appendChild(menu);

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.col-header-menu-btn') && !menu.contains(e.target)) {
          menu.style.display = 'none';
        }
      });
    }

    const editActive = isCmsEditMode();

    menu.innerHTML = `
      <a href="index.html" class="editorial-menu-item ${this.activePage === 'archive' ? 'active' : ''}">
        <span>Archive</span>
        <span class="mono" style="opacity: 0.4;">01</span>
      </a>
      <a href="photo.html" class="editorial-menu-item ${this.activePage === 'photo' ? 'active' : ''}">
        <span>Photo</span>
        <span class="mono" style="opacity: 0.4;">02</span>
      </a>
      <a href="field-research.html" class="editorial-menu-item ${this.activePage === 'field-research' ? 'active' : ''}">
        <span>Field Research</span>
        <span class="mono" style="opacity: 0.4;">03</span>
      </a>
      <a href="memo.html" class="editorial-menu-item ${this.activePage === 'memo' ? 'active' : ''}">
        <span>Memo</span>
        <span class="mono" style="opacity: 0.4;">04</span>
      </a>
      <a href="trash.html" class="editorial-menu-item ${this.activePage === 'trash' ? 'active' : ''}">
        <span>Trash</span>
        <span class="mono" style="opacity: 0.4;">05</span>
      </a>
      <div style="height: 1px; background: #EAEAEA; margin: 4px 0;"></div>
      <button type="button" id="menu-btn-save-file" class="editorial-menu-item" style="background: none; border: none; width: 100%; cursor: pointer; text-align: left; font-weight: 500;">
        <span>💾 Save to File</span>
        <span class="mono" style="opacity: 0.6; font-size: 11px;">[JSON]</span>
      </button>
      <button type="button" id="menu-btn-toggle-edit" class="editorial-menu-item" style="background: none; border: none; width: 100%; cursor: pointer; text-align: left;">
        <span>Edit Mode</span>
        <span class="mono" style="color: ${editActive ? '#C00000' : '#777777'}; font-weight: ${editActive ? '500' : 'normal'}; font-style: ${editActive ? 'italic' : 'normal'};">${editActive ? '[ON]' : '[OFF]'}</span>
      </button>
      <button type="button" id="menu-btn-register" class="editorial-menu-item" style="background: none; border: none; width: 100%; cursor: pointer; text-align: left;">
        <span>+ Add Object</span>
        <span class="mono" style="opacity: 0.4;">&plus;</span>
      </button>
    `;

    menu.querySelectorAll('a.editorial-menu-item').forEach(link => {
      link.addEventListener('click', () => {
        menu.style.display = 'none';
      });
    });

    document.getElementById('menu-btn-save-file')?.addEventListener('click', () => {
      menu.style.display = 'none';
      this.saveToSourceFile();
    });

    document.getElementById('menu-btn-toggle-edit')?.addEventListener('click', () => {
      menu.style.display = 'none';
      toggleCmsEditMode();
      this.renderHeader();
    });

    document.getElementById('menu-btn-register')?.addEventListener('click', () => {
      menu.style.display = 'none';
      this.openRegistrationModal();
    });

    // Attach to all "=" buttons in column headers once
    document.querySelectorAll('.col-header-menu-btn').forEach(btn => {
      if (btn._menuAttached) return;
      btn._menuAttached = true;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const isVisible = (menu.style.display === 'flex');
        if (isVisible) {
          menu.style.display = 'none';
        } else {
          this.initMenuPopover(); // re-render popover with latest state
          const rect = btn.getBoundingClientRect();
          menu.style.top = `${rect.bottom + 6}px`;
          menu.style.left = `${Math.max(10, Math.min(window.innerWidth - 220, rect.left - 160))}px`;
          menu.style.display = 'flex';
        }
      });
    });
  }
}

window.app = new ArchiveApp();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
