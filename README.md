# 성경 퀴즈 · 성경 고사

2027 경기북부노회 어린이대회 성경 퀴즈·성경 고사 예상문제를 풀어 보는 웹 앱입니다.
빌드 과정 없이 `index.html`을 브라우저로 열거나 GitHub Pages 등에 그대로 올리면 됩니다.

## 기능

1. **과목 선택** – 성경 퀴즈(에스라~아가) 또는 성경 고사(킹덤 스토리 1–48과)
2. **풀기 방식**
   - 하루에 5문제: 1번부터 차례대로 하루 5문제씩 (다 풀면 다음 날 이어서)
   - 100문제 풀기: 전체 문제
   - 랜덤 5문제: 무작위 5문제
3. **날짜 도장판** – 과목에 들어오면 그날 초록색 `출석` 도장, 문제를 끝까지 풀면 파란색 `완료` 도장으로 덮어씁니다.
4. **정답 확인** – 답을 고르거나 쓴 뒤 `확인`을 누르면 정답·해설·출제 근거가 함께 나옵니다.
   주관식은 해설에 적힌 다른 인정 답안도 정답으로 처리하고, 같은 뜻인 경우 직접 정답 처리할 수 있습니다.

기록(도장, 하루 5문제 진도)은 브라우저의 localStorage에 저장됩니다.

## 문제 데이터

`data/quiz.js`, `data/exam.js`는 원본 PDF에서 추출했습니다. 문제를 바꾸려면:

```sh
pdftotext -layout 성경퀴즈.pdf quiz.txt
python3 tools/parse_pdf_text.py quiz.txt data/quiz.js QUIZ_QUESTIONS
pdftotext -layout 성경고사.pdf exam.txt
python3 tools/parse_pdf_text.py exam.txt data/exam.js EXAM_QUESTIONS
```
