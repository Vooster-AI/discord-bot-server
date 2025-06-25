# 코드베이스 아키텍처

## 📁 프로젝트 구조

```
src/
├── core/                    # 핵심 비즈니스 로직
│   └── services/           # 도메인별 서비스
│       ├── UserService.ts     # 사용자 관리 (통합됨)
│       ├── ScoreService.ts    # 점수 관리
│       ├── MessageService.ts  # 메시지 처리
│       └── ReactionService.ts # 반응 처리
├── bot/                    # Discord 봇 관련
│   ├── index.ts           # 봇 메인 클래스
│   ├── login.ts           # 봇 로그인 로직
│   ├── commands/          # 슬래시 명령어
│   └── monitors/          # 이벤트 모니터링
│       └── ForumMonitor.ts   # 포럼 모니터링 (리팩토링됨)
├── api/                   # REST API
│   ├── app.ts            # Express 앱 설정
│   ├── controllers/      # API 컨트롤러
│   ├── routes/           # API 라우트
│   └── middlewares/      # 미들웨어
├── services/             # 외부 서비스 연동
│   ├── github/          # GitHub 동기화
│   ├── supabaseSync/    # Supabase 동기화
│   └── sync/            # 기타 동기화
└── shared/              # 공유 유틸리티
    ├── types/          # 타입 정의
    └── utils/          # 유틸리티 함수
```

## 🔧 리팩토링 내용

### 1. 단일 책임 원칙 적용
- **ForumMonitor**: 1000+ 줄의 거대한 파일을 여러 서비스로 분리
  - `MessageService`: 메시지 처리 전담
  - `ReactionService`: 반응 처리 전담  
  - `ScoreService`: 점수 관리 전담

### 2. 중복 코드 제거
- **UserService**: 두 개의 중복된 사용자 서비스를 하나로 통합
  - Prisma와 Supabase 통합 지원
  - 폴백 메커니즘으로 안정성 확보

### 3. 타입 정의 통합
- `shared/types/common.ts`: 공통 타입 정의 중앙화
- `shared/types/api.ts`: API 관련 타입들

## 🛠️ 개발 도구

### 코드 품질
- **ESLint**: 코드 스타일 및 오류 검사
- **Prettier**: 코드 포맷팅
- **TypeScript**: 정적 타입 검사

### 사용법
```bash
# 린팅
npm run lint
npm run lint:fix

# 포맷팅
npm run format
npm run format:check

# 타입 체크
npm run typecheck

# 빌드
npm run build
```

## 🚀 CI/CD

### GitHub Actions 워크플로우

1. **ci.yml**: 메인/develop 브랜치 푸시 시
   - 코드 포맷팅 검사
   - ESLint 실행
   - TypeScript 타입 체크
   - 빌드 테스트

2. **pr-check.yml**: Pull Request 시
   - 모든 CI 검사
   - 보안 취약점 스캔

3. **deploy.yml**: 메인 브랜치 배포 시
   - 프로덕션 빌드
   - 배포 준비

## 📋 서비스 책임

### Core Services
- **UserService**: 사용자 생성, 업데이트, 점수 관리
- **MessageService**: Discord 메시지 처리 및 동기화
- **ReactionService**: Discord 반응 처리 및 GitHub 동기화
- **ScoreService**: 사용자 점수 계산 및 저장

### External Services
- **GitHubSyncService**: GitHub 이슈/댓글 동기화
- **SyncService**: Supabase 데이터 동기화
- **MessageSyncService**: 메시지 삭제 등 동기화

## 🔄 데이터 흐름

1. **Discord 이벤트** → ForumMonitor
2. **ForumMonitor** → 해당 Service (Message/Reaction/Score)
3. **Service** → 외부 API (GitHub/Supabase)
4. **결과** → 로깅 및 사용자 피드백

## 🧪 테스트 전략

- 단위 테스트: 각 서비스별 독립적 테스트
- 통합 테스트: 서비스 간 상호작용 테스트
- E2E 테스트: Discord → GitHub/Supabase 전체 플로우

## 🔒 보안 고려사항

- 환경변수로 민감정보 관리
- Discord ID 정밀도 보존을 위한 문자열 변환
- GitHub API rate limiting 처리
- Supabase RLS 정책 적용