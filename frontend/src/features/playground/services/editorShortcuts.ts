/**
 * Text manipulation helpers for SQL editor keyboard shortcuts.
 * Supports cross-platform behavior for Mac (⌘), Windows (Ctrl), and Linux (Ctrl).
 */

export interface TextEditResult {
  text: string;
  newStart: number;
  newEnd: number;
}

/**
 * Toggles SQL line comment (-- ) on current line or multi-line selection.
 */
export function toggleComment(query: string, start: number, end: number): TextEditResult {
  const lineStart = query.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = query.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? query.length : lineEndIdx;

  const targetSlice = query.slice(lineStart, lineEnd);
  const lines = targetSlice.split('\n');

  const allCommented = lines.every((l) => l.trim().length === 0 || l.trim().startsWith('--'));

  let newLines: string[];
  if (allCommented) {
    // Uncomment all lines
    newLines = lines.map((l) => {
      const match = l.match(/^(\s*)--\s?(.*)$/);
      return match ? match[1] + match[2] : l;
    });
  } else {
    // Comment all non-empty lines
    newLines = lines.map((l) => (l.trim().length === 0 ? l : `-- ${l}`));
  }

  const replaced = newLines.join('\n');
  const newQuery = query.slice(0, lineStart) + replaced + query.slice(lineEnd);
  const diff = replaced.length - targetSlice.length;
  const newStart = Math.max(lineStart, start + (allCommented ? -3 : 3));
  const newEnd = Math.max(newStart, end + diff);

  return { text: newQuery, newStart, newEnd };
}

/**
 * Indents or outdents lines by 2 spaces.
 */
export function indentLines(
  query: string,
  start: number,
  end: number,
  outdent: boolean
): TextEditResult {
  // Single cursor without selection and indenting: simply insert 2 spaces
  if (!outdent && start === end) {
    const newQuery = query.slice(0, start) + '  ' + query.slice(end);
    return { text: newQuery, newStart: start + 2, newEnd: start + 2 };
  }

  const lineStart = query.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = query.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? query.length : lineEndIdx;

  const targetSlice = query.slice(lineStart, lineEnd);
  const lines = targetSlice.split('\n');

  let newLines: string[];
  if (outdent) {
    newLines = lines.map((l) => {
      if (l.startsWith('  ')) return l.slice(2);
      if (l.startsWith(' ')) return l.slice(1);
      if (l.startsWith('\t')) return l.slice(1);
      return l;
    });
  } else {
    newLines = lines.map((l) => '  ' + l);
  }

  const replaced = newLines.join('\n');
  const newQuery = query.slice(0, lineStart) + replaced + query.slice(lineEnd);
  const diff = replaced.length - targetSlice.length;
  const newStart = Math.max(lineStart, start + (outdent ? -2 : 2));
  const newEnd = Math.max(newStart, end + diff);

  return { text: newQuery, newStart, newEnd };
}

/**
 * Duplicates the current line or selection below.
 */
export function duplicateLine(query: string, start: number, end: number): TextEditResult {
  if (start !== end) {
    const selected = query.slice(start, end);
    const newQuery = query.slice(0, end) + selected + query.slice(end);
    return { text: newQuery, newStart: end, newEnd: end + selected.length };
  }

  const lineStart = query.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = query.indexOf('\n', start);
  const lineEnd = lineEndIdx === -1 ? query.length : lineEndIdx;
  const currentLine = query.slice(lineStart, lineEnd);

  const newQuery = query.slice(0, lineEnd) + '\n' + currentLine + query.slice(lineEnd);
  const newPos = lineEnd + 1 + (start - lineStart);
  return { text: newQuery, newStart: newPos, newEnd: newPos };
}

/**
 * Moves the current line or selected lines block up or down.
 */
export function moveLines(
  query: string,
  start: number,
  end: number,
  direction: 'up' | 'down'
): TextEditResult {
  const lineStart = query.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = query.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? query.length : lineEndIdx;

  const currentBlock = query.slice(lineStart, lineEnd);

  if (direction === 'up') {
    if (lineStart === 0) return { text: query, newStart: start, newEnd: end };
    const prevLineStart = query.lastIndexOf('\n', lineStart - 2) + 1;
    const prevLine = query.slice(prevLineStart, lineStart - 1);

    const newQuery =
      query.slice(0, prevLineStart) +
      currentBlock +
      '\n' +
      prevLine +
      query.slice(lineEnd);

    const shift = prevLine.length + 1;
    return { text: newQuery, newStart: start - shift, newEnd: end - shift };
  } else {
    if (lineEnd >= query.length) return { text: query, newStart: start, newEnd: end };
    const nextLineEndIdx = query.indexOf('\n', lineEnd + 1);
    const nextLineEnd = nextLineEndIdx === -1 ? query.length : nextLineEndIdx;
    const nextLine = query.slice(lineEnd + 1, nextLineEnd);

    const newQuery =
      query.slice(0, lineStart) +
      nextLine +
      '\n' +
      currentBlock +
      query.slice(nextLineEnd);

    const shift = nextLine.length + 1;
    return { text: newQuery, newStart: start + shift, newEnd: end + shift };
  }
}
