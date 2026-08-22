# Day 12 · 二维码批量生成器

一行一条内容（网址、中文文本、Wi-Fi 串都行），一次全部生成，打包下载 ZIP。浏览器本地生成，内容不上传。

## 用法

```bash
python3 -m http.server 4173
# 访问 http://127.0.0.1:4173/tools/day-12-qr-batch-generator/
```

生成引擎 qrcode-generator（CDN），打包用本地 jszip。白边距按规范取 4 模块——那是扫码成功率的静区，别为了好看裁掉。

## 自检（生成 → 解码回读）

在页面控制台先加载解码库再生成，逐张回读比对：

```js
// 控制台执行：
const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; document.head.appendChild(s)
// 填入多行内容点「全部生成」后：
[...document.querySelectorAll('#codes .qr')].filter(div => {
  const c = div.querySelector('canvas'), cap = div.querySelector('.cap').textContent
  const r = jsQR(c.getContext('2d').getImageData(0,0,c.width,c.height).data, c.width, c.height)
  return !(r && r.data === cap)
}).length  // 预期 0（全部能扫回原内容）
```

实测：30 条混合内容（URL/中文/Wi-Fi）30/30，随机 100 条 100/100。

## 开发过程中当场发现并当场修复

初版 30 条中 20 条失败——**所有中文内容生成的码扫出来是空的**。原因：qrcode-generator 默认的 `stringToBytes` 只认 ASCII，中文被切成乱码字节。修复：`qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']`（库自带 UTF-8 支持，只是默认不启用），同时把白边距从 1 补到规范的 4 模块。
