"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RealisticFogBackgroundProps {
  className?: string;
  backgroundColor?: string;
}

/**
 * Mist/Fog Background — CSS fog (always visible) + WebGL enhancement
 */
export function RealisticFogBackground({
  className,
  backgroundColor = "#09090b",
}: RealisticFogBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const vsSource = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
    const fsSource = `precision highp float;
uniform float u_time;uniform vec2 u_resolution;uniform vec2 u_mouse;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1));
vec2 u=f*f*(3.-2.*f);return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
void main(){
vec2 uv=gl_FragCoord.xy/u_resolution.xy;uv.x*=u_resolution.x/u_resolution.y;
vec2 mp=u_mouse/u_resolution.xy;mp.x*=u_resolution.x/u_resolution.y;
float d=distance(uv,mp);
vec2 q=vec2(fbm(uv+.07*u_time),fbm(uv+vec2(1)));
vec2 r=vec2(fbm(uv+q+vec2(1.7,9.2)+.15*u_time),fbm(uv+q+vec2(8.3,2.8)+.126*u_time));
float f=fbm(uv+r);
vec3 c=mix(vec3(.08,.09,.12),vec3(.4,.42,.52),f*1.2);
c=mix(c,vec3(.5,.55,.7),dot(q,r)*.6);
c+=smoothstep(.4,0.,d)*.2*vec3(.6,.75,1.);
gl_FragColor=vec4(pow(c,vec3(.95))*1.8,1.);
}`;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    let mouse = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = window.innerHeight - e.clientY; };
    window.addEventListener("mousemove", onMove);

    let raf: number;
    const render = (t: number) => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      gl.uniform1f(uTime, t * 0.001);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      setWebglReady(true);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className={cn("fixed inset-0 w-full h-full overflow-hidden z-0", className)}
      style={{ background: backgroundColor }}
    >
      {/* CSS fog — always visible */}
      <div className="fog-layer">
        <div
          className="fog-blob bg-slate-400/50"
          style={{
            width: "120%",
            height: "80%",
            left: "-10%",
            top: "-20%",
            animationName: "fog-drift-1",
          }}
        />
        <div
          className="fog-blob bg-slate-500/40"
          style={{
            width: "100%",
            height: "100%",
            left: "-5%",
            top: "-10%",
            animationName: "fog-drift-2",
            animationDelay: "-5s",
          }}
        />
        <div
          className="fog-blob bg-indigo-400/35"
          style={{
            width: "90%",
            height: "90%",
            left: "5%",
            top: "5%",
            animationName: "fog-drift-3",
            animationDelay: "-10s",
          }}
        />
        <div
          className="fog-blob bg-slate-500/35"
          style={{
            width: "80%",
            height: "70%",
            left: "10%",
            top: "15%",
            animationName: "fog-drift-1",
            animationDelay: "-15s",
            animationDuration: "25s",
          }}
        />
      </div>
      {/* WebGL layer — on top when ready */}
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000",
          webglReady ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
