// Dependency-free replication of make.fun csv-reader 1.0.0.
// Scans left to right in bulk slices; never builds strings one character at a time.

const COMMA = 'comma';
const LINE_BREAK = 'line break';
const END = 'end';

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;

  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = n > 0 && text[0] === '\uFEFF' ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  // Reads an unquoted field, appending the text between special characters in
  // slices. `value` is the prefix already collected (only used when a quoted
  // field turns out to be unterminated, or when trailing quote junk is read).
  function readUnquoted(value) {
    let start = pos;
    let added = 0;

    while (pos < n) {
      const c = text[pos];

      if (c === ',') {
        const chunk = text.slice(start, pos);
        value += chunk;
        added += chunk.length;
        pos++;
        return { value, ended: COMMA, added };
      }

      if (c === '\n') {
        const chunk = text.slice(start, pos);
        value += chunk;
        added += chunk.length;
        pos++;
        line++;
        return { value, ended: LINE_BREAK, added };
      }

      if (c === '\r') {
        const chunk = text.slice(start, pos);
        value += chunk;
        added += chunk.length;

        if (pos + 1 < n && text[pos + 1] === '\n') {
          pos += 2;
          line++;
          return { value, ended: LINE_BREAK, added };
        }

        // A lone CR outside quotes is dropped.
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos++;
        start = pos;
        continue;
      }

      pos++;
    }

    const chunk = text.slice(start, n);
    value += chunk;
    added += chunk.length;
    return { value, ended: END, added };
  }

  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos++;

    let closed = false;
    let value = '';
    let chunkStart = pos;

    while (pos < n) {
      const c = text[pos];

      if (c === '"') {
        if (pos + 1 < n && text[pos + 1] === '"') {
          value += text.slice(chunkStart, pos) + '"';
          pos += 2;
          chunkStart = pos;
          continue;
        }
        value += text.slice(chunkStart, pos);
        pos++;
        closed = true;
        break;
      }

      if (c === '\r') {
        // CRLF and lone CR inside quotes both read as LF and advance the line.
        value += text.slice(chunkStart, pos) + '\n';
        pos += pos + 1 < n && text[pos + 1] === '\n' ? 2 : 1;
        line++;
        chunkStart = pos;
        continue;
      }

      if (c === '\n') {
        line++;
        pos++;
        continue;
      }

      pos++;
    }

    if (!closed) {
      // The opening quote is a literal; re-read the rest as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"');
    }

    if (pos >= n) return { value, ended: END, added: 0 };

    const c = text[pos];
    if (c === ',') {
      pos++;
      return { value, ended: COMMA, added: 0 };
    }
    if (c === '\n') {
      pos++;
      line++;
      return { value, ended: LINE_BREAK, added: 0 };
    }
    if (c === '\r' && pos + 1 < n && text[pos + 1] === '\n') {
      pos += 2;
      line++;
      return { value, ended: LINE_BREAK, added: 0 };
    }

    // Anything between the closing quote and the next comma/linebreak is
    // appended as-is to the field value.
    const result = readUnquoted(value);
    if (result.added > 0) {
      errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    }
    return result;
  }

  while (true) {
    // Skip empty lines; they produce no record.
    while (pos < n) {
      const c = text[pos];
      if (c === '\n') {
        pos++;
        line++;
      } else if (c === '\r' && pos + 1 < n && text[pos + 1] === '\n') {
        pos += 2;
        line++;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    const fields = [];
    let firstQuoted = false;
    let ended;

    do {
      const quoted = pos < n && text[pos] === '"';
      if (fields.length === 0) firstQuoted = quoted;
      const field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
      ended = field.ended;
    } while (ended === COMMA);

    if (fields.length === 1 && fields[0] === '' && !firstQuoted) continue;

    if (width < 0) width = fields.length;

    if (header && columns === null) {
      columns = fields;
      continue;
    }

    if (fields.length < width) {
      errors.push({
        code: 'short_row',
        line: recordLine,
        row: recordRow,
        fields: fields.length,
      });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({
        code: 'long_row',
        line: recordLine,
        row: recordRow,
        extra: fields.splice(width),
      });
    }

    rows.push(fields);
  }

  return { columns: header ? columns ?? [] : null, rows, errors };
}
