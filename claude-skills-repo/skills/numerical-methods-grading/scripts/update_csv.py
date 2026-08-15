#!/usr/bin/env python3
"""
update_csv.py -- fill in the 評点 (score) and 採点ワークフローステータス
(grading workflow status) columns of a Moodle assignment grading-worksheet
CSV, using the output of compute_grades.py.

Matching: Moodle's ID column looks like "参加者31356828" -- the numeric
suffix is stripped and looked up in computed_grades.json's "students" dict.
Any row whose ID is NOT found there is treated as a non-submission and is
scored 0.00. This mirrors how the Moodle export already lists every
enrolled student, submitted or not, so no separate non-submitter list
needs to be maintained by hand.

Column policy (confirmed by the user during L8 grading -- treat as the
standing default for every future round unless told otherwise):
- フィードバックコメント (feedback comment) is left blank. The instructor
  does not want per-student comments written into this column.
- 採点ワークフローステータス starts as "未採点" (ungraded) for every row in
  the raw Moodle export. This script updates it to:
    - "採点完了" (grading complete) for any row whose grade is final --
      i.e. every non-submitter (0 point is unambiguous) and every
      submitter whose computed_grades.json entry has no "flag" set.
    - "採点中" (grading in progress) for a submitter whose entry DOES have
      a "flag" set (see compute_grades.py / grading_agent_prompt_template.md)
      -- e.g. the submission looked incomplete, inconsistent, or otherwise
      needs the student (not just the grader) to weigh in before the grade
      can be considered final. Leaving these as "in progress" rather than
      "complete" keeps them visibly distinct in Moodle until resolved.

Usage:
    python update_csv.py <moodle_csv> <computed_grades.json> <output_csv>
"""
import csv
import json
import sys


def main():
    if len(sys.argv) != 4:
        print("Usage: python update_csv.py <moodle_csv> <computed_grades.json> <output_csv>")
        sys.exit(1)
    src, grades_path, dst = sys.argv[1], sys.argv[2], sys.argv[3]

    with open(grades_path, encoding="utf-8") as f:
        computed = json.load(f)["students"]

    with open(src, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)

    idx_id = header.index("ID")
    idx_score = header.index("評点")
    idx_comment = header.index("フィードバックコメント") if "フィードバックコメント" in header else None
    idx_status = header.index("採点ワークフローステータス") if "採点ワークフローステータス" in header else None

    filled, nonsubmit, needs_review, unmatched = 0, 0, 0, []
    for row in rows:
        pid = row[idx_id].replace("参加者", "").strip()
        if idx_comment is not None:
            row[idx_comment] = ""  # フィードバックコメント欄は使わない(ユーザー方針)
        if pid in computed:
            r = computed[pid]
            row[idx_score] = f"{r['total']:.2f}"
            if idx_status is not None:
                if r.get("flag"):
                    row[idx_status] = "採点中"
                    needs_review += 1
                else:
                    row[idx_status] = "採点完了"
            filled += 1
        elif pid:
            row[idx_score] = "0.00"
            if idx_status is not None:
                row[idx_status] = "採点完了"
            nonsubmit += 1
        else:
            unmatched.append(row[idx_id])

    with open(dst, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"filled {filled} submitted + {nonsubmit} non-submitted = {filled + nonsubmit} rows -> {dst}")
    if idx_status is not None:
        print(f"  of which flagged as 採点中 (needs follow-up): {needs_review}")
    if unmatched:
        print(f"WARNING: {len(unmatched)} row(s) had no parseable participant ID: {unmatched}")


if __name__ == "__main__":
    main()
