/* ============================================================
   KanbanFlow — Glassmorphism Board
   app.js — Fixed & Stable Version
   ============================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────
const STATE = {
  tasks: {},
  columns: [
    { id: 'todo',       label: 'Todo',        dotClass: 'dot-todo',        custom: false },
    { id: 'inprogress', label: 'In Progress',  dotClass: 'dot-inprogress',  custom: false },
    { id: 'done',       label: 'Done',         dotClass: 'dot-done',        custom: false },
  ],
  dragId: null,
  filterPriority: 'all',
  searchQuery: '',
  theme: 'dark',
  pendingColumn: 'todo',   // column targeted for new task
};

// ── Storage ──────────────────────────────────────────────────
const S_TASKS   = 'kanbanflow_tasks_v2';
const S_COLUMNS = 'kanbanflow_columns_v2';
const S_THEME   = 'kanbanflow_theme_v1';

function saveData() {
  localStorage.setItem(S_TASKS,   JSON.stringify(STATE.tasks));
  localStorage.setItem(S_COLUMNS, JSON.stringify(STATE.columns));
}

function loadData() {
  try {
    const t = localStorage.getItem(S_TASKS);
    const c = localStorage.getItem(S_COLUMNS);
    const th= localStorage.getItem(S_THEME);
    if (t)  STATE.tasks   = JSON.parse(t);
    if (c)  STATE.columns = JSON.parse(c);
    if (th) STATE.theme   = th;
  } catch (e) { console.warn('Storage error:', e); }
}

// ── Helpers ──────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const wrap  = document.getElementById('toastContainer');
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type]} toast-icon"></i><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 350); }, 2800);
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats() {
  const all  = Object.keys(STATE.tasks).length;
  const done = Object.values(STATE.tasks).filter(t => t.column === 'done').length;
  document.getElementById('boardStats').textContent = all ? `${done}/${all} done` : '';
}

// ── Full Board Render ─────────────────────────────────────────
function renderBoard() {
  const board     = document.getElementById('board');
  const addColBtn = document.getElementById('addColumnBtn').closest('.add-column-wrap');

  // Remove all existing column elements
  board.querySelectorAll('.column').forEach(c => c.remove());

  // Create & insert columns in order
  STATE.columns.forEach(col => {
    board.insertBefore(buildColumn(col), addColBtn);
  });

  // Populate tasks into each column
  STATE.columns.forEach(col => {
    const list = document.getElementById(`list-${col.id}`);
    if (!list) return;

    const colTasks = Object.values(STATE.tasks)
      .filter(t => t.column === col.id)
      .sort((a, b) => a.createdAt - b.createdAt);

    if (colTasks.length === 0) {
      list.appendChild(emptyState());
    } else {
      colTasks.forEach(task => list.appendChild(buildCard(task)));
    }

    const countEl = document.getElementById(`count-${col.id}`);
    if (countEl) countEl.textContent = colTasks.length;
  });

  applyFiltersToAll();
  updateStats();
  setupColumnDragListeners();
}

function buildColumn(col) {
  const div = document.createElement('div');
  div.className   = 'column';
  div.id          = `col-${col.id}`;
  div.dataset.column = col.id;

  const dotStyle = col.custom && col.color
    ? `style="background:${col.color};box-shadow:0 0 8px ${col.color}"`
    : '';
  const dotClass = col.dotClass || 'col-dot';
  const deleteBtn = col.custom
    ? `<button class="card-btn del-col-btn" data-col-id="${col.id}" title="Delete Column">
         <i class="fa-solid fa-trash"></i>
       </button>`
    : '';

  div.innerHTML = `
    <div class="column-header">
      <div class="col-title-wrap">
        <span class="col-dot ${dotClass}" ${dotStyle}></span>
        <h2 class="col-title">${esc(col.label)}</h2>
        <span class="col-count" id="count-${col.id}">0</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        ${deleteBtn}
        <button class="add-task-btn" data-column="${col.id}" title="Add Task">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    </div>
    <div class="task-list${col.id === 'done' ? ' done-column' : ''}"
         id="list-${col.id}" data-column="${col.id}">
      <div class="drop-indicator"></div>
    </div>`;

  return div;
}

function emptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `<i class="fa-regular fa-clipboard"></i><span>No tasks yet</span>`;
  return div;
}

// ── Task Card ────────────────────────────────────────────────
function buildCard(task) {
  const card = document.createElement('div');
  const colorClass = task.color && task.color !== 'default' ? ` color-${task.color}` : '';
  card.className   = `task-card${colorClass}`;
  card.id          = `task-${task.id}`;
  card.draggable   = true;
  card.dataset.taskId = task.id;

  card.innerHTML = `
    <div class="card-top">
      <h3 class="card-title">${esc(task.title)}</h3>
      <div class="card-actions">
        <button class="card-btn edit-btn" data-task-id="${task.id}" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="card-btn del-btn" data-task-id="${task.id}" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
    ${task.desc ? `<p class="card-desc">${esc(task.desc)}</p>` : ''}
    <div class="card-meta">
      <span class="priority-badge ${task.priority}">${task.priority}</span>
      <span class="card-date">${formatDate(task.createdAt)}</span>
    </div>`;

  // Drag events
  card.addEventListener('dragstart', e => {
    STATE.dragId = task.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
  });

  // Touch drag
  card.addEventListener('touchstart', onTouchStart, { passive: true });

  return card;
}

// ── Event Delegation on Board ─────────────────────────────────
// One listener handles ALL dynamic buttons (add task, edit, delete, delete column)
function setupBoardDelegation() {
  const board = document.getElementById('board');

  board.addEventListener('click', e => {
    // ── Add Task Button ──────────────────────────────────────
    const addBtn = e.target.closest('.add-task-btn');
    if (addBtn) {
      e.stopPropagation();
      openAddModal(addBtn.dataset.column);
      return;
    }

    // ── Edit Task Button ─────────────────────────────────────
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
      e.stopPropagation();
      openEditModal(editBtn.dataset.taskId);
      return;
    }

    // ── Delete Task Button ───────────────────────────────────
    const delBtn = e.target.closest('.del-btn:not(.del-col-btn)');
    if (delBtn) {
      e.stopPropagation();
      openDeleteModal(delBtn.dataset.taskId);
      return;
    }

    // ── Delete Column Button ─────────────────────────────────
    const delColBtn = e.target.closest('.del-col-btn');
    if (delColBtn) {
      e.stopPropagation();
      const colId = delColBtn.dataset.colId;
      const col   = STATE.columns.find(c => c.id === colId);
      if (col && confirm(`Delete column "${col.label}"? Its tasks will move to Todo.`)) {
        deleteColumn(colId);
      }
      return;
    }
  });
}

// ── Drag & Drop (Desktop) ─────────────────────────────────────
function setupColumnDragListeners() {
  document.querySelectorAll('.task-list').forEach(list => {
    list.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.closest('.column').classList.add('drag-over');
    });

    list.addEventListener('dragleave', e => {
      if (!list.contains(e.relatedTarget)) {
        list.closest('.column').classList.remove('drag-over');
      }
    });

    list.addEventListener('drop', e => {
      e.preventDefault();
      list.closest('.column').classList.remove('drag-over');
      if (!STATE.dragId) return;

      const targetCol = list.dataset.column;
      const task      = STATE.tasks[STATE.dragId];
      if (!task || task.column === targetCol) return;

      task.column = targetCol;
      saveData();
      renderBoard();
      const colLabel = STATE.columns.find(c => c.id === targetCol)?.label || targetCol;
      showToast(`Moved to "${colLabel}"`, 'info');
    });
  });
}

// ── Touch Drag (Mobile) ───────────────────────────────────────
let _touchId = null, _touchClone = null, _origCard = null;

function onTouchStart(e) {
  const card  = e.currentTarget;
  _touchId    = card.dataset.taskId;
  _origCard   = card;
  STATE.dragId = _touchId;

  const rect  = card.getBoundingClientRect();
  _touchClone = card.cloneNode(true);
  Object.assign(_touchClone.style, {
    position: 'fixed', width: rect.width + 'px', top: rect.top + 'px',
    left: rect.left + 'px', opacity: '0.88', pointerEvents: 'none',
    zIndex: 9999, transform: 'scale(1.04)', boxShadow: '0 16px 40px rgba(0,0,0,.5)',
    transition: 'none',
  });
  document.body.appendChild(_touchClone);
  card.style.opacity = '0.3';

  document.addEventListener('touchmove',   _onTouchMove,   { passive: false });
  document.addEventListener('touchend',    _onTouchEnd);
  document.addEventListener('touchcancel', _cleanTouch);
}

function _onTouchMove(e) {
  e.preventDefault();
  const t = e.touches[0];
  if (_touchClone) {
    _touchClone.style.top  = (t.clientY - 30) + 'px';
    _touchClone.style.left = (t.clientX - 80) + 'px';
  }
  const el  = document.elementFromPoint(t.clientX, t.clientY);
  const col = el?.closest('.column');
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
  if (col) col.classList.add('drag-over');
}

function _onTouchEnd(e) {
  const t   = e.changedTouches[0];
  const el  = document.elementFromPoint(t.clientX, t.clientY);
  const list = el?.closest('.task-list');

  if (list && STATE.dragId) {
    const targetCol = list.dataset.column;
    const task      = STATE.tasks[STATE.dragId];
    if (task && task.column !== targetCol) {
      task.column = targetCol;
      saveData();
      renderBoard();
      const colLabel = STATE.columns.find(c => c.id === targetCol)?.label || targetCol;
      showToast(`Moved to "${colLabel}"`, 'info');
    }
  }
  _cleanTouch();
}

function _cleanTouch() {
  _touchClone?.remove(); _touchClone = null;
  if (_origCard) { _origCard.style.opacity = ''; _origCard = null; }
  _touchId = null;
  STATE.dragId = null;
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
  document.removeEventListener('touchmove',   _onTouchMove);
  document.removeEventListener('touchend',    _onTouchEnd);
  document.removeEventListener('touchcancel', _cleanTouch);
}

// ── Task Modal ────────────────────────────────────────────────
function openAddModal(column) {
  STATE.pendingColumn = column || 'todo';

  document.getElementById('modalTitle').textContent = 'New Task';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value  = '';
  document.getElementById('editingTaskId').value = '';
  document.getElementById('titleCount').textContent = '0/100';
  document.getElementById('descCount').textContent  = '0/500';

  setSelector('#prioritySelector .priority-opt', 'p', 'medium');
  setSelector('#colorSelector .color-opt', 'color', 'default');

  document.getElementById('taskModal').classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 200);
}

function openEditModal(taskId) {
  const task = STATE.tasks[taskId];
  if (!task) return;

  document.getElementById('modalTitle').textContent     = 'Edit Task';
  document.getElementById('taskTitle').value            = task.title;
  document.getElementById('taskDesc').value             = task.desc || '';
  document.getElementById('editingTaskId').value        = taskId;
  document.getElementById('titleCount').textContent     = `${task.title.length}/100`;
  document.getElementById('descCount').textContent      = `${(task.desc||'').length}/500`;

  setSelector('#prioritySelector .priority-opt', 'p',     task.priority);
  setSelector('#colorSelector .color-opt',       'color', task.color || 'default');

  document.getElementById('taskModal').classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 200);
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('open');
}

function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    const input = document.getElementById('taskTitle');
    input.style.borderColor = '#ff6b9d';
    input.focus();
    setTimeout(() => { input.style.borderColor = ''; }, 1500);
    return;
  }

  const desc     = document.getElementById('taskDesc').value.trim();
  const priority = document.querySelector('#prioritySelector .priority-opt.active')?.dataset.p     || 'medium';
  const color    = document.querySelector('#colorSelector .color-opt.active')?.dataset.color       || 'default';
  const editId   = document.getElementById('editingTaskId').value;

  if (editId) {
    STATE.tasks[editId] = { ...STATE.tasks[editId], title, desc, priority, color };
    saveData();
    renderBoard();
    showToast('Task updated ✓', 'success');
  } else {
    const id = uid();
    STATE.tasks[id] = {
      id, title, desc, priority, color,
      column: STATE.pendingColumn,
      createdAt: Date.now(),
    };
    saveData();
    renderBoard();
    showToast('Task created ✓', 'success');
  }

  closeTaskModal();
}

// ── Delete Modal ──────────────────────────────────────────────
function openDeleteModal(taskId) {
  const task = STATE.tasks[taskId];
  if (!task) return;
  document.getElementById('deleteTaskName').textContent = task.title;
  document.getElementById('deletingTaskId').value       = taskId;
  document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
}

function confirmDelete() {
  const id = document.getElementById('deletingTaskId').value;
  if (STATE.tasks[id]) {
    delete STATE.tasks[id];
    saveData();
    renderBoard();
    showToast('Task deleted', 'error');
  }
  closeDeleteModal();
}

// ── Column CRUD ───────────────────────────────────────────────
function openColumnModal() {
  document.getElementById('newColName').value = '';
  setSelector('#colColorSelector .color-opt', 'color', '#a78bfa');
  document.getElementById('columnModal').classList.add('open');
  setTimeout(() => document.getElementById('newColName').focus(), 200);
}

function closeColumnModal() {
  document.getElementById('columnModal').classList.remove('open');
}

function addColumn() {
  const name = document.getElementById('newColName').value.trim();
  if (!name) { document.getElementById('newColName').focus(); return; }

  const color = document.querySelector('#colColorSelector .color-opt.active')?.dataset.color || '#a78bfa';
  const id    = 'col_' + uid();

  STATE.columns.push({ id, label: name, dotClass: 'col-dot', color, custom: true });
  saveData();
  renderBoard();
  closeColumnModal();
  showToast(`Column "${name}" added`, 'info');
}

function deleteColumn(colId) {
  Object.values(STATE.tasks).forEach(t => { if (t.column === colId) t.column = 'todo'; });
  STATE.columns = STATE.columns.filter(c => c.id !== colId);
  saveData();
  renderBoard();
  showToast('Column removed', 'error');
}

// ── Selector Utility ──────────────────────────────────────────
function setSelector(query, dataAttr, value) {
  document.querySelectorAll(query).forEach(btn => {
    btn.classList.toggle('active', btn.dataset[dataAttr] === value);
  });
}

// ── Theme ─────────────────────────────────────────────────────
function applyTheme() {
  document.body.classList.toggle('light-theme', STATE.theme === 'light');
  const icon = document.querySelector('#themeToggle i');
  if (icon) icon.className = STATE.theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  localStorage.setItem(S_THEME, STATE.theme);
}

// ── Filter & Search ───────────────────────────────────────────
function applyFiltersToAll() {
  Object.values(STATE.tasks).forEach(task => {
    const card = document.getElementById(`task-${task.id}`);
    if (!card) return;
    const okP = STATE.filterPriority === 'all' || task.priority === STATE.filterPriority;
    const q   = STATE.searchQuery;
    const okS = !q || task.title.toLowerCase().includes(q) || (task.desc||'').toLowerCase().includes(q);
    card.classList.toggle('hidden', !(okP && okS));
  });
}

// ── Static Button Wiring ──────────────────────────────────────
function wireStaticButtons() {
  // Task modal
  document.getElementById('modalClose') .onclick = closeTaskModal;
  document.getElementById('modalCancel').onclick = closeTaskModal;
  document.getElementById('modalSave')  .onclick = saveTask;
  document.getElementById('taskModal')  .addEventListener('click', e => { if (e.target===e.currentTarget) closeTaskModal(); });

  // Delete modal
  document.getElementById('deleteModalClose').onclick = closeDeleteModal;
  document.getElementById('deleteCancelBtn') .onclick = closeDeleteModal;
  document.getElementById('deleteConfirmBtn').onclick = confirmDelete;
  document.getElementById('deleteModal')     .addEventListener('click', e => { if (e.target===e.currentTarget) closeDeleteModal(); });

  // Column modal
  document.getElementById('addColumnBtn') .onclick = openColumnModal;
  document.getElementById('colModalClose').onclick = closeColumnModal;
  document.getElementById('colModalCancel').onclick = closeColumnModal;
  document.getElementById('colModalSave') .onclick = addColumn;
  document.getElementById('columnModal')  .addEventListener('click', e => { if (e.target===e.currentTarget) closeColumnModal(); });

  // Theme
  document.getElementById('themeToggle').onclick = () => {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  };

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.filterPriority = btn.dataset.priority;
      applyFiltersToAll();
    });
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  const clearBtn    = document.getElementById('clearSearch');
  searchInput.addEventListener('input', () => {
    STATE.searchQuery = searchInput.value.toLowerCase().trim();
    clearBtn.classList.toggle('visible', STATE.searchQuery.length > 0);
    applyFiltersToAll();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    STATE.searchQuery = '';
    clearBtn.classList.remove('visible');
    applyFiltersToAll();
    searchInput.focus();
  });

  // Modal selector buttons (priority & color) — static HTML, no delegation needed
  document.querySelectorAll('#prioritySelector .priority-opt').forEach(btn => {
    btn.addEventListener('click', () => setSelector('#prioritySelector .priority-opt', 'p', btn.dataset.p));
  });
  document.querySelectorAll('#colorSelector .color-opt').forEach(btn => {
    btn.addEventListener('click', () => setSelector('#colorSelector .color-opt', 'color', btn.dataset.color));
  });
  document.querySelectorAll('#colColorSelector .color-opt').forEach(btn => {
    btn.addEventListener('click', () => setSelector('#colColorSelector .color-opt', 'color', btn.dataset.color));
  });

  // Char counters
  document.getElementById('taskTitle').addEventListener('input', e => {
    document.getElementById('titleCount').textContent = `${e.target.value.length}/100`;
  });
  document.getElementById('taskDesc').addEventListener('input', e => {
    document.getElementById('descCount').textContent = `${e.target.value.length}/500`;
  });

  // Enter-to-submit
  document.getElementById('taskTitle').addEventListener('keydown', e => { if (e.key === 'Enter') saveTask(); });
  document.getElementById('newColName').addEventListener('keydown', e => { if (e.key === 'Enter') addColumn(); });

  // ESC closes modals, Ctrl+N new task
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openAddModal('todo');
    }
  });
}

// ── Demo Seed ─────────────────────────────────────────────────
function seedDemo() {
  const demos = [
    { title: 'Design landing page mockup', desc: 'Create Figma wireframes for homepage redesign', priority: 'high',   color: 'violet',  column: 'todo' },
    { title: 'Set up CI/CD pipeline',      desc: 'Configure GitHub Actions for auto-deploys',    priority: 'medium', color: 'sky',     column: 'todo' },
    { title: 'Write unit tests',           desc: 'Cover core utils with Jest',                   priority: 'low',    color: 'default', column: 'todo' },
    { title: 'Implement auth system',      desc: 'OAuth 2.0 + JWT token management',             priority: 'high',   color: 'rose',    column: 'inprogress' },
    { title: 'Refactor API endpoints',     desc: 'Consolidate REST routes, improve error handling', priority: 'medium', color: 'amber', column: 'inprogress' },
    { title: 'Deploy to production',       desc: 'Vercel deploy with custom domain + SSL',       priority: 'high',   color: 'emerald', column: 'done' },
    { title: 'User research interviews',   desc: 'Conduct 5 discovery interviews',               priority: 'medium', color: 'default', column: 'done' },
  ];
  const base = Date.now();
  demos.forEach((d, i) => {
    const id = uid();
    STATE.tasks[id] = { id, ...d, createdAt: base - i * 3600000 };
  });
  saveData();
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  loadData();
  applyTheme();
  wireStaticButtons();    // wire everything that never changes
  setupBoardDelegation(); // ONE delegated listener for dynamic board buttons
  renderBoard();          // build columns + cards

  if (Object.keys(STATE.tasks).length === 0) {
    seedDemo();
    renderBoard();
  }

  console.log('✅ KanbanFlow ready. Ctrl+N = new task | ESC = close modal');
}

document.addEventListener('DOMContentLoaded', init);