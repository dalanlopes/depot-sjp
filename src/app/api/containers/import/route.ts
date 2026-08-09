import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canImportData } from "@/lib/roles";
import { ARMADORES, PADROES, STATUS_CONTAINER } from "@/lib/types";

// Achata o valor de uma célula do exceljs (que pode vir como texto, número,
// data, fórmula calculada ou rich text) para um valor simples, no mesmo
// formato que o parser abaixo já espera.
function cellPlain(v: ExcelJS.CellValue): string | number | Date | null {
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

async function sheetToMatrix(buffer: Buffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
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

function matrixToObjects(matrix: unknown[][]): Record<string, unknown>[] {
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

interface ParsedRow {
  numero: string;
  armador: string;
  padrao: string;
  status: string;
  entrada: string | null;
  tipo: string | null;
  valorEstimado: number | null;
}

const ARMADOR_ALIASES: Record<string, string> = {
  MSK: "MAERSK",
  MAERSK: "MAERSK",
  MSC: "MSC",
  HPL: "HAPAG",
  HAPAG: "HAPAG",
  ZIM: "ZIM",
  LOG: "LOGIN",
  LOGIN: "LOGIN",
};

const CARGA_ALIASES: Record<string, string> = {
  AL: "AL",
  M: "AL",
  ALIMENTO: "AL",
  CG: "CG",
  E: "CG",
  K: "CG",
  "CARGA GERAL": "CG",
  OU: "OU",
};

const STATUS_ALIASES: Record<string, string> = {
  WE: "AR",
};

function normStatus(raw: string): string {
  let v = raw.trim().toUpperCase();
  if (v.includes(" - ")) v = v.split(" - ")[0].trim();
  if (STATUS_ALIASES[v]) v = STATUS_ALIASES[v];
  return v;
}

function normArmador(raw: string): string {
  const v = raw.trim().toUpperCase();
  return ARMADOR_ALIASES[v] ?? v;
}

function normCarga(raw: string): string {
  const v = raw.trim().toUpperCase();
  return CARGA_ALIASES[v] ?? v;
}

function parseEntrada(raw: unknown): string | null {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString();
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw.trim());
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function parseValor(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/r\$/i, "").trim();
  // Brazilian format: 1.234,56  -> 1234.56
  if (/\d,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((c) => c === null || c === undefined || String(c).trim() === "");
}

function parseTerminalReport(matrix: unknown[][]): ParsedRow[] | null {
  const headerIdx = matrix.findIndex(
    (row) => String(row[0] ?? "").trim().toLowerCase() === "container"
  );
  if (headerIdx === -1) return null;

  const header = matrix[headerIdx].map((c) => String(c ?? "").trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idxContainer = col("container");
  const idxTipo = col("tipo");
  const idxArmador = col("armador");
  const idxStatus = col("status");
  const idxCarga = col("carga");
  const idxEntrada = col("entrada");
  const idxEstimativa = col("estimativa");

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || isBlankRow(row)) break;
    const numero = String(row[idxContainer] ?? "").trim().toUpperCase();
    if (!numero) continue;
    rows.push({
      numero,
      armador: idxArmador >= 0 ? normArmador(String(row[idxArmador] ?? "")) : "",
      padrao: idxCarga >= 0 ? normCarga(String(row[idxCarga] ?? "")) : "",
      status: idxStatus >= 0 ? normStatus(String(row[idxStatus] ?? "")) || "WS" : "WS",
      entrada: idxEntrada >= 0 ? parseEntrada(row[idxEntrada]) : null,
      tipo: idxTipo >= 0 ? String(row[idxTipo] ?? "").trim().toUpperCase() || null : null,
      valorEstimado: idxEstimativa >= 0 ? parseValor(row[idxEstimativa]) : null,
    });
  }
  return rows;
}

function parseSimpleFormat(matrix: unknown[][]): ParsedRow[] {
  const rawRows = matrixToObjects(matrix);
  const norm = (v: unknown) => String(v ?? "").trim().toUpperCase();
  return rawRows.map((r) => ({
    numero: norm(r["numero"] ?? r["Numero"] ?? r["Número"] ?? r["container"] ?? r["Container"]),
    armador: normArmador(norm(r["armador"] ?? r["Armador"])),
    padrao: normCarga(norm(r["padrao"] ?? r["Padrao"] ?? r["Padrão"] ?? r["carga"] ?? r["Carga"])),
    status: normStatus(norm(r["status"] ?? r["Status"])) || "WS",
    entrada: null,
    tipo: (r["tipo"] ?? r["Tipo"]) ? norm(r["tipo"] ?? r["Tipo"]) : null,
    valorEstimado: parseValor(r["estimativa"] ?? r["Estimativa"]),
  }));
}

function valorIguais(a: string | null, b: number | null): boolean {
  const an = a === null ? null : Number(a);
  return (an === null || isNaN(an) ? null : an) === b;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canImportData(session.role)) {
    return NextResponse.json({ error: "Sem permissão para importar dados." }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const matrix = await sheetToMatrix(buffer);

  const rows = parseTerminalReport(matrix) ?? parseSimpleFormat(matrix);

  // Carrega o estoque atual uma única vez, para comparar com a planilha e
  // saber exatamente o que mudou (em vez de sobrescrever tudo às cegas).
  const existentes = await db
    .selectFrom("containers")
    .select(["numero", "armador", "padrao", "status", "entrada", "tipo", "valor_estimado"])
    .execute();
  const porNumero = new Map(existentes.map((c) => [c.numero, c]));

  let criados = 0;
  let atualizados = 0;
  let semAlteracao = 0;
  const mudancasStatus: { numero: string; de: string; para: string }[] = [];
  const errors: { linha: number; motivo: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linha = i + 2;
    if (!row.numero) {
      errors.push({ linha, motivo: "Número do container ausente." });
      continue;
    }
    if (!ARMADORES.includes(row.armador as never)) {
      errors.push({ linha, motivo: `Armador inválido: "${row.armador}" (container ${row.numero}).` });
      continue;
    }
    if (!PADROES.includes(row.padrao as never)) {
      errors.push({ linha, motivo: `Padrão/carga inválido: "${row.padrao}" (container ${row.numero}).` });
      continue;
    }
    if (!STATUS_CONTAINER.includes(row.status as never)) {
      errors.push({ linha, motivo: `Status inválido: "${row.status}" (container ${row.numero}).` });
      continue;
    }

    const atual = porNumero.get(row.numero);
    const mudou =
      !atual ||
      atual.armador !== row.armador ||
      atual.padrao !== row.padrao ||
      atual.status !== row.status ||
      (atual.entrada ?? null) !== (row.entrada ?? null) ||
      (atual.tipo ?? null) !== (row.tipo ?? null) ||
      !valorIguais(atual.valor_estimado, row.valorEstimado);

    if (atual && atual.status !== row.status) {
      mudancasStatus.push({ numero: row.numero, de: atual.status, para: row.status });
    }

    await db
      .insertInto("containers")
      .values({
        numero: row.numero,
        armador: row.armador as never,
        padrao: row.padrao as never,
        status: row.status as never,
        entrada: row.entrada,
        tipo: row.tipo,
        valor_estimado: row.valorEstimado === null ? null : String(row.valorEstimado),
      })
      .onConflict((oc) =>
        oc.column("numero").doUpdateSet({
          armador: row.armador as never,
          padrao: row.padrao as never,
          status: row.status as never,
          entrada: row.entrada,
          tipo: row.tipo,
          valor_estimado: row.valorEstimado === null ? null : String(row.valorEstimado),
          atualizado_em: new Date().toISOString(),
        })
      )
      .execute();

    if (!atual) criados++;
    else if (mudou) atualizados++;
    else semAlteracao++;
  }

  const imported = criados + atualizados + semAlteracao;

  return NextResponse.json({
    imported,
    total: rows.length,
    criados,
    atualizados,
    semAlteracao,
    mudancasStatus,
    errors,
  });
}
