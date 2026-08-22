# -*- coding: utf-8 -*-
"""给一张普通 JPEG 注入 EXIF（GPS 坐标 + 竖拍方向标签 6），用于测试隐私清理器。
用法：python3 make_test_photo.py 输入.jpg 输出.jpg
"""
import struct
import sys

src = open(sys.argv[1], 'rb').read()
assert src[:2] == b'\xff\xd8', 'not a jpeg'

def entry(tag, typ, count, value):
    return struct.pack('<HHI', tag, typ, count) + value

ifd0_off = 8
gps_off = ifd0_off + 2 + 2 * 12 + 4
data_off = gps_off + 2 + 5 * 12 + 4
lat = [(23, 1), (6, 1), (3182, 100)]
lon = [(113, 1), (15, 1), (4312, 100)]
data = b''
lat_off = data_off; data += b''.join(struct.pack('<II', n, d) for n, d in lat)
lon_off = data_off + 24; data += b''.join(struct.pack('<II', n, d) for n, d in lon)
map_off = data_off + 48; data += b'WGS-84\x00'

ifd0 = struct.pack('<H', 2)
ifd0 += entry(0x0112, 3, 1, struct.pack('<HH', 6, 0))
ifd0 += entry(0x8825, 4, 1, struct.pack('<I', gps_off))
ifd0 += struct.pack('<I', 0)
gps = struct.pack('<H', 5)
gps += entry(0x0001, 2, 2, b'N\x00\x00\x00')
gps += entry(0x0002, 5, 3, struct.pack('<I', lat_off))
gps += entry(0x0003, 2, 2, b'E\x00\x00\x00')
gps += entry(0x0004, 5, 3, struct.pack('<I', lon_off))
gps += entry(0x001A, 2, 7, struct.pack('<I', map_off))
gps += struct.pack('<I', 0)

payload = b'Exif\x00\x00' + b'II' + struct.pack('<HI', 42, ifd0_off) + ifd0 + gps + data
app1 = b'\xff\xe1' + struct.pack('>H', len(payload) + 2) + payload
open(sys.argv[2], 'wb').write(src[:2] + app1 + src[2:])
print('done:', sys.argv[2])
