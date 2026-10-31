#!/bin/zsh
cd -- "$(dirname "$0")" || exit 1
if [[ -d "dist/mac-universal/衡账.app" ]]; then
  open "dist/mac-universal/衡账.app"
elif [[ -d "dist/mac-arm64/衡账.app" ]]; then
  open "dist/mac-arm64/衡账.app"
elif [[ -d "dist/mac/衡账.app" ]]; then
  open "dist/mac/衡账.app"
elif [[ -x "node_modules/.bin/electron" ]]; then
  npm start
else
  echo "请打开打包后的衡账.app。开发环境首次运行需执行 npm ci。"
  read -r "?按回车退出"
fi
