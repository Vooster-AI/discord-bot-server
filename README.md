# Discord 포럼 Supabase 동기화 시스템

Discord 포럼 채널의 포스트와 메시지를 실시간으로 Supabase 데이터베이스에 동기화하는 시스템입니다.

## 🚀 기능

- **실시간 모니터링**: Discord 포럼 채널의 새 포스트와 메시지를 실시간 감지
- **Supabase 동기화**: PostgreSQL 데이터베이스에 모든 포럼 활동 저장
- **Express.js API**: RESTful API를 통한 데이터 조회
- **콘솔 로깅**: 모든 활동에 대한 상세한 콘솔 출력
- **구성 가능**: JSON 설정을 통한 유연한 구성

## 📋 시스템 구성

```
Discord 포럼 → Discord 봇 → Express.js API → Supabase PostgreSQL
                    ↓
               콘솔 로깅
```

## 🛠️ 설치 및 설정

### 1. 환경 변수 설정

`.env` 파일에 필요한 키들을 설정하세요:

```env
DISCORD_TOKEN=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database
DATABASE_URL=

# Server
PORT=3000

# GitHub Integration
GITHUB_TOKEN=
GITHUB_REPOSITORY=owner/repository
```

### 2. 포럼 채널 설정

`src/forum/forum-config.json` 파일에서 모니터링할 채널을 설정하세요:

```forum-config.json
"forumChannels": [
  {
    "id": "채널 아이디",
    "name": "채널 이름",
    "table": "supabase 테이블 이름"
  }
]
```

### 3. Supabase table 설정 (Questions, Reports, ...)


| Name        | Format      | Role/Description               |
|-------------|-------------|--------------------------------|
| `post_name` | text        | Forum post title               |
| `content`   | text        | Message content                |
| `created_at`| timestamptz | Message creation timestamp     |
| `details`   | json        | Metadata (author, link, etc.)  |
| `github`    | text        | Linked GitHub issue URL        |

### 4. Supabase table 설정 (Users)

| Name        | Format | Role/Description                       |
|-------------|--------|----------------------------------------|
| `Nname`     | text   | Display name of the Discord user       |
| `discord_id`| text   | Unique Discord user ID                 |
| `score`     | int    | Score value assigned to the user       |
| `scored_by` | text   | Discord ID of the user who gave score  |

## 🏃‍♂️ 실행

### 개발 환경 (전체 시스템)

```bash
# 서버와 봇을 함께 실행
./start-dev.sh
```

### 개별 실행

```bash
# Express.js 서버만 실행
npm run server

# Discord 봇만 실행
npm run dev
```

## 📊 데이터베이스 스키마

### 주요 테이블

- **guilds**: Discord 서버 정보
- **forum_channels**: 포럼 채널 정보
- **forum_posts**: 포럼 포스트 데이터
- **forum_messages**: 포럼 메시지 데이터
- **sync_logs**: 동기화 로그

## 🔌 API 엔드포인트

### 조회 API

```bash
# 포럼 목록 조회
GET /api/forums

# 특정 포럼의 포스트 목록
GET /api/forums/:channelId/posts?page=1&limit=20

# 특정 포스트의 메시지 목록
GET /api/posts/:postId/messages?page=1&limit=50

# 통계 조회
GET /api/stats

# 서버 상태 확인
GET /health
```

### 동기화 API

```bash
# 새 포스트 동기화
POST /api/sync/post

# 새 메시지 동기화
POST /api/sync/message
```