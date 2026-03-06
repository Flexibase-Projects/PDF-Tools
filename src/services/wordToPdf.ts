/**
 * Conversão de Word (DOCX) para PDF no navegador.
 * Lê o XML do DOCX (um <p> por parágrafo), preserva quebras, tabs e formatação.
 * Usa html2canvas + jsPDF (HTML → PDF).
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_DPI = 96;
const SCALE = 2;
const CONTENT_WIDTH_PX = (A4_WIDTH_MM / 25.4) * PDF_DPI * (SCALE / 2);

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_RELS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Indentação em px: left (margem esquerda), firstLine (primeira linha). */
interface ParagraphIndent {
  leftPx: number;
  firstLinePx: number;
}

const parser = new DOMParser();

/** Converte twips (1/20 pt) para px. */
function twipsToPx(twips: number): number {
  return Math.round((twips / 20) * (PDF_DPI / 72));
}

/**
 * Extrai indentação de cada parágrafo do documento já parseado (w:p diretos no body).
 */
function extractParagraphIndentsFromDoc(doc: Document): ParagraphIndent[] {
  const indents: ParagraphIndent[] = [];
  const body = doc.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) return indents;

  const collectParagraphs = (node: Element | null): void => {
    if (!node) return;
    const ns = node.namespaceURI;
    const local = node.localName;

    if (ns === WORD_NS && local === 'p') {
      let leftPx = 0;
      let firstLinePx = 0;
      const pPr = node.getElementsByTagNameNS(WORD_NS, 'pPr')[0];
      if (pPr) {
        const ind = pPr.getElementsByTagNameNS(WORD_NS, 'ind')[0];
        if (ind) {
          const left = ind.getAttribute('left');
          const firstLine = ind.getAttribute('firstLine');
          const hanging = ind.getAttribute('hanging');
          if (left) leftPx = twipsToPx(parseInt(left, 10));
          if (firstLine) firstLinePx = twipsToPx(parseInt(firstLine, 10));
          else if (hanging) firstLinePx = -twipsToPx(parseInt(hanging, 10));
        }
      }
      indents.push({ leftPx, firstLinePx });
      return;
    }

    for (let i = 0; i < node.children.length; i++) {
      collectParagraphs(node.children[i]);
    }
  };

  for (let i = 0; i < body.children.length; i++) {
    collectParagraphs(body.children[i]);
  }
  return indents;
}

/** Mapa de rId (hyperlink) para URL. */
function parseRels(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const doc = parser.parseFromString(relsXml, 'application/xml');
    const rels = doc.getElementsByTagNameNS(RELS_NS, 'Relationship');
    for (let i = 0; i < rels.length; i++) {
      const id = rels[i].getAttribute('Id');
      const target = rels[i].getAttribute('Target');
      if (id && target) map.set(id, target);
    }
  } catch {
    // ignora falha no rels
  }
  return map;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converte um run (w:r) em HTML: texto, <br/>, tab, negrito, itálico.
 */
function runToHtml(run: Element): string {
  const rPr = run.getElementsByTagNameNS(WORD_NS, 'rPr')[0];
  const bold = rPr?.getElementsByTagNameNS(WORD_NS, 'b').length > 0;
  const italic = rPr?.getElementsByTagNameNS(WORD_NS, 'i').length > 0;

  let content = '';
  for (let i = 0; i < run.children.length; i++) {
    const child = run.children[i];
    const local = child.localName;
    const ns = child.namespaceURI;
    if (ns !== WORD_NS) continue;
    if (local === 't') {
      content += escapeHtml((child as Element).textContent || '');
    } else if (local === 'br') {
      content += '<br/>';
    } else if (local === 'tab') {
      content += '\u00A0\u00A0\u00A0\u00A0'; // tab como espaços
    } else if (local === 'rPr') {
      // já tratado acima
    }
    // ignora fldChar, instrText etc.
  }

  if (bold) content = '<strong>' + content + '</strong>';
  if (italic) content = '<em>' + content + '</em>';
  return content;
}

/**
 * Converte um parágrafo (w:p) em HTML: um <p> com conteúdo de runs e hyperlinks.
 */
