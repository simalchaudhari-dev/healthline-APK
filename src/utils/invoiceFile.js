import { Platform, Share } from 'react-native';
import { getActiveBrandId } from '../config/colors';
import { MARK_BOX, MARK_PATHS } from './invoiceMarkPaths';
import { formatDate } from './formatDate';

const INVOICE_THEMES = {
  green: {
    header: [0.14, 0.22, 0.16],
    accent: [0.49, 0.78, 0.27],
    table: [0.29, 0.51, 0.27],
    amount: [0.18, 0.4, 0.22],
    grandText: [0.1, 0.16, 0.1],
    tagline: [0.78, 0.86, 0.78],
    marks: null,
  },
};

function themeFor(brand) {
  return INVOICE_THEMES[brand] || INVOICE_THEMES.green;
}

function formatWhen(value) {
  return formatDate(value);
}

function pdfEscape(value) {
  return String(value || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/** Segoe UI ₹ (U+20B9). Helvetica has no rupee glyph, so this outline is filled instead. */
const RUPEE_EM = 2048;
const RUPEE_WIDTH = 1104;
const RUPEE_PATH =
  'm 131 1107 l 616 1107 c 610.67 1135.00 601.83 1160.50 589.5 1183.5 c 577.17 1206.50 559.83 1226.17 537.5 1242.5 c 515.17 1258.83 487.50 1271.50 454.5 1280.5 c 421.50 1289.50 382.33 1294.00 337 1294 l 131 1294 l 131 1434 l 1034 1434 l 1034 1294 l 706 1294 c 725.33 1269.33 741.17 1241.50 753.5 1210.5 c 765.83 1179.50 774.00 1145.00 778 1107 l 1034 1107 l 1034 967 l 773 967 c 759.00 887.00 726.17 818.83 674.5 762.5 c 622.83 706.17 557.33 667.33 478 646 l 478 642 c 500.67 631.33 521.33 619.00 540 605 c 558.67 591.00 576.67 574.83 594 556.5 c 611.33 538.17 628.50 517.00 645.5 493 c 662.50 469.00 680.67 441.67 700 411 l 955 0 l 765 0 l 537 382 c 515.00 418.67 494.17 451.00 474.5 479 c 454.83 507.00 433.83 530.33 411.5 549 c 389.17 567.67 364.50 581.67 337.5 591 c 310.50 600.33 279.00 605.00 243 605 l 131 605 l 131 742 l 336 742 c 370.00 742.00 402.33 747.50 433 758.5 c 463.67 769.50 491.17 784.83 515.5 804.5 c 539.83 824.17 560.50 847.83 577.5 875.5 c 594.50 903.17 606.67 933.67 614 967 l 131 967 h';

function rupeeGlyph(x, y, size) {
  const k = size / RUPEE_EM;
  const tokens = RUPEE_PATH.split(/\s+/);
  const parts = [];
  let i = 0;
  const pt = () => {
    const gx = Number(tokens[i]);
    const gy = Number(tokens[i + 1]);
    i += 2;
    return `${(x + gx * k).toFixed(2)} ${(y + gy * k).toFixed(2)}`;
  };
  while (i < tokens.length) {
    const op = tokens[i];
    i += 1;
    if (op === 'm' || op === 'l') parts.push(`${pt()} ${op}`);
    else if (op === 'c') parts.push(`${pt()} ${pt()} ${pt()} c`);
    else if (op === 'h') parts.push('h');
  }
  parts.push('f');
  return parts.join('\n');
}

function fill(r, g, b, x, y, w, h) {
  return `${r} ${g} ${b} rg\n${x} ${y} ${w} ${h} re\nf`;
}

function text(font, size, x, y, r, g, b, value) {
  const raw = String(value || '');
  const lead = raw.match(/^\s*(?:₹|INR)\s*(.*)$/);
  if (lead) {
    const gap = (RUPEE_WIDTH / RUPEE_EM) * size + size * 0.08;
    return `${r} ${g} ${b} rg\n${rupeeGlyph(x, y, size)}\nBT /${font} ${size} Tf 1 0 0 1 ${(x + gap).toFixed(2)} ${y} Tm (${pdfEscape(lead[1])}) Tj ET`;
  }
  return `${r} ${g} ${b} rg\nBT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(raw)}) Tj ET`;
}

function svgToPdf(d, map) {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  const out = [];
  let i = 0;
  let cmd = 'M';
  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[MLCZ]$/.test(token)) {
      cmd = token;
      i += 1;
      if (cmd === 'Z') out.push('h');
      continue;
    }
    const count = cmd === 'C' ? 6 : 2;
    const nums = tokens.slice(i, i + count).map(Number);
    i += count;
    if (cmd === 'M') out.push(`${map(nums[0], nums[1])} m`);
    else if (cmd === 'L') out.push(`${map(nums[0], nums[1])} l`);
    else if (cmd === 'C') {
      out.push(
        `${map(nums[0], nums[1])} ${map(nums[2], nums[3])} ${map(nums[4], nums[5])} c`
      );
    }
  }
  return out.join('\n');
}

/** Real Healthline leaf, same paths as HealthlineMark, in the active brand. */
function logo(cx, cy, marks) {
  const height = 46;
  const scale = height / (MARK_BOX.maxY - MARK_BOX.minY);
  const width = (MARK_BOX.maxX - MARK_BOX.minX) * scale;
  const left = cx - width / 2;
  const bottom = cy - height / 2;
  const map = (x, y) => {
    const px = left + (x - MARK_BOX.minX) * scale;
    const py = bottom + (MARK_BOX.maxY - y) * scale;
    return `${px.toFixed(2)} ${py.toFixed(2)}`;
  };
  return MARK_PATHS.map((path, index) => {
    const rgb = marks?.[index] || path.rgb;
    return `${rgb.join(' ')} rg\n${svgToPdf(path.d, map)}\nf`;
  }).join('\n');
}

