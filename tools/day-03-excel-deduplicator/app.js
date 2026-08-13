(function () {
  "use strict";

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const PREVIEW_LIMIT = 300;
  const elements = {
    clearButton: document.querySelector("#clearButton"),
    cleanCount: document.querySelector("#cleanCount"),
    columnError: document.querySelector("#columnError"),
    columnGroup: document.querySelector("#columnGroup"),
    columnOptions: document.querySelector("#columnOptions"),
    dataSection: document.querySelector("#dataSection"),
    downloadButton: document.querySelector("#downloadButton"),
    dropZone: document.querySelector("#dropZone"),
    duplicateCount: document.querySelector("#duplicateCount"),
    fileInput: document.querySelector("#fileInput"),
    ignoreCase: document.querySelector("#ignoreCase"),
    keepGroup: document.querySelector(".keep-group"),
    modeGroup: document.querySelector(".mode-group"),
    previewHint: document.querySelector("#previewHint"),
    resetSettings: document.querySelector("#resetSettings"),
    sheetSelect: document.querySelector("#sheetSelect"),
    sheetSummary: document.querySelector("#sheetSummary"),
    tableBody: document.querySelector("#tableBody"),
    tableFootnote: document.querySelector("#tableFootnote"),
    tableHead: document.querySelector("#tableHead"),
    toggleColumns: document.querySelector("#toggleColumns"),
    toastRegion: document.querySelector("#toastRegion"),
    totalCount: document.querySelector("#totalCount"),
    trimWhitespace: document.querySelector("#trimWhitespace")
  };

  const state = {
    file: null,
    workbook: null,
    sheetName: "",
    headers: [],
    rows: [],
    selectedColumns: new Set(),
    analysis: null,
    isReading: false,
    toastTimer: null
  };

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function showToast(message, type = "info") {
    window.clearTimeout(state.toastTimer);
    elements.toastRegion.textContent = message;
    elements.toastRegion.classList.toggle("is-error", type === "error");
    elements.toastRegion.classList.add("is-visible");
    state.toastTimer = window.setTimeout(() => elements.toastRegion.classList.remove("is-visible"), 3200);
  }

  function getSettings() {
    return {
      matchMode: document.querySelector('input[name="matchMode"]:checked').value,
      keepMode: document.querySelector('input[name="keepMode"]:checked').value,
      ignoreCase: elements.ignoreCase.checked,
      trimWhitespace: elements.trimWhitespace.checked
    };
  }

  function normalize(value, settings) {
    if (value === null || value === undefined) return "";
    let result = value instanceof Date ? value.toISOString() : String(value);
    if (settings.trimWhitespace) result = result.trim();
    if (settings.ignoreCase) result = result.toLocaleLowerCase("zh-CN");
    return result;
  }

  function createHeaders(rawHeaders, columnCount) {
    const used = new Map();
    return Array.from({ length: columnCount }, (_, index) => {
      const source = rawHeaders[index];
      const base = String(source === undefined || source === null || source === "" ? `未命名列 ${index + 1}` : source).trim();
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      return { key: index, label: count === 1 ? base : `${base} (${count})` };
    });
  }

  function readSheet(name) {
    const sheet = state.workbook.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    const nonEmpty = matrix.filter((row) => row.some((value) => String(value).trim() !== ""));
    const columnCount = nonEmpty.reduce((max, row) => Math.max(max, row.length), 0);
    state.headers = createHeaders(nonEmpty[0] || [], columnCount);
    state.rows = nonEmpty.slice(1).map((row, index) => ({ sourceIndex: index + 2, values: Array.from({ length: columnCount }, (_, col) => row[col] ?? "") }));
    state.selectedColumns = new Set(state.headers.map((header) => header.key));
    renderColumnOptions();
    analyze();
  }

  function buildKey(row, settings) {
    const indexes = settings.matchMode === "row" ? state.headers.map((header) => header.key) : [...state.selectedColumns].sort((a, b) => a - b);
    return JSON.stringify(indexes.map((index) => normalize(row.values[index], settings)));
  }

  function analyze() {
    if (!state.workbook) return;
    const settings = getSettings();
    const columnsValid = settings.matchMode === "row" || state.selectedColumns.size > 0;
    elements.columnError.textContent = columnsValid ? "" : "请至少选择一个判断字段";

    if (!columnsValid) {
      state.analysis = null;
      render();
      return;
    }

    const groups = new Map();
    state.rows.forEach((row, index) => {
      const key = buildKey(row, settings);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(index);
    });

    const duplicateGroups = [...groups.values()].filter((indexes) => indexes.length > 1);
    const removeIndexes = new Set();
    const keeperIndexes = new Set();
    duplicateGroups.forEach((indexes) => {
      if (settings.keepMode === "first") {
        keeperIndexes.add(indexes[0]);
        indexes.slice(1).forEach((index) => removeIndexes.add(index));
      } else if (settings.keepMode === "last") {
        keeperIndexes.add(indexes[indexes.length - 1]);
        indexes.slice(0, -1).forEach((index) => removeIndexes.add(index));
      } else {
        indexes.forEach((index) => removeIndexes.add(index));
      }
    });

    const duplicateRows = new Set(duplicateGroups.flat());
    state.analysis = { duplicateGroups, duplicateRows, keeperIndexes, removeIndexes };
    render();
  }

  function renderColumnOptions() {
    elements.columnOptions.innerHTML = state.headers.map((header) => `
      <label class="column-option">
        <input type="checkbox" value="${header.key}" ${state.selectedColumns.has(header.key) ? "checked" : ""}>
        <span title="${escapeHtml(header.label)}">${escapeHtml(header.label)}</span>
      </label>`).join("");
  }

  function renderTable() {
    elements.tableHead.innerHTML = `<tr><th>状态</th>${state.headers.map((header) => `<th title="${escapeHtml(header.label)}">${escapeHtml(header.label)}</th>`).join("")}</tr>`;
    const analysis = state.analysis;
    let rowsToShow = state.rows;
    if (analysis && analysis.duplicateRows.size) {
      rowsToShow = state.rows.filter((_, index) => analysis.duplicateRows.has(index));
    }
    const previewRows = rowsToShow.slice(0, PREVIEW_LIMIT);
    elements.tableBody.innerHTML = previewRows.map((row) => {
      const index = state.rows.indexOf(row);
      const remove = analysis?.removeIndexes.has(index);
      const keep = analysis?.keeperIndexes.has(index);
      const rowClass = remove ? "is-duplicate" : keep ? "is-keeper" : "";
      const status = remove ? '<span class="row-status remove">移除</span>' : keep ? '<span class="row-status keep">保留</span>' : '<span class="row-status">正常</span>';
      return `<tr class="${rowClass}"><td>${status}</td>${row.values.map((value) => `<td title="${escapeHtml(value)}">${escapeHtml(value)}</td>`).join("")}</tr>`;
    }).join("");
    elements.tableFootnote.textContent = rowsToShow.length > PREVIEW_LIMIT ? `为保证页面流畅，仅显示前 ${PREVIEW_LIMIT} 条匹配记录。导出会处理全部数据。` : `共显示 ${rowsToShow.length} 条记录。`;
  }

  function render() {
    const hasWorkbook = Boolean(state.workbook);
    const settings = getSettings();
    const analysis = state.analysis;
    const total = state.rows.length;
    const removed = analysis ? analysis.removeIndexes.size : 0;

    elements.dataSection.classList.toggle("is-hidden", !hasWorkbook);
    elements.clearButton.disabled = !hasWorkbook || state.isReading;
    elements.resetSettings.disabled = !hasWorkbook;
    elements.sheetSelect.disabled = !hasWorkbook;
    elements.modeGroup.disabled = !hasWorkbook;
    elements.keepGroup.disabled = !hasWorkbook;
    elements.ignoreCase.disabled = !hasWorkbook;
    elements.trimWhitespace.disabled = !hasWorkbook;
    elements.columnGroup.classList.toggle("is-hidden", settings.matchMode !== "columns");
    elements.downloadButton.disabled = !hasWorkbook || !analysis || state.isReading;
    elements.totalCount.textContent = total.toLocaleString("zh-CN");
    elements.duplicateCount.textContent = removed.toLocaleString("zh-CN");
    elements.cleanCount.textContent = (total - removed).toLocaleString("zh-CN");
    elements.sheetSummary.textContent = state.sheetName || "-";
    elements.previewHint.textContent = analysis
      ? analysis.duplicateGroups.length
        ? `发现 ${analysis.duplicateGroups.length} 组重复，共移除 ${removed} 条`
        : "没有发现重复记录"
      : "请完善判断规则";
    if (hasWorkbook) renderTable();
  }

  async function loadFile(file) {
    if (!file) return;
    const extension = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(extension)) return showToast("请选择 .xlsx、.xls 或 .csv 文件", "error");
    if (file.size > MAX_FILE_SIZE) return showToast("文件不能超过 20 MB", "error");
    if (typeof XLSX === "undefined") return showToast("Excel 组件加载失败，请刷新页面重试", "error");

    state.isReading = true;
    state.file = file;
    elements.dropZone.querySelector("strong").textContent = "正在读取表格...";
    try {
      const data = await file.arrayBuffer();
      state.workbook = XLSX.read(data, { type: "array", cellDates: true });
      if (!state.workbook.SheetNames.length) throw new Error("empty workbook");
      elements.sheetSelect.innerHTML = state.workbook.SheetNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
      state.sheetName = state.workbook.SheetNames[0];
      readSheet(state.sheetName);
      showToast(`已读取 ${file.name}`);
    } catch (error) {
      clearAll(false);
      showToast("无法读取这个文件，请确认文件未损坏或加密", "error");
    } finally {
      state.isReading = false;
      elements.dropZone.querySelector("strong").textContent = state.file ? state.file.name : "拖拽 Excel 到这里";
      render();
    }
  }

  function clearAll(showMessage = true) {
    state.file = null;
    state.workbook = null;
    state.sheetName = "";
    state.headers = [];
    state.rows = [];
    state.selectedColumns.clear();
    state.analysis = null;
    elements.fileInput.value = "";
    elements.sheetSelect.innerHTML = "<option>请先上传文件</option>";
    elements.dropZone.querySelector("strong").textContent = "拖拽 Excel 到这里";
    render();
    if (showMessage) showToast("文件已清空");
  }

  function resetSettings() {
    document.querySelector('input[name="matchMode"][value="row"]').checked = true;
    document.querySelector('input[name="keepMode"][value="first"]').checked = true;
    elements.ignoreCase.checked = true;
    elements.trimWhitespace.checked = true;
    state.selectedColumns = new Set(state.headers.map((header) => header.key));
    renderColumnOptions();
    analyze();
    showToast("已恢复默认清理规则");
  }

  function cleanCurrentSheet(workbook) {
    const keptRows = state.rows.filter((_, index) => !state.analysis.removeIndexes.has(index)).map((row) => row.values);
    const headerRow = state.headers.map((header) => header.label.replace(/ \(\d+\)$/, ""));
    const newSheet = XLSX.utils.aoa_to_sheet([headerRow, ...keptRows]);
    const oldSheet = workbook.Sheets[state.sheetName];
    if (oldSheet["!cols"]) newSheet["!cols"] = oldSheet["!cols"];
    workbook.Sheets[state.sheetName] = newSheet;
  }

  function downloadCleaned() {
    if (!state.analysis) return;
    try {
      const source = XLSX.write(state.workbook, { bookType: "xlsx", type: "array" });
      const workbook = XLSX.read(source, { type: "array" });
      cleanCurrentSheet(workbook);
      const output = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
      const blob = new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const base = state.file.name.replace(/\.[^.]+$/, "");
      link.href = url;
      link.download = `${base}-cleaned.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast(`已导出 ${state.rows.length - state.analysis.removeIndexes.size} 条记录`);
    } catch (error) {
      showToast("导出失败，请尝试减少数据量后重试", "error");
    }
  }

  elements.fileInput.addEventListener("change", (event) => loadFile(event.target.files[0]));
  elements.dropZone.addEventListener("dragover", (event) => { event.preventDefault(); elements.dropZone.classList.add("is-dragging"); });
  elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("is-dragging"));
  elements.dropZone.addEventListener("drop", (event) => { event.preventDefault(); elements.dropZone.classList.remove("is-dragging"); loadFile(event.dataTransfer.files[0]); });
  elements.clearButton.addEventListener("click", () => clearAll());
  elements.resetSettings.addEventListener("click", resetSettings);
  elements.downloadButton.addEventListener("click", downloadCleaned);
  elements.sheetSelect.addEventListener("change", () => { state.sheetName = elements.sheetSelect.value; readSheet(state.sheetName); });
  elements.columnOptions.addEventListener("change", (event) => {
    const key = Number(event.target.value);
    if (event.target.checked) state.selectedColumns.add(key); else state.selectedColumns.delete(key);
    analyze();
  });
  elements.toggleColumns.addEventListener("click", () => {
    const allSelected = state.selectedColumns.size === state.headers.length;
    state.selectedColumns = new Set(allSelected ? [] : state.headers.map((header) => header.key));
    renderColumnOptions();
    analyze();
  });
  document.querySelectorAll('input[name="matchMode"], input[name="keepMode"], #ignoreCase, #trimWhitespace').forEach((input) => input.addEventListener("change", analyze));
  render();
}());
