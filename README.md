# Vooster

Vooster 디스코드를 위한 전용 봇으로 유저 목록, 메시지 로깅, 깃허브 및 supabase 동기화 기능이 있습니다.

## Setup

```bash
git clone <repository-url>
```

### 환경 변수 설정

루트 디렉터리에 `.env` 파일을 만들고 아래 내용을 넣어주세요:

```env
# 봇 토큰
DISCORD_TOKEN=

# Supabase 키
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (Prisma) - Using local SQLite for development
DATABASE_URL="file:./dev.db"

# Server
PORT=3000

# 레벨 = 경험치 / 10
LEVEL_DIVISOR=10

# 깃허브 연동용
GITHUB_TOKEN=
GITHUB_REPOSITORY=아이디/저장소이름

# 초기 시작시 기존 메시지들 로깅
AUTO_BACKFILL=true
```

### 데이터베이스 설정

봇은 데이터베이스 관리를 위해 Prisma를 사용합니다. 다음 명령어를 실행하여 데이터베이스를 설정하세요:

```bash
# 데이터베이스 마이그레이션 적용
npm run db:migrate

# Prisma 클라이언트 생성
npm run db:generate

# (선택사항) 데이터베이스 관리를 위한 Prisma Studio 열기
npm run db:studio
```

### Supabase 테이블


#### Users
Discord 사용자 정보와 점수 데이터를 저장합니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 사용자 ID (PK) |
| nickname | TEXT | 서버 프로필 별명 |
| username | TEXT | 사용자 계정 이름 |
| score | INTEGER | 총 점수 |
| discord_id | TEXT | 사용자 디스코드 ID |
| created_at | timestamptz | 테이블에 추가된 시각 |

#### Forums
포럼 채널 설정 및 동기화 설정을 관리합니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 포럼 ID (PK) |
| name | TEXT | 포럼 채널 이름 |
| table_name | TEXT | 동기화 대상 테이블명 |
| score | INTEGER | 포스트당 부여 점수 |
| github_sync | BOOLEAN | GitHub 동기화 활성화 여부 |
| channel_id | TEXT | Discord 채널 ID |
| todo | BOOLEAN | 투두 기능 활성화 여부 |

#### Logs
사용자 점수 변경 이력을 추적합니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 로그 ID (PK) |
| user | UUID | 사용자 ID (FK) |
| score_change | INTEGER | 점수 변화량 |
| score | INTEGER | 변경 후 총 점수 |
| action | TEXT | 점수 변경 사유 |
| channel | TEXT | 디스코드 채널 이름 |
| post | TEXT | 해당 포스트 이름 |
| content | TEXT | 메시지 내용 |
| changed_at | TIMESTAMP | 변경 시간 |
| message_link | TEXT | 메시지 링크 |

#### 동적 콘텐츠 테이블들
Forums에 추가할 수 있는 포럼 로깅용 테이블입니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 콘텐츠 ID (PK) |
| post_name | TEXT | 해당 포스트 이름 |
| content | TEXT | 메시지 내용 |
| user | UUID | 사용자 ID (FK) |
| post_id | TEXT | 포스트 ID |
| message_id | TEXT | 메시지 ID |
| message_link | TEXT | 메시지 링크 |
| created_at | TIMESTAMP | 생성 타임스탬프 |

## 사용법

### Discord 명령어

#### 레벨 확인
```
/level_check
```
현재 레벨과 점수 진행도를 확인합니다.

**출력 예시:**
```
📊 YOUR_NAME님의 레벨 정보
🎯 레벨: 5 (1,250 점)
📈 다음 레벨까지: 250점 (83.3%)
```

#### 서버 랭킹
```
/rank
```
서버 내 상위 10명 사용자를 표시합니다.

**출력 예시:**
```
🏆 서버 랭킹 TOP 10
🥇 1위: Player1 - 레벨 10 (2,500점)
🥈 2위: Player2 - 레벨 9 (2,100점)
🥉 3위: Player3 - 레벨 8 (1,800점)
```

### 자동 동기화

#### 포럼 포스트 → GitHub 이슈
- 새로운 포럼 포스트가 자동으로 GitHub 이슈를 생성합니다
- 포스트 제목과 내용이 이슈 제목과 설명으로 변환됩니다
- Discord와 GitHub 간 상호 참조가 유지됩니다

#### 메시지 → 댓글
- 포럼 포스트 답글이 GitHub 이슈 댓글로 동기화됩니다
- 작성자 정보와 메시지 내용이 보존됩니다
- 사용자는 댓글 작성으로 점수를 받습니다

