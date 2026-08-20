# -*- coding: utf-8 -*-
"""生成最小合法 PDF（未压缩、Helvetica 文本），每页一个唯一标记。"""
def make_pdf(pages_text, path):
    objs = []
    n_pages = len(pages_text)
    font_num = 3 + n_pages * 2  # catalog=1, pages=2, page/content 成对，字体最后
    kids = ' '.join(f'{3 + i * 2} 0 R' for i in range(n_pages))
    objs.append(f'<< /Type /Catalog /Pages 2 0 R >>')
    objs.append(f'<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>')
    for i, text in enumerate(pages_text):
        objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {font_num} 0 R >> >> /Contents {4 + i * 2} 0 R >>')
        stream = f'BT /F1 24 Tf 72 760 Td ({text}) Tj ET'
        objs.append(f'<< /Length {len(stream)} >>\nstream\n{stream}\nendstream')
    objs.append(f'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    out = '%PDF-1.4\n'
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += f'{i} 0 obj\n{body}\nendobj\n'
    xref_pos = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'
    for off in offsets:
        out += f'{off:010d} 00000 n \n'
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF'
    open(path, 'wb').write(out.encode('ascii'))
    print(f'{path}: {n_pages} 页')

make_pdf(['QUOTATION-SHEET-P1'], 'a-quotation.pdf')
make_pdf(['CONTRACT-P1', 'CONTRACT-P2'], 'b-contract.pdf')
make_pdf(['DRAWING-LIST-P1'], 'c-drawings.pdf')
