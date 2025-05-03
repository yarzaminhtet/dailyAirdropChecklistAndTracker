// DOM Elements
const currentDateEl = document.getElementById('current-date');
const timeRemainingEl = document.getElementById('time-remaining');
const taskTypeSelect = document.getElementById('task-type');
const newTaskInput = document.getElementById('new-task');
const addTaskBtn = document.getElementById('add-task-btn');
const taskListEl = document.getElementById('task-list');
const historyListEl = document.getElementById('history-list');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const clearCompletedBtn = document.getElementById('clear-completed-btn');
const resetAllBtn = document.getElementById('reset-all-btn');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const historyDateEl = document.getElementById('history-date');
const confirmModal = document.getElementById('confirm-modal');
const modalMessage = document.getElementById('modal-message');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

// App State
let tasks = [];
let history = {};
let currentHistoryDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
let modalCallback = null;

// Constants
const STORAGE_KEY_TASKS = 'airdrop_checkin_tasks';
const STORAGE_KEY_HISTORY = 'airdrop_checkin_history';
const STORAGE_KEY_LAST_RESET = 'airdrop_checkin_last_reset';
const TASK_TYPE = {
    TITLE: 'title',
    SUBTASK: 'subtask'
};

// Initialize the app
function init() {
    loadData();
    renderTasks();
    updateDateTime();
    checkAndResetTasks();
    renderHistory();
    
    // Set up event listeners
    addTaskBtn.addEventListener('click', addNewTask);
    newTaskInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') addNewTask();
    });
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    clearCompletedBtn.addEventListener('click', confirmClearCompleted);
    resetAllBtn.addEventListener('click', confirmResetAll);
    
    prevDayBtn.addEventListener('click', () => navigateHistory(-1));
    nextDayBtn.addEventListener('click', () => navigateHistory(1));
    
    modalCancel.addEventListener('click', closeModal);
    modalConfirm.addEventListener('click', executeModalAction);
    
    // Update time every minute
    setInterval(updateDateTime, 60000);
    
    // Check for reset every minute
    setInterval(checkAndResetTasks, 60000);
}

// Load data from localStorage
function loadData() {
    const savedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
    
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (savedHistory) {
        history = JSON.parse(savedHistory);
    }
}

// Save tasks to localStorage
function saveTasks() {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
}

// Save history to localStorage
function saveHistory() {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
}

// Update current date and time remaining until reset
function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString(undefined, options);
    
    // Calculate time until midnight (next reset)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilReset = tomorrow - now;
    const hours = Math.floor(timeUntilReset / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    
    timeRemainingEl.textContent = `Reset in ${hours}h ${minutes}m`;
}

// Check if tasks need to be reset (once per day)
function checkAndResetTasks() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const lastReset = localStorage.getItem(STORAGE_KEY_LAST_RESET);
    
    if (lastReset !== today) {
        // Save current state to history before resetting
        saveToHistory();
        
        // Reset all tasks to undone
        tasks.forEach(task => {
            task.done = false;
        });
        
        saveTasks();
        renderTasks();
        
        // Update last reset date
        localStorage.setItem(STORAGE_KEY_LAST_RESET, today);
    }
}

// Save current tasks state to history
function saveToHistory() {
    const today = new Date().toISOString().split('T')[0];
    
    // Create a snapshot of current tasks
    const snapshot = tasks.map(task => ({
        id: task.id,
        name: task.name,
        done: task.done,
        type: task.type,
        parentId: task.parentId
    }));
    
    history[today] = snapshot;
    saveHistory();
}

// Add a new task
function addNewTask() {
    const taskName = newTaskInput.value.trim();
    const taskType = taskTypeSelect.value;
    
    if (taskName) {
        const newTask = {
            id: Date.now(),
            name: taskName,
            done: false,
            type: taskType,
            parentId: null,
            createdAt: new Date().toISOString()
        };
        
        // If it's a subtask, find the most recent title to be its parent
        if (taskType === TASK_TYPE.SUBTASK) {
            const titles = tasks.filter(t => t.type === TASK_TYPE.TITLE);
            if (titles.length > 0) {
                // Get the most recent title
                const mostRecentTitle = titles.reduce((latest, current) => {
                    return new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest;
                }, titles[0]);
                
                newTask.parentId = mostRecentTitle.id;
            } else {
                // If no titles exist, create one first
                alert('Please create an Airdrop Title first before adding subtasks.');
                taskTypeSelect.value = TASK_TYPE.TITLE;
                return;
            }
        }
        
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        
        newTaskInput.value = '';
        newTaskInput.focus();
    }
}

