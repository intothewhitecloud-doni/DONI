# DONI Agent Instructions

## Commit Message Rules

- 모든 커밋 메시지는 Conventional Commits 형식을 강제한다.
- 커밋 제목 형식은 `<type>(<scope>): <한글 요약>`으로 작성한다.
- 허용 타입은 `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`, `revert`로 제한한다.
- 제목과 본문은 한글로 작성한다. 단, 코드 식별자, 파일 경로, 명령어, 타입명은 원문을 유지할 수 있다.
- 제목은 72자 이내의 명령형 또는 결과 중심 문장으로 작성하고 마침표를 붙이지 않는다.
- 본문은 개조식으로 작성한다.
- 본문 항목은 `- 변경:`, `- 이유:`, `- 검증:`, `- 위험:` 중 필요한 항목을 사용한다.
- 검증을 수행하지 못한 경우 `- 검증:` 항목에 미수행 사유를 명시한다.
- 원격 이력을 수정하는 amend/rebase 이후 push가 필요하면 `git push --force-with-lease`를 사용한다.

### Example

```text
feat(ai-chat): 역할별 답변 피드백 버튼을 추가

- 변경: 소유자는 공유하기, 관리자는 보고하기 버튼을 확인하도록 조정
- 이유: 답변 하단의 이동 버튼 대신 역할별 피드백만 받기 위함
- 검증: npm run typecheck, npm run test:policy, npm run build 통과
- 위험: 실제 공유/보고 API 연동은 포함하지 않음
```
