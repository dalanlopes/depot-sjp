import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canImportData } from "@/lib/roles";
import { sheetToMatrix, isBlankRow, parseDataHoraBR } from "@/lib/xlsx-import";

// Planilha de saída do sistema do terminal (não é a mesma coisa que a
// planilha de entrada da Importação). Colunas esperadas, em qualquer ordem:
// Container, Tipo, Entrada, Dt.Saida, Hora, Tara, MGW, Booking, Dias, Car,
// Exportador, Navio, Vg, Lacre Exp., Lacre P., Lacre V.
//
// Container que já tem uma coleta CONCLUIDO (ou seja, já saiu via CM na aba
// Coletas) é ignorado aqui — não conta como saída externa, pra não duplicar
// a mesma saída em dois lugares.

function normHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  container: "container",
  numero: "container",
  tipo: "tipo",
  entrada: "entrada",
  dtsaida: "dataSaida",
  datasaida: "dataSaida",
  saida: "dataSaida",
  hora: "hora",
  tara: "tara",
  mgw: "mgw",
  booking: "booking",
  dias: "dias",
  car: "car",
  exportador: "exportador",
  navio: "navio",
  vg: "vg",
  lacreexp: "lacreExp",
  lacrep: "lacreP",
  lacrev: "lacreV",
};

