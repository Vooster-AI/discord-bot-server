# 🌐 프론트엔드 API 사용 예제

Discord Bot API를 프론트엔드에서 사용하는 방법을 정리한 가이드입니다.

## 📋 목차
- [기본 설정](#기본-설정)
- [사용자 관리 API](#사용자-관리-api)
- [Todo 관리 API](#todo-관리-api)
- [포럼 데이터 API](#포럼-데이터-api)
- [GitHub 동기화 API](#github-동기화-api)
- [실시간 업데이트](#실시간-업데이트)

## 🔧 기본 설정

### API 기본 URL
```javascript
const API_BASE = 'http://localhost:3000/api';
```

### 공통 헤더
```javascript
const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};
```

### 에러 핸들링 헬퍼
```javascript
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${url}`, {
            headers,
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'API 호출 실패');
        }
        
        return data;
    } catch (error) {
        console.error('API 호출 오류:', error);
        throw error;
    }
}
```

## 👥 사용자 관리 API

### 사용자 목록 조회
```javascript
async function getUsers(limit = 50) {
    const data = await apiCall(`/users?limit=${limit}`);
    return data.data.users;
}

// 사용 예제
async function displayUsers() {
    try {
        const users = await getUsers(20);
        const userList = document.getElementById('userList');
        
        userList.innerHTML = users.map(user => `
            <div class="user-item">
                <h4>${user.name}</h4>
                <p>점수: ${user.score}점</p>
                <p>Discord ID: ${user.discord_id}</p>
            </div>
        `).join('');
    } catch (error) {
        alert('사용자 목록을 불러올 수 없습니다: ' + error.message);
    }
}
```

### 특정 사용자 조회
```javascript
async function getUserByDiscordId(discordId) {
    const data = await apiCall(`/users/${discordId}`);
    return data.data.user;
}

// 사용 예제
async function showUserProfile(discordId) {
    try {
        const user = await getUserByDiscordId(discordId);
        document.getElementById('userProfile').innerHTML = `
            <h3>${user.name}</h3>
            <p>총 점수: ${user.score}점</p>
            <p>활동 내역: ${user.scored_by?.length || 0}개</p>
        `;
    } catch (error) {
        if (error.message.includes('404')) {
            alert('사용자를 찾을 수 없습니다.');
        } else {
            alert('사용자 정보를 불러올 수 없습니다: ' + error.message);
        }
    }
}
```

### 사용자 점수 추가
```javascript
async function addUserScore(userData) {
    const data = await apiCall('/users/score', {
        method: 'POST',
        body: JSON.stringify(userData)
    });
    return data.data.user;
}

// 사용 예제
async function submitScore() {
    const scoreData = {
        discord_id: document.getElementById('discordId').value,
        name: document.getElementById('userName').value,
        score: parseInt(document.getElementById('score').value),
        scored_at: new Date().toISOString(),
        scored_by: {
            post_name: document.getElementById('postName').value,
            message_content: document.getElementById('messageContent').value,
            message_link: document.getElementById('messageLink').value
        }
    };
    
    try {
        const user = await addUserScore(scoreData);
        alert(`${user.name}님에게 점수가 추가되었습니다!`);
    } catch (error) {
        alert('점수 추가 실패: ' + error.message);
    }
}
```

## ✅ Todo 관리 API

### Todo 생성
```javascript
async function createTodo(todoData) {
    const data = await apiCall('/todos/create', {
        method: 'POST',
        body: JSON.stringify(todoData)
    });
    return data.task;
}

// 사용 예제 (React 스타일)
function TodoCreateForm() {
    const [formData, setFormData] = useState({
        task_name: '',
        complexity: 1,
        due_date: '',
        url: ''
    });
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const todo = await createTodo(formData);
            alert('Todo가 생성되었습니다!');
            // Discord에 자동으로 메시지가 전송됩니다
        } catch (error) {
            alert('Todo 생성 실패: ' + error.message);
        }
    };
    
    // JSX 렌더링...
}
```

### Todo 목록 조회
```javascript
async function getTodos(options = {}) {
    const params = new URLSearchParams();
    if (options.completed !== undefined) params.append('completed', options.completed);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    
    const url = params.toString() ? `/todos?${params}` : '/todos';
    const data = await apiCall(url);
    return data.tasks;
}

// 사용 예제
async function loadTodoList() {
    const todoContainer = document.getElementById('todoContainer');
    
    try {
        // 미완료 Todo만 가져오기
        const incompleteTodos = await getTodos({ completed: false, limit: 20 });
        
        todoContainer.innerHTML = incompleteTodos.map(todo => `
            <div class="todo-card ${todo.completed ? 'completed' : ''}">
                <h4>${todo.task_name}</h4>
                <div class="todo-meta">
                    <span class="complexity">복잡도: ${todo.complexity}/10</span>
                    <span class="due-date">마감: ${new Date(todo.due_date).toLocaleDateString()}</span>
                </div>
                <div class="todo-actions">
                    ${!todo.completed ? 
                        `<button onclick="completeTodo('${todo.id}')">완료</button>` : 
                        '<span class="completed-badge">✅ 완료됨</span>'
                    }
                    <a href="${todo.post_url}" target="_blank">Discord에서 보기</a>
                </div>
            </div>
        `).join('');
    } catch (error) {
        todoContainer.innerHTML = `<div class="error">Todo 목록을 불러올 수 없습니다: ${error.message}</div>`;
    }
}
```

### Todo 완료 처리
```javascript
async function completeTodo(todoId) {
    const data = await apiCall(`/todos/${todoId}/complete`, {
        method: 'POST'
    });
    return data.task;
}

// 사용 예제
async function markTodoComplete(todoId) {
    try {
        const completedTodo = await completeTodo(todoId);
        
        // UI 업데이트
        const todoElement = document.querySelector(`[data-todo-id="${todoId}"]`);
        todoElement.classList.add('completed');
        
        // Discord에 자동으로 반응이 변경됩니다 (👀 → ✅)
        alert('Todo가 완료되었습니다!');
        
        // 목록 새로고침
        loadTodoList();
    } catch (error) {
        alert('Todo 완료 처리 실패: ' + error.message);
    }
}
```

### Todo 개별 조회
```javascript
async function getTodoById(todoId) {
    const data = await apiCall(`/todos/${todoId}`);
    return data.task;
}

// 사용 예제
async function showTodoDetails(todoId) {
    try {
        const todo = await getTodoById(todoId);
        
        document.getElementById('todoModal').innerHTML = `
            <div class="modal-content">
                <h3>${todo.task_name}</h3>
                <p><strong>복잡도:</strong> ${todo.complexity}/10</p>
                <p><strong>마감일:</strong> ${new Date(todo.due_date).toLocaleDateString()}</p>
                <p><strong>생성일:</strong> ${new Date(todo.created_at).toLocaleDateString()}</p>
                <p><strong>상태:</strong> ${todo.completed ? '완료' : '진행중'}</p>
                <a href="${todo.post_url}" target="_blank">Discord 메시지 보기</a>
            </div>
        `;
    } catch (error) {
        alert('Todo 상세 정보를 불러올 수 없습니다: ' + error.message);
    }
}
```

## 📊 포럼 데이터 API

### 포럼 통계 조회
```javascript
async function getForumStats() {
    const data = await apiCall('/forums/stats');
    return data.data;
}

// 사용 예제
async function displayForumStats() {
    try {
        const stats = await getForumStats();
        
        document.getElementById('statsContainer').innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>총 게시물</h4>
                    <p class="stat-number">${stats.totalPosts}</p>
                </div>
                <div class="stat-card">
                    <h4>활성 사용자</h4>
                    <p class="stat-number">${stats.activeUsers}</p>
                </div>
                <div class="stat-card">
                    <h4>평균 점수</h4>
                    <p class="stat-number">${stats.averageScore}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('통계 로드 실패:', error);
    }
}
```

## 🐙 GitHub 동기화 API

### GitHub 연결 상태 확인
```javascript
async function checkGitHubConnection() {
    const data = await apiCall('/github/status');
    return data.data;
}

// 사용 예제
async function updateGitHubStatus() {
    try {
        const status = await checkGitHubConnection();
        
        const statusElement = document.getElementById('githubStatus');
        statusElement.className = status.connected ? 'status-connected' : 'status-disconnected';
        statusElement.textContent = status.connected ? 
            '✅ GitHub 연결됨' : '❌ GitHub 연결 안됨';
            
        if (status.connected) {
            document.getElementById('repoInfo').textContent = 
                `저장소: ${status.repository}`;
        }
    } catch (error) {
        document.getElementById('githubStatus').textContent = 
            '⚠️ 상태 확인 실패';
    }
}
```

### GitHub 이슈 조회
```javascript
async function getGitHubIssues(page = 1, state = 'open') {
    const data = await apiCall(`/github/issues?page=${page}&state=${state}`);
    return data.data.issues;
}

// 사용 예제
async function displayGitHubIssues() {
    try {
        const issues = await getGitHubIssues(1, 'open');
        
        document.getElementById('issuesList').innerHTML = issues.map(issue => `
            <div class="issue-card">
                <h4><a href="${issue.html_url}" target="_blank">#${issue.number} ${issue.title}</a></h4>
                <p class="issue-meta">
                    <span class="issue-state ${issue.state}">${issue.state}</span>
                    <span class="issue-date">${new Date(issue.created_at).toLocaleDateString()}</span>
                </p>
                <div class="issue-labels">
                    ${issue.labels.map(label => 
                        `<span class="label" style="background-color: #${label.color}">${label.name}</span>`
                    ).join('')}
                </div>
            </div>
        `).join('');
    } catch (error) {
        document.getElementById('issuesList').innerHTML = 
            `<div class="error">GitHub 이슈를 불러올 수 없습니다: ${error.message}</div>`;
    }
}
```

## 🔄 실시간 업데이트

### Server-Sent Events (SSE) 사용
```javascript
function setupRealtimeUpdates() {
    const eventSource = new EventSource(`${API_BASE}/stream`);
    
    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'todo_created':
                addTodoToList(data.todo);
                showNotification('새 Todo가 생성되었습니다!');
                break;
                
            case 'todo_completed':
                updateTodoStatus(data.todo.id, true);
                showNotification('Todo가 완료되었습니다!');
                break;
                
            case 'user_score_updated':
                updateUserScore(data.user);
                break;
                
            default:
                console.log('알 수 없는 이벤트:', data);
        }
    };
    
    eventSource.onerror = function(error) {
        console.error('실시간 연결 오류:', error);
        // 재연결 로직
        setTimeout(() => setupRealtimeUpdates(), 5000);
    };
}

