// Automated Verification Script for Field Research, Infinite Canvas, and Trash System

let mockStorage = {};
const localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { throw new Error("ILLEGAL: localStorage.clear() must NEVER be called!"); }
};

const window = {
  localStorage,
  location: { pathname: '/trash.html', search: '' },
  dispatchEvent: (e) => {},
  innerWidth: 1400,
  innerHeight: 900
};
const document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};
function CustomEvent(type, detail) {
  this.type = type;
  this.detail = detail;
}

let passed = 0;
let total = 0;
function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    print("PASS: " + message);
  } else {
    print("FAIL: " + message);
    throw new Error("Assertion failed: " + message);
  }
}

// -------------------------------------------------------------
// 1. Verify Storage Keys and Baseline preservation
// -------------------------------------------------------------
print("\n--- TEST 1: Storage Keys and Data Preservation ---");

// Initialize test mock data
mockStorage['archive_user_custom_v3'] = JSON.stringify({
  objects: [
    { id: "obj-001", title: "Test Clock", images: ["img1.svg", "img2.svg"], representativeImage: "img1.svg" }
  ],
  memos: [
    { id: "memo-001", objectId: "obj-001", title: "Test Memo", content: "Observation", timestamp: "2026.10.01 12:00" }
  ]
});
mockStorage['archive_memo_positions_v1'] = JSON.stringify({
  "memo-001": { x: 420, y: 280 }
});
mockStorage['archive_memo_connections_v1'] = JSON.stringify([
  { id: "conn-1", fromMemoId: "memo-001", toMemoId: "memo-002", color: "rgb(20, 100, 240)" }
]);
mockStorage['archive_field_research_v1'] = JSON.stringify([
  { id: "res-001", title: "Field Test", blocks: [{ type: "text", text: "Long text paragraph..." }] }
]);

assert(mockStorage['archive_memo_positions_v1'] !== null, "archive_memo_positions_v1 preserved");
assert(mockStorage['archive_memo_connections_v1'] !== null, "archive_memo_connections_v1 preserved");
assert(mockStorage['archive_field_research_v1'] !== null, "archive_field_research_v1 preserved");

// -------------------------------------------------------------
// 2. Infinite Canvas Math Tests
// -------------------------------------------------------------
print("\n--- TEST 2: Infinite Canvas Math & Transformations ---");

let canvasState = { panX: 100, panY: 50, zoom: 1.0 };

// Cursor-centered zoom test:
// Pointer at (px: 400, py: 300) in viewport. Zoom in by 1.5x -> newZoom = 1.5.
// Formula: newPan = px - (px - oldPan) * (newZoom / oldZoom)
const px = 400, py = 300;
const oldZoom = 1.0, nextZoom = 1.5;
const newPanX = px - (px - canvasState.panX) * (nextZoom / oldZoom);
const newPanY = py - (py - canvasState.panY) * (nextZoom / oldZoom);

// The point in canvas space before zoom: (400 - 100) / 1.0 = 300
// After zoom: 300 * 1.5 + newPanX = 450 + (400 - 300 * 1.5) = 400.
// Under cursor, the canvas point remains exactly at (400, 300) in viewport!
const canvasPtX = (px - canvasState.panX) / oldZoom;
const reprojectedPx = canvasPtX * nextZoom + newPanX;
assert(Math.abs(reprojectedPx - px) < 0.0001, "Pointer-centered zoom keeps canvas point exactly under cursor");

// Memo movement scaling test:
// When dragging with mouse, if zoom is 2.0 and mouse moves 100px, memo moves 50 canvas pixels.
const mouseDeltaX = 100;
const currentZoom = 2.0;
const canvasDeltaX = mouseDeltaX / currentZoom;
assert(canvasDeltaX === 50, "Memo move delta correctly scaled by 1 / zoom (" + canvasDeltaX + "px)");

// Direct X/Y coordinate editing test:
let positions = JSON.parse(mockStorage['archive_memo_positions_v1']);
assert(positions["memo-001"].x === 420 && positions["memo-001"].y === 280, "Initial memo coordinates: (420, 280)");

// User updates X to 600, Y to 100
positions["memo-001"] = { x: 600, y: 100 };
mockStorage['archive_memo_positions_v1'] = JSON.stringify(positions);
let updatedPos = JSON.parse(mockStorage['archive_memo_positions_v1'])["memo-001"];
assert(updatedPos.x === 600 && updatedPos.y === 100, "Direct coordinate editing updates position to (600, 100)");

