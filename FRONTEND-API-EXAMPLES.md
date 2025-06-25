# 프론트엔드 API 사용 예시 (JavaScript)

## 기본 설정
```javascript
const API_BASE = 'http://localhost:3000/api';

// 공통 fetch 함수
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    
    if (data) options.body = JSON.stringify(data);
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    return response.json();
}
```

## 시스템 & 상태 확인
```javascript
// 건강 상태 확인
const health = await fetch('http://localhost:3000/health').then(r => r.json());

// 서버 통계
const stats = await apiCall('/stats');

// 설정 조회
const config = await apiCall('/config');
```

## 할 일(Todo) 관리
```javascript
// 할 일 생성 (Discord URL 필수!)
const newTodo = await apiCall('/todo/create', 'POST', {
    task_name: '새로운 기능 개발',
    complexity: 5,  // 1-10 숫자
    due_date: '2025-12-31',
    url: 'https://discord.com/channels/1234567890/1234567890/1234567890'  // Discord 메시지 URL
});

// 할 일 완료 (Discord에서 👀 -> ✅ 변경)
const complete = await apiCall(`/todo/${todoId}/complete`, 'POST');

// 할 일 목록 조회
const todos = await apiCall('/todo?completed=false&limit=20');

// 특정 할 일 조회 (개별 조회 API는 없음, 목록에서 필터링 필요)
const allTodos = await apiCall('/todo');
const specificTodo = allTodos.tasks?.find(t => t.id === todoId);
```

## 사용자 관리
```javascript
// 사용자 점수 추가
const addScore = await apiCall('/users/score', 'POST', {
    username: '사용자#1234',
    discord_id: '123456789',
    score: 10,
    scored_at: new Date().toISOString(),
    scored_by: {
        channel: '채널ID',
        post_name: '포스트 제목',
        message_content: '메시지 내용'
    }
});

// 사용자 목록 (점수 순)
const users = await apiCall('/users?limit=10');

// 특정 사용자 조회
const user = await apiCall(`/users/${discordId}`);

// 사용자 동기화
const sync = await apiCall('/users/sync', 'POST');
```

## 포럼 관리
```javascript
// 포럼 목록
const forums = await apiCall('/forums');

// Supabase 포럼 설정
const supabaseForums = await apiCall('/forums/supabase');

// 새 포럼 추가
const newForum = await apiCall('/forums/supabase', 'POST', {
    name: '개선_제안',
    channel_id: '1383077201498345492',
    table_name: 'Suggestions',
    score: 5
});

// 포럼 수정
const updateForum = await apiCall(`/forums/supabase/${forumId}`, 'PATCH', {
    score: 10,
    github_sync: true
});

// 포럼 삭제
const deleteForum = await apiCall(`/forums/supabase/${forumId}`, 'DELETE');

// 포럼 포스트 조회
const posts = await apiCall(`/forums/${channelId}/posts?limit=50`);

// 포스트 메시지 조회
const messages = await apiCall(`/forums/posts/${postId}/messages`);
```

## 데이터 동기화
```javascript
// Supabase 동기화
const syncData = await apiCall('/sync/supabase', 'POST', {
    table: 'Suggestions',
    data: {
        title: '새로운 제안',
        content: '제안 내용',
        author: '사용자명'
    }
});

// 포럼 포스트 동기화
const syncPost = await apiCall('/sync/post', 'POST', {
    table: 'Suggestions',
    postData: {
        title: '포스트 제목',
        content: '포스트 내용'
    }
});

// 포럼 메시지 동기화
const syncMessage = await apiCall('/sync/message', 'POST', {
    table: 'Suggestions',
    messageData: {
        content: '메시지 내용',
        author: '작성자'
    }
});
```

## GitHub 연동
```javascript
// GitHub 이슈 목록
const issues = await apiCall('/github/issues');

// GitHub 이슈 생성
const newIssue = await apiCall('/github/issues', 'POST', {
    title: '새로운 이슈',
    body: '이슈 설명',
    labels: ['bug', 'enhancement']
});
```

## 로그 조회
```javascript
// 최근 로그
const logs = await apiCall('/logs?limit=50');

// 특정 채널 로그
const channelLogs = await apiCall(`/logs/channel/${channelId}`);

// 특정 사용자 로그
const userLogs = await apiCall(`/logs/user/${userId}`);
```

## Supabase 통계
```javascript
// Supabase 통계
const supabaseStats = await apiCall('/supabase/stats');

// 테이블 구조
const tables = await apiCall('/supabase/tables');
```

## Discord 연동
```javascript
// Discord 답장 전송
const reply = await apiCall('/discord/reply', 'POST', {
    task_name: '작업명',
    complexity: 'Medium',
    due_date: '2025-12-31',
    thread_id: '스레드ID'
});
```

## React Hook 예시
```javascript
import { useState, useEffect } from 'react';

// 사용자 목록 Hook
function useUsers(limit = 10) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        apiCall(`/users?limit=${limit}`)
            .then(setUsers)
            .finally(() => setLoading(false));
    }, [limit]);
    
    return { users, loading };
}

// Todo 목록 Hook
function useTodos(completed = false, limit = 20) {
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        apiCall(`/todo?completed=${completed}&limit=${limit}`)
            .then(setTodos)
            .finally(() => setLoading(false));
    }, [completed, limit]);
    
    const completeTodo = async (id) => {
        await apiCall(`/todo/${id}/complete`, 'POST');
        setTodos(prev => prev.map(todo => 
            todo.id === id ? { ...todo, completed: true } : todo
        ));
    };
    
    return { todos, loading, completeTodo };
}

// 사용 예시
function App() {
    const { users, loading: usersLoading } = useUsers(10);
    const { todos, loading: todosLoading, completeTodo } = useTodos(false, 20);
    
    if (usersLoading || todosLoading) return <div>Loading...</div>;
    
    return (
        <div>
            <h2>사용자 목록</h2>
            {users.map(user => (
                <div key={user.discord_id}>{user.username}: {user.score}점</div>
            ))}
            
            <h2>할 일 목록</h2>
            {todos.map(todo => (
                <div key={todo.id}>
                    {todo.task_name}
                    <button onClick={() => completeTodo(todo.id)}>완료</button>
                </div>
            ))}
        </div>
    );
}
```

## Vue.js 예시
```javascript
// Vue Composition API
import { ref, onMounted } from 'vue';

export function useUsers(limit = 10) {
    const users = ref([]);
    const loading = ref(true);
    
    onMounted(async () => {
        users.value = await apiCall(`/users?limit=${limit}`);
        loading.value = false;
    });
    
    return { users, loading };
}

// 컴포넌트에서 사용
export default {
    setup() {
        const { users, loading } = useUsers(10);
        
        const addScore = async (userId, score) => {
            await apiCall('/users/score', 'POST', {
                discord_id: userId,
                score: score,
                scored_at: new Date().toISOString()
            });
        };
        
        return { users, loading, addScore };
    }
};
```

## 에러 처리 예시
```javascript
async function safeApiCall(endpoint, method = 'GET', data = null) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: data ? JSON.stringify(data) : null
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API 호출 실패:', error);
        throw error;
    }
}