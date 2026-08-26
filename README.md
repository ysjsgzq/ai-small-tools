# AI 小工具箱

用 AI 构建的轻量实用工具合集。每个工具解决一个真实的小问题，并存放在独立目录中，尽量做到无需注册、打开即用。

## 工具目录

| 序号 | 工具 | 功能 | 目录 |
| --- | --- | --- | --- |
| Day 01 | 图片批量压缩器 | 本地批量压缩、体积对比、ZIP 下载 | [`tools/day-01-image-compressor/`](tools/day-01-image-compressor/) |
| Day 02 | 批量文件重命名工具 | 命名规则预览、排序、ZIP 下载副本 | [`tools/day-02-batch-renamer/`](tools/day-02-batch-renamer/) |
| Day 03 | Excel 重复数据清理工具 | 多规则查重、预览、清理副本下载 | [`tools/day-03-excel-deduplicator/`](tools/day-03-excel-deduplicator/) |
| Day 04 | 客户跟进助手 | 客户排序、跟进建议、话术草稿、CSV 导入导出 | [`tools/day-04-client-follow-up/`](tools/day-04-client-follow-up/) |
| Day 08 | 文档格式体检器（Agent Skill） | 格式要求拆解、字体/字号/行距/页面核对、三状态报告 | [`tools/day-08-doc-format-checker/`](tools/day-08-doc-format-checker/) |
| Day 09 | 评论归类器 | 事实/建议/情绪拆分、六大类问题归堆、原话可回查 | [`tools/day-09-comment-classifier/`](tools/day-09-comment-classifier/) |
| Day 10 | PDF 合并器 | 浏览器本地合并、页数预览、顺序调整 | [`tools/day-10-pdf-merger/`](tools/day-10-pdf-merger/) |
| Day 11 | 口算题生成器 | 分难度出题、约束保证、可打印含答案页 | [`tools/day-11-math-worksheet/`](tools/day-11-math-worksheet/) |
| Day 12 | 二维码批量生成器 | 一行一条批量生成、解码回读自检、ZIP 打包 | [`tools/day-12-qr-batch-generator/`](tools/day-12-qr-batch-generator/) |
| Day 13 | 照片隐私清理器 | 批量擦除 EXIF/GPS、格式跟进出、方向自动摆正 | [`tools/day-13-photo-privacy-cleaner/`](tools/day-13-photo-privacy-cleaner/) |
| Day 14 | 文案极限词检测器 | 广告法极限词红字标注、白名单防误伤、长词优先去重 | [`tools/day-14-ad-word-checker/`](tools/day-14-ad-word-checker/) |
| Day 15 | 图片转文字 | 浏览器本地 OCR、放大灰度预处理、批量识别可复制 | [`tools/day-15-image-to-text/`](tools/day-15-image-to-text/) |
| Day 16 | 文本对比工具 | 两级 LCS 逐字标差异、行号定位、差异清单可复制 | [`tools/day-16-text-diff/`](tools/day-16-text-diff/) |

## 仓库结构

```text
.
├── README.md
├── LICENSE
└── tools/
    ├── day-01-image-compressor/
    │   ├── README.md
    │   ├── index.html
    │   ├── styles.css
    │   ├── app.js
    │   └── vendor/
    ├── day-02-batch-renamer/
    │   ├── README.md
    │   ├── index.html
    │   ├── styles.css
    │   ├── app.js
    │   └── vendor/
    ├── day-03-excel-deduplicator/
    │   ├── README.md
    │   ├── index.html
    │   ├── styles.css
    │   ├── app.js
    │   └── vendor/
    ├── day-04-client-follow-up/
    │   ├── README.md
    │   ├── index.html
    │   ├── styles.css
    │   └── app.js
    ├── day-08-doc-format-checker/
    │   ├── SKILL.md
    │   ├── README.md
    │   ├── scripts/
    │   └── assets/
    ├── day-09-comment-classifier/
    │   ├── README.md
    │   ├── comment_classifier.py
    │   └── test_comments.txt
    ├── day-10-pdf-merger/
    │   ├── README.md
    │   ├── index.html
    │   └── make_test_pdfs.py
    ├── day-11-math-worksheet/
    │   ├── README.md
    │   ├── index.html
    │   └── verify.js
    ├── day-12-qr-batch-generator/
    │   ├── README.md
    │   ├── index.html
    │   └── vendor/
    ├── day-13-photo-privacy-cleaner/
    │   ├── README.md
    │   ├── index.html
    │   ├── make_test_photo.py
    │   └── vendor/
    ├── day-14-ad-word-checker/
    │   ├── README.md
    │   └── index.html
    ├── day-15-image-to-text/
    │   ├── README.md
    │   └── index.html
    └── day-16-text-diff/
        ├── README.md
        └── index.html
```

后续工具统一添加到 `tools/` 下，每个工具使用独立文件夹，目录名采用 `day-序号-英文名称` 格式。

## 本地预览

在仓库根目录启动静态文件服务器：

```bash
python3 -m http.server 4173
```

然后访问对应工具目录。例如 Day 01：

```text
http://127.0.0.1:4173/tools/day-01-image-compressor/
```

## 开源许可

项目代码采用 MIT License。各工具使用的第三方组件许可保存在对应工具目录中。
