import ExcelJS from 'exceljs';
import { TYPES, DC_OPTIONS } from './inventoryCatalog';

/**
 * Excel import for spare inventory.
 *
 * COLUMN_SPEC is the single definition of what a sheet may contain: the parser
 * matches headers from it, and the "required columns" help dialog renders from
 * it. Adding a column here updates both — they can't drift apart.
 *
 * Header matching is deliberately forgiving (case-insensitive, punctuation and
 * spacing ignored, several aliases each) because these sheets get hand-made and
 * a rejected upload over "Serial #" vs "Serial" is a bad trade.
 */
export const COLUMN_SPEC = [
  {
    key: 'model',
    label: 'Model',
    required: true,
    aliases: ['model', 'part', 'part number', 'partno', 'pid', 'product id', 'product'],
    example: 'UCSX-210C-M7',
    help: 'Cisco PID / part number. The only column that must be present.',
  },
  {
    key: 'type',
    label: 'Type',
    required: false,
    aliases: ['type', 'hardware type', 'category', 'hardware', 'kind'],
    example: 'Blade Server',
    help: `Accepts the label or the short code — ${TYPES.map(t => t.value).join(', ')}. Blank or unrecognised becomes "Other".`,
  },
  {
    key: 'dc',
    label: 'Datacenter',
    required: false,
    aliases: ['dc', 'datacenter', 'data center', 'site', 'location dc'],
    example: 'SITE2',
    help: `${DC_OPTIONS.join(' or ')} — case and spacing don't matter. Anything else falls back to ${DC_OPTIONS[0]} and is flagged for you to correct.`,
  },
  {
    key: 'serial',
    label: 'Serial',
    required: false,
    aliases: ['serial', 'serial number', 'serial no', 'sn', 's/n', 'serial #'],
    example: 'FCH2109V1PH',
    help: 'Stored uppercase. Leave blank for unserialised parts.',
  },
  {
    key: 'quantity',
    label: 'Quantity',
    required: false,
    aliases: ['quantity', 'qty', 'count', 'units', 'amount'],
    example: '8',
    help: 'Whole number. Blank or invalid becomes 1.',
  },
  {
    key: 'notes',
    label: 'Notes',
    required: false,
    aliases: ['notes', 'note', 'comment', 'comments', 'location', 'rack', 'remarks'],
    example: 'Rack B12, shelf 3',
    help: 'Free text — physical location lives here, and it is searchable in Bulk lookup.',
  },
];

/* How many blank, validation-ready rows the downloaded template ships with. */
const TEMPLATE_ROWS = 100;

/**
 * Build the blank import template.
 *
 * Sheet 1 ("Inventory") is what gets imported: headers from COLUMN_SPEC plus
 * empty rows carrying dropdown validation for Type and Datacenter, so the two
 * fields with a fixed vocabulary can't be typo'd into a silent fallback.
 *
 * The worked example lives on sheet 2 on purpose — the parser only reads the
 * first worksheet, so a user who downloads this and uploads it untouched imports
 * nothing rather than a phantom "UCSX-210C-M7" nobody owns.
 */
export async function buildInventoryTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Intersight Dashboard';
  wb.created = new Date();

  const ws = wb.addWorksheet('Inventory', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = COLUMN_SPEC.map(c => ({
    header: c.label,
    key: c.key,
    width: Math.max(c.label.length + 4, c.key === 'notes' ? 28 : c.key === 'model' ? 22 : 14),
  }));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  // Required columns get a red header so the one mandatory field is obvious.
  COLUMN_SPEC.forEach((c, i) => {
    if (c.required) {
      header.getCell(i + 1).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' },
      };
    }
    header.getCell(i + 1).note = `${c.required ? 'Required. ' : 'Optional. '}${c.help}`;
  });

  const colLetter = key => {
    const idx = COLUMN_SPEC.findIndex(c => c.key === key);
    return String.fromCharCode(65 + idx);
  };

  // Dropdowns so Type and Datacenter can't drift out of the accepted vocabulary.
  ws.dataValidations.add(`${colLetter('type')}2:${colLetter('type')}${TEMPLATE_ROWS + 1}`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${TYPES.map(t => t.label).join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Unknown hardware type',
    error: 'Pick a type from the list, or leave blank for "Other".',
  });
  ws.dataValidations.add(`${colLetter('dc')}2:${colLetter('dc')}${TEMPLATE_ROWS + 1}`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${DC_OPTIONS.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Unknown datacenter',
    error: `Pick ${DC_OPTIONS.join(' or ')}. Anything else falls back to ${DC_OPTIONS[0]} on import.`,
  });
  ws.dataValidations.add(`${colLetter('quantity')}2:${colLetter('quantity')}${TEMPLATE_ROWS + 1}`, {
    type: 'whole',
    operator: 'greaterThan',
    formulae: [0],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: 'Quantity must be a whole number',
    error: 'Enter 1 or more, or leave blank for 1.',
  });

  // Sheet 2: the worked example + per-column reference. Never imported.
  const guide = wb.addWorksheet('Example & notes');
  guide.columns = [
    { header: 'Column', width: 16 },
    { header: 'Required', width: 11 },
    { header: 'Example', width: 22 },
    { header: 'Also accepts', width: 34 },
    { header: 'Notes', width: 62 },
  ];
  guide.getRow(1).font = { bold: true };
  for (const c of COLUMN_SPEC) {
    guide.addRow([
      c.label,
      c.required ? 'Yes' : 'No',
      c.example,
      c.aliases.join(', '),
      c.help,
    ]);
  }
  guide.addRow([]);
  guide.addRow(['Only rows on the "Inventory" sheet are imported. This sheet is reference only.']);
  guide.lastRow.font = { italic: true };
  guide.addRow(['Uploading stages rows in the Add hardware form — nothing is saved until you press Save.']);
  guide.lastRow.font = { italic: true };

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Trigger a browser download of the blank template. */
export async function downloadInventoryTemplate(filename = 'spare-inventory-template.xlsx') {
  const blob = await buildInventoryTemplate();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Normalise a header cell for matching: lowercase, strip punctuation/space. */
const normHeader = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** ExcelJS cells can hold rich text, hyperlinks, formula results or dates. */
function cellText(cell) {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return '';
  }
  return String(v);
}

