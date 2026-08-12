(function () {
  "use strict";

  const MAX_FILES = 200;
  const DEFAULTS = {
    prefix: "产品",
    separator: "-",
    startNumber: 1,
    digits: 3,
    sortMode: "selected",
    keepExtension: true
  };
  const INVALID_FILENAME = /[\\/:*?"<>|\u0000-\u001f]/;
  const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

  const elements = {
    clearButton: document.querySelector("#clearButton"),
    digits: document.querySelector("#digits"),
    digitsOutput: document.querySelector("#digitsOutput"),
    downloadButton: document.querySelector("#downloadButton"),
    dropZone: document.querySelector("#dropZone"),
    exampleName: document.querySelector("#exampleName"),
    fileCount: document.querySelector("#fileCount"),
    fileInput: document.querySelector("#fileInput"),
    fileTableBody: document.querySelector("#fileTableBody"),
    keepExtension: document.querySelector("#keepExtension"),
    prefix: document.querySelector("#prefix"),
    previewSection: document.querySelector("#previewSection"),
    renameCount: document.querySelector("#renameCount"),
    resetSettings: document.querySelector("#resetSettings"),
    separator: document.querySelector("#separator"),
    sortMode: document.querySelector("#sortMode"),
    startNumber: document.querySelector("#startNumber"),
    toastRegion: document.querySelector("#toastRegion"),
    validationStatus: document.querySelector("#validationStatus")
  };

  const state = {
    entries: [],
    isPackaging: false,
    nextOrder: 0,
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
    state.toastTimer = window.setTimeout(() => elements.toastRegion.classList.remove("is-visible"), 3000);
  }

  function splitFileName(name) {
    const dot = name.lastIndexOf(".");
    if (dot <= 0 || dot === name.length - 1) return { base: name, extension: "" };
    return { base: name.slice(0, dot), extension: name.slice(dot) };
  }

  function sortedEntries() {
    const entries = [...state.entries];
    const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
    switch (state.settings.sortMode) {
      case "name-asc": return entries.sort((a, b) => collator.compare(a.file.name, b.file.name));
      case "name-desc": return entries.sort((a, b) => collator.compare(b.file.name, a.file.name));
      case "size-desc": return entries.sort((a, b) => b.file.size - a.file.size || a.order - b.order);
      case "size-asc": return entries.sort((a, b) => a.file.size - b.file.size || a.order - b.order);
      default: return entries.sort((a, b) => a.order - b.order);
    }
  }

  function sanitizeStartNumber() {
    const value = Number.parseInt(elements.startNumber.value, 10);
    return Number.isFinite(value) ? Math.max(0, Math.min(999999, value)) : 0;
  }

  function createNewName(entry, index) {
    const number = String(state.settings.startNumber + index).padStart(state.settings.digits, "0");
    const extension = state.settings.keepExtension ? splitFileName(entry.file.name).extension : "";
    return `${state.settings.prefix}${state.settings.separator}${number}${extension}`;
  }

  function validatePrefix(prefix) {
    const trimmed = prefix.trim();
    if (!trimmed) return "请输入文件名前缀";
    if (INVALID_FILENAME.test(trimmed)) return "前缀包含系统不允许的字符";
    if (WINDOWS_RESERVED.test(trimmed)) return "该前缀是系统保留名称";
    if (/[. ]$/.test(trimmed)) return "前缀不能以句点或空格结尾";
    return "";
  }

  function buildPreview() {
    const entries = sortedEntries();
    const prefixError = validatePrefix(state.settings.prefix);
    const generated = entries.map((entry, index) => ({
      entry,
      newName: prefixError ? "规则无效" : createNewName(entry, index)
    }));
    const names = generated.map((item) => item.newName.toLocaleLowerCase("zh-CN"));
    const duplicateNames = new Set(names.filter((name, index) => names.indexOf(name) !== index));
    const validationError = prefixError || (duplicateNames.size ? "生成了重复文件名" : "");
    return { entries: generated, validationError };
  }

  function render() {
    const preview = buildPreview();
    const hasFiles = preview.entries.length > 0;
    const valid = hasFiles && !preview.validationError;

    elements.previewSection.classList.toggle("is-hidden", !hasFiles);
    elements.clearButton.disabled = !hasFiles || state.isPackaging;
    elements.downloadButton.disabled = !valid || state.isPackaging;
    elements.fileCount.textContent = `${preview.entries.length} 个文件`;
    elements.renameCount.textContent = `${preview.entries.length} 个名称待修改`;
    elements.validationStatus.textContent = preview.validationError || "规则有效";
    elements.validationStatus.classList.toggle("is-error", Boolean(preview.validationError));
    elements.prefix.classList.toggle("is-invalid", Boolean(validatePrefix(state.settings.prefix)));

    const exampleExtension = state.settings.keepExtension ? ".jpg" : "";
    const exampleNumber = String(state.settings.startNumber).padStart(state.settings.digits, "0");
    elements.exampleName.textContent = validatePrefix(state.settings.prefix)
      ? "请先修正命名规则"
      : `${state.settings.prefix}${state.settings.separator}${exampleNumber}${exampleExtension}`;

    const invalidClass = preview.validationError ? " is-invalid" : "";
    elements.fileTableBody.innerHTML = preview.entries.map(({ entry, newName }, index) => `
      <tr>
        <td class="file-index">${String(index + 1).padStart(2, "0")}</td>
        <td>
          <div class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</div>
          <small>${formatBytes(entry.file.size)}</small>
        </td>
        <td class="rename-arrow" aria-label="重命名为">→</td>
        <td><div class="new-name${invalidClass}" title="${escapeHtml(newName)}">${escapeHtml(newName)}</div></td>
        <td><button class="row-action" type="button" data-id="${entry.id}" aria-label="移除 ${escapeHtml(entry.file.name)}" title="移除">×</button></td>
      </tr>`).join("");
  }

  function readSettings() {
    state.settings.prefix = elements.prefix.value.trim();
    state.settings.separator = elements.separator.value;
    state.settings.startNumber = sanitizeStartNumber();
    state.settings.digits = Number(elements.digits.value);
    state.settings.sortMode = elements.sortMode.value;
    state.settings.keepExtension = elements.keepExtension.checked;
    elements.digitsOutput.value = `${state.settings.digits} 位`;
    elements.digitsOutput.textContent = `${state.settings.digits} 位`;
    render();
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const errors = [];
    const slots = Math.max(0, MAX_FILES - state.entries.length);
    const selected = incoming.slice(0, slots);
    if (incoming.length > slots) errors.push(`最多只能添加 ${MAX_FILES} 个文件`);

    selected.forEach((file) => {
      const duplicate = state.entries.some((entry) => (
        entry.file.name === file.name
        && entry.file.size === file.size
        && entry.file.lastModified === file.lastModified
      ));
      if (duplicate) {
        errors.push(`${file.name} 已在列表中`);
        return;
      }
      state.entries.push({ id: makeId(), file, order: state.nextOrder++ });
    });

    elements.fileInput.value = "";
    render();
    if (errors.length) showToast(errors[0], "error");
    else showToast(`已添加 ${selected.length} 个文件`);
  }

  function removeEntry(id) {
    if (state.isPackaging) return;
    state.entries = state.entries.filter((entry) => entry.id !== id);
    render();
  }

  function clearAll() {
    if (state.isPackaging) return;
    state.entries = [];
    render();
    showToast("文件列表已清空");
  }

  function resetSettings() {
    state.settings = { ...DEFAULTS };
    elements.prefix.value = DEFAULTS.prefix;
    elements.separator.value = DEFAULTS.separator;
    elements.startNumber.value = String(DEFAULTS.startNumber);
    elements.digits.value = String(DEFAULTS.digits);
    elements.sortMode.value = DEFAULTS.sortMode;
    elements.keepExtension.checked = DEFAULTS.keepExtension;
    readSettings();
    showToast("已恢复默认命名规则");
  }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function downloadRenamedFiles() {
    if (state.isPackaging) return;
    const preview = buildPreview();
    if (!preview.entries.length || preview.validationError) {
      showToast(preview.validationError || "请先选择文件", "error");
      return;
    }
    if (typeof JSZip === "undefined") {
      showToast("ZIP 组件加载失败，请刷新页面重试", "error");
      return;
    }

    state.isPackaging = true;
    render();
    const label = elements.downloadButton.querySelector(".button-label");
    label.textContent = "正在打包 0%";
    const zip = new JSZip();
    preview.entries.forEach(({ entry, newName }) => zip.file(newName, entry.file));

    try {
      const archive = await zip.generateAsync({ type: "blob", compression: "STORE" }, (metadata) => {
        label.textContent = `正在打包 ${Math.round(metadata.percent)}%`;
      });
      const safePrefix = state.settings.prefix.replace(/\s+/g, "-");
      triggerDownload(archive, `${safePrefix}-renamed-${new Date().toISOString().slice(0, 10)}.zip`);
      showToast(`已打包 ${preview.entries.length} 个重命名文件`);
    } catch (error) {
      showToast("打包失败，请减少文件数量后重试", "error");
    } finally {
      state.isPackaging = false;
      label.textContent = "下载重命名文件";
      render();
    }
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
  elements.fileTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-id]");
    if (button) removeEntry(button.dataset.id);
  });
  elements.clearButton.addEventListener("click", clearAll);
  elements.downloadButton.addEventListener("click", downloadRenamedFiles);
  elements.resetSettings.addEventListener("click", resetSettings);
  [elements.prefix, elements.separator, elements.startNumber, elements.digits, elements.sortMode, elements.keepExtension]
    .forEach((element) => element.addEventListener(element.type === "text" || element.type === "range" || element.type === "number" ? "input" : "change", readSettings));

  readSettings();
}());
