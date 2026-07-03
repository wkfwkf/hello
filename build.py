#!/usr/bin/env python3
"""构建脚本：把 Three.js 和游戏代码内联进模板，生成单文件 index.html（双击即玩）。"""
import pathlib

root = pathlib.Path(__file__).parent
template = (root / "src" / "template.html").read_text(encoding="utf-8")
three = (root / "vendor" / "three.min.js").read_text(encoding="utf-8")
game = (root / "src" / "game.js").read_text(encoding="utf-8")

out = template.replace("/*__THREE__*/", three, 1)
out = out.replace("/*__GAME__*/", game, 1)

(root / "index.html").write_text(out, encoding="utf-8")
size = (root / "index.html").stat().st_size
print(f"index.html built: {size/1024:.0f} KB")