const TYPE_LOOKUP = new Map();
for (const t of TYPES) {
  TYPE_LOOKUP.set(normHeader(t.value), t.value);
  TYPE_LOOKUP.set(normHeader(t.label), t.value);
  // "DIMM / Memory" should also answer to plain "memory", "Drive / SSD" to "ssd".
  for (const part of t.label.split('/')) TYPE_LOOKUP.set(normHeader(part), t.value);
}

function resolveType(raw) {
  const hit = TYPE_LOOKUP.get(normHeader(raw));
  return hit || 'other';
}

/**
 * Match a datacenter cell against the known list, case- and space-insensitively.
 *
 * Returns { value, unrecognised }. An unknown value has to fall back to a real
 * option: the staging form renders DC into a <select> of DC_OPTIONS, and a value
 * that isn't one of them makes the browser silently select the first entry — so
 * an unrecognised "ash2" would save as SITE1 with nothing on screen to say so.
 * We take the same fallback deliberately and warn about it instead.
 */
function resolveDc(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { value: '', unrecognised: false };
  const match = DC_OPTIONS.find(d => d.toLowerCase() === s.toLowerCase());
  return match
    ? { value: match, unrecognised: false }
    : { value: DC_OPTIONS[0], unrecognised: true };
}

/**
 * Parse the first worksheet of an .xlsx file into rows the Add form understands.
 *
 * Resolves to { rows, errors, sheetName, matched, skipped }. `errors` are
 * per-row problems worth showing the user; a fatal problem throws.
 */
export async function parseInventoryWorkbook(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('That workbook has no worksheets.');

  // Find the header row: the first row that matches at least one known column.
  let headerRowNumber = 0;
  let colMap = {};
  const maxScan = Math.min(ws.rowCount, 20);
  for (let r = 1; r <= maxScan; r++) {
    const candidate = {};
    ws.getRow(r).eachCell((cell, colNumber) => {
      const norm = normHeader(cellText(cell));
      if (!norm) return;
      const spec = COLUMN_SPEC.find(s => s.aliases.some(a => normHeader(a) === norm));
      if (spec && candidate[spec.key] == null) candidate[spec.key] = colNumber;
    });
    if (Object.keys(candidate).length > 0) {
      headerRowNumber = r;
      colMap = candidate;
      break;
    }
  }

  if (!headerRowNumber) {
    throw new Error(
      'No recognisable header row found. The sheet needs a header with at least a "Model" column.',
    );
  }
  if (colMap.model == null) {
    throw new Error(
      'A "Model" column is required — that is the only field an inventory item cannot be created without.',
    );
  }

  const rows = [];
  const errors = [];
  let skipped = 0;

  for (let r = headerRowNumber + 1; r <= ws.rowCount; r++) {
    const excelRow = ws.getRow(r);
    const get = key => (colMap[key] != null ? cellText(excelRow.getCell(colMap[key])).trim() : '');

    const model = get('model');
    const serial = get('serial');
    const notes = get('notes');
    const rawQty = get('quantity');

    // Entirely blank line — spacer rows are common in hand-made sheets.
    if (!model && !serial && !notes && !rawQty) { skipped++; continue; }

    if (!model) {
      errors.push(`Row ${r}: skipped — no Model.`);
      continue;
    }

    const qty = parseInt(rawQty, 10);
    if (rawQty && (!Number.isFinite(qty) || qty < 1)) {
      errors.push(`Row ${r}: quantity "${rawQty}" isn't a positive number — using 1.`);
    }

    const rawDc = get('dc');
    const dc = resolveDc(rawDc);
    if (dc.unrecognised) {
      errors.push(
        `Row ${r}: datacenter "${rawDc}" isn't ${DC_OPTIONS.join(' or ')} — set to ${dc.value}, change it before saving.`,
      );
    }

    rows.push({
      type: resolveType(get('type')),
      dc: dc.value || DC_OPTIONS[0],
      model,
      serial: serial.toUpperCase(),
      quantity: Number.isFinite(qty) && qty >= 1 ? qty : 1,
      notes,
    });
  }

  return {
    rows,
    errors,
    skipped,
    sheetName: ws.name,
    matched: Object.keys(colMap).map(k => COLUMN_SPEC.find(s => s.key === k)?.label || k),
  };
}
