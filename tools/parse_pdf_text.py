"""pdftotext -layout 결과(.txt)를 문항 JSON으로 변환합니다.

사용법: python3 tools/parse_pdf_text.py <입력.txt> <출력.js> <전역변수명>
"""
import json
import re
import sys

CIRCLED = "①②③④"
Q_RE = re.compile(r"^(\d+)\.\s+(.*)$")
MARK_RE = re.compile(r"\(\s*([OX①②③④])\s*\)\s*$")


def clean(s):
    # 빈칸 괄호는 '( )'로 통일합니다. 화면에서 빈칸 모양으로 그립니다.
    s = re.sub(r"[ \t\f]+", " ", s)
    return s.strip()


def parse(path):
    lines = [clean(l) for l in open(path, encoding="utf-8")]
    lines = [l for l in lines if l]
    questions, section, cur, field = [], None, None, None
    expected = 1

    def finish():
        if not cur:
            return
        text = " ".join(cur["text"]).strip()
        m = MARK_RE.search(text)
        if m:
            text = text[: m.start()].strip()
            mark = m.group(1)
        else:
            mark = None
        q = {"no": cur["no"], "section": cur["section"], "question": text}
        if cur["options"]:
            q["type"] = "choice"
            q["options"] = cur["options"]
            q["answer"] = CIRCLED.index(mark) if mark else None
        elif mark in ("O", "X"):
            q["type"] = "ox"
            q["answer"] = mark
        else:
            q["type"] = "short"
            q["answer"] = cur.get("answer", "")
        q["source"] = cur.get("source", "")
        q["explanation"] = cur.get("explanation", "")
        if q["type"] != "short" and q["answer"] is None:
            raise ValueError(f"정답 표시 없음: {q['no']}")
        questions.append(q)

    for line in lines:
        m = Q_RE.match(line)
        if m and int(m.group(1)) == expected:
            finish()
            cur = {"no": expected, "section": section, "text": [m.group(2)], "options": []}
            field = "text"
            expected += 1
            continue
        if cur is None:
            if expected > 1 or line.startswith(("OX형", "에스라")):
                section = line
            continue
        if line[0] in CIRCLED and field in ("text", "options"):
            cur["options"].append(line[1:].strip())
            field = "options"
            continue
        key = {"정답:": "answer", "근거:": "source", "해설:": "explanation"}.get(line[:3])
        if key:
            cur[key] = line[3:].strip()
            field = key
            continue
        if field == "text":
            cur["text"].append(line)
        elif field in ("answer", "source", "explanation"):
            # 다음 섹션 제목(예: '느헤미야', '빈칸 채우기 (61–75번)')인지 확인
            if len(line) <= 25 and not line.endswith((".", "다")):
                finish()
                cur = None
                section = line
            else:
                cur[field] += " " + line
        else:
            cur["options"][-1] += " " + line
    finish()
    return questions


def main():
    src, out, var = sys.argv[1:4]
    qs = parse(src)
    assert len(qs) == 100, len(qs)
    sections = []
    for q in qs:
        if q["section"] not in sections:
            sections.append(q["section"])
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"window.{var} = ")
        json.dump(qs, f, ensure_ascii=False, indent=1)
        f.write(";\n")
    print(len(qs), sections)


if __name__ == "__main__":
    main()
