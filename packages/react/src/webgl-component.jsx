import React, { useEffect, useRef, useState } from 'react';

// Shaders are owned by the renderer; DIL supplies bounded triangle data only.
const vertex = `attribute vec3 position; uniform vec3 view; uniform float aspect;
varying vec3 shade;
void main(){
 float a=view.x,b=view.y;
 vec3 p=vec3(position.x*cos(a)-position.z*sin(a),position.y,position.x*sin(a)+position.z*cos(a));
 p=vec3(p.x,p.y*cos(b)-p.z*sin(b),p.y*sin(b)+p.z*cos(b));
 float depth=5.0-p.z;
 gl_Position=vec4(p.x*view.z/aspect,p.y*view.z,(depth-1.0)/5.0,depth);
 shade=clamp(position*.25+.55,0.0,1.0);
}`;
const fragment = `precision mediump float; varying vec3 shade; void main(){gl_FragColor=vec4(shade,1.0);}`;
export function WebGLScene({ props: p, common }) {
  const canvas = useRef(null), render = useRef(null), pointer = useRef(null);
  const [view, setView] = useState([.6,.4,2.5]), [status, setStatus] = useState('Loading WebGL');
  const current = useRef(view); current.current = view;
  const vertices = JSON.stringify(p.vertices ?? []);
  useEffect(() => {
    const el = canvas.current;
    let gl, program, buffer, shaders = [], disposed = false;
    const clear = () => {
      if (gl) { if(buffer)gl.deleteBuffer(buffer); if(program)gl.deleteProgram(program); shaders.forEach(s=>gl.deleteShader(s)); }
      buffer=null; program=null; shaders=[]; render.current=null;
    };
    const draw = () => {
      if (!program || gl.isContextLost() || disposed) return;
      const ratio = Math.min(2,window.devicePixelRatio || 1);
      el.width=Math.max(1,Math.round(el.clientWidth*ratio)); el.height=Math.max(1,Math.round(el.clientHeight*ratio));
      gl.viewport(0,0,el.width,el.height); gl.clearColor(.06,.09,.14,1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
      gl.useProgram(program); gl.uniform3fv(gl.getUniformLocation(program,'view'),current.current);
      gl.uniform1f(gl.getUniformLocation(program,'aspect'),el.width/el.height);
      gl.drawArrays(gl.TRIANGLES,0,JSON.parse(vertices).length/3);
    };
    const initialize = () => {
      try {
        gl=el.getContext('webgl',{antialias:true});
        if (!gl) throw Error('WebGL is unavailable in this browser.');
        const data=JSON.parse(vertices);
        if (!Array.isArray(data) || !data.length || data.length%9 || data.length>90000 || !data.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=100)) throw Error('Invalid mesh: use triangles with finite coordinates (maximum 30,000 vertices).');
        program=gl.createProgram();
        for (const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
          const shader=gl.createShader(type); shaders.push(shader); gl.shaderSource(shader,source); gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('WebGL compilation failed.');
          gl.attachShader(program,shader);
        }
        gl.linkProgram(program); if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('WebGL initialization failed.');
        gl.useProgram(program); buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
        const position=gl.getAttribLocation(program,'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,3,gl.FLOAT,false,0,0);
        render.current=draw; draw(); setStatus('WebGL active');
      } catch(error) { clear(); setStatus(error.message); }
    };
    const lost = e => { e.preventDefault(); render.current=null; setStatus('WebGL context lost; waiting for restoration.'); };
    const restored = () => { clear(); initialize(); };
    el.addEventListener('webglcontextlost',lost); el.addEventListener('webglcontextrestored',restored);
    initialize(); const observer=new ResizeObserver(()=>render.current?.()); observer.observe(el);
    return () => { disposed=true; observer.disconnect(); el.removeEventListener('webglcontextlost',lost); el.removeEventListener('webglcontextrestored',restored); clear(); };
  },[vertices]);
  useEffect(()=>{render.current?.();},[view]);
  const zoom = delta => setView(v=>[v[0],v[1],Math.max(1,Math.min(5,v[2]+delta))]);
  return <section {...common}>
    <canvas ref={canvas} aria-label={p['aria-label'] || 'Interactive WebGL scene'} tabIndex={0} style={{width:'100%',height:360,touchAction:'none',borderRadius:12}}
      onPointerDown={e=>{pointer.current=[e.clientX,e.clientY];e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(!pointer.current)return;const [x,y]=pointer.current;pointer.current=[e.clientX,e.clientY];setView(v=>[v[0]+(e.clientX-x)*.01,v[1]+(e.clientY-y)*.01,v[2]]);}}
      onPointerUp={()=>{pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}}
      onWheel={e=>zoom(e.deltaY<0?.2:-.2)}
      onKeyDown={e=>{const offsets={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]};if(offsets[e.key]){e.preventDefault();const [a,b]=offsets[e.key];setView(v=>[v[0]+a,v[1]+b,v[2]]);}}}/>
    <p role="status">{status}</p>
    <div className="intl-row"><button onClick={()=>zoom(.2)}>Zoom in 3D</button><button onClick={()=>zoom(-.2)}>Zoom out 3D</button><button onClick={()=>setView([.6,.4,2.5])}>Reset 3D</button></div>
    <small>Drag to rotate; use the wheel or buttons to zoom. Use arrow keys for keyboard rotation.</small>
  </section>;
}
