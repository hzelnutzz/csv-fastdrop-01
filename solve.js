// Fast drop-in for csv-reader 1.0.0: same answers, bulk scanning instead of per-char string concat.
const COMMA='comma', LINE_BREAK='line break', END='end';

export function run(input){
  const text=String(input.text);
  const header=input.header===true;
  const n=text.length;
  const errors=[]; const rows=[]; let columns=null; let width=-1;
  let pos=(n>0&&text[0]==='\uFEFF')?1:0;
  let line=1, recordLine=1, recordRow=null;

  // Unquoted field: [start,end) returns end state, appends text.slice.
  function readUnquoted(value){ // value: string so far (only from quote fallback)
    let start=pos, added=0;
    while(pos<n){
      const c=text[pos];
      if(c===','){value+=text.slice(start,pos);pos++;return{value,ended:COMMA,added:added+(pos-1-start)};}
      if(c==='\n'){value+=text.slice(start,pos);pos++;line++;return{value,ended:LINE_BREAK,added:added+(pos-1-start)};}
      if(c==='\r'){
        value+=text.slice(start,pos);
        if(pos+1<n&&text[pos+1]==='\n'){pos+=2;line++;return{value,ended:LINE_BREAK,added:added+(pos-start)/2|0};}
        errors.push({code:'stray_cr',line:recordLine,row:recordRow});pos++;start=pos;continue;
      }
      pos++;
    }
    value+=text.slice(start);return{value,ended:END,added:added+(n-start)};
  }

  function readQuoted(){
    const open=pos, openLine=line;
    pos++; let closed=false;
    let value='';
    let chunkStart=pos;
    while(pos<n){
      const c=text[pos];
      if(c==='"'){
        if(pos+1<n&&text[pos+1]==='"'){value+=text.slice(chunkStart,pos)+'"';pos+=2;chunkStart=pos;continue;}
        value+=text.slice(chunkStart,pos);pos++;closed=true;break;
      }
      if(c==='\r'){
        value+=text.slice(chunkStart,pos)+'\n';line++;
        pos+=(pos+1<n&&text[pos+1]==='\n')?2:1;chunkStart=pos;continue;
      }
      if(c==='\n')line++;
      pos++;
    }
    if(!closed){
      pos=open+1;line=openLine;
      errors.push({code:'unterminated_quote',line:recordLine,row:recordRow});
      return readUnquoted('"');
    }
    if(pos>=n)return{value,ended:END};
    const c=text[pos];
    if(c===','){pos++;return{value,ended:COMMA};}
    if(c==='\n'){pos++;line++;return{value,ended:LINE_BREAK};}
    if(c==='\r'&&pos+1<n&&text[pos+1]==='\n'){pos+=2;line++;return{value,ended:LINE_BREAK};}
    const before=pos;
    const junk=readUnquoted(value);
    if(junk.added>0)errors.push({code:'quote_junk',line:recordLine,row:recordRow});
    void before;
    return junk;
  }

  while(true){
    while(pos<n){
      const c=text[pos];
      if(c==='\n'){pos++;line++;}
      else if(c==='\r'&&pos+1<n&&text[pos+1]==='\n'){pos+=2;line++;}
      else break;
    }
    if(pos>=n)break;
    recordLine=line;
    recordRow=header&&columns===null?null:rows.length;
    const fields=[];let field,quoted;
    do{
      quoted=text[pos]==='"';
      field=quoted?readQuoted():readUnquoted('');
      fields.push(field.value);
    }while(field.ended===COMMA);
    if(fields.length===1&&fields[0]===''&&!quoted)continue;
    if(width<0)width=fields.length;
    if(header&&columns===null){columns=fields;continue;}
    if(fields.length<width){
      errors.push({code:'short_row',line:recordLine,row:recordRow,fields:fields.length});
      while(fields.length<width)fields.push('');
    }else if(fields.length>width){
      errors.push({code:'long_row',line:recordLine,row:recordRow,extra:fields.splice(width)});
    }
    rows.push(fields);
  }
  return{columns:header?(columns??[]):null,rows,errors};
}
