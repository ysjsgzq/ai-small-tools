// 自检脚本：浏览器打开 index.html 后，控制台粘贴本文件内容并回车
// 预期：4 个案例 + 随机 100 组全部通过（两清 / 整数分 / 笔数 ≤ n-1）
function __verify(paidMap) {
  const { totalCents, transfers } = splitBill(paidMap);
  const names = Object.keys(paidMap);
  const base = Math.floor(totalCents / names.length);
  const rem = totalCents - base * names.length;
  const balances = Object.fromEntries(names.map((n, i) => [n, Math.round(paidMap[n] * 100) - (base + (i < rem ? 1 : 0))]));
  const fails = [];
  transfers.forEach(t => { balances[t.from] += t.amt; balances[t.to] -= t.amt; });
  names.forEach(n => { if (balances[n] !== 0) fails.push('未两清 ' + n); });
  transfers.forEach(t => { if (!Number.isInteger(t.amt) || t.amt <= 0) fails.push('金额异常 ' + t.amt); });
  if (transfers.length > names.length - 1) fails.push('笔数超上限');
  return fails;
}
const __cases = [
  { A: 600, B: 0, C: 0, D: 0, E: 0, F: 0 },
  { 小张: 436, 小李: 128.5, 小王: 0, 小赵: 0 },
  { A: 0.1, B: 0.2 },
  { 甲: 589, 乙: 320, 丙: 0, 丁: 145.7, 戊: 0, 己: 88.8, 庚: 0 }
];
__cases.forEach((m, i) => console.log('案例' + (i + 1) + '：失败 ' + __verify(m).length + ' 条', __verify(m)));
let pass = 0;
for (let k = 0; k < 100; k++) {
  const n = 2 + Math.floor(Math.random() * 7);
  const m = {};
  for (let i = 0; i < n; i++) m['P' + i] = Math.floor(Math.random() * 50000) / 100;
  if (__verify(m).length === 0) pass++;
}
console.log('随机 100 组：通过 ' + pass + ' 组（预期 100）');
