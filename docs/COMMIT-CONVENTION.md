# Git 커밋 메시지 컨벤션 (Conventional Commits)

이 프로젝트는 커밋 메시지에 [Conventional Commits](https://www.conventionalcommits.org/ko/) 스타일을 따릅니다.
커밋 메시지를 일관되게 작성함으로써, 변경 이력을 명확하게 파악하고 자동 changelog 생성 등의 자동화를 가능하게 합니다.

---

## ✅ 커밋 메시지 형식

```
<type>(optional scope): <subject>

[optional body]

[optional footer]
```

- `type`: 변경의 종류 (아래 참고)
- `scope`: 선택사항, 변경된 모듈/파일/기능 범위
- `subject`: 간결한 설명 (50자 이내, 마침표 ❌)
- `body`: 선택사항, 변경 이유와 상세 내용
- `footer`: 선택사항, 이슈 연결 (`Closes #123` 등)

---

## 📌 type 종류

| 타입       | 설명                                            |
| ---------- | ----------------------------------------------- |
| `feat`     | 새로운 기능 추가                                |
| `fix`      | 버그 수정                                       |
| `refactor` | 기능 변화 없이 내부 코드 개선                   |
| `docs`     | 문서 관련 변경 (README 등)                      |
| `style`    | 코드 포맷팅, 세미콜론 등 스타일 변경            |
| `test`     | 테스트 코드 추가/수정                           |
| `chore`    | 빌드, 설정, CI, 의존성 등 변경                  |
| `perf`     | 성능 개선                                       |
| `build`    | 빌드 시스템 또는 외부 의존성에 영향을 주는 변경 |
| `ci`       | CI 관련 설정 변경                               |
