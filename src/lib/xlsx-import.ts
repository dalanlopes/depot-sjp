import ExcelJS from "exceljs";
import { Readable } from "stream";

// Utilitários compartilhados para ler planilhas enviadas (.xlsx/.csv) e
// transformar em matriz de células / objetos por linha. Usado pelos imports
// de containers (entrada) e de saídas externas.

// Achata o valor de uma célula do exceljs (que pode vir como texto, número,
// data, fórmula calculada ou rich text) para um valor simples.
export function cellPlain(v: ExcelJS.CellValue): string | number | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const obj = v as unknown as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((r) => r.text).join("");
    }
    if ("result" in obj) {
      const r = obj.result;
      if (r instanceof Date || typeof r === "number" || typeof r === "string") return r;
      return null;
    }
    if ("text" in obj) return String(obj.text);
    return null;
  }
  return v as string | number;
}

export function worksheetToMatrix(worksheet: ExcelJS.Worksheet): unknown[][] {
  const matrix: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const vals = row.values as ExcelJS.CellValue[];
    const linha: unknown[] = [];
    for (let c = 1; c < vals.length; c++) {
      linha.push(cellPlain(vals[c]));
    }
    matrix.push(linha);
  });
  return matrix;
}

// Lê o arquivo enviado (.xlsx ou .csv) e devolve a matriz de células.
// .xls (formato binário antigo do Excel 97-2003) não é suportado — pedimos
// para o usuário salvar como .xlsx ou .csv.
export async function sheetToMatrix(buffer: Buffer, filename: string): Promise<unknown[][]> {
  const lower = filename.toLowerCase();
  const workbook = new ExcelJS.Workbook();

  if (lower.endsWith(".csv")) {
    const worksheet = await workbook.csv.read(Readable.from(buffer) as never);
    return worksheetToMatrix(worksheet);
  }

  if (lower.endsWith(".xls")) {
    throw new Error(
      "Formato .xls (Excel 97-2003) não é suportado. Abra a planilha no Excel e salve como .xlsx ou .csv, depois envie novamente."
    );
  }

  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new Error(
      "Não foi possível ler o arquivo como planilha Excel (.xlsx). Verifique se o arquivo não está corrompido ou salve como .csv."
    );
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("A planilha enviada não tem nenhuma aba com dados.");
  }
  return worksheetToMatrix(worksheet);
}

// O ExcelJS ancora células de data (sem fuso) no UTC — uma célula "10/08/2026"
// vira o instante 2026-08-10T00:00:00Z. Se guardarmos isso direto num
// timestamptz, ao exibir/filtrar em horário do Brasil (-03:00) o dia pode
// "voltar" pro dia anterior (00:00 UTC = 21:00 do dia anterior no Brasil).
// Por isso extraímos ano/mês/dia com os getters UTC (que preservam o que a
// planilha realmente disse) e remontamos o instante já ancorado em -03:00,
// com a hora informada (ou meio-dia como padrão, se não houver).
export function excelDateParts(raw: Date): { y: number; m: number; d: number } {
  return { y: raw.getUTCFullYear(), m: raw.getUTCMonth() + 1, d: raw.getUTCDate() };
}

export function brDateTimeISO(y: number, m: number, d: number, h = 12, min = 0): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p2(m)}-${p2(d)}T${p2(h)}:${p2(min)}:00-03:00`;
}

// Combina uma célula de data (Date do exceljs, ou texto dd/mm/yyyy) com uma
// célula de hora opcional (Date/número/"HH:MM"), devolvendo o instante já
// corrigido pro horário do Brasil.
export function parseDataHoraBR(dateRaw: unknown, horaRaw?: unknown): Date | null {
  let y: number, m: number, d: number;

  if (dateRaw instanceof Date && !isNaN(dateRaw.getTime())) {
    ({ y, m, d } = excelDateParts(dateRaw));
  } else if (typeof dateRaw === "string" && dateRaw.trim()) {
    const s = dateRaw.trim();
    const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (br) {
      d = Number(br[1]);
      m = Number(br[2]);
      y = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    } else {
      const parsed = new Date(s);
      if (isNaN(parsed.getTime())) return null;
      ({ y, m, d } = excelDateParts(parsed));
    }
  } else if (typeof dateRaw === "number") {
    // Serial de data do Excel (dias desde 1899-12-30), sempre UTC-anchored.
    const ms = Math.round((dateRaw - 25569) * 86400 * 1000);
    const parsed = new Date(ms);
    if (isNaN(parsed.getTime())) return null;
    ({ y, m, d } = excelDateParts(parsed));
  } else {
    return null;
  }

  let h = 12;
  let min = 0;
  if (horaRaw instanceof Date && !isNaN(horaRaw.getTime())) {
    h = horaRaw.getUTCHours();
    min = horaRaw.getUTCMinutes();
  } else if (typeof horaRaw === "number") {
    const totalMin = Math.round(horaRaw * 24 * 60);
    h = Math.floor(totalMin / 60) % 24;
    min = totalMin % 60;
  } else if (typeof horaRaw === "string" && horaRaw.trim()) {
    const hm = horaRaw.trim().match(/^(\d{1,2}):(\d{2})/);
    if (hm) {
      h = Number(hm[1]);
      min = Number(hm[2]);
    }
  }

  const iso = brDateTimeISO(y, m, d, h, min);
  const result = new Date(iso);
  return isNaN(result.getTime()) ? null : result;
}

export function isBlankRow(row: unknown[]): boolean {
  return row.every((c) => c === null || c === undefined || String(c).trim() === "");
}

export function matrixToObjects(matrix: unknown[][]): Record<string, unknown>[] {
  if (matrix.length === 0) return [];
  const header = matrix[0].map((c) => String(c ?? "").trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || isBlankRow(row)) continue;
    const obj: Record<string, unknown> = {};
    header.forEach((h, idx) => {
      if (h) obj[h] = row[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}
