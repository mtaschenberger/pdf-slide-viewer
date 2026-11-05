#!/usr/bin/env python3
"""Generate a small, dependency-free four-slide PDF for manual testing."""
from pathlib import Path

objects = []
def add(data):
    objects.append(data.encode('ascii'))
    return len(objects)

add('<< /Type /Catalog /Pages 2 0 R >>')
add('<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R 10 0 R] /Count 4 >>')
add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
for i, (colour, title) in enumerate([('0.12 0.24 0.47', 'Welcome'), ('0.12 0.43 0.35', 'Explore'), ('0.55 0.28 0.17', 'Present'), ('0.35 0.22 0.46', 'Thank you')], 1):
    content = f'{colour} rg 0 0 960 540 re f\n1 1 1 rg BT /F1 56 Tf 70 280 Td ({title}) Tj ET\nBT /F1 24 Tf 70 220 Td (Slide {i} of 4) Tj ET\n'
    stream_id = len(objects) + 2
    add(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_id} 0 R >>')
    add(f'<< /Length {len(content)} >>\nstream\n{content}endstream')

out = bytearray(b'%PDF-1.4\n')
offsets = [0]
for i, obj in enumerate(objects, 1):
    offsets.append(len(out))
    out.extend(f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n')
xref = len(out)
out.extend(f'xref\n0 {len(offsets)}\n0000000000 65535 f \n'.encode())
for offset in offsets[1:]:
    out.extend(f'{offset:010d} 00000 n \n'.encode())
out.extend(f'trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode())
Path(__file__).with_name('four-slides.pdf').write_bytes(out)
