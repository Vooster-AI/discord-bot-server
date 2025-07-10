# Vooster

## 개요

이 봇은 Discord 커뮤니티와 GitHub 프로젝트 관리를 효과적으로 연결하여, 포럼 포스트를 GitHub 이슈로 자동 변환하고 실시간으로 동기화합니다. 사용자 활동에 따른 레벨 시스템도 제공합니다.

## 주요 기능

- **자동 이슈 생성**: Discord 포럼 포스트가 GitHub 이슈로 자동 변환
- **실시간 동기화**: 메시지, 댓글, 반응이 양방향으로 동기화
- **사용자 레벨 시스템**: 활동에 따른 점수 및 레벨 관리
- **상태 동기화**: 포럼 포스트 상태 변경이 GitHub 이슈에 반영

## 시작하기

### 필수 요구사항

- Node.js 18.0.0 이상
- Discord 봇 토큰
- GitHub Personal Access Token
- Supabase 프로젝트

### 설치

1. 저장소 클론
```bash
git clone <repository-url>
cd discord-bot
```

2. 의존성 설치
```bash
npm install
```

3. 환경 변수 설정
`.env` 파일 생성 후 다음 내용 추가:
```env
DISCORD_TOKEN=your_discord_bot_token
GITHUB_TOKEN=your_github_token
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3000
```

4. 데이터베이스 설정
```bash
npm run db:migrate
npm run db:generate
```

5. 봇 실행
```bash
# 개발 모드
npm run dev

# 프로덕션
npm run build
npm start
```

## 사용법

### Discord 명령어

#### 레벨 확인
```
/level_check
```
현재 사용자의 레벨과 점수를 확인합니다.

**출력 예시:**
```
📊 YOUR_NAME님의 레벨 정보
🎯 레벨: 5 (1,250 점)
📈 다음 레벨까지: 250점 (83.3%)
```

#### 랭킹 확인
```
/rank
```
서버 내 상위 10명의 랭킹을 확인합니다.

**출력 예시:**
```
🏆 서버 랭킹 TOP 10
🥇 1위: Player1 - 레벨 10 (2,500점)
🥈 2위: Player2 - 레벨 9 (2,100점)
🥉 3위: Player3 - 레벨 8 (1,800점)
```

### 자동 동기화

#### 1. 포럼 포스트 → GitHub 이슈
- 포럼 채널에 새 포스트 작성시 자동으로 GitHub 이슈 생성
- 포스트 제목과 내용이 이슈 제목과 본문으로 변환
- Discord 링크와 GitHub 이슈가 상호 참조

#### 2. 메시지 → 댓글 동기화
- 포럼 포스트의 댓글이 GitHub 이슈 댓글로 동기화
- 작성자 정보와 메시지 내용 보존
- 댓글 작성시 사용자에게 점수 지급

#### 3. 반응 동기화
- Discord 반응이 GitHub 댓글 반응으로 동기화
- 지원 반응: 👍, 👎, ❤️, 🎉, 😕, 🚀, 👀

#### #### 4. 상태 동기화
- 포럼 포스트 잠금 → GitHub 이슈 닫기
- 포럼 포스트 아카이브 → GitHub 이슈 닫기

## 설정

### 데이터베이스 구조

#### forum_configs 테이블
포럼 채널별 설정을 관리합니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| channel_id | TEXT | Discord 채널 ID |
| github_repo_owner | TEXT | GitHub 저장소 소유자 |
| github_repo_name | TEXT | GitHub 저장소 이름 |
| points_per_message | INTEGER | 메시지당 점수 |
| created_at | TIMESTAMP | 생성 시간 |

#### users 테이블
사용자 정보와 점수를 관리합니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| discord_id | TEXT | Discord 사용자 ID |
| username | TEXT | 사용자명 |
| total_score | INTEGER | 총 점수 |
| level | INTEGER | 현재 레벨 |
| created_at | TIMESTAMP | 생성 시간 |
| updated_at | TIMESTAMP | 업데이트 시간 |

#### github_mappings 테이블
Discord 포스트와 GitHub 이슈의 매핑을 관리합니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| discord_thread_id | TEXT | Discord 스레드 ID |
| github_issue_number | INTEGER | GitHub 이슈 번호 |
| github_repo_owner | TEXT | GitHub 저장소 소유자 |
| github_repo_name | TEXT | GitHub 저장소 이름 |
| created_at | TIMESTAMP | 생성 시간 |

### 포럼 채널 연결

