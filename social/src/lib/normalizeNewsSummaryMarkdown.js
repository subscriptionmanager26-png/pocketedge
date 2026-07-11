const TABLE_HEADER_PATTERN =
  /^(.*?)(?:\:\s*)?(\|?\s*(?:Issuer|Company|Name|Particulars|Security|Bond|Instrument)\s*\|.+)$/i;

const TABLE_SEPARATOR_PATTERN = /^\s*\|?\s*[-:\s|]+\s*$/;

/**
 * Stock news summaries from Supabase often use wire-service formatting rather than
 * valid markdown (inline bullets padded with spaces, ** segment ** delimiters, pipe tables).
 */
export function normalizeNewsSummaryMarkdown(raw) {
  if (!raw?.trim()) return '';

  let text = raw.replace(/\r\n/g, '\n').trim();
  text = text.replace(/\\-/g, '-');

  text = text.replace(/\s{2,}\*\s+/g, '\n* ');

  const delimiterCount = (text.match(/\*\*/g) ?? []).length;
  if (text.startsWith('**') && delimiterCount >= 4) {
    text = normalizeBoldDelimitedBullets(text);
  }

  text = normalizeMarkdownTables(text);
  text = splitLongParagraphs(text, 3);

  return text.trim();
}

function normalizeBoldDelimitedBullets(text) {
  const parts = text
    .split(/\*\*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return text;

  const lines = [];
  for (const part of parts) {
    const [headline, ...footerLines] = part.split('\n').map((line) => line.trim()).filter(Boolean);
    if (headline) lines.push(`- **${headline}**`);
    if (footerLines.length) {
      lines.push('', footerLines.join('\n'));
    }
  }

  return lines.join('\n');
}

function normalizeMarkdownTables(text) {
  const lines = text.split('\n');
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const tableBlock = extractTableBlock(lines, index);

    if (tableBlock) {
      output.push(tableBlock.markdown.trimEnd());
      index = tableBlock.nextIndex;
      continue;
    }

    output.push(line);
    index += 1;
  }

  return output.join('\n');
}

function extractTableBlock(lines, startIndex) {
  let index = startIndex;
  let intro = '';
  let headerLine = lines[index];

  const inlineMatch = headerLine.match(TABLE_HEADER_PATTERN);
  if (inlineMatch) {
    intro = inlineMatch[1].trim();
    headerLine = inlineMatch[2].trim();
  } else if (!looksLikeTableRow(headerLine)) {
    return null;
  }

  const headerCells = splitTableRow(headerLine);
  if (headerCells.length < 2) return null;

  index += 1;
  if (index >= lines.length || !TABLE_SEPARATOR_PATTERN.test(lines[index])) {
    return null;
  }

  const separatorLine = normalizeSeparatorRow(lines[index], headerCells.length);
  index += 1;

  const bodyRows = [];
  while (index < lines.length) {
    const rowLine = lines[index];
    if (!rowLine.trim()) break;
    if (!rowLine.includes('|')) break;
    if (TABLE_SEPARATOR_PATTERN.test(rowLine)) break;
    if (rowLine.trim().startsWith('*') && !rowLine.includes('|')) break;

    bodyRows.push(...splitConcatenatedTableRows(rowLine));
    index += 1;
  }

  if (!bodyRows.length) return null;

  const markdown = [
    intro,
    '',
    formatTableRow(headerCells),
    separatorLine,
    ...bodyRows.map((row) => formatTableRow(splitTableRow(row))),
  ]
    .filter((part, partIndex) => part !== '' || partIndex > 0)
    .join('\n');

  return { markdown, nextIndex: index };
}

function looksLikeTableRow(line) {
  if (!line?.includes('|')) return false;
  return splitTableRow(line).length >= 2;
}

function splitTableRow(line) {
  return line
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell, cellIndex, cells) => cell !== '' || (cellIndex > 0 && cellIndex < cells.length - 1));
}

