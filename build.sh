#!/usr/bin/env bash
set -e

echo "📦 安装依赖..."
if command -v bun &>/dev/null; then
  bun i
  echo "🔨 构建项目..."
  bun run build
else
  pnpm i
  echo "🔨 构建项目..."
  pnpm run build
fi

echo "✅ 构建完成！产物在 dist/ 目录"