새로운 포럼 채널을 봇에 연결하려면 Supabase의 `forum_configs` 테이블에 새 레코드를 추가합니다:

```sql
INSERT INTO forum_configs (
  channel_id,
  github_repo_owner,
  github_repo_name,
  points_per_message
) VALUES (
  '1234567890123456789',  -- Discord 채널 ID
  'username',              -- GitHub 사용자명
  'repository-name',       -- 저장소 이름
  10                       -- 메시지당 점수
);
```

## API 레퍼런스

봇 실행 후 `http://localhost:3000/api`에서 API 문서를 확인할 수 있습니다.

### 주요 엔드포인트

#### 시스템 상태
```
GET /health
```
서버 상태를 확인합니다.

#### 사용자 관리
```
GET /api/users           # 사용자 목록 조회
GET /api/users/:id       # 특정 사용자 정보 조회
```

#### 동기화 관리
```
POST /api/sync/manual    # 수동 동기화 실행
```

## 개발

### 프로젝트 구조

```
src/
├── api/                 # Express API 서버
│   ├── controllers/     # API 컨트롤러
│   ├── middlewares/     # 미들웨어
│   └── routes/          # API 라우트
├── bot/                 # Discord 봇 로직
│   ├── commands/        # 슬래시 명령어
│   └── monitors/        # 이벤트 모니터
├── core/                # 핵심 서비스
│   └── services/        # 메시지, 반응, 사용자 서비스
├── services/            # 외부 서비스 연동
│   ├── database/        # 데이터베이스 서비스
│   ├── github/          # GitHub API 연동
│   └── sync/            # 동기화 서비스
└── shared/              # 공유 유틸리티
    ├── types/           # TypeScript 타입 정의
    └── utils/           # 헬퍼 함수
```

### 개발 도구

```bash
# 타입 체크
npm run typecheck

# 린트
npm run lint
npm run lint:fix

# 포맷팅
npm run format
npm run format:check

# 데이터베이스 관리
npm run db:studio
npm run db:migrate
```

### 새 기능 추가

#### Discord 명령어 추가
1. `src/bot/commands/`에 새 파일 생성
2. `Command` 인터페이스 구현
3. `src/bot/login.ts`에서 명령어 등록

#### API 엔드포인트 추가
1. `src/api/controllers/`에 컨트롤러 생성
2. `src/api/routes/`에 라우트 정의
3. `src/api/app.ts`에서 라우트 등록

## 문제 해결

### 일반적인 문제

#### 봇이 응답하지 않는 경우

**확인 사항:**
- Discord 봇 토큰이 올바른지 확인
- 봇이 해당 채널에 대한 권한을 가지고 있는지 확인
- 채널이 `forum_configs` 테이블에 등록되어 있는지 확인

**해결 방법:**
```bash
# 봇 상태 확인
npm run dev

# 로그 확인
tail -f server.log
```

#### GitHub 연동이 작동하지 않는 경우

**확인 사항:**
- GitHub 토큰 권한 (repo 권한 필요)
- 저장소 이름과 소유자가 정확한지 확인
- GitHub API 사용량 제한 확인

**해결 방법:**
```bash
# GitHub 연결 테스트
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/user
```

#### 점수 시스템이 작동하지 않는 경우

**확인 사항:**
- Supabase 연결 상태
- `forum_configs` 테이블의 `points_per_message` 설정
- 사용자가 `users` 테이블에 등록되어 있는지 확인

**해결 방법:**
```sql
-- 사용자 확인
SELECT * FROM users WHERE discord_id = 'USER_DISCORD_ID';

-- 포럼 설정 확인
SELECT * FROM forum_configs WHERE channel_id = 'CHANNEL_ID';
```

### 로그 확인

```bash
# 애플리케이션 로그
tail -f server.log

# HTTP 서버 로그
tail -f http_server.log

# 실시간 로그 모니터링
npm run dev
```

### 디버깅

```bash
# 데이터베이스 스키마 확인
npm run db:studio

# 타입 체크
npm run typecheck

# 린트 확인
npm run lint
```

## 기여

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/new-feature`)
3. 변경사항 커밋 (`git commit -m 'Add new feature'`)
4. 브랜치 푸시 (`git push origin feature/new-feature`)
5. Pull Request 생성

## 라이선스

MIT License

## 지원

문제 발생 시 GitHub Issues에 다음 정보와 함께 제보해주세요:
- 오류 메시지
- 재현 단계
- 환경 정보 (Node.js 버전, OS 등)
- 관련 로그