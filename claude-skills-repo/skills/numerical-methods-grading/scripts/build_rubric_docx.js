// build_rubric_docx.js -- generate a "採点基準" (grading rubric) docx for one
// lecture's assignment, from a JSON config. This is the document shown to
// the user for approval BEFORE any grading happens.
//
// Usage:
//   node build_rubric_docx.js <rubric_config.json> <output.docx>
//
// See ../references/rubric_config_schema.md for the full field reference and
// an example. Short version of the shape:
// {
//   "lecture_no": 9,
//   "assignment_title": "第9回課題: ...",
//   "overview": "課題の概要を1〜数段落で。",
//   "submission_max": 50, "content_max": 50,
//   "late_students": [ {"name": "...", "late_label": "24時間以内", "note": "..."} ],
//   "exercises": [
//     { "name": "演習1", "max": 21, "description": "...",
//       "subquestions": [ {"label": "(1)", "max": 7, "criteria": ["...", "..."]} ] }
//   ],
//   "common_rules": ["..."],
//   "submission_format_notes": ["..."],
//   "grader_reference": "模範解答の値など、採点者向けメモ。",
//   "next_steps": "..."
// }
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, VerticalAlign,
} = require("docx");

const [, , configPath, outPath] = process.argv;
if (!configPath || !outPath) {
  console.error("Usage: node build_rubric_docx.js <rubric_config.json> <output.docx>");
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const FONT = "游ゴシック";
const BLUE = "1F4E79";
const GRAY = "F2F2F2";

const DEFAULT_TIERS = [
  ["期限内", 0, "±0点"],
  ["24時間以内", 5, "-5点"],
  ["24時間〜3日", 10, "-10点"],
  ["3日〜7日", 20, "-20点"],
  ["7日超", 35, "-35点 (要相談)"],
];

function h(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level, spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, font: FONT })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, font: FONT, ...opts })] });
}
function bullet(text, level = 0) {
  return new Paragraph({
    spacing: { after: 60 }, bullet: { level },
    children: [new TextRun({ text, font: FONT })],
  });
}
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: BLUE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, font: FONT, bold: true, size: 18, color: "FFFFFF" })],
    })],
  });
}
function cell(text, { width, align = AlignmentType.LEFT, shade = null, size = 18 } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.CLEAR, color: "auto", fill: shade } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(text), font: FONT, size })] })],
  });
}

const body = [];

body.push(
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 300 },
    children: [new TextRun({ text: `採点基準: ${cfg.assignment_title || `第${cfg.lecture_no}回課題`}`, bold: true, size: 32, font: FONT })],
  }),
);

// 1. 課題の概要
body.push(h("1. 課題の概要"));
body.push(p(cfg.overview || ""));

// 2. 採点方針
const subMax = cfg.submission_max ?? 50;
const conMax = cfg.content_max ?? 50;
body.push(h("2. 採点方針"));
body.push(p(`提出点${subMax}点 + 内容点${conMax}点 = 合計100点満点。提出しているだけで${subMax}点、無提出は0点。内容の出来に応じて内容点で加点する。`));

// 3. 提出遅延の減点基準
body.push(h("3. 提出遅延の減点基準"));
const tierWidths = [3000, 2000, 6000];
const tierRows = [
  new TableRow({ tableHeader: true, children: [headerCell("区分", tierWidths[0]), headerCell("減点", tierWidths[1]), headerCell("備考", tierWidths[2])] }),
  ...DEFAULT_TIERS.map(([label, ded, note]) => new TableRow({
    children: [cell(label, { width: tierWidths[0] }), cell(ded === 0 ? "±0点" : `-${ded}点`, { width: tierWidths[1], align: AlignmentType.CENTER }), cell(note, { width: tierWidths[2] })],
  })),
];
body.push(new Table({ width: { size: 11000, type: WidthType.DXA }, columnWidths: tierWidths, rows: tierRows }));

if (cfg.late_students && cfg.late_students.length) {
  body.push(new Paragraph({ text: "", spacing: { after: 150 } }));
  body.push(p("今回、遅延提出に該当する学生:", { bold: true }));
  cfg.late_students.forEach((s) => body.push(bullet(`${s.name}: ${s.late_label}${s.note ? `(${s.note})` : ""}`)));
}

// 4. 配点表(概要)
body.push(h("4. 配点表(概要)"));
const exList = cfg.exercises || [];
exList.forEach((ex) => body.push(bullet(`${ex.name}: ${ex.max}点${ex.description ? ` -- ${ex.description}` : ""}`)));
body.push(bullet(`内容点合計: ${conMax}点`));

// 5+. 演習ごとの詳細基準
exList.forEach((ex, i) => {
  body.push(h(`${5 + i}. ${ex.name} 詳細基準 (${ex.max}点)`));
  if (ex.description) body.push(p(ex.description));
  (ex.subquestions || []).forEach((sq) => {
    body.push(p(`${sq.label} (${sq.max}点)`, { bold: true }));
    (sq.criteria || []).forEach((c) => body.push(bullet(c, 1)));
  });
});

let nextSection = 5 + exList.length;

// 共通の評価基準・減点事項
if (cfg.common_rules && cfg.common_rules.length) {
  body.push(h(`${nextSection}. 共通の評価基準・減点事項`));
  cfg.common_rules.forEach((r) => body.push(bullet(r)));
  nextSection += 1;
}

// 提出物の形式に関する留意事項
if (cfg.submission_format_notes && cfg.submission_format_notes.length) {
  body.push(h(`${nextSection}. 提出物の形式に関する留意事項`));
  cfg.submission_format_notes.forEach((r) => body.push(bullet(r)));
  nextSection += 1;
}

// 採点者用参考
if (cfg.grader_reference) {
  body.push(h(`${nextSection}. 採点者用参考`));
  cfg.grader_reference.split("\n").forEach((line) => { if (line.trim()) body.push(p(line)); });
  nextSection += 1;
}

// 今後の進め方
if (cfg.next_steps) {
  body.push(h(`${nextSection}. 今後の進め方`));
  body.push(p(cfg.next_steps));
}

const doc = new Document({
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 } } }, children: body }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log(`wrote ${outPath}`);
});