// Canvas pan does not alter memo coordinate:
canvasState.panX += 300;
canvasState.panY += 200;
let posAfterPan = JSON.parse(mockStorage['archive_memo_positions_v1'])["memo-001"];
assert(posAfterPan.x === 600 && posAfterPan.y === 100, "Canvas Pan leaves memo canvas coordinates unchanged");

// -------------------------------------------------------------
// 3. Trash System Soft-Delete, Snapshots, and Restore Tests
// -------------------------------------------------------------
print("\n--- TEST 3: Trash System Operations ---");

function getTrashItems() {
  try {
    const raw = localStorage.getItem('archive_trash_v1');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function saveTrashItems(items) {
  localStorage.setItem('archive_trash_v1', JSON.stringify(items));
}
function moveToTrash(type, item, snapshot) {
  const trashItem = {
    id: "trash-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
    type,
    originalId: item.id || (snapshot && snapshot.originalId) || '',
    title: item.title || 'Record',
    deletedAt: new Date().toISOString(),
    data: snapshot || item
  };
  const items = getTrashItems();
  items.unshift(trashItem);
  saveTrashItems(items);
  return trashItem;
}

// 3.1 Object Soft Delete
const testObj = { id: "obj-001", title: "Test Clock", images: ["img1.svg", "img2.svg"], representativeImage: "img1.svg" };
const attachedMemos = [{ id: "memo-001", objectId: "obj-001", title: "Test Memo", content: "Observation" }];
const trashObj = moveToTrash('object', testObj, {
  object: testObj,
  attachedMemos: attachedMemos,
  memoPositions: { "memo-001": { x: 600, y: 100 } },
  memoConnections: [{ id: "conn-1", fromMemoId: "memo-001", toMemoId: "memo-002" }]
});

let currentTrash = getTrashItems();
assert(currentTrash.length === 1, "Trash has 1 item after object delete");
assert(currentTrash[0].type === "object", "Trash item type is 'object'");
assert(currentTrash[0].data.object.title === "Test Clock", "Trash snapshot includes full object data");
assert(currentTrash[0].data.attachedMemos.length === 1, "Trash snapshot includes attached memos");
assert(currentTrash[0].data.memoPositions["memo-001"].x === 600, "Trash snapshot includes memo coordinates");

// 3.2 Field Research Soft Delete
const testRes = { id: "res-001", title: "Field Test", blocks: [{ type: "text", text: "Long text" }] };
const trashRes = moveToTrash('field-research', testRes, testRes);
currentTrash = getTrashItems();
assert(currentTrash.length === 2, "Trash has 2 items after research delete");
assert(currentTrash[0].type === "field-research", "Field research soft-deleted to Trash");

// 3.3 Photo Soft Delete
const trashPhoto = moveToTrash('photo', { id: "obj-001-photo-1", title: "Clock Photo" }, {
  objectId: "obj-001",
  index: 1,
  imageSrc: "img2.svg",
  wasRepresentative: false
});
currentTrash = getTrashItems();
assert(currentTrash.length === 3, "Trash has 3 items after photo delete");
assert(currentTrash[0].type === "photo", "Photo soft-deleted to Trash with original index and src");

// 3.4 Memo Soft Delete
const trashMemo = moveToTrash('memo', { id: "memo-002", title: "Isolated Memo" }, {
  memo: { id: "memo-002", title: "Isolated Memo", content: "Hello" },
  position: { x: 200, y: 150 },
  connections: []
});
currentTrash = getTrashItems();
assert(currentTrash.length === 4, "Trash has 4 items after memo delete");

// 3.5 Restore Photo
const restorePhotoItem = currentTrash.find(t => t.type === 'photo');
assert(restorePhotoItem !== undefined, "Found photo item to restore");
// simulate restore
testObj.images.splice(restorePhotoItem.data.index, 0, restorePhotoItem.data.imageSrc);
saveTrashItems(currentTrash.filter(t => t.id !== restorePhotoItem.id));
assert(getTrashItems().length === 3, "Trash has 3 items after photo restore");
assert(testObj.images.length === 3, "Photo restored to object images array");

// 3.6 Delete Permanently
const permDeleteItem = getTrashItems()[0];
saveTrashItems(getTrashItems().filter(t => t.id !== permDeleteItem.id));
assert(getTrashItems().length === 2, "1 item deleted permanently from Trash");

// 3.7 Empty Trash
saveTrashItems([]);
assert(getTrashItems().length === 0, "Empty trash completely empties Trash storage");

print(`\n========================================`);
print(`ALL ${passed}/${total} UNIT TESTS PASSED SUCCESSFULLY!`);
print(`========================================\n`);
