"use client";

import { useEffect, useRef, useState } from "react";

interface RealisticFogBackgroundProps {
  backgroundColor?: string;
  /** 0-1. Lower values improve text readability over the fog. Default 1. */
  opacity?: number;
  /** Use darker fog tones. Default false. */
  darken?: boolean;
}

const FOG_BLOBS = {
  default: [
    { background: "rgba(148, 163, 184, 0.55)" },
    { background: "rgba(100, 116, 139, 0.5)" },
    { background: "rgba(129, 140, 248, 0.45)" },
    { background: "rgba(71, 85, 105, 0.4)" },
  ],
  dark: [
    { background: "rgba(51, 65, 85, 0.6)" },
    { background: "rgba(30, 41, 59, 0.55)" },
    { background: "rgba(71, 85, 105, 0.5)" },
    { background: "rgba(30, 41, 59, 0.5)" },
  ],
};

export function RealisticFogBackground({
  backgroundColor = "#09090b",
  opacity = 1,
  darken = false,
}: RealisticFogBackgroundProps) {
  const blobs = FOG_BLOBS[darken ? "dark" : "default"];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

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
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [mounted]);

  if (!mounted) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor,
          zIndex: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor,
        opacity,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* CSS fog blobs — inline styles, no Tailwind */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "140%",
            height: "100%",
            left: "-20%",
            top: "-20%",
            borderRadius: "50%",
            background: blobs[0].background,
            filter: "blur(120px)",
            animation: "fog-drift-1 16s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "120%",
            height: "110%",
            left: "-10%",
            top: "-15%",
            borderRadius: "50%",
            background: blobs[1].background,
            filter: "blur(130px)",
            animation: "fog-drift-2 20s ease-in-out infinite 3s",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "110%",
            height: "105%",
            left: "-5%",
            top: "-5%",
            borderRadius: "50%",
            background: blobs[2].background,
            filter: "blur(100px)",
            animation: "fog-drift-3 18s ease-in-out infinite 6s",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "90%",
            left: "0%",
            top: "5%",
            borderRadius: "50%",
            background: blobs[3].background,
            filter: "blur(140px)",
            animation: "fog-drift-1 24s ease-in-out infinite 12s",
          }}
        />
      </div>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />
      {darken && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(15,23,42,0.4) 0%, rgba(30,41,59,0.35) 100%)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
