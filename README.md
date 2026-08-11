# AI 小工具箱

用 AI 构建的轻量实用工具合集。每个工具解决一个真实的小问题，并存放在独立目录中，尽量做到无需注册、打开即用。

## 工具目录

| 序号 | 工具 | 功能 | 目录 |
| --- | --- | --- | --- |
| Day 01 | 图片批量压缩器 | 本地批量压缩、体积对比、ZIP 下载 | [`tools/day-01-image-compressor/`](tools/day-01-image-compressor/) |

## 仓库结构

```text
.
├── README.md
├── LICENSE
└── tools/
    └── day-01-image-compressor/
        ├── README.md
        ├── index.html
        ├── styles.css
        ├── app.js
        └── vendor/
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