// Toggle task completion status
function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.done = !task.done;
        
        // If it's a title, toggle all its subtasks too
        if (task.type === TASK_TYPE.TITLE) {
            const subtasks = tasks.filter(t => t.parentId === task.id);
            subtasks.forEach(subtask => {
                subtask.done = task.done;
            });
        }
        
        saveTasks();
        renderTasks();
    }
}

// Edit a task
function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        const newName = prompt('Edit task name:', task.name);
        if (newName && newName.trim()) {
            task.name = newName.trim();
            saveTasks();
            renderTasks();
        }
    }
}

// Delete a task
function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    
    if (task) {
        // If it's a title, also delete all its subtasks
        if (task.type === TASK_TYPE.TITLE) {
            tasks = tasks.filter(t => t.id !== id && t.parentId !== id);
        } else {
            tasks = tasks.filter(t => t.id !== id);
        }
        
        saveTasks();
        renderTasks();
    }
}

// Clear all completed tasks
function clearCompleted() {
    tasks = tasks.filter(task => !task.done);
    saveTasks();
    renderTasks();
    closeModal();
}

// Reset all tasks to undone
function resetAll() {
    tasks.forEach(task => {
        task.done = false;
    });
    saveTasks();
    renderTasks();
    closeModal();
}

// Confirm clear completed action
function confirmClearCompleted() {
    modalMessage.textContent = 'Are you sure you want to remove all completed tasks?';
    modalCallback = clearCompleted;
    openModal();
}

// Confirm reset all action
function confirmResetAll() {
    modalMessage.textContent = 'Are you sure you want to reset all tasks to undone?';
    modalCallback = resetAll;
    openModal();
}

// Open confirmation modal
function openModal() {
    confirmModal.classList.add('active');
}

// Close confirmation modal
function closeModal() {
    confirmModal.classList.remove('active');
    modalCallback = null;
}

// Execute modal action
function executeModalAction() {
    if (modalCallback) {
        modalCallback();
    }
}

// Switch between tabs
function switchTab(tabName) {
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    if (tabName === 'history') {
        renderHistory();
    }
}

// Navigate through history dates
function navigateHistory(direction) {
    const currentDate = new Date(currentHistoryDate);
    currentDate.setDate(currentDate.getDate() + direction);
    
    // Don't allow navigating to future dates
    const today = new Date();
    if (currentDate > today) {
        currentDate.setTime(today.getTime());
    }
    
    currentHistoryDate = currentDate.toISOString().split('T')[0];
    renderHistory();
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateString === today.toISOString().split('T')[0]) {
        return 'Today';
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
}

// Generate subtask indicator (A, B, C, etc.)
function getSubtaskIndicator(parentId) {
    const subtasks = tasks.filter(t => t.parentId === parentId);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const index = subtasks.length;
    return alphabet[index % alphabet.length];
}

// Render task list
function renderTasks() {
    taskListEl.innerHTML = '';
    
    if (tasks.length === 0) {
        taskListEl.innerHTML = `
            <div class="empty-state">
                <p>No tasks yet. Add your first airdrop check-in task!</p>
            </div>
        `;
        return;
    }
    
    // First render all title tasks
    const titleTasks = tasks.filter(task => task.type === TASK_TYPE.TITLE);
    
    titleTasks.forEach(titleTask => {
        // Render the title
        const titleEl = createTaskElement(titleTask);
        taskListEl.appendChild(titleEl);
        
        // Render all subtasks for this title
        const subtasks = tasks.filter(task => task.parentId === titleTask.id);
        subtasks.forEach((subtask, index) => {
            const subtaskEl = createTaskElement(subtask, index);
            taskListEl.appendChild(subtaskEl);
        });
    });
    
    // Render any orphaned subtasks (should not happen in normal usage)
    const orphanedSubtasks = tasks.filter(task => 
        task.type === TASK_TYPE.SUBTASK && 
        !titleTasks.some(title => title.id === task.parentId)
    );
    
    if (orphanedSubtasks.length > 0) {
        const orphanedTitle = document.createElement('div');
        orphanedTitle.className = 'task-item title';
        orphanedTitle.innerHTML = `<span class="task-name">Other Tasks</span>`;
        taskListEl.appendChild(orphanedTitle);
        
        orphanedSubtasks.forEach((subtask, index) => {
            const subtaskEl = createTaskElement(subtask, index);
            taskListEl.appendChild(subtaskEl);
        });
    }
}

