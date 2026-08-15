---
name: secret-guard
description: Detects and prevents API keys, tokens, credentials, and .env files from being committed, staged, printed, or included in generated output. Use before any git add/commit/push, before creating or editing .env-like files, and whenever generating code samples, logs, or documentation that might contain secrets.
license: MIT
compatibility: opencode
allowed-tools:
  - Bash(git status:*)
  - Bash(git diff:*)
  - Bash(git ls-files:*)
  - Bash(grep:*)
  - Read
metadata:
  category: security
  audience: all-agents
---

# secret-guard

APIキー・トークン・パスワード・秘密鍵・`.env`系ファイルが、コミット・出力・ログ・生成コードに
混入するのを防ぐためのスキルです。以下の場面で必ず適用してください。

## 適用タイミング

- `git add` / `git commit` / `git push` の**前**
- `.env`, `.env.*`, `*.pem`, `*.key`, `credentials.json` などの新規作成・編集の前後
- コード例、ログ出力、READMEやドキュメントを生成する前(実際の値を貼り付けない)
- `.gitignore` が存在しない、または不十分なリポジトリで作業を始めるとき

## 手順

### 1. `.gitignore` を確認・補強する

以下のパターンが含まれているか確認し、なければ追記する。

```
.env
.env.*
!.env.example
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
*_rsa
*_ed25519
credentials.json
secrets.yaml
secrets.yml
.aws/credentials
.npmrc
*.local
```

`.env.example` や `.env.sample` のようなテンプレート(実値なし)は明示的に除外(`!`)して構わない。

### 2. ステージ済み・追跡中のファイルを走査する

コミット前に、追跡対象になっているファイル一覧と差分をスキャンする。

```bash
# 追跡されている .env 系ファイルがないか
git ls-files | grep -E '\.env(\.|$)|\.pem$|\.key$|credentials\.json$'

# ステージされた差分に秘密情報っぽい文字列がないか
git diff --cached | grep -inE \
  '(api[_-]?key|secret[_-]?key|access[_-]?token|bearer\s+[a-z0-9_\-\.]{20,}|password\s*=|-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|sk-[a-zA-Z0-9]{20,})'
```

いずれかにヒットしたら **コミットを中断** し、次のいずれかを行う。

- 該当ファイルを `.gitignore` に追加し、`git rm --cached <file>` で追跡から外す
- コード内の値を環境変数参照(`os.environ["X"]` など)に置き換える
- 既にコミット済みの場合は、単なる `git rm` では履歴に残るため、
  `git filter-repo` や BFG Repo-Cleaner での履歴書き換え、および該当キーの**即時失効・再発行**を提案する

### 3. 新規ファイル作成・編集時のチェック

- ファイル名が `.env`, `*.pem`, `*.key`, `id_rsa` などの機密系パターンに一致する場合、
  作成直後に `.gitignore` へのエントリ追加もあわせて提案する
- サンプル・テンプレートを作る場合は、実際の値ではなくプレースホルダーを使う
  (例: `API_KEY=your_api_key_here`)

### 4. 出力・生成コードでの取り扱い

- チャット応答、ログ、READMEなどに実際のキー値・トークン・パスワードを**そのまま貼り付けない**
- ユーザーが誤って実際のキーを貼り付けてきた場合は、それをそのまま繰り返し出力せず、
  マスクした形(例: `sk-ab12***`)で言及し、キーの失効・再発行を促す
- 環境変数名やファイル名(`.env` の中身ではなくキー名)を示すのは問題ない

### 5. 検出パターンの目安

| 種別 | パターン例 |
|---|---|
| AWS Access Key | `AKIA[0-9A-Z]{16}` |
| GitHub PAT | `ghp_[0-9A-Za-z]{36}` |
| OpenAI/Anthropic系 | `sk-[a-zA-Z0-9]{20,}` |
| 秘密鍵ヘッダ | `-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----` |
| 汎用 | `(api|secret|access)[_-]?(key|token)\s*[:=]\s*['"][^'"]{16,}['"]` |

これらは目安であり、プロジェクト固有のキー形式があれば追加すること。

## 対応ツールと配置場所

このスキルは Agent Skills オープン標準に準拠しており、OpenCodeとClaude Codeの両方で動作する。

- OpenCode プロジェクト: `.opencode/skills/secret-guard/SKILL.md`
- OpenCode グローバル: `~/.config/opencode/skills/secret-guard/SKILL.md`
- Claude Code プロジェクト: `.claude/skills/secret-guard/SKILL.md`
- Claude Code グローバル: `~/.claude/skills/secret-guard/SKILL.md`

OpenCodeは `.claude/skills/` 配下も自動的に読み込むため、`.claude/skills/secret-guard/SKILL.md`
に1箇所置くだけで両方のツールから利用できる。

`allowed-tools` はClaude Codeの拡張フィールドで、スキル実行中に許可するツールを
`git status`/`git diff`/`git ls-files`/`grep`/`Read` に制限する。OpenCodeはこのフィールドを
無視し、代わりに `permission` フィールドやagent側の `permission.skill` で制御する。

## permission設定の推奨

このスキルを常時有効にしたい場合、`opencode.json` またはエージェントのfrontmatterで
`bash` パーミッションを使い、`git commit*` / `git push*` の前に本スキルの手順を強制する運用が望ましい。

```json
{
  "permission": {
    "skill": {
      "secret-guard": "allow"
    }
  }
}
```

読み取り専用のレビュー系subagent(例: `review`, `security-auditor`)からは常時参照できるようにし、
書き込み権限を持つ `build` 系primary agentでは、`git commit`/`git push` を実行する直前に
このスキルを呼び出す運用を徹底する。
