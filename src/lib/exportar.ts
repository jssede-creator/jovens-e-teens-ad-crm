/** Exportação de tabelas para CSV e para planilha do Excel, sem dependência externa. */

function baixar(conteudo: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

const escapar = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** CSV com ponto e vírgula e BOM — abre certo no Excel em português. */
export function exportarCSV(nome: string, cabecalho: string[], linhas: (string | number)[][]) {
  const celula = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv =
    "﻿" +
    [cabecalho.map(celula).join(";"), ...linhas.map((l) => l.map(celula).join(";"))].join("\r\n");
  baixar(csv, `${nome}.csv`, "text/csv;charset=utf-8");
}

/**
 * Planilha no formato SpreadsheetML 2003 (.xls), que o Excel e o LibreOffice
 * abrem direto. Evita puxar uma biblioteca de xlsx só para exportar uma tabela.
 */
export function exportarExcel(nome: string, cabecalho: string[], linhas: (string | number)[][]) {
  const celula = (v: string | number) =>
    typeof v === "number"
      ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${escapar(v)}</Data></Cell>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="cabecalho">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapar(nome).slice(0, 31)}">
    <Table>
      <Row>${cabecalho.map((c) => `<Cell ss:StyleID="cabecalho"><Data ss:Type="String">${escapar(c)}</Data></Cell>`).join("")}</Row>
      ${linhas.map((l) => `<Row>${l.map(celula).join("")}</Row>`).join("\n      ")}
    </Table>
  </Worksheet>
</Workbook>`;

  baixar(xml, `${nome}.xls`, "application/vnd.ms-excel;charset=utf-8");
}