// Create a task element
function createTaskElement(task, index = null) {
    const taskEl = document.createElement('div');
    taskEl.className = `task-item ${task.type}`;
    
    let taskContent = '';
    
    if (task.type === TASK_TYPE.TITLE) {
        taskContent = `
            <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''}>
            <span class="task-name">${task.name}</span>
            <div class="task-actions">
                <button class="edit-btn"><i class="fas fa-edit"></i></button>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            </div>
        `;
    } else {
        // For subtasks, add an indicator (A, B, C, etc.)
        const indicator = String.fromCharCode(65 + index); // A, B, C, ...
        taskContent = `
            <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''}>
            <span class="subtask-indicator">${indicator}</span>
            <span class="task-name">${task.name}</span>
            <div class="task-actions">
                <button class="edit-btn"><i class="fas fa-edit"></i></button>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            </div>
        `;
    }
    
    taskEl.innerHTML = taskContent;
    
    // Add event listeners
    const checkbox = taskEl.querySelector('.task-checkbox');
    if (checkbox) {
        checkbox.addEventListener('change', () => toggleTask(task.id));
    }
    
    const editBtn = taskEl.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => editTask(task.id));
    }
    
    const deleteBtn = taskEl.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteTask(task.id));
    }
    
    return taskEl;
}

// Render history
function renderHistory() {
    historyListEl.innerHTML = '';
    
    // Update history date display
    historyDateEl.textContent = formatDate(currentHistoryDate);
    
    // Get tasks for the selected date
    const dayHistory = history[currentHistoryDate] || [];
    
    if (dayHistory.length === 0) {
        historyListEl.innerHTML = `
            <div class="empty-state">
                <p>No history available for this date.</p>
            </div>
        `;
        return;
    }
    
    // First render all title tasks
    const titleTasks = dayHistory.filter(task => task.type === TASK_TYPE.TITLE);
    
    titleTasks.forEach(titleTask => {
        // Render the title
        const titleEl = createHistoryElement(titleTask);
        historyListEl.appendChild(titleEl);
        
        // Render all subtasks for this title
        const subtasks = dayHistory.filter(task => task.parentId === titleTask.id);
        subtasks.forEach((subtask, index) => {
            const subtaskEl = createHistoryElement(subtask, index);
            historyListEl.appendChild(subtaskEl);
        });
    });
    
    // Render any orphaned subtasks
    const orphanedSubtasks = dayHistory.filter(task => 
        task.type === TASK_TYPE.SUBTASK && 
        !titleTasks.some(title => title.id === task.parentId)
    );
    
    if (orphanedSubtasks.length > 0) {
        const orphanedTitle = document.createElement('div');
        orphanedTitle.className = 'history-item title';
        orphanedTitle.innerHTML = `<span class="history-name">Other Tasks</span>`;
        historyListEl.appendChild(orphanedTitle);
        
        orphanedSubtasks.forEach((subtask, index) => {
            const subtaskEl = createHistoryElement(subtask, index);
            historyListEl.appendChild(subtaskEl);
        });
    }
}

// Create a history element
function createHistoryElement(task, index = null) {
    const historyEl = document.createElement('div');
    historyEl.className = `history-item ${task.type}`;
    
    let historyContent = '';
    
    if (task.type === TASK_TYPE.TITLE) {
        historyContent = `
            <div class="history-status ${task.done ? 'status-done' : 'status-undone'}">
                <i class="fas ${task.done ? 'fa-check' : 'fa-times'}"></i>
            </div>
            <span class="history-name">${task.name}</span>
        `;
    } else {
        // For subtasks, add an indicator (A, B, C, etc.)
        const indicator = String.fromCharCode(65 + index); // A, B, C, ...
        historyContent = `
            <div class="history-status ${task.done ? 'status-done' : 'status-undone'}">
                <i class="fas ${task.done ? 'fa-check' : 'fa-times'}"></i>
            </div>
            <span class="subtask-indicator">${indicator}</span>
            <span class="history-name">${task.name}</span>
        `;
    }
    
    historyEl.innerHTML = historyContent;
    return historyEl;
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);