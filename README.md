![status](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)
![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/hzelnutzz/csv-fastdrop-01/rank.svg)
![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/hzelnutzz/csv-fastdrop-01/reward.svg)

[make.fun bounty](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

# csv-fastdrop-01

A faster drop-in replacement for make.fun's `csv-reader` 1.0.0, built for the
[csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
bounty.

`solve.js` exposes a single dependency-free ES module export:

```js
import { run } from './solve.js';

run({ text: 'a,b\n1,2\n', header: true });
// => { columns: ['a', 'b'], rows: [['1', '2']], errors: [] }
```

It matches the reference reader's output exactly — header handling, BOM
stripping, quoted fields with `""` escapes and embedded newlines, lone-CR
handling, short/long row padding and trimming, and the full error record
list (`stray_cr`, `unterminated_quote`, `quote_junk`, `short_row`, `long_row`)
with the same line/row coordinates.

## How it works

The reference implementation builds field values one character at a time.
`solve.js` instead scans with an index and appends runs of ordinary characters
in bulk via `text.slice(start, pos)`, so a field costs a handful of slices
rather than one string concatenation per character. Quoted fields are handled
the same way: the span between quote characters is sliced in one go, with only
escapes and newline normalisation breaking the run. Since strings are still
assembled in order and every special case is preserved, the output is
byte-identical to `csv-reader` 1.0.0 — the exact broken-CSV error semantics
(stray CRs, unterminated quotes re-read as literal text, junk after a closing
quote, ragged rows) are kept, not approximated.

## Run

`main.ts` reads `cases.json` from `MAKEFUN_INPUT_DIR` and writes `answers.json`
to `MAKEFUN_OUTPUT_DIR`, falling back to `/input` and `/output` when unset:

```sh
MAKEFUN_INPUT_DIR=./in MAKEFUN_OUTPUT_DIR=./out node --experimental-strip-types main.ts
```

Any TypeScript runner works (`tsx main.ts`, `bun main.ts`, ...). The input file
must look like:

```json
[
  { "id": "case-1", "input": { "text": "a,b\n1,2\n", "header": true } }
]
```

and the output is the array of `run()` results, one per case, in input order.

To exercise the parser directly without the driver:

```sh
node --input-type=module -e "import('./solve.js').then(({run}) => console.log(JSON.stringify(run({text:'a,b\n1,2\n', header:true}))))"
```
