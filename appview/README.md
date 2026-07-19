# etzhayyim-project-credits App migration

このディレクトリは `legacy-runtime` 実装を残したまま、App 版を段階移行するための配置先です。

## 対象 App services

- `etzhayyim-credits-z8l65qxz`

## App 実装方針

- 各 service は `projects/*/wasm/*-component` として順次実装。
- 既存 App runtime は互換運用のため維持。
- HTTP/cron/job エンドポイントから優先して移植。

## 実装済みコンポーネント

- `credits-mcp-component` (`etzhayyim-credits-z8l65qxz` 対応)
  - `POST /api/mcp`, `POST /{nanoid}/api/mcp`
  - Credits 購入時の 30% platform fee を実装
  - Credits 消費時の 10% `etzhayyim-project-public-fund` 分配を実装
  - user が `credits` UI で分配先を選べる preview console を実装