#### 반응 동기화
- Discord 반응이 GitHub 댓글에 미러링됩니다
- 지원하는 반응: 👍, 👎, ❤️, 🎉, 😕, 🚀, 👀

#### 상태 동기화
- 포럼 포스트 잠금 → GitHub 이슈 닫기
- 포럼 포스트 아카이브 → GitHub 이슈 닫기

## API 레퍼런스

examples 폴더내에 api 예시 페이지가 있습니다.
`http://localhost:3000/api`에서 RESTful API를 제공합니다. 주요 엔드포인트는 다음과 같습니다:

### 시스템 상태
```http
GET /health
```
서버 상태와 건강 상태를 확인합니다.

### 사용자 관리
```http
GET /api/users           # 모든 사용자 목록
GET /api/users/:id       # 특정 사용자 정보
```

### 포럼 데이터
```http
GET /api/forums                              # 모든 포럼 목록
GET /api/forums/:channelId/posts             # 채널의 포스트 목록
GET /api/posts/:postId/messages              # 포스트의 메시지 목록
```

### 동기화
```http
POST /api/sync/manual                        # 수동 동기화 실행
POST /api/sync/post                          # 특정 포스트 동기화
POST /api/sync/message                       # 특정 메시지 동기화
```

### 통계
```http
GET /api/stats                               # 시스템 통계
```

## 프로젝트 구조

```
src/
├── api/                 # Express API 서버
│   ├── controllers/     # API 컨트롤러
│   ├── middlewares/     # Express 미들웨어
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

## 데이터베이스 스키마

### 로컬 SQLite 테이블 (개발용)

#### tasks
할 일 관리를 위한 로컬 테이블입니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | TEXT | 작업 ID (Primary Key, UUID) |
| taskName | TEXT | 작업 이름 |
| complexity | INTEGER | 복잡도 |
| dueDate | TIMESTAMP | 마감일 |
| url | TEXT | Discord URL |
| threadId | TEXT | Discord 스레드 ID |
| channelId | TEXT | Discord 채널 ID |
| guildId | TEXT | Discord 서버 ID |
| status | TEXT | 상태 (기본값: "pending") |
| completedAt | TIMESTAMP | 완료 시간 (선택사항) |
| createdAt | TIMESTAMP | 생성 타임스탬프 |
| updatedAt | TIMESTAMP | 마지막 업데이트 타임스탬프 |

### 데이터베이스 연결 정보

**Supabase 연결**
- URL: `https://sqpbyhqlwcptqfuntvtc.supabase.co`
- 인증: Service Role Key 사용
- 용도: 메인 데이터 저장 및 동기화

**SQLite 연결**
- 파일: `./dev.db`
- 용도: 로컬 개발 및 할 일 관리

## 개발

### 사용 가능한 스크립트

```bash
# 개발
npm run dev                    # 개발 모드로 시작
npm run build                  # 프로덕션 빌드
npm start                      # 프로덕션 서버 시작

# 코드 품질
npm run typecheck              # TypeScript 타입 체크
npm run lint                   # ESLint 체크
npm run lint:fix               # ESLint 문제 수정
npm run format                 # Prettier로 코드 포맷팅
npm run format:check           # 코드 포맷팅 체크

# 데이터베이스
npm run db:migrate             # 데이터베이스 마이그레이션 실행
npm run db:generate            # Prisma 클라이언트 생성
npm run db:studio              # Prisma Studio 열기
```

### 새 기능 추가

#### Discord 명령어
1. `src/bot/commands/`에 새 파일 생성
2. `Command` 인터페이스 구현
3. `src/bot/login.ts`에서 명령어 등록

#### API 엔드포인트
1. `src/api/controllers/`에 컨트롤러 생성
2. `src/api/routes/`에 라우트 정의
3. `src/api/app.ts`에서 라우트 등록

## 문제 해결

### 일반적인 문제

#### 봇이 응답하지 않는 경우
- Discord 봇 토큰이 올바른지 확인
- 대상 채널에서 봇 권한을 확인
- 채널이 `forum_configs` 테이블에 등록되어 있는지 확인

#### GitHub 연동이 작동하지 않는 경우
- GitHub 토큰에 repo 권한이 있는지 확인
- 저장소 소유자와 이름이 올바른지 확인
- GitHub API 사용률 제한을 모니터링

#### 점수 시스템이 작동하지 않는 경우
- Supabase 연결 상태 확인
- `points_per_message` 설정 확인
- 사용자가 `users` 테이블에 등록되어 있는지 확인