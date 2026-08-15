#!/usr/bin/env python3
"""
compute_grades.py -- turn per-student content scores + lateness labels into
final grades (submission point + content point + total), with the
graduated late-penalty policy applied.

Input:  a JSON file shaped like:
{
  "content_max": 50,
  "submission_max": 50,
  "late_penalty_tiers": {                 # optional; defaults to the
    "期限内": {"deduction": 0,  "desc": "期限内提出"},            # canonical
    "24時間以内": {"deduction": 5,  "desc": "..."},               # tiers in
    "24時間〜3日": {"deduction": 10, "desc": "..."},               # references/
    "3日〜7日":   {"deduction": 20, "desc": "..."},               # late_penalty_policy.md
    "7日超":     {"deduction": 35, "desc": "..."}
  },
  "students": {
    "<participant_id>": {
      "name": "SONODA, Naohiro 園田尚弘",
      "content_score": 24,                # 0..content_max, from grading agents
      "late_label": null,                 # one of the tier keys above, or null/omit if on-time
      "note": "演習2②実質白紙。",          # optional free-text folded into the CSV comment
      "flag": null                        # e.g. "要学生確認" if the submission looked
                                           # incomplete/inconsistent and needs the student
                                           # (not just the grader) to weigh in before the
                                           # grade is final; null/omit otherwise
    },
    ...
  }
}

Output: a JSON file with per-student {submission, content, total, comment, flag}
plus class stats (count/average/max/min/median), ready for update_csv.py
and for building report_data.json (see build_summary_docx.js). update_csv.py
uses "flag" to decide whether a row's 採点ワークフローステータス becomes
採点完了 (done) or 採点中 (still needs follow-up) -- see that script's
docstring.

Usage:
    python compute_grades.py <grading_input.json> <computed_grades.json>
"""
import json
import statistics
import sys

DEFAULT_TIERS = {
    "期限内": {"deduction": 0, "desc": "期限内提出"},
    "24時間以内": {"deduction": 5, "desc": "締切から24時間以内の遅延"},
    "24時間〜3日": {"deduction": 10, "desc": "締切から24時間〜3日の遅延"},
    "3日〜7日": {"deduction": 20, "desc": "締切から3日〜7日の遅延"},
    "7日超": {"deduction": 35, "desc": "締切から7日超の遅延(要相談)"},
}


def main():
    if len(sys.argv) != 3:
        print("Usage: python compute_grades.py <grading_input.json> <computed_grades.json>")
        sys.exit(1)

    inp_path, out_path = sys.argv[1], sys.argv[2]
    with open(inp_path, encoding="utf-8") as f:
        inp = json.load(f)

    content_max = inp.get("content_max", 50)
    submission_max = inp.get("submission_max", 50)
    tiers = inp.get("late_penalty_tiers", DEFAULT_TIERS)

    results = {}
    for pid, s in inp["students"].items():
        content = float(s["content_score"])
        if content > content_max:
            raise ValueError(f"{pid}: content_score {content} exceeds content_max {content_max}")
        late_label = s.get("late_label") or None
        if late_label:
            tier = tiers.get(late_label)
            if tier is None:
                raise ValueError(
                    f"Unknown late_label '{late_label}' for {pid}; "
                    f"add it to late_penalty_tiers or fix the label."
                )
            submission = submission_max - tier["deduction"]
        else:
            submission = submission_max

        total = round(submission + content, 2)

        comment_parts = [
            f"提出点{submission}点(満点{submission_max}点)",
            f"内容点{content}点(満点{content_max}点)",
        ]
        if late_label:
            comment_parts.append(f"遅延減点: {late_label}({tiers[late_label]['desc']})")
        if s.get("note"):
            comment_parts.append(s["note"])
        comment = "。".join(comment_parts) + "。"

        results[pid] = {
            "name": s.get("name", ""),
            "submission": submission,
            "content": content,
            "total": total,
            "late_label": late_label,
            "comment": comment,
            "flag": s.get("flag") or None,
        }

    totals = [r["total"] for r in results.values()]
    stats = {}
    if totals:
        stats = {
            "count": len(totals),
            "average": round(sum(totals) / len(totals), 2),
            "max": max(totals),
            "min": min(totals),
            "median": statistics.median(totals),
        }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"students": results, "stats": stats}, f, ensure_ascii=False, indent=1)

    print(f"computed {len(results)} students -> {out_path}")
    if stats:
        print(
            f"avg={stats['average']} max={stats['max']} "
            f"min={stats['min']} median={stats['median']}"
        )


if __name__ == "__main__":
    main()