function formatTableRow(cells) {
  return `| ${cells.join(' | ')} |`;
}

function normalizeSeparatorRow(_line, cellCount) {
  const count = Math.max(cellCount, 2);
  return `| ${Array(count).fill('---').join(' | ')} |`;
}

function splitConcatenatedTableRows(line) {
  const pipeCount = (line.match(/\|/g) ?? []).length;
  const expectedPipes = Math.max(splitTableRow(line).length - 1, 5);

  if (pipeCount <= expectedPipes + 1) {
    return [line.trim()];
  }

  const rows = [];
  let current = line.trim();

  while (current) {
    const cells = splitTableRow(current);
    if (cells.length <= expectedPipes + 1) {
      rows.push(formatTableRow(cells));
      break;
    }

    const rowCells = cells.slice(0, expectedPipes + 1);
    rows.push(formatTableRow(rowCells));
    current = cells.slice(expectedPipes + 1).join(' | ');
  }

  return rows;
}

function splitLongParagraphs(text, maxSentences) {
  const blocks = splitPreservingStructures(text);
  return blocks
    .map((block) => {
      if (block.type !== 'prose') return block.content;
      return chunkProseParagraph(block.content, maxSentences);
    })
    .join('\n\n');
}

function splitPreservingStructures(text) {
  const lines = text.split('\n');
  const blocks = [];
  let proseBuffer = [];
  let structuredBuffer = [];

  const flushProse = () => {
    if (!proseBuffer.length) return;
    blocks.push({ type: 'prose', content: proseBuffer.join('\n').trim() });
    proseBuffer = [];
  };

  const flushStructured = () => {
    if (!structuredBuffer.length) return;
    blocks.push({ type: 'structured', content: structuredBuffer.join('\n') });
    structuredBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushProse();
      flushStructured();
      continue;
    }

    if (isStructuredLine(trimmed)) {
      flushProse();
      structuredBuffer.push(trimmed);
      continue;
    }

    flushStructured();
    proseBuffer.push(trimmed);
  }

  flushProse();
  flushStructured();
  return blocks;
}

function isStructuredLine(trimmed) {
  return (
    trimmed.startsWith('|') ||
    TABLE_SEPARATOR_PATTERN.test(trimmed) ||
    trimmed.startsWith('- ') ||
    trimmed.startsWith('* ') ||
    /^\d+\.\s/.test(trimmed)
  );
}

function chunkProseParagraph(paragraph, maxSentences) {
  let normalized = paragraph.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  normalized = addSentenceSpacing(normalized);

  const sentences = splitSentences(normalized);
  if (sentences.length <= maxSentences) {
    return sentences.join(' ');
  }

  const chunks = [];
  for (let index = 0; index < sentences.length; index += maxSentences) {
    chunks.push(sentences.slice(index, index + maxSentences).join(' '));
  }

  return chunks.join('\n\n');
}

function addSentenceSpacing(text) {
  return text.replace(/([.!?])([A-Z(])/g, (match, punct, next, offset, str) => {
    if (punct !== '.') return `${punct} ${next}`;

    const tail = str.slice(offset + 1);
    if (/^[A-Z]{1,3}(?:\s|$|[,)])/.test(tail) && !/^[A-Z][a-z]/.test(tail)) {
      return match;
    }

    return `${punct} ${next}`;
  });
}

function splitSentences(text) {
  const parts = [];
  let start = 0;
  const regex = /(?<!\d)\.(?:\s+)(?=[A-Z"(])|(?<=[!?])(?:\s+)(?=[A-Z"(])/g;
  let match = regex.exec(text);

  while (match) {
    parts.push(text.slice(start, match.index + 1).trim());
    start = match.index + match[0].length;
    match = regex.exec(text);
  }

  if (start < text.length) {
    parts.push(text.slice(start).trim());
  }

  return parts.filter(Boolean);
}
