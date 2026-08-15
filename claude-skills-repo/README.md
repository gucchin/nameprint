# claude-skills

個人用の [Claude Code](https://claude.com/claude-code) スキル置き場。

`~/.claude/skills/` に置いたスキルは全プロジェクトで有効になる。このリポジトリはその中身をバージョン管理し、複数マシン（および使い捨てのリモートセッション）に配りやすくするためのもの。

## インストール

```bash
git clone git@github.com:gucchin/claude-skills.git
cd claude-skills
./install.sh            # ~/.claude/skills/ にシンボリックリンクを張る
./install.sh --copy     # リンクではなく実体をコピーする
```

シンボリックリンク方式なら、`git pull` するだけで全スキルが更新される。

インストール後、Claude Code を再起動すると `/diverge` のようにスラッシュコマンドとして呼べる。

## 収録スキル

### 思考モード

一連の流れとして使う想定。`/diverge` で広げ、`/converge` で決め、`/devils-advocate` で叩く。

| スキル | 役割 | 効かせている制約 |
|---|---|---|
| [`diverge`](skills/diverge/SKILL.md) | 発散モード。判断を保留して選択肢の空間を広げる | 生成中の評価・推奨・順位づけを禁止。案が出ないときは軸を足す。最低12案とワイルドカード枠（バカげた案／何もしない／問題自体を消す）を必須化 |
| [`converge`](skills/converge/SKILL.md) | 収束モード。選択肢を1つの決定に落とす | 基準を案より先に決めて後付け正当化を防ぐ。「ケースバイケース」を禁止。可逆／不可逆を最初に判定し、軽い決定に重い分析をかけない |
| [`devils-advocate`](skills/devils-advocate/SKILL.md) | 悪魔の代弁者モード。提案を守らず壊す | まずスティールマンして藁人形攻撃を防ぐ。反論には具体的な失敗シナリオと検証方法を必須化し、一般論のリスク列挙を弾く。最後に判定と生き残り条件を出させる |

### ワークフロー

| スキル | 用途 |
|---|---|
| [`secret-guard`](skills/secret-guard/SKILL.md) | APIキー・認証情報・`.env` のコミットや出力への混入を防ぐ |
| [`windows-ascii-script`](skills/windows-ascii-script/SKILL.md) | Windows 向け `.ps1` / `.bat` の CP932 文字化けと `curl` / `curl.exe` の取り違えを防ぐ |
| [`numerical-methods-grading`](skills/numerical-methods-grading/SKILL.md) | 数値計算法2026の課題採点ワークフロー（採点基準作成・成績CSV・報告書生成） |

## スキルの書き方

各スキルは `skills/<name>/SKILL.md` に置き、YAML フロントマターを持つ。

```markdown
---
name: skill-name
description: いつ使うか。Claude はこの説明文だけを見て発火を判断するため、
  想定される言い回し（日本語・英語の両方）を具体的に列挙する。
---

# 本文
```

`description` の質がそのまま発火精度になる。「何をするか」より**「どういうときに使うか」**を書く。関連スキルがあるなら「〜のときは別スキルを使う」と書いて棲み分けさせる。

補助ファイル（`references/`、`scripts/`）は本文から相対パスで参照する。本文は必要十分な長さにとどめ、詳細は補助ファイルに逃がす。

新規作成・改善には Anthropic 製の `skill-creator` スキルが使える。
