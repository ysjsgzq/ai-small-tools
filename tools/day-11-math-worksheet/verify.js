// 自检脚本：浏览器打开 index.html 后，在控制台粘贴本文件全部内容并回车
// 预期输出：三个难度各 100 题，fails 均为 0
function __verify(list, level) {
  const fails = [];
  const seen = new Set();
  list.forEach((q) => {
    const { a, b, op, ans } = q;
    const re = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
    if (re !== ans) fails.push('答案错误 ' + q.text + ans);
    if (seen.has(q.text)) fails.push('重复 ' + q.text.trim());
    seen.add(q.text);
    if (level === 3) {
      if (op === '÷' && (!Number.isInteger(ans) || ans > 9 || b === 1)) fails.push('除法问题 ' + q.text + ans);
      if (op === '×' && (a === 1 || b === 1)) fails.push('×1 送分 ' + q.text.trim());
    }
    if (op === '-' && ans < 0) fails.push('负数 ' + q.text.trim());
    if (level === 1 && (a > 10 || b > 10 || ans > 10)) fails.push('超十以内 ' + q.text.trim());
    if (level === 2 && (a > 20 || b > 20 || ans > 20)) fails.push('超二十以内 ' + q.text.trim());
  });
  return fails;
}
[1, 2, 3].forEach((lv) => {
  const list = genSet(lv, 100);
  const fails = __verify(list, lv);
  console.log('level ' + lv + ': ' + list.length + ' 题，失败 ' + fails.length + ' 条', fails.slice(0, 5));
});
