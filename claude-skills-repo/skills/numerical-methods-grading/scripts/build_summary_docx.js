// build_summary_docx.js -- generate the final "採点結果" (grading results)
// report docx: a landscape table of every submitter's scores plus a list of
// non-submitters, from a JSON data file.
//
// Usage:
//   node build_summary_docx.js <report_data.json> <output.docx>
//
// See ../references/report_data_schema.md for the full field reference.
// Short version:
// {
//   "title": "数値計算法 2026年度 第9回課題",
//   "columns": [ {"key": "ex1_total", "label": "演習1", "max": 21},
//                {"key": "ex2_total", "label": "演習2", "max": 29} ],
//   "content_max": 50, "submission_max": 50,
//   "students": [ {"stu_id": "1W212223", "name": "SONODA, ... 園田尚弘",
//                  "ex1_total": 18, "ex2_total": 6, "content": 24,
//                  "submission": 50, "total": 74, "late": null,
//                  "note": "...", "flag": "要学生確認"} , ... ],
//   "nonsubmitters": [ {"id": "1W192281", "name": "NAKAYAMA, ..."} ]
// }
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, VerticalAlign,
} = require("docx");

const [, , dataPath, outPath] = process.argv;
if (!dataPath || !outPath) {
  console.error("Usage: node build_summary_docx.js <report_data.json> <output.docx>");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

const FONT = "游ゴシック";
const BLUE = "1F4E79";
const GRAY = "F2F2F2";
const RED = "FCE4E4";

function h(text, level) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, bold: true, font: FONT })] });
}
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, font: FONT, ...opts })] });
}
function bullet(text) {
  return new Paragraph({ spacing: { after: 60 }, bullet: { level: 0 }, children: [new TextRun({ text, font: FONT })] });
}
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: BLUE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, font: FONT, bold: true, size: 16, color: "FFFFFF" })] })],
  });
}
function cell(text, { width, align = AlignmentType.LEFT, shade = null, size = 16 } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.CLEAR, color: "auto", fill: shade } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(text), font: FONT, size })] })],
  });
}

const exCols = data.columns || [];
// 学籍番号, 氏名, [exercise columns...], 内容点, 提出点, 合計, 遅延, 特記事項
const fixedLeft = [1500, 2600];
const exWidth = 1000;
const fixedRight = [900, 900, 900, 1100];
const noteWidth = 4200 - Math.max(0, exCols.length - 2) * 0; // note column stays fixed-ish
const widths = [...fixedLeft, ...exCols.map(() => exWidth), ...fixedRight, 4200];

const headerRow = new TableRow({
  tableHeader: true,
  children: [
    headerCell("学籍番号", widths[0]),
    headerCell("氏名", widths[1]),
    ...exCols.map((c, i) => headerCell(c.label, widths[2 + i])),
    headerCell("内容点", widths[widths.length - 5]),
    headerCell("提出点", widths[widths.length - 4]),
    headerCell("合計", widths[widths.length - 3]),
    headerCell("遅延", widths[widths.length - 2]),
    headerCell("特記事項", widths[widths.length - 1]),
  ],
});

const bodyRows = (data.students || []).map((r, i) => {
  const flagged = !!r.flag || (r.note && r.note.includes("要学生確認"));
  const shade = flagged ? RED : (i % 2 ? GRAY : null);
  const exCells = exCols.map((c, ci) => cell(`${r[c.key]}/${c.max}`, { width: widths[2 + ci], align: AlignmentType.CENTER, shade }));
  return new TableRow({
    children: [
      cell(r.stu_id, { width: widths[0], shade }),
      cell(r.name, { width: widths[1], shade }),
      ...exCells,
      cell(r.content, { width: widths[widths.length - 5], align: AlignmentType.CENTER, shade }),
      cell(r.submission, { width: widths[widths.length - 4], align: AlignmentType.CENTER, shade }),
      cell(r.total, { width: widths[widths.length - 3], align: AlignmentType.CENTER, shade }),
      cell(r.late || "-", { width: widths[widths.length - 2], align: AlignmentType.CENTER, shade }),
      cell(r.note || "", { width: widths[widths.length - 1], shade, size: 14 }),
    ],
  });
});

const tableWidth = widths.reduce((a, b) => a + b, 0);
const table = new Table({ width: { size: tableWidth, type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...bodyRows] });

const nonSubmitters = data.nonsubmitters || [];
const nonSubmitWidths = [2000, 5000];
let nonSubmitTable = null;
if (nonSubmitters.length) {
  nonSubmitTable = new Table({
    width: { size: 7000, type: WidthType.DXA },
    columnWidths: nonSubmitWidths,
    rows: [
      new TableRow({ tableHeader: true, children: [headerCell("学籍番号", nonSubmitWidths[0]), headerCell("氏名", nonSubmitWidths[1])] }),
      ...nonSubmitters.map((s) => new TableRow({ children: [cell(s.id, { width: nonSubmitWidths[0] }), cell(s.name, { width: nonSubmitWidths[1] })] })),
    ],
  });
}

const totals = (data.students || []).map((r) => r.total);
const avg = totals.length ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : "-";
const max = totals.length ? Math.max(...totals) : "-";
const min = totals.length ? Math.min(...totals) : "-";
const sorted = [...totals].sort((a, b) => a - b);
const median = sorted.length
  ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
  : "-";

const needsCheck = (data.students || []).filter((r) => r.flag || (r.note && (r.note.includes("要学生確認") || r.note.includes("確認済み") || r.note.includes("提出ミス"))));

const contentMax = data.content_max ?? 50;
const submissionMax = data.submission_max ?? 50;

const children = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: data.title || "採点結果", font: FONT, size: 22, color: "595959" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: "採点結果(ドラフト)", font: FONT, bold: true, size: 32 })] }),
  p(`採点基準に基づくAI一次採点の結果です。提出点${submissionMax}点+内容点${contentMax}点、合計100点満点。提出者${(data.students || []).length}名・未提出${nonSubmitters.length}名(合計${(data.students || []).length + nonSubmitters.length}名)。`, { size: 18, color: "595959" }),

  h("概要", HeadingLevel.HEADING_1),
  bullet(`平均点(提出者): ${avg}点 / 最高点: ${max}点 / 最低点: ${min}点 / 中央値: ${median}点`),
  bullet("赤色のハイライト行は、提出内容に欠落や確認が必要な事項がある学生です(詳細は「特記事項」列、および下記「要確認事項」を参照)。"),
  bullet("この結果はAIによる一次採点です。特に赤色ハイライトの学生と、下位・上位の学生の解答は、Moodleへ反映する前に一度目視でのご確認をお勧めします。"),

  h("学生別採点結果一覧(合計点順)", HeadingLevel.HEADING_1),
  table,
  new Paragraph({ text: "", spacing: { after: 200 } }),
];

if (needsCheck.length) {
  children.push(h("要確認事項", HeadingLevel.HEADING_1));
  children.push(p("以下の提出物は内容に欠落や不整合があり、必要に応じて学生への確認を推奨します。"));
  needsCheck.forEach((r) => children.push(bullet(`${r.stu_id} ${r.name}: ${r.note}`)));
}

if (nonSubmitTable) {
  children.push(h(`未提出者(${nonSubmitters.length}名、評点0点)`, HeadingLevel.HEADING_1));
  children.push(nonSubmitTable);
}

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 16838, height: 11906 }, orientation: "landscape" } },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log(`wrote ${outPath}`);
});
