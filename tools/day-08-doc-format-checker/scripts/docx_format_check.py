#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""文档格式体检器（Day 08）

根据格式要求核对 docx 的字体、字号、行距、页边距、纸张，
解析直接格式与样式表继承，输出「符合 / 不符合 / 需人工确认」三状态报告。

只报告事实，不修改文档。全程本地解析，不上传任何内容。

用法：
    python3 docx_format_check.py --doc 标书.docx --reqs requirements.json [--out report.md]
"""
import argparse
import json
import zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

# 中文字号对照（磅 → 字号名），仅用于报告展示
PT_NAME = {'10.5': '五号', '12': '小四', '14': '四号', '15': '小三', '16': '三号', '18': '小二', '22': '二号'}
PAPER = {('11906', '16838'): 'A4', ('16838', '11906'): 'A4(横)', ('8419', '11906'): 'A5', ('11906', '8419'): 'A5'}


def pt_name(pt):
    key = str(int(pt)) if float(pt) == int(pt) else str(pt)
    return PT_NAME.get(key, '')


# ---------- 读取 docx ----------

def load_docx(path):
    z = zipfile.ZipFile(path)
    doc = ET.fromstring(z.read('word/document.xml'))
    try:
        styles_root = ET.fromstring(z.read('word/styles.xml'))
    except KeyError:
        styles_root = None
    return doc, styles_root


def extract_rpr(rpr):
    """从 rPr 抽取字体 / 字号。"""
    out = {}
    if rpr is None:
        return out
    fonts = rpr.find(f'{W}rFonts')
    if fonts is not None:
        ea = fonts.get(f'{W}eastAsia')
        asc = fonts.get(f'{W}ascii')
        out['east_asia_font'] = ea or asc
        out['ascii_font'] = asc
    for tag in ('sz', 'szCs'):
        sz = rpr.find(f'{W}{tag}')
        if sz is not None and sz.get(f'{W}val'):
            out['font_size_pt'] = int(sz.get(f'{W}val')) / 2.0
            break
    return out


def extract_ppr(ppr):
    """从 pPr 抽取行距。"""
    out = {}
    if ppr is None:
        return out
    sp = ppr.find(f'{W}spacing')
    if sp is not None:
        line, rule = sp.get(f'{W}line'), sp.get(f'{W}lineRule')
        if line:
            if rule in ('exact', 'atLeast'):
                out['line_spacing'] = ('exact' if rule == 'exact' else 'at_least', int(line) / 20.0)
            else:
                out['line_spacing'] = ('multiple', int(line) / 240.0)
    return out


def load_styles(styles_root):
    """样式表 → {styleId: {basedOn, rPr, ppr}}，以及文档默认格式。"""
    styles, defaults = {}, {'rPr': {}, 'ppr': {}}
    if styles_root is None:
        return styles, defaults
    dd = styles_root.find(f'{W}docDefaults')
    if dd is not None:
        defaults['rPr'] = extract_rpr(dd.find(f'{W}rPrDefault/{W}rPr'))
        defaults['ppr'] = extract_ppr(dd.find(f'{W}pPrDefault/{W}pPr'))
    for st in styles_root.findall(f'{W}style'):
        sid = st.get(f'{W}styleId')
        if not sid:
            continue
        bo = st.find(f'{W}basedOn')
        styles[sid] = {
            'basedOn': bo.get(f'{W}val') if bo is not None else None,
            'rPr': extract_rpr(st.find(f'{W}rPr')),
            'ppr': extract_ppr(st.find(f'{W}pPr')),
        }
    return styles, defaults


def style_chain(styles, sid):
    seen, chain = set(), []
    while sid and sid not in seen and sid in styles:
        seen.add(sid)
        chain.append(styles[sid])
        sid = styles[sid]['basedOn']
    return chain


def chain_get(chain, group, key):
    for node in chain:
        if key in node.get(group, {}):
            return node[group][key]
    return None


def paragraph_facts(p, styles, defaults):
    """计算段落生效格式：直接格式 > 段落样式链 > 文档默认。"""
    ppr = p.find(f'{W}pPr')
    style_el = ppr.find(f'{W}pStyle') if ppr is not None else None
    style_id = style_el.get(f'{W}val') if style_el is not None else None
    chain = style_chain(styles, style_id)
    facts = {'ppr': dict(extract_ppr(ppr)), 'runs': []}
    for key in ('line_spacing',):
        if key not in facts['ppr']:
            v = chain_get(chain, 'ppr', key) or defaults['ppr'].get(key)
            if v is not None:
                facts['ppr'][key] = v
    for r in p.iter(f'{W}r'):
        if not ''.join(t.text or '' for t in r.iter(f'{W}t')).strip():
            continue
        direct = extract_rpr(r.find(f'{W}rPr'))
        run = {}
        for key in ('east_asia_font', 'ascii_font', 'font_size_pt'):
            if key in direct:
                run[key] = direct[key]
            else:
                v = chain_get(chain, 'rPr', key) or defaults['rPr'].get(key)
                if v is not None:
                    run[key] = v
        facts['runs'].append(run)
    facts['text'] = ''.join(t.text or '' for t in p.iter(f'{W}t')).strip()
    return facts


def section_facts(doc):
    """页面级：纸张、页边距（取 body 内第一个 sectPr）。"""
    out = {}
    sect = doc.find(f'.//{W}body/{W}sectPr')
    if sect is None:
        return out
    pg = sect.find(f'{W}pgSz')
    if pg is not None and pg.get(f'{W}w') and pg.get(f'{W}h'):
        wh = (pg.get(f'{W}w'), pg.get(f'{W}h'))
        if wh in PAPER:
            out['paper_size'] = PAPER[wh]
        else:
            out['paper_size'] = f"{int(wh[0]) / 567:.1f}x{int(wh[1]) / 567:.1f}cm"
    mar = sect.find(f'{W}pgMar')
    if mar is not None:
        for side in ('top', 'bottom', 'left', 'right'):
            v = mar.get(f'{W}{side}')
            if v:
                out[f'margin_{side}_cm'] = round(int(v) / 567.0, 2)
    return out


# ---------- 比对 ----------

def fmt_val(attr, v):
    if v is None:
        return None
    if attr == 'font_size_pt':
        n = pt_name(v)
        return f'{v:g}磅' + (f'（{n}）' if n else '')
    if attr == 'line_spacing':
        kind, n = v
        return {'exact': f'固定值{n:g}磅', 'at_least': f'最小值{n:g}磅'}.get(kind, f'{n:g}倍行距')
    if attr.startswith('margin_'):
        return f'{v}厘米'
    return str(v)


def parse_expected(attr, raw):
    raw = str(raw).strip()
    if attr == 'font_size_pt':
        return float(raw.replace('磅', '').replace('pt', '').replace('（', ' ').split()[0])
    if attr == 'line_spacing':
        if ':' in raw:
            kind, n = raw.split(':', 1)
            return (kind.strip(), float(n))
        return ('exact', float(raw.replace('磅', '')))
    if attr.startswith('margin_'):
        return float(raw.replace('厘米', '').replace('cm', ''))
    return raw


def same(attr, cur, exp):
    if cur is None:
        return None
    if attr == 'font_size_pt':
        return abs(cur - exp) < 0.25
    if attr == 'line_spacing':
        return cur[0] == exp[0] and abs(cur[1] - exp[1]) < 0.05
    if attr.startswith('margin_'):
        return abs(cur - exp) < 0.05
    return str(cur) == str(exp)


def check(doc_path, reqs):
    doc, styles_root = load_docx(doc_path)
    styles, defaults = load_styles(styles_root)
    paras = [f for f in (paragraph_facts(p, styles, defaults) for p in doc.iter(f'{W}p')) if f['text']]
    sect = section_facts(doc)
    results = {'ok': [], 'bad': [], 'manual': []}
    for req in reqs:
        attr = req['attr']
        label = f"{req.get('object', '')}·{attr}"
        if req.get('checkable') is False:
            results['manual'].append({**req, 'label': label})
            continue
        exp = parse_expected(attr, req['expected'])
        if attr == 'paper_size' or attr.startswith('margin_'):
            cur = sect.get(attr)
            if cur is None:
                results['manual'].append({**req, 'label': label, 'note': '文档中未读取到页面设置'})
            elif same(attr, cur, exp):
                results['ok'].append({**req, 'label': label})
            else:
                results['bad'].append({**req, 'label': label,
                    'detail': [{'para': '全文', 'text': '页面设置', 'current': fmt_val(attr, cur)}]})
            continue
        hits, seen_any = [], False
        for i, f in enumerate(paras, 1):
            sources = [f['ppr']] if attr == 'line_spacing' else f['runs']
            vals = [s.get(attr) for s in sources if s.get(attr) is not None]
            if vals:
                seen_any = True
            bad_vals = [v for v in vals if not same(attr, v, exp)]
            if bad_vals:
                hits.append((i, f['text'][:14], sorted({fmt_val(attr, v) for v in bad_vals})))
        if hits:
            results['bad'].append({**req, 'label': label,
                'detail': [{'para': i, 'text': t, 'current': '、'.join(vs)} for i, t, vs in hits]})
        elif not seen_any:
            results['manual'].append({**req, 'label': label, 'note': '段落未设置该属性，无法判定'})
        else:
            results['ok'].append({**req, 'label': label})
    return results, len(paras)


def fmt_expected(it):
    attr = it['attr']
    try:
        return fmt_val(attr, parse_expected(attr, it['expected']))
    except (ValueError, TypeError):
        return str(it['expected'])


def render(results, para_count, doc_path):
    L = ['# 文档格式体检报告', '',
         f'- 体检对象：`{doc_path}`',
         f'- 检查段落：{para_count} 段（不含空段）',
         f'- 结果：符合 {len(results["ok"])} 项 · 不符合 {len(results["bad"])} 项 · 需人工确认 {len(results["manual"])} 项', '']
    if results['bad']:
        L += ['## 不符合', '', '| 检查项 | 位置 | 当前值 | 要求值 | 来源 |', '| --- | --- | --- | --- | --- |']
        for it in results['bad']:
            where = '；'.join(f"第{d['para']}段[{d['text']}…]" for d in it['detail'])
            cur = '；'.join(dict.fromkeys(d['current'] for d in it['detail']))
            L.append(f"| {it['label']} | {where} | {cur} | {fmt_expected(it)} | {it.get('source', '')} |")
        L.append('')
    if results['manual']:
        L += ['## 需人工确认', '', '| 检查项 | 要求 / 原话 | 原因 | 来源 |', '| --- | --- | --- | --- |']
        for it in results['manual']:
            note = it.get('note', '机器无法检查（打印、装订、签章等实体要求）')
            L.append(f"| {it['label']} | {it['expected']} | {note} | {it.get('source', '')} |")
        L.append('')
    if results['ok']:
        L += ['## 符合', '', '| 检查项 | 要求值 | 来源 |', '| --- | --- | --- |']
        for it in results['ok']:
            L.append(f"| {it['label']} | {fmt_expected(it)} | {it.get('source', '')} |")
        L.append('')
    L += ['## 说明与限制', '',
          '- 定位精确到段落；页码需要排版引擎算完分页才能给出，本工具不提供。',
          '- 已解析样式表继承与文档默认格式；未覆盖：页眉页脚、表格内部、目录域、修订记录。',
          '- 本工具只报告事实，不修改文档；是否修改、如何修改由人决定。']
    return '\n'.join(L)


def main():
    ap = argparse.ArgumentParser(description='docx 格式体检器')
    ap.add_argument('--doc', required=True, help='待检查的 .docx 文件')
    ap.add_argument('--reqs', required=True, help='requirements.json（格式要求清单）')
    ap.add_argument('--out', help='报告输出路径（缺省打印到终端）')
    a = ap.parse_args()
    with open(a.reqs, encoding='utf-8') as f:
        reqs = json.load(f)
    if isinstance(reqs, dict):
        reqs = reqs.get('requirements', [])
    results, n = check(a.doc, reqs)
    report = render(results, n, a.doc)
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f'报告已写入 {a.out}')
        print(f'符合 {len(results["ok"])} · 不符合 {len(results["bad"])} · 需人工确认 {len(results["manual"])}')
    else:
        print(report)


if __name__ == '__main__':
    main()