function parseNumberBR(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  let s = String(raw).trim();
  if (!s) return null;
  if (/\d,\d{1,3}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

interface ParsedSaida {
  numero: string;
  tipo: string | null;
  entrada: Date | null;
  dataSaida: Date | null;
  tara: number | null;
  mgw: number | null;
  booking: string | null;
  dias: number | null;
  car: string | null;
  exportador: string | null;
  navio: string | null;
  vg: string | null;
  lacreExp: string | null;
  lacreP: string | null;
  lacreV: string | null;
}

function parseSheet(matrix: unknown[][]): ParsedSaida[] {
  let headerIdx = -1;
  let colMap: Record<string, number> = {};
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;
    const map: Record<string, number> = {};
    row.forEach((cell, idx) => {
      const norm = normHeader(String(cell ?? ""));
      const key = HEADER_ALIASES[norm];
      if (key && !(key in map)) map[key] = idx;
    });
    if (map.container !== undefined) {
      headerIdx = i;
      colMap = map;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const rows: ParsedSaida[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || isBlankRow(row)) continue;
    const numero = String(row[colMap.container] ?? "").trim().toUpperCase();
    if (!numero) continue;

    const dataSaida =
      colMap.dataSaida !== undefined
        ? parseDataHoraBR(row[colMap.dataSaida], colMap.hora !== undefined ? row[colMap.hora] : undefined)
        : null;

    rows.push({
      numero,
      tipo: colMap.tipo !== undefined ? str(row[colMap.tipo]) : null,
      entrada: colMap.entrada !== undefined ? parseDataHoraBR(row[colMap.entrada]) : null,
      dataSaida,
      tara: colMap.tara !== undefined ? parseNumberBR(row[colMap.tara]) : null,
      mgw: colMap.mgw !== undefined ? parseNumberBR(row[colMap.mgw]) : null,
      booking: colMap.booking !== undefined ? str(row[colMap.booking]) : null,
      dias: colMap.dias !== undefined ? (parseNumberBR(row[colMap.dias]) ?? null) : null,
      car: colMap.car !== undefined ? str(row[colMap.car]) : null,
      exportador: colMap.exportador !== undefined ? str(row[colMap.exportador]) : null,
      navio: colMap.navio !== undefined ? str(row[colMap.navio]) : null,
      vg: colMap.vg !== undefined ? str(row[colMap.vg]) : null,
      lacreExp: colMap.lacreExp !== undefined ? str(row[colMap.lacreExp]) : null,
      lacreP: colMap.lacreP !== undefined ? str(row[colMap.lacreP]) : null,
      lacreV: colMap.lacreV !== undefined ? str(row[colMap.lacreV]) : null,
    });
  }
  return rows;
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const matrix = await sheetToMatrix(buffer, file.name);
    const rows = parseSheet(matrix);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Não encontrei uma coluna \"Container\" nessa planilha. Verifique o arquivo e envie novamente." },
        { status: 400 }
      );
    }

    // Containers já coletados via CM (avulso ou vindo de programação) — a
    // saída deles já está contabilizada, então ignoramos aqui.
    const numeros = rows.map((r) => r.numero);
    const jaColetadosRows = await db
      .selectFrom("coletas")
      .select("container_numero")
      .where("status", "=", "CONCLUIDO")
      .where("container_numero", "in", numeros)
      .execute();
    const jaColetadosSet = new Set(jaColetadosRows.map((r) => r.container_numero));

    const existentesRows = await db
      .selectFrom("saidas_externas")
      .selectAll()
      .where("container_numero", "in", numeros)
      .execute();
    const existentesMap = new Map(existentesRows.map((r) => [r.container_numero, r]));

    function igual(existente: (typeof existentesRows)[number] | undefined, row: ParsedSaida): boolean {
      if (!existente) return false;
      const num = (v: string | null) => (v === null ? null : Number(v));
      return (
        (existente.tipo ?? null) === row.tipo &&
        (existente.data_saida ? new Date(existente.data_saida as unknown as string).getTime() : null) ===
          (row.dataSaida ? row.dataSaida.getTime() : null) &&
        num(existente.tara) === row.tara &&
        num(existente.mgw) === row.mgw &&
        (existente.booking ?? null) === row.booking &&
        (existente.dias_planilha ?? null) === (row.dias === null ? null : Math.round(row.dias)) &&
        (existente.car ?? null) === row.car &&
        (existente.exportador ?? null) === row.exportador &&
        (existente.navio ?? null) === row.navio &&
        (existente.vg ?? null) === row.vg &&
        (existente.lacre_exp ?? null) === row.lacreExp &&
        (existente.lacre_p ?? null) === row.lacreP &&
        (existente.lacre_v ?? null) === row.lacreV
      );
    }

    let criados = 0;
    let atualizados = 0;
    let semAlteracao = 0;
    const jaSaiuPorCM: string[] = [];
    const errors: { linha: number; motivo: string }[] = [];
    const processados = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linha = i + 2;

      if (jaColetadosSet.has(row.numero)) {
        if (!jaSaiuPorCM.includes(row.numero)) jaSaiuPorCM.push(row.numero);
        continue;
      }
      if (!row.dataSaida) {
        errors.push({ linha, motivo: `Container ${row.numero}: data de saída ausente ou inválida.` });
        continue;
      }

      const existente = existentesMap.get(row.numero);
      if (!processados.has(row.numero) && igual(existente, row)) {
        semAlteracao++;
        processados.add(row.numero);
        continue;
      }

      await db
        .insertInto("saidas_externas")
        .values({
          container_numero: row.numero,
          tipo: row.tipo,
          entrada: row.entrada ? row.entrada.toISOString() : null,
          data_saida: row.dataSaida.toISOString(),
          tara: row.tara === null ? null : String(row.tara),
          mgw: row.mgw === null ? null : String(row.mgw),
          booking: row.booking,
          dias_planilha: row.dias === null ? null : Math.round(row.dias),
          car: row.car,
          exportador: row.exportador,
          navio: row.navio,
          vg: row.vg,
          lacre_exp: row.lacreExp,
          lacre_p: row.lacreP,
          lacre_v: row.lacreV,
          criado_por_id: session.userId,
        })
        .onConflict((oc) =>
          oc.column("container_numero").doUpdateSet({
            tipo: row.tipo,
            entrada: row.entrada ? row.entrada.toISOString() : null,
            data_saida: row.dataSaida!.toISOString(),
            tara: row.tara === null ? null : String(row.tara),
            mgw: row.mgw === null ? null : String(row.mgw),
            booking: row.booking,
            dias_planilha: row.dias === null ? null : Math.round(row.dias),
            car: row.car,
            exportador: row.exportador,
            navio: row.navio,
            vg: row.vg,
            lacre_exp: row.lacreExp,
            lacre_p: row.lacreP,
            lacre_v: row.lacreV,
            atualizado_em: new Date().toISOString(),
          })
        )
        .execute();

      if (existente || processados.has(row.numero)) atualizados++;
      else criados++;
      processados.add(row.numero);
    }

    return NextResponse.json({
      total: rows.length,
      criados,
      atualizados,
      semAlteracao,
      jaSaiuPorCM,
      errors,
    });
  } catch (err) {
    console.error("Erro na importação de saída externa:", err);
    const msg = err instanceof Error ? err.message : "Erro inesperado ao processar a planilha.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