function buildPdf(invoice, theme) {
  const rows = [
    [invoice.plan || 'Plan', invoice.amount, '1', invoice.amount],
    [`${invoice.billing} billing`, '-', '1', '-'],
    [invoice.card || 'Card', '-', '1', '-'],
    [`Auto-pay ${invoice.autoPay}`, '-', '1', '-'],
  ];

  const [hr, hg, hb] = theme.header;
  const [ar, ag, ab] = theme.accent;
  const [tr, tg, tb] = theme.table;
  const [mr, mg, mb] = theme.amount;
  const [gr, gg, gb] = theme.grandText;
  const [lr, lg, lb] = theme.tagline;
  const parts = [
    fill(1, 1, 1, 0, 0, 595, 842),
    fill(hr, hg, hb, 0, 742, 595, 100),
    fill(ar, ag, ab, 0, 736, 595, 6),
    logo(50, 792, theme.marks),
    text('F2', 16, 82, 798, 1, 1, 1, 'HealthLine'),
    text('F1', 9, 82, 780, lr, lg, lb, 'Eat smart, live better'),
    text('F2', 26, 360, 792, 1, 1, 1, 'INVOICE'),
    text('F1', 10, 360, 770, lr, lg, lb, invoice.number),

    text('F1', 9, 40, 700, 0.45, 0.5, 0.46, 'INVOICE TO'),
    text('F2', 14, 40, 680, 0.1, 0.12, 0.11, invoice.name),
    text('F1', 11, 40, 662, 0.35, 0.4, 0.38, invoice.email),

    text('F1', 9, 380, 700, 0.45, 0.5, 0.46, 'TOTAL DUE'),
    text('F2', 18, 380, 676, mr, mg, mb, invoice.amount),
    text('F1', 10, 380, 656, 0.35, 0.4, 0.38, invoice.paid),

    fill(tr, tg, tb, 40, 600, 515, 26),
    text('F2', 10, 52, 608, 1, 1, 1, 'Description'),
    text('F2', 10, 330, 608, 1, 1, 1, 'Price'),
    text('F2', 10, 420, 608, 1, 1, 1, 'Qty'),
    text('F2', 10, 490, 608, 1, 1, 1, 'Total'),
  ];

  rows.forEach((row, index) => {
    const y = 568 - index * 28;
    if (index % 2 === 1) parts.push(fill(0.96, 0.97, 0.96, 40, y - 8, 515, 28));
    parts.push(text('F1', 11, 52, y, 0.15, 0.18, 0.16, row[0]));
    parts.push(text('F1', 11, 330, y, 0.15, 0.18, 0.16, row[1]));
    parts.push(text('F1', 11, 428, y, 0.15, 0.18, 0.16, row[2]));
    parts.push(text('F1', 11, 490, y, 0.15, 0.18, 0.16, row[3]));
  });

  parts.push(
    text('F1', 11, 360, 430, 0.35, 0.4, 0.38, 'Subtotal'),
    text('F2', 11, 470, 430, 0.1, 0.12, 0.11, invoice.amount),
    text('F1', 11, 360, 408, 0.35, 0.4, 0.38, 'Tax'),
    text('F2', 11, 470, 408, 0.1, 0.12, 0.11, '₹ 0'),
    fill(ar, ag, ab, 340, 360, 215, 28),
    text('F2', 12, 352, 368, gr, gg, gb, 'Grand total'),
    text('F2', 12, 460, 368, gr, gg, gb, invoice.amount),

    text('F2', 11, 40, 430, 0.1, 0.12, 0.11, 'Payment info'),
    text('F1', 10, 40, 412, 0.35, 0.4, 0.38, `Method: ${invoice.card}`),
    text('F1', 10, 40, 396, 0.35, 0.4, 0.38, `Auto-pay: ${invoice.autoPay}`),
    text('F1', 10, 40, 380, 0.35, 0.4, 0.38, `Period ends: ${invoice.ends}`),
    text('F1', 10, 40, 352, 0.35, 0.4, 0.38, 'Test checkout. No real charge was made.'),

    fill(hr, hg, hb, 0, 0, 595, 36),
    text('F1', 9, 40, 14, lr, lg, lb, 'HealthLine   ·   Eat smart, live better')
  );

  const stream = parts.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
    '6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

/** Download a one-page invoice for this payment. */
export async function downloadInvoice(row, user, brand) {
  const invoice = {
    number: `INV-${String(row.id || '').slice(-8).toUpperCase()}`,
    name: user?.displayName || user?.email || row.user || 'Customer',
    email: user?.email || row.email || '',
    plan: row.plan || 'Plan',
    amount: String(row.amount || '').replace(/^INR\s*/i, '₹ '),
    billing: row.billing || '',
    card: row.method || '',
    autoPay: row.autoPay ? 'On' : 'Off',
    paid: formatWhen(row.date),
    ends: formatWhen(row.endsAt),
    status: row.status || 'Paid',
  };
  const lines = [
    'HealthLine invoice',
    invoice.number,
    invoice.name,
    invoice.email,
    `${invoice.plan} · ${invoice.amount}`,
    `Auto-pay ${invoice.autoPay}`,
    `Paid ${invoice.paid} · ends ${invoice.ends}`,
  ];
  const fileName = `HealthLine-invoice-${String(row.id || 'payment').slice(-8)}.pdf`;
  const pdf = buildPdf(invoice, themeFor(brand || getActiveBrandId()));

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }

  await Share.share({ title: fileName, message: lines.join('\n') });
}
