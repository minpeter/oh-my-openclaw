# Draft: Killer Preset ("올인원" 에이전트)

## Requirements (confirmed)
- **방향**: 개인 비서 + 개발 무기 올인원 프리셋
- **채널**: Telegram, Discord, Terminal/CLI (Web UI는 보안상 비활성화 기본, 설정은 터미널로만)
- **성격 톤**: 유저가 초기 인터랙션에서 커스터마이즈할 수 있어야 함 → USER.md에서 정의 유도
- **자동화 레벨**: TBD (유저가 다른 에이전트 작업 참고 후 결정 예정)
- **tmux-opencode 스킬**: 무조건 내장. OpenCode 세션을 tmux로 원격 제어하여 코드 작업 위임.
- **prompt-guard 스킬**: 무조건 내장. 600+ 패턴 prompt injection 방어, 10개 언어, DLP, canary token.


## tmux-opencode 스킬 요약
- **목적**: tmux로 OpenCode 세션 제어 (코드 작업, 이슈 픽스, 병렬 작업)
- **핵심 기능**:
  - 소켓 기반 tmux 세션 생성/관리
  - OpenCode에 프롬프트 전송 (영어, `-l` 플래그, `ulw` 접두사)
  - 상태 확인 (thinking/ready/error/stuck 판단)
  - 모델 변경 (Ctrl+X M → 모델 피커)
  - 에이전트 선택 (Tab 순환: Sisyphus → Hephaestus → Prometheus → Atlas)
  - Rate limit 복구 (ESC → continue)
  - Idle 세션 채찍질 (ESC → continue)
  - 병렬 이슈 작업 (git worktree + 세션별 분리)
  - 세션 추적 (memory/tmux-sessions.json)
  - 자동 완료 알림 (watch-session.sh → Discord)
- **프리셋 통합 방식**: TOOLS.md에 스킬로 포함, AGENTS.md에 사용 규칙 정의

## prompt-guard 스킬 요약
- **목적**: AI 에이전트 런타임 보안 — prompt injection, jailbreak, 비밀 유출 방어
- **핵심 기능**:
  - 600+ 패턴 (injection, jailbreak, MCP abuse, reverse shell, skill weaponization)
  - 10개 언어 (EN, KO, JA, ZH, RU, ES, DE, FR, PT, VI)
  - 5단계 심각도 (SAFE → LOW → MEDIUM → HIGH → CRITICAL)
  - Output DLP: LLM 응답에서 credential 자동 감지/제거 (15+ 키 포맷)
  - Enterprise DLP: sanitize_output() — redact-first, block-as-fallback
  - Canary Token: 시스템 프롬프트 추출 탐지
  - 인코딩 해독: Base64, Hex, ROT13, URL, HTML entities, Unicode
  - Token Smuggling 방어: delimiter stripping + character spacing collapse
  - SHIELD.md 표준 준수 (11개 위협 카테고리)
  - Supply Chain Skill Injection 방어 (v3.5.0)
  - Memory Poisoning Defense (AGENTS.md/SOUL.md/MEMORY.md 보호)
  - Tiered pattern loading (70% 토큰 감소) + LRU hash cache (90% 절약)
  - 100% 오프라인 작동 + Optional API for early-access patterns
- **프리셋 통합 방식**:
  - AGENTS.md에 "모든 외부 입력은 prompt-guard로 스캔" 규칙 추가
  - TOOLS.md에 prompt-guard 설치/사용법 포함
  - config에서 sensitivity: high, canary_tokens 설정

## Technical Decisions
- SOUL.md는 성격 톤 placeholder + "초기 대화에서 유저 스타일 학습" 지시 포함
- USER.md는 빈 템플릿 + "유저가 채워야 할 항목" 가이드
- tmux-opencode는 TOOLS.md 전체로 포함 (gist 원문 그대로 + 프리셋용 커스터마이즈)

## Open Questions
- [ ] 자동화 레벨 (Heartbeat/Cron 설정) — 유저가 추후 결정
- [ ] 프리셋 이름 — TBD
- [ ] 추가 Skills (GitHub, Obsidian, 1Password 등) — TBD
- [x] prompt-guard 통합 — CONFIRMED (무조건 내장)

## Scope Boundaries
- INCLUDE: identity, agents, tools, SOUL.md, AGENTS.md, IDENTITY.md, USER.md, TOOLS.md, MEMORY.md
- EXCLUDE: 채널 토큰 (sensitive), API 키, auth-profiles.json
