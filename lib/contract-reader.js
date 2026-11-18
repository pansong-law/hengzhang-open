import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { invalid } from "./money.js";

const execFileAsync = promisify(execFile);
export const MAX_CONTRACT_BYTES = 30 * 1024 * 1024;
export const MAX_CONTRACT_CHARS = 36000;

const JXA_PDF_SCRIPT = `
ObjC.import("Foundation");
ObjC.import("PDFKit");
ObjC.import("Vision");
ObjC.import("AppKit");

function run(argv) {
  const filePath = argv[0];
  const maxPages = Math.max(1, Number(argv[1] || 25));
  const url = $.NSURL.fileURLWithPath($(filePath));
  const doc = $.PDFDocument.alloc.initWithURL(url);
  if (!doc || doc.isNil()) {
    throw new Error("无法解析该 PDF 文件，请确认文件未损坏且未加密");
  }
  if (doc.isLocked) {
    throw new Error("该 PDF 文件受密码保护，请先解除密码后再识别");
  }
  const pageCount = Number(doc.pageCount);
  const limit = Math.min(pageCount, maxPages);
  const pages = [];
  let ocrPages = 0;

  for (let i = 0; i < limit; i++) {
    const page = doc.pageAtIndex(i);
    if (!page || page.isNil()) continue;
    const rawStr = page.string;
    const directText = rawStr && !rawStr.isNil() ? String(ObjC.unwrap(rawStr)).trim() : "";
    if (directText.replace(/\\s+/g, "").length >= 30) {
      pages.push(directText);
      continue;
    }
    const thumb = page.thumbnailOfSizeForBox($.NSMakeSize(1800, 1800), $.kPDFDisplayBoxMediaBox);
    if (!thumb || thumb.isNil()) {
      if (directText) pages.push(directText);
      continue;
    }
    const tiff = thumb.TIFFRepresentation;
    if (!tiff || tiff.isNil()) {
      if (directText) pages.push(directText);
      continue;
    }
    const req = $.VNRecognizeTextRequest.alloc.init;
    req.recognitionLevel = $.VNRequestTextRecognitionLevelAccurate;
    req.usesLanguageCorrection = true;
    req.recognitionLanguages = $(["zh-Hans", "zh-Hant", "en-US"]);
    const handler = $.VNImageRequestHandler.alloc.initWithDataOptions(tiff, $.NSDictionary.dictionary);
    const ok = handler.performRequestsError($([req]), null);
    if (ok) {
      const results = req.results;
      const lines = [];
      const count = results ? Number(results.count) : 0;
      for (let j = 0; j < count; j++) {
        const top = results.objectAtIndex(j).topCandidates(1);
        if (top && Number(top.count) > 0) {
          lines.push(String(ObjC.unwrap(top.objectAtIndex(0).string)));
        }
      }
      const ocrText = lines.join("\\n").trim();
      if (ocrText) {
        ocrPages++;
        pages.push(ocrText);
        continue;
      }
    }
    if (directText) pages.push(directText);
  }

  return JSON.stringify({
    pages: pageCount,
    processed_pages: limit,
    ocr_pages: ocrPages,
    text: pages.join("\\n\\n")
  });
}
`;

function decodeXmlEntities(str) {
  return String(str || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&amp;/g, "&");
}

function wordXmlToText(xml) {
  const withBreaks = String(xml || "")
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:(?:p|tr)>/g, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeXmlEntities(stripped)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function extractDocxFromBuffer(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let eocdOffset = -1;
  const minEocdOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minEocdOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw Error("不是有效的 .docx 压缩结构");
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  let ptr = cdOffset;
  const xmlParts = [];

  for (let i = 0; i < totalEntries && ptr + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);
    const name = buf
      .subarray(ptr + 46, ptr + 46 + nameLen)
      .toString("utf8");
    ptr += 46 + nameLen + extraLen + commentLen;

    if (!/^word\/(?:document|header\d+|footer\d+)\.xml$/i.test(name)) continue;
    if (
      localHeaderOffset + 30 > buf.length ||
      buf.readUInt32LE(localHeaderOffset) !== 0x04034b50
    )
      continue;
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) continue;
    const raw = buf.subarray(dataStart, dataEnd);
    let content;
    if (method === 0) content = raw;
    else if (method === 8) content = zlib.inflateRawSync(raw);
    else continue;
    xmlParts.push({
      name,
      text: wordXmlToText(content.toString("utf8")),
    });
  }

  if (!xmlParts.length) throw Error("未能从 .docx 中读取文档正文");
  xmlParts.sort((a, b) => {
    const rank = (n) =>
      n.includes("header") ? 0 : n.includes("document") ? 1 : 2;
    return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
  });
  return xmlParts
    .map((p) => p.text)
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function detectContractFormat(filename, buffer) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  if (
    ext === ".pdf" ||
    (buffer?.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-")
  )
    return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".doc") return "doc";
  if (
    buffer?.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  )
    return "docx";
  throw invalid("仅支持 PDF（.pdf）或 Word（.docx / .doc）合同文件");
}

export async function extractContractText({
  filename,
  buffer,
  maxChars = MAX_CONTRACT_CHARS,
} = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length)
    throw invalid("合同文件为空，请重新选择");
  if (buffer.length > MAX_CONTRACT_BYTES)
    throw invalid("合同文件不能超过 30 MB");

  const format = detectContractFormat(filename, buffer);
  let text = "",
    pages = null,
    ocrPages = 0;

  if (format === "docx") {
    try {
      text = extractDocxFromBuffer(buffer);
    } catch {
      text = "";
    }
  }

  if (!text && (format === "docx" || format === "doc")) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-contract-doc-"));
    const tempFile = path.join(tempDir, "contract." + format);
    try {
      fs.writeFileSync(tempFile, buffer, { mode: 0o600 });
      const { stdout } = await execFileAsync(
        "/usr/bin/textutil",
        ["-convert", "txt", "-stdout", tempFile],
        { timeout: 20000, maxBuffer: 16 * 1024 * 1024 },
      );
      text = String(stdout || "").trim();
    } catch {
      throw invalid("无法读取该 Word 合同文件，请另存为 .docx 或 .pdf 后重试");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  if (format === "pdf") {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hz-contract-pdf-"));
    const tempFile = path.join(tempDir, "contract.pdf");
    try {
      fs.writeFileSync(tempFile, buffer, { mode: 0o600 });
      const { stdout } = await execFileAsync(
        "/usr/bin/osascript",
        ["-l", "JavaScript", "-e", JXA_PDF_SCRIPT, tempFile, "25"],
        { timeout: 60000, maxBuffer: 16 * 1024 * 1024 },
      );
      const parsed = JSON.parse(String(stdout || "").trim());
      text = String(parsed.text || "").trim();
      pages = parsed.pages ?? null;
      ocrPages = parsed.ocr_pages ?? 0;
    } catch (error) {
      const msg = String(error?.stderr || error?.message || "");
      if (msg.includes("密码"))
        throw invalid("该 PDF 合同受密码保护，请先解除密码后再识别");
      throw invalid("无法解析该 PDF 合同文件，请确认文件未损坏");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  if (normalized.replace(/\s+/g, "").length < 10)
    throw invalid("未能在合同文件中识别出有效文字，请确认文件内容清晰可读");

  const truncated = normalized.slice(0, maxChars);
  return {
    format,
    pages,
    ocr_pages: ocrPages,
    char_count: normalized.length,
    truncated: normalized.length > maxChars,
    text: truncated,
  };
}