// 페이지 로드 시 실시간 업데이트 시작
window.addEventListener('load', setupRealtimeUpdates);
```

### WebSocket 사용 (고급)
```javascript
class DiscordBotWebSocket {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }
    
    connect() {
        this.ws = new WebSocket(`ws://localhost:3000/ws`);
        
        this.ws.onopen = () => {
            console.log('WebSocket 연결됨');
            this.reconnectAttempts = 0;
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket 연결 종료');
            this.reconnect();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket 오류:', error);
        };
    }
    
    handleMessage(data) {
        // 실시간 데이터 처리
        switch(data.event) {
            case 'discord_message':
                this.onDiscordMessage(data.message);
                break;
            case 'github_sync':
                this.onGitHubSync(data.sync);
                break;
        }
    }
    
    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
        }
    }
    
    onDiscordMessage(message) {
        // Discord 메시지 실시간 표시
        const messageContainer = document.getElementById('realtimeMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'realtime-message';
        messageElement.innerHTML = `
            <strong>${message.author}</strong>: ${message.content}
            <small>${new Date(message.timestamp).toLocaleTimeString()}</small>
        `;
        messageContainer.appendChild(messageElement);
    }
    
    onGitHubSync(sync) {
        // GitHub 동기화 상태 업데이트
        document.getElementById('syncStatus').textContent = 
            `마지막 동기화: ${new Date(sync.timestamp).toLocaleString()}`;
    }
}

// 사용
const discordWS = new DiscordBotWebSocket();
discordWS.connect();
```

## 🎨 CSS 스타일 예제

```css
/* 공통 스타일 */
.api-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* Todo 카드 */
.todo-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    transition: all 0.3s ease;
}

.todo-card:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.todo-card.completed {
    background-color: #f0f8ff;
    opacity: 0.7;
}

/* 사용자 아이템 */
.user-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #eee;
}

/* 상태 표시 */
.status-connected {
    color: #28a745;
}

.status-disconnected {
    color: #dc3545;
}

/* 알림 */
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #007bff;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 1000;
}
```

이 예제들을 참고하여 Discord Bot API를 효과적으로 활용하세요! 🚀