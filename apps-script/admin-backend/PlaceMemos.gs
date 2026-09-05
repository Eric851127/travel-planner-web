const P14_MEMO_TYPES = ['food','shopping','note','reservation'];
const P14_MEMO_PRIORITIES = ['high','normal','low'];

function p14ValidatePlaceMemo_(input,rows,ss){
  const o=p10ValidateExistingId_(input.id,rows,/^PM\d{3,}$/,'地點備忘');
  o.place_id=p10RequiredForeignId_(ss,'places',input.place_id,'place_id');
  o.type=p10EnumValue_(input.type,P14_MEMO_TYPES,'type');
  o.title=p10RequiredText_(input.title,'標題',160);
  o.note=p10Text_(input.note,1000);
  o.priority=p10EnumValue_(input.priority||'normal',P14_MEMO_PRIORITIES,'priority');
  o.active=p10BooleanValue_(input.active===undefined?'true':input.active,'active');
  o.sort_order=p14SortOrder_(input.sort_order);
  return o;
}

function p14SortOrder_(value){
  const raw=String(value==null?'':value).trim();
  if(!raw)return 10;
  const n=Number(raw);
  if(!Number.isInteger(n)||n<0||n>9999)throw p10Error_('VALIDATION_ERROR','sort_order 必須是 0–9999 的整數');
  return n;
}