function paragraphToHtml(p: Element, rels: Map<string, string>): string {
  let content = '';
  for (let i = 0; i < p.children.length; i++) {
    const child = p.children[i];
    const local = child.localName;
    const ns = child.namespaceURI;
    if (ns !== WORD_NS) continue;
    if (local === 'pPr') continue; // propriedades do parágrafo
    if (local === 'r') {
      content += runToHtml(child as Element);
    } else if (local === 'hyperlink') {
      const el = child as Element;
      const rId = el.getAttributeNS(OFFICE_RELS_NS, 'id') || el.getAttribute('r:id') || el.getAttribute('id');
      const href = rId ? rels.get(rId) : '';
      let linkContent = '';
      const runs = (child as Element).getElementsByTagNameNS(WORD_NS, 'r');
      for (let j = 0; j < runs.length; j++) {
        linkContent += runToHtml(runs[j]);
      }
      if (href) {
        const safeHref = escapeHtml(href);
        content += '<a href="' + safeHref + '">' + (linkContent || href) + '</a>';
      } else {
        content += linkContent;
      }
    }
  }
  const trimmed = content.trim();
  const inner = trimmed.length === 0 ? '\u00A0' : content;
  return '<p>' + inner + '</p>';
}

/**
 * Converte o document.xml do Word em HTML, preservando um <p> por parágrafo,
 * quebras de linha (w:br), tabs, negrito, itálico e hyperlinks.
 */
function docxDocToHtml(doc: Document, rels: Map<string, string>): string {
  const body = doc.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) return '<p></p>';

  const parts: string[] = [];
  for (let i = 0; i < body.children.length; i++) {
    const node = body.children[i];
    const ns = node.namespaceURI;
    const local = node.localName;
    if (ns === WORD_NS && local === 'p') {
      parts.push(paragraphToHtml(node as Element, rels));
    }
    // ignora w:tbl, w:sectPr etc. por simplicidade
  }
  return parts.join('');
}

/**
 * Aplica array de indentação aos elementos de bloco do container (p, h1, h2, h3, li)
 * na ordem em que aparecem no DOM.
 */
function applyIndentsToHtml(container: HTMLElement, indents: ParagraphIndent[]): void {
  const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'LI'];
  let index = 0;

  const walk = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (blockTags.includes(el.tagName) && index < indents.length) {
      const { leftPx, firstLinePx } = indents[index++];
      if (leftPx > 0) el.style.marginLeft = `${leftPx}px`;
      if (firstLinePx !== 0) el.style.textIndent = `${firstLinePx}px`;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i]);
    }
  };

  walk(container);
}

export async function convertWordToPdf(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const docXml = await zip.file('word/document.xml')?.async('text');
  const relsXml = (await zip.file('word/_rels/document.xml.rels')?.async('text')) || '';

  if (!docXml) {
    throw new Error('Arquivo Word inválido: word/document.xml não encontrado.');
  }

  const doc = parser.parseFromString(docXml, 'application/xml');
  const rels = parseRels(relsXml);
  const indents = extractParagraphIndentsFromDoc(doc);
  const html = docxDocToHtml(doc, rels);

  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${CONTENT_WIDTH_PX}px;
    padding: 40px;
    background: #fff;
    color: #000;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    box-sizing: border-box;
    overflow: visible;
  `;
  container.innerHTML = html;

  container.classList.add('word-pdf-container');
  const style = document.createElement('style');
  style.textContent = `
    .word-pdf-container p, .word-pdf-container h1, .word-pdf-container h2,
    .word-pdf-container h3, .word-pdf-container h4, .word-pdf-container h5,
    .word-pdf-container h6, .word-pdf-container li {
      display: block;
      margin: 0.4em 0;
      white-space: pre-wrap;
    }
    .word-pdf-container p:first-child, .word-pdf-container h1:first-child { margin-top: 0; }
    .word-pdf-container p.word-pdf-empty,
    .word-pdf-container p:empty {
      min-height: 1.5em;
      margin: 0.25em 0;
    }
  `;
  container.insertBefore(style, container.firstChild);
  applyIndentsToHtml(container, indents);

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: container.offsetWidth,
      height: container.scrollHeight,
      windowWidth: container.offsetWidth,
      windowHeight: container.scrollHeight,
    });

    const imgW = canvas.width;
    const imgH = canvas.height;
    const pageHeightPx = Math.floor(imgW * (A4_HEIGHT_MM / A4_WIDTH_MM));

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let offsetY = 0;
    let pageNum = 0;

    while (offsetY < imgH) {
      if (pageNum > 0) {
        pdf.addPage();
      }

      const sliceHeight = Math.min(pageHeightPx, imgH - offsetY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = imgW;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2d context not available');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, imgW, sliceHeight);
      ctx.drawImage(canvas, 0, offsetY, imgW, sliceHeight, 0, 0, imgW, sliceHeight);

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const heightMm = (sliceHeight / imgW) * A4_WIDTH_MM;
      pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, heightMm);

      offsetY += pageHeightPx;
      pageNum++;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

export async function downloadWordAsPdf(
  file: File,
  fileName: string = 'documento.pdf'
): Promise<void> {
  const finalName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const blob = await convertWordToPdf(file);
  saveAs(blob, finalName);
}
