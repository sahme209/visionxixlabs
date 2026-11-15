/** Original generated Axiom conduit surface. No copied textures or reference assets. */
export const quietOrbitVertex = `varying vec3 vPosition;varying vec3 vNormal;varying vec2 vUv;void main(){vPosition=position;vNormal=normal;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const quietOrbitFragment = `precision highp float;varying vec3 vPosition;varying vec3 vNormal;varying vec2 vUv;uniform vec3 eye;uniform float time;
  float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){return noise(p)*.57+noise(p*2.03+9.7)*.28+noise(p*4.11+3.1)*.15;}
  vec3 cylinder(float a,float frequency,float depth){return vec3(cos(a)*frequency,sin(a)*frequency,depth);}
  void main(){
    vec3 n=normalize(vNormal),view=normalize(eye-vPosition);if(dot(n,view)<0.)n=-n;
    float a=vUv.x*6.28318530718,t=vUv.y;
    // Every angular sample is periodic in 3D, including fine flow. No UV mask.
    float phase=a+t*5.8-time*.025;
    float broad=fbm(cylinder(phase,2.4,t*7.));
    float flow=fbm(cylinder(phase+broad*.18,22.,t*11.));
    float fine=fbm(cylinder(phase+broad*.07,108.,t*27.));
    float diffuse=max(dot(n,normalize(vec3(-.55,1.05,2.2))),0.);
    float viewRim=pow(1.-max(dot(n,view),0.),3.2);
    float vein=smoothstep(.61,.79,flow)*smoothstep(.49,.72,fine);
    float shadow=1.-smoothstep(.6,1.,t);
    vec3 base=mix(vec3(.006,.006,.006),vec3(.039,.039,.039),broad*.75);
    vec3 col=base*(.18+diffuse*.95)*(.58+shadow*.42);
    col+=vec3(.16,.16,.16)*vein*.33*(.12+diffuse*.88)*(.4+shadow*.6);
    col+=vec3(.14,.14,.14)*viewRim*.22;
    // A single lit crescent travels over the folded lip, never a neon torus.
    float crest=exp(-pow((t-.91)/.036,2.))*pow(max(0.,cos(a+1.05)),6.);
    float whisper=exp(-pow((t-.78)/.09,2.))*pow(max(0.,cos(a-2.3)),4.);
    col+=vec3(.50,.50,.50)*crest*(.65+fine*.35);
    col+=vec3(.095,.095,.095)*whisper*.4;
    col+=vec3(.003,.003,.003);
    col=pow(max(col*1.7,vec3(0.)),vec3(.72));
    gl_FragColor=vec4(col,1.);
  }`;
