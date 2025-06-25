# 📚 예제 파일 모음

Discord Bot API 사용법을 배우기 위한 예제 파일들입니다.

## 📁 파일 목록

### 🌐 HTML 테스트 파일
- **`todo-test.html`** - Todo API 완전한 테스트 인터페이스
  - Todo 생성, 조회, 완료 처리
  - 실시간 Discord 연동 테스트
  - 복잡도별 색상 구분
  - 반응형 디자인

### 📖 문서 및 가이드
- **`FRONTEND-API-EXAMPLES.md`** - 프론트엔드 개발자를 위한 API 사용 가이드
  - JavaScript/React 예제 코드
  - 모든 API 엔드포인트 사용법
  - 실시간 업데이트 구현 방법
  - CSS 스타일 예제

## 🚀 사용 방법

### 1. 서버 실행
```bash
# Discord Bot 서버 시작
npm run dev

# 또는 프로덕션 모드
npm start
```

### 2. HTML 테스트 파일 사용
```bash
# 예제 폴더로 이동
cd examples

# HTML 파일을 브라우저에서 열기
open todo-test.html
# 또는 Live Server 확장 사용 (VS Code)
```

### 3. API 테스트 순서
1. **서버 상태 확인** - `http://localhost:3000/api/health`
2. **Todo 생성** - HTML 폼 사용
3. **Discord 메시지 확인** - 봇이 자동으로 메시지 전송
4. **Todo 완료** - 완료 버튼 클릭
5. **Discord 반응 확인** - 👀 → ✅ 자동 변경

## 🔧 개발 팁

### 환경 설정
```javascript
// 개발 환경
const API_BASE = 'http://localhost:3000/api';

// 프로덕션 환경
const API_BASE = 'https://your-domain.com/api';
```

### CORS 설정
서버에서 CORS가 활성화되어 있어야 브라우저에서 API 호출이 가능합니다.

### Discord 메시지 URL 형식
```
https://discord.com/channels/{guild_id}/{channel_id}/{message_id}
```

## 🐛 문제 해결

### 자주 발생하는 오류

1. **CORS 오류**
   ```
   Access to fetch at 'http://localhost:3000/api/todos/create' from origin 'file://' has been blocked by CORS policy
   ```
   **해결방법**: Live Server 또는 HTTP 서버 사용

2. **Discord URL 오류**
   ```
   Invalid Discord URL format
   ```
   **해결방법**: Discord에서 메시지 링크 복사 후 붙여넣기

3. **API 서버 연결 오류**
   ```
   Failed to fetch
   ```
   **해결방법**: 서버가 실행 중인지 확인 (`npm run dev`)

### 디버깅 도구
```javascript
// 브라우저 개발자 도구에서 API 응답 확인
fetch('http://localhost:3000/api/todos')
  .then(res => res.json())
  .then(console.log);
```

## 📝 추가 예제 아이디어

### 구현할 수 있는 기능들
- **사용자 랭킹 페이지** - 점수별 순위 표시
- **Todo 대시보드** - 복잡도별/날짜별 통계
- **GitHub 이슈 뷰어** - Discord-GitHub 연동 상태
- **실시간 채팅** - Discord 메시지 실시간 표시
- **포럼 통계** - 채널별 활동 현황

### React/Vue 컴포넌트 예제
- `TodoForm` - Todo 생성 폼
- `TodoList` - Todo 목록 표시
- `UserProfile` - 사용자 프로필 카드
- `GitHubSync` - GitHub 동기화 상태

이 예제들을 활용해서 멋진 Discord Bot 관리 인터페이스를 만들어보세요! 🎯