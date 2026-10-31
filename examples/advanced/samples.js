export const samples = [
  {id:'forms',title:'Forms and charts',source:`{@body const data=DIL.useAppData()}
{@body const [note,setNote]=DIL.useState('Write here')}
{@body const [region,setRegion]=DIL.useState('North')}
{@body const [saved,setSaved]=DIL.useState('')}
{@body const [date,setDate]=DIL.useState('')}
<card padding=4 border radius="lg"><title>{data.title}</title>
<form onSubmit={()=>setSaved(note)}><textarea value={note} onChange={setNote} rows=3/><button>Confirm</button></form>
<caption>Last confirmed note: {saved}</caption>
<radio-group value={region} onChange={setRegion}><radio value="North">North</radio><radio value="South">South</radio></radio-group>
<date-picker aria-label="Date" value={date} onChange={setDate}/><text>Selected region: {region}</text>
<Chart content={{chartType:'scatter',xKey:'x',data:data.rows,series:[{dataKey:'y',label:'Illustrative values'}]}}/>
</card>`},
  {id:'tools',title:'Timers, files and dragging',source:`{@body const [ticks,setTicks]=DIL.useState(0)}
{@body const [running,setRunning]=DIL.useState(false)}
{@body const [text,setText]=DIL.useState('Sample text')}
{@body const [items,setItems]=DIL.useState([{id:'a',columnId:'todo',title:'First task'},{id:'b',columnId:'done',title:'Second task'}])}
{@body function moveItem(move){const item=items.find(value=>value.id===move.id);const rest=items.filter(value=>value.id!==move.id);const before=rest.findIndex(value=>value.id===move.beforeId);const index=before<0?rest.length:before;setItems([...rest.slice(0,index),{...item,columnId:move.columnId},...rest.slice(index)])}}
<checkbox checked={running} onChange={setRunning}>Start timer</checkbox>
<timer running={running} interval=1000 onTick={()=>setTicks(n=>n+1)}/><text>Tick: {ticks}</text>
<drag-board columns={[{id:'todo',title:'To do'},{id:'done',title:'Done'}]} items={items} onMove={moveItem}/>
<file-input accept=".txt,.csv" maxBytes={50000} onChange={file=>setText(file.content)}/>
<textarea value={text} onChange={setText}/><download filename="note.txt" mime="text/plain" content={text}>Download text</download>
<local-store storageKey="intlui-advanced-demo-notes" value={text} onLoad={setText} onReset={()=>setText('')}/>`},
  {id:'visual',title:'SVG, WebGL and images',source:`<caption>Local illustrative geometry and images.</caption>
<svg viewBox="0 0 200 80" height=100><defs><linearGradient id="shade"><stop offset="0%" stopColor="#397569"/><stop offset="100%" stopColor="#c48345"/></linearGradient></defs><rect width=200 height=80 fill="url(#shade)"/></svg>
<webgl-scene vertices={[-1,-1,0,1,-1,0,0,1,0]} aria-label="3D triangle"/>
<carousel showArrows visibleItems=1><carousel-item><text>First card</text></carousel-item><carousel-item><AsyncImage ref="sample" alt="Local illustration"/></carousel-item></carousel>
<Cite ref="guide"/>`},
  {id:'data',title:'Map and local data',source:`{@body const [values,setValues]=DIL.useState([])}
{@body const [selected,setSelected]=DIL.useState('')}
<caption>Synthetic data: the polygon does not represent a real boundary.</caption>
<data-source src="/data.json" onData={setValues}/>
{#each values as row}<text key={row.id}>{row.label}: {row.value}</text>{/each}
<geo-map src="/map.json" markers={[{id:'example',label:'Illustrative point',latitude:0,longitude:0}]} selected={selected} onSelect={setSelected}/>
<text>Selection: {selected}</text>`},
];
