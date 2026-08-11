(function () {
  "use strict";

  const MAX_FILES = 50;
  const MAX_FILE_SIZE = 40 * 1024 * 1024;
  const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const DEFAULTS = {
    quality: 82,
    maxSize: 2560,
    format: "auto",
    preserveTransparency: true
  };

  const elements = {
    clearButton: document.querySelector("#clearButton"),
    compressButton: document.querySelector("#compressButton"),
    compressedTotal: document.querySelector("#compressedTotal"),
    downloadAllButton: document.querySelector("#downloadAllButton"),
    dropZone: document.querySelector("#dropZone"),
    fileCount: document.querySelector("#fileCount"),
    fileInput: document.querySelector("#fileInput"),
    fileList: document.querySelector("#fileList"),
    formatControl: document.querySelector("#formatControl"),
    maxSize: document.querySelector("#maxSize"),
    originalTotal: document.querySelector("#originalTotal"),
    preserveTransparency: document.querySelector("#preserveTransparency"),
    quality: document.querySelector("#quality"),
    qualityOutput: document.querySelector("#qualityOutput"),
    queueSection: document.querySelector("#queueSection"),
    resetSettings: document.querySelector("#resetSettings"),
    toastRegion: document.querySelector("#toastRegion")
  };

  const state = {
    items: [],
    isProcessing: false,
    settings: { ...DEFAULTS },
    toastTimer: null
  };

  function makeId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** exponent);
    const digits = exponent === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(digits)} ${units[exponent]}`;
  }

  function showToast(message, type = "info") {
    window.clearTimeout(state.toastTimer);
    elements.toastRegion.textContent = message;
    elements.toastRegion.classList.toggle("is-error", type === "error");
    elements.toastRegion.classList.add("is-visible");
    state.toastTimer = window.setTimeout(() => {
      elements.toastRegion.classList.remove("is-visible");
    }, 2800);
  }

  function resultName(name, mimeType) {
    const base = name.replace(/\.[^.]+$/, "");
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
    return `${base}-compressed.${extension}`;
  }

  function outputMimeType(file) {
    if (state.settings.format === "jpeg") return "image/jpeg";
    if (state.settings.format === "webp") return "image/webp";
    if (file.type === "image/jpeg") return "image/jpeg";
    if (file.type === "image/webp") return "image/webp";
    return state.settings.preserveTransparency ? "image/webp" : "image/jpeg";
  }

  function dimensionsText(item) {
    if (!item.width || !item.height) return formatBytes(item.file.size);
    return `${item.width} × ${item.height} · ${formatBytes(item.file.size)}`;
  }

  function stateMarkup(item) {
    if (item.status === "processing") {
      return `<span class="file-state processing">处理中 ${item.progress}%</span>`;
    }
    if (item.status === "done") {
      const saved = Math.max(0, Math.round((1 - item.result.size / item.file.size) * 100));
      const suffix = item.usedOriginal ? " · 已是较优" : ` · 节省 ${saved}%`;
      return `<span class="file-state done">${formatBytes(item.result.size)}${suffix}</span>`;
    }
    if (item.status === "error") {
      return '<span class="file-state error">处理失败</span>';
    }
    return '<span class="file-state ready">等待处理</span>';
  }

  function actionMarkup(item) {
    if (item.status === "done") {
      return `<button class="row-action" type="button" data-action="download" data-id="${item.id}" aria-label="下载 ${escapeHtml(item.result.name)}" title="下载">↓</button>`;
    }
    const disabled = item.status === "processing" ? " disabled" : "";
    return `<button class="row-action" type="button" data-action="remove" data-id="${item.id}" aria-label="移除 ${escapeHtml(item.file.name)}" title="移除"${disabled}>×</button>`;
  }

  function render() {
    const hasItems = state.items.length > 0;
    const completed = state.items.filter((item) => item.status === "done" && item.result);
    const actionable = state.items.some((item) => item.status === "waiting" || item.status === "error");
    const originalBytes = state.items.reduce((total, item) => total + item.file.size, 0);
    const compressedBytes = completed.reduce((total, item) => total + item.result.size, 0);

    elements.queueSection.classList.toggle("is-hidden", !hasItems);
    elements.clearButton.disabled = !hasItems || state.isProcessing;
    elements.compressButton.disabled = !actionable || state.isProcessing;
    elements.downloadAllButton.disabled = completed.length === 0 || state.isProcessing;
    elements.fileCount.textContent = `${state.items.length} 张图片`;
    elements.originalTotal.textContent = `原始 ${formatBytes(originalBytes)}`;
    elements.compressedTotal.textContent = completed.length
      ? `${completed.length}/${state.items.length} 张 · ${formatBytes(compressedBytes)}`
      : "等待压缩";

    elements.compressButton.textContent = state.isProcessing ? "正在压缩…" : "开始压缩";

    elements.fileList.innerHTML = state.items.map((item) => {
      const progress = item.status === "processing"
        ? `<span class="progress-track"><span class="progress-value" style="width:${item.progress}%"></span></span>`
        : "";
      const error = item.status === "error"
        ? `<span class="error-detail">${escapeHtml(item.error || "请重试")}</span>`
        : "";
      return `
        <article class="file-row${item.status === "processing" ? " is-processing" : ""}">
          <img class="file-preview" src="${item.previewUrl}" alt="${escapeHtml(item.file.name)} 预览">
          <div class="file-info">
            <strong title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</strong>
            <span>${dimensionsText(item)}</span>
            ${progress}${error}
          </div>
          ${stateMarkup(item)}
          ${actionMarkup(item)}
        </article>`;
    }).join("");
  }

  function readDimensions(item) {
    const image = new Image();
    image.onload = () => {
      item.width = image.naturalWidth;
      item.height = image.naturalHeight;
      render();
    };
    image.onerror = () => {
      item.status = "error";
      item.error = "无法读取图片";
      render();
    };
    image.src = item.previewUrl;
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const errors = [];
    const availableSlots = Math.max(0, MAX_FILES - state.items.length);
    const selected = incoming.slice(0, availableSlots);
    if (incoming.length > availableSlots) errors.push(`最多只能添加 ${MAX_FILES} 张图片`);

    selected.forEach((file) => {
      if (!ACCEPTED_TYPES.has(file.type)) {
        errors.push(`${file.name} 不是支持的图片格式`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} 超过 40 MB`);
        return;
      }
      const duplicate = state.items.some((item) => (
        item.file.name === file.name
        && item.file.size === file.size
        && item.file.lastModified === file.lastModified
      ));
      if (duplicate) {
        errors.push(`${file.name} 已在队列中`);
        return;
      }

      const item = {
        id: makeId(),
        file,
        previewUrl: URL.createObjectURL(file),
        width: 0,
        height: 0,
        status: "waiting",
        progress: 0,
        result: null,
        usedOriginal: false,
        error: ""
      };
      state.items.push(item);
      readDimensions(item);
    });

    elements.fileInput.value = "";
    render();
    if (errors.length) showToast(errors[0], "error");
    else showToast(`已添加 ${selected.length} 张图片`);
  }

  function removeItem(id) {
    const item = state.items.find((entry) => entry.id === id);
    if (!item || item.status === "processing") return;
    URL.revokeObjectURL(item.previewUrl);
    if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    state.items = state.items.filter((entry) => entry.id !== id);
    render();
  }

  function clearAll() {
    if (state.isProcessing) return;
    state.items.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    state.items = [];
    render();
    showToast("处理队列已清空");
  }

  function updateProgress(item, progress) {
    item.progress = progress;
    render();
  }

  function decodeImageWithElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("浏览器无法解码这张图片"));
      };
      image.src = url;
    });
  }

  function decodeImage(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file, { imageOrientation: "from-image" })
        .catch(() => decodeImageWithElement(file));
    }
    return decodeImageWithElement(file);
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("浏览器无法编码该图片"));
      }, mimeType, quality);
    });
  }

  async function compressItem(item) {
    updateProgress(item, 12);
    const source = await decodeImage(item.file);
    updateProgress(item, 34);

    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    const maxSize = state.settings.maxSize;
    const scale = maxSize > 0 ? Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight)) : 1;
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("浏览器不支持图片画布");

    const mimeType = outputMimeType(item.file);
    if (mimeType === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height);
    if (typeof source.close === "function") source.close();
    updateProgress(item, 68);

    const blob = await canvasToBlob(canvas, mimeType, state.settings.quality / 100);
    updateProgress(item, 92);

    const resized = width !== sourceWidth || height !== sourceHeight;
    const shouldKeepOriginal = blob.size >= item.file.size && !resized && mimeType === item.file.type;
    const result = shouldKeepOriginal
      ? new File([item.file], item.file.name, { type: item.file.type, lastModified: Date.now() })
      : new File([blob], resultName(item.file.name, mimeType), { type: mimeType, lastModified: Date.now() });

    item.usedOriginal = shouldKeepOriginal;
    item.result = result;
    item.outputWidth = width;
    item.outputHeight = height;
    item.resultUrl = URL.createObjectURL(result);
    updateProgress(item, 100);
  }

  async function compressAll() {
    if (state.isProcessing) return;
    const queue = state.items.filter((item) => item.status === "waiting" || item.status === "error");
    if (!queue.length) return;

    state.isProcessing = true;
    render();
    let failed = 0;

    for (const item of queue) {
      item.status = "processing";
      item.progress = 3;
      item.error = "";
      render();
      try {
        await compressItem(item);
        item.status = "done";
      } catch (error) {
        item.status = "error";
        item.error = error instanceof Error ? error.message : "未知错误";
        failed += 1;
      }
      render();
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }

    state.isProcessing = false;
    render();
    if (failed) showToast(`${failed} 张图片处理失败，可调整尺寸后重试`, "error");
    else showToast(`${queue.length} 张图片已压缩完成`);
  }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadItem(id) {
    const item = state.items.find((entry) => entry.id === id);
    if (!item || !item.result) return;
    triggerDownload(item.result, item.result.name);
  }

  async function downloadAll() {
    const completed = state.items.filter((item) => item.status === "done" && item.result);
    if (!completed.length || state.isProcessing) return;
    if (typeof JSZip === "undefined") {
      showToast("ZIP 组件加载失败，请刷新页面重试", "error");
      return;
    }

    elements.downloadAllButton.disabled = true;
    const label = elements.downloadAllButton.querySelector(".button-label");
    label.textContent = "正在打包 0%";
    const zip = new JSZip();
    const usedNames = new Set();
    completed.forEach((item) => {
      let name = item.result.name;
      let index = 2;
      while (usedNames.has(name)) {
        const dot = item.result.name.lastIndexOf(".");
        const base = dot > -1 ? item.result.name.slice(0, dot) : item.result.name;
        const extension = dot > -1 ? item.result.name.slice(dot) : "";
        name = `${base}-${index}${extension}`;
        index += 1;
      }
      usedNames.add(name);
      zip.file(name, item.result);
    });

    try {
      const archive = await zip.generateAsync({ type: "blob", compression: "STORE" }, (metadata) => {
        label.textContent = `正在打包 ${Math.round(metadata.percent)}%`;
      });
      triggerDownload(archive, `compressed-images-${new Date().toISOString().slice(0, 10)}.zip`);
      showToast(`已打包 ${completed.length} 张图片`);
    } catch (error) {
      showToast("打包失败，请尝试单张下载", "error");
    } finally {
      label.textContent = "打包下载";
      elements.downloadAllButton.disabled = false;
    }
  }

  function setFormat(format) {
    state.settings.format = format;
    elements.formatControl.querySelectorAll("button").forEach((button) => {
      const selected = button.dataset.format === format;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const jpegSelected = format === "jpeg";
    elements.preserveTransparency.disabled = jpegSelected;
    if (jpegSelected) elements.preserveTransparency.checked = false;
    else elements.preserveTransparency.checked = state.settings.preserveTransparency;
  }

  function resetSettings() {
    state.settings = { ...DEFAULTS };
    elements.quality.value = String(DEFAULTS.quality);
    elements.qualityOutput.value = `${DEFAULTS.quality}%`;
    elements.qualityOutput.textContent = `${DEFAULTS.quality}%`;
    elements.maxSize.value = String(DEFAULTS.maxSize);
    elements.preserveTransparency.checked = DEFAULTS.preserveTransparency;
    elements.preserveTransparency.disabled = false;
    setFormat(DEFAULTS.format);
    showToast("已恢复默认压缩设置");
  }

  elements.fileInput.addEventListener("change", (event) => addFiles(event.target.files));
  elements.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
  elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("is-dragging"));
  elements.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
    addFiles(event.dataTransfer.files);
  });
  elements.fileList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "remove") removeItem(button.dataset.id);
    if (button.dataset.action === "download") downloadItem(button.dataset.id);
  });
  elements.clearButton.addEventListener("click", clearAll);
  elements.compressButton.addEventListener("click", compressAll);
  elements.downloadAllButton.addEventListener("click", downloadAll);
  elements.resetSettings.addEventListener("click", resetSettings);
  elements.quality.addEventListener("input", () => {
    state.settings.quality = Number(elements.quality.value);
    elements.qualityOutput.value = `${state.settings.quality}%`;
    elements.qualityOutput.textContent = `${state.settings.quality}%`;
  });
  elements.maxSize.addEventListener("change", () => {
    state.settings.maxSize = Number(elements.maxSize.value);
  });
  elements.formatControl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-format]");
    if (button) setFormat(button.dataset.format);
  });
  elements.preserveTransparency.addEventListener("change", () => {
    state.settings.preserveTransparency = elements.preserveTransparency.checked;
  });

  setFormat(DEFAULTS.format);
  render();
}());
