#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""评论归类器 · 第一版
输入：评论文本文件，一行一条
处理：明显好评先排除 → 建议 / 问题归类 / 情绪 / 其他
输出：问题分类表（带原话）+ 建议区 + 情绪区 + 其他占比检查
规则：关键词匹配。关键词只会找字，不会读句子。
"""
import sys

CATEGORIES = {
    '出餐速度': ['慢', '等了', '上菜', '排队', '出餐', '等位'],
    '口味': ['咸', '淡', '难吃', '味道', '太甜', '太辣', '腻', '腥'],
    '卫生': ['头发', '异物', '脏', '油腻', '蟑螂', '不干净', '苍蝇', '餐具没'],
    '服务': ['态度', '不理', '翻白眼', '怼', '没人理'],
    '包装': ['打包', '包装', '漏了', '洒了', '盒子破', '袋子太薄'],
    '价格': ['贵', '涨价', '涨', '性价比', '不值'],
}
SUGGEST_WORDS = ['希望', '建议', '能不能', '可不可以', '下次', '加个', '不如', '为什么没有', '希望能']
EMOTION_WORDS = ['服了', '无语', '气死', '绝了', '醉了', '呵呵', '失望', '后悔', '恶心', '再也不来']
PRAISE_WORDS = ['好吃', '值', '赞', '喜欢', '满意', '热情', '棒', '推荐', '真好', '很好', '不错', '干净', '没得说', '刚好']
TRANSITIONS = ['但是', '不过', '可是', '然而', '只不过', '就是', '但']


def hit(text, words):
    return any(w in text for w in words)


def first_category(text):
    for cat, words in CATEGORIES.items():
        if hit(text, words):
            return cat
    return None


def classify(text):
    """返回 (去向, 类别或说明)
    两条保护：
    1. 先夸后转折（"…没得说，就是有点咸"）：按转折后面的部分归类，夸奖不吞问题；
    2. 整条只有夸奖、没有转折的（"不咸不淡，刚好"）：算好评，不算问题。
    """
    is_praise = hit(text, PRAISE_WORDS)
    is_sugg = hit(text, SUGGEST_WORDS)
    is_emo = hit(text, EMOTION_WORDS)
    for t in TRANSITIONS:
        if t in text:
            head, tail = text.split(t, 1)
            cat = first_category(tail)
            if cat and hit(head, PRAISE_WORDS):
                return ('问题', cat)
    cat = first_category(text)
    if cat:
        if is_praise:
            return ('好评', '含夸奖词，未计入问题')
        return ('问题', cat)
    if is_sugg:
        return ('建议', '建议')
    if is_emo:
        return ('情绪', '不满，无具体事实')
    if is_praise:
        return ('好评', '好评')
    return ('其他', '归不进任何一类')


def main(path):
    lines = [l.strip() for l in open(path, encoding='utf-8') if l.strip()]
    problems = {c: [] for c in CATEGORIES}
    suggests, emotions, praises, others = [], [], [], []
    for i, text in enumerate(lines, 1):
        where, what = classify(text)
        if where == '问题':
            problems[what].append(text)
        elif where == '建议':
            suggests.append(text)
        elif where == '情绪':
            emotions.append(text)
        elif where == '好评':
            praises.append(text)
        else:
            others.append(text)
    total = len(lines)
    issue_cnt = sum(len(v) for v in problems.values())
    print(f'体检对象：{path}（{total} 条评论）')
    print()
    print('## 问题分类')
    for cat, quotes in problems.items():
        if not quotes:
            continue
        print(f'\n【{cat}】{len(quotes)} 条')
        for q in quotes:
            print(f'  - {q}')
    print(f'\n## 建议（{len(suggests)} 条）')
    for q in suggests:
        print(f'  - {q}')
    print(f'\n## 情绪（{len(emotions)} 条，无具体事实，不计入问题统计）')
    for q in emotions:
        print(f'  - {q}')
    print(f'\n## 好评（{len(praises)} 条，未计入问题）')
    for q in praises[:3]:
        print(f'  - {q}')
    if len(praises) > 3:
        print(f'  - …等 {len(praises)} 条')
    print(f'\n## 其他（{len(others)} 条）')
    for q in others:
        print(f'  - {q}')
    ratio = len(others) / total if total else 0
    print(f'\n小结：{total} 条中，问题 {issue_cnt} 条、建议 {len(suggests)} 条、'
          f'情绪 {len(emotions)} 条、好评 {len(praises)} 条、其他 {len(others)} 条（占比 {ratio:.0%}）。')
    if ratio > 1 / 3:
        print('警告：「其他」超过三分之一，该修的是分类规则，不是继续塞。')


if __name__ == '__main__':
    main(sys.argv[1])
