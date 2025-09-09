class FocusFlowOrganizer {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('focusflow_tasks')) || [];
        this.sharedTasks = JSON.parse(localStorage.getItem('focusflow_shared_tasks')) || [];
        this.currentUser = localStorage.getItem('focusflow_username') || '';
        this.currentFilter = 'all';
        this.timer = {
            timeLeft: 25 * 60,
            isRunning: false,
            isWorkSession: true,
            workDuration: 25,
            breakDuration: 5,
            sessionsToday: parseInt(localStorage.getItem('focusflow_sessions')) || 0
        };
        this.timerInterval = null;
        this.activities = JSON.parse(localStorage.getItem('focusflow_activities')) || [];
        
        this.init();
    }

    init() {
        this.setupTabs();
        this.setupTaskListeners();
        this.setupTimerListeners();
        this.setupCollaborationListeners();
        this.renderTasks();
        this.updateTimerDisplay();
        this.renderSharedTasks();
        this.renderActivities();
        this.displayCurrentUser();
    }

    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });
    }

    setupTaskListeners() {
        document.getElementById('addTaskBtn').addEventListener('click', () => this.addTask());
        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.renderTasks();
            });
        });
    }

    setupTimerListeners() {
        document.getElementById('startBtn').addEventListener('click', () => this.startTimer());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseTimer());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetTimer());
        
        document.getElementById('workDuration').addEventListener('change', (e) => {
            this.timer.workDuration = parseInt(e.target.value);
            if (this.timer.isWorkSession && !this.timer.isRunning) {
                this.timer.timeLeft = this.timer.workDuration * 60;
                this.updateTimerDisplay();
            }
        });

        document.getElementById('breakDuration').addEventListener('change', (e) => {
            this.timer.breakDuration = parseInt(e.target.value);
            if (!this.timer.isWorkSession && !this.timer.isRunning) {
                this.timer.timeLeft = this.timer.breakDuration * 60;
                this.updateTimerDisplay();
            }
        });
    }

    setupCollaborationListeners() {
        document.getElementById('setUsernameBtn').addEventListener('click', () => this.setUsername());
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.setUsername();
        });
        
        document.getElementById('addSharedTaskBtn').addEventListener('click', () => this.addSharedTask());
        document.getElementById('sharedTaskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addSharedTask();
        });
    }

    addTask() {
        const input = document.getElementById('taskInput');
        const priority = document.getElementById('prioritySelect').value;
        const taskText = input.value.trim();

        if (taskText) {
            const task = {
                id: Date.now(),
                text: taskText,
                completed: false,
                priority: priority,
                createdAt: new Date().toISOString()
            };

            this.tasks.unshift(task);
            this.saveTasks();
            this.renderTasks();
            input.value = '';
            input.focus();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(task => task.id !== id);
        this.saveTasks();
        this.renderTasks();
    }

    toggleTask(id) {
        const task = this.tasks.find(task => task.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.renderTasks();
        }
    }

    renderTasks() {
        const taskList = document.getElementById('taskList');
        const filteredTasks = this.filterTasks();

        taskList.innerHTML = filteredTasks.map(task => `
            <li class="task-item ${task.completed ? 'completed' : ''} ${task.priority}-priority">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                       onchange="app.toggleTask(${task.id})">
                <span class="task-text">${task.text}</span>
                <span class="task-priority priority-${task.priority}">${task.priority}</span>
                <button class="task-delete" onclick="app.deleteTask(${task.id})">Delete</button>
            </li>
        `).join('');

        this.updateTaskStats();
    }

    filterTasks() {
        switch (this.currentFilter) {
            case 'completed':
                return this.tasks.filter(task => task.completed);
            case 'pending':
                return this.tasks.filter(task => !task.completed);
            case 'high':
                return this.tasks.filter(task => task.priority === 'high');
            default:
                return this.tasks;
        }
    }

    updateTaskStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const pending = total - completed;
        
        document.getElementById('taskStats').textContent = 
            `${total} tasks total • ${completed} completed • ${pending} pending`;
    }

    saveTasks() {
        localStorage.setItem('focusflow_tasks', JSON.stringify(this.tasks));
    }

    startTimer() {
        if (!this.timer.isRunning) {
            this.timer.isRunning = true;
            this.timerInterval = setInterval(() => {
                this.timer.timeLeft--;
                this.updateTimerDisplay();

                if (this.timer.timeLeft <= 0) {
                    this.timerComplete();
                }
            }, 1000);
        }
    }

    pauseTimer() {
        this.timer.isRunning = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        this.pauseTimer();
        this.timer.timeLeft = this.timer.isWorkSession ? 
            this.timer.workDuration * 60 : this.timer.breakDuration * 60;
        this.updateTimerDisplay();
    }

    timerComplete() {
        this.pauseTimer();
        
        if (this.timer.isWorkSession) {
            this.timer.sessionsToday++;
            localStorage.setItem('focusflow_sessions', this.timer.sessionsToday.toString());
            this.showNotification('Work session complete! Time for a break.');
            this.timer.isWorkSession = false;
            this.timer.timeLeft = this.timer.breakDuration * 60;
        } else {
            this.showNotification('Break complete! Ready for another work session.');
            this.timer.isWorkSession = true;
            this.timer.timeLeft = this.timer.workDuration * 60;
        }
        
        this.updateTimerDisplay();
        this.playNotificationSound();
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timer.timeLeft / 60);
        const seconds = this.timer.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('timeDisplay').textContent = timeString;
        document.getElementById('sessionsCount').textContent = this.timer.sessionsToday;
        document.getElementById('currentMode').textContent = this.timer.isWorkSession ? 'Work' : 'Break';
    }

    showNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('FocusFlow Organizer', { body: message });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('FocusFlow Organizer', { body: message });
                }
            });
        }
        alert(message);
    }

    playNotificationSound() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    }

    setUsername() {
        const input = document.getElementById('usernameInput');
        const username = input.value.trim();
        
        if (username) {
            this.currentUser = username;
            localStorage.setItem('focusflow_username', username);
            this.displayCurrentUser();
            this.addActivity(`${username} joined the workspace`);
            input.value = '';
        }
    }

    displayCurrentUser() {
        const userDisplay = document.getElementById('currentUser');
        if (this.currentUser) {
            userDisplay.textContent = `Welcome, ${this.currentUser}!`;
            userDisplay.style.display = 'block';
        } else {
            userDisplay.style.display = 'none';
        }
    }

    addSharedTask() {
        const taskInput = document.getElementById('sharedTaskInput');
        const assigneeInput = document.getElementById('assigneeInput');
        const taskText = taskInput.value.trim();
        const assignee = assigneeInput.value.trim() || 'Unassigned';

        if (taskText) {
            const task = {
                id: Date.now(),
                text: taskText,
                assignee: assignee,
                createdBy: this.currentUser || 'Anonymous',
                completed: false,
                createdAt: new Date().toISOString()
            };

            this.sharedTasks.unshift(task);
            this.saveSharedTasks();
            this.renderSharedTasks();
            this.addActivity(`${task.createdBy} added task: "${taskText}" (assigned to ${assignee})`);
            
            taskInput.value = '';
            assigneeInput.value = '';
            taskInput.focus();
        }
    }

    deleteSharedTask(id) {
        const task = this.sharedTasks.find(t => t.id === id);
        if (task) {
            this.sharedTasks = this.sharedTasks.filter(t => t.id !== id);
            this.saveSharedTasks();
            this.renderSharedTasks();
            this.addActivity(`${this.currentUser || 'Someone'} deleted task: "${task.text}"`);
        }
    }

    toggleSharedTask(id) {
        const task = this.sharedTasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveSharedTasks();
            this.renderSharedTasks();
            this.addActivity(`${this.currentUser || 'Someone'} ${task.completed ? 'completed' : 'reopened'} task: "${task.text}"`);
        }
    }

    renderSharedTasks() {
        const taskList = document.getElementById('sharedTaskList');
        
        taskList.innerHTML = this.sharedTasks.map(task => `
            <li class="shared-task-item ${task.completed ? 'completed' : ''}">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                       onchange="app.toggleSharedTask(${task.id})">
                <span class="task-text">${task.text}</span>
                <span class="shared-task-assignee">${task.assignee}</span>
                <small style="color: #6b7280;">by ${task.createdBy}</small>
                <button class="task-delete" onclick="app.deleteSharedTask(${task.id})">Delete</button>
            </li>
        `).join('');
    }

    saveSharedTasks() {
        localStorage.setItem('focusflow_shared_tasks', JSON.stringify(this.sharedTasks));
    }

    addActivity(message) {
        const activity = {
            id: Date.now(),
            message: message,
            timestamp: new Date().toLocaleTimeString()
        };

        this.activities.unshift(activity);
        if (this.activities.length > 50) {
            this.activities = this.activities.slice(0, 50);
        }

        localStorage.setItem('focusflow_activities', JSON.stringify(this.activities));
        this.renderActivities();
    }

    renderActivities() {
        const activityFeed = document.getElementById('activityFeed');
        
        if (this.activities.length === 0) {
            activityFeed.innerHTML = '<p style="color: #6b7280; text-align: center;">No activity yet</p>';
            return;
        }

        activityFeed.innerHTML = this.activities.map(activity => `
            <div class="activity-item">
                <strong>${activity.timestamp}</strong> - ${activity.message}
            </div>
        `).join('');
    }
}

const app = new FocusFlowOrganizer();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(registrationError => console.log('SW registration failed'));
    });
}