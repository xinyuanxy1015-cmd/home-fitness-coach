# 居家健身教练

手机端逐组带练、周计划、体测和教练建议。训练数据保存在浏览器的 IndexedDB。设置页可导出或恢复备份。

## 本地运行

```sh
python3 -m http.server 8000 --directory site
node --test test/model.test.mjs
```

在浏览器打开 http://localhost:8000/。GitHub Pages 使用 GitHub Actions 从 `main` 发布 `site`。
