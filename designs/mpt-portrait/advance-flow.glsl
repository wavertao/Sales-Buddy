precision mediump float;
/** @resolution */
uniform vec2 u_resolution;
/** @time */
uniform float u_time;
/** @label Flow Color @color @default #5261ed */
uniform vec3 u_color;
/** @label Vertical Flow @default 0 */
uniform float u_vertical;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_vertical > 0.5) uv = uv.yx;
  float mid = abs(uv.y - 0.5);
  float line = 1.0 - smoothstep(0.025, 0.065, mid);
  float phase = fract(uv.x * 3.0 - u_time * 0.65);
  float arrow = 1.0 - smoothstep(0.045, 0.095, abs(mid - (0.5-phase)*0.55));
  arrow *= step(0.14, phase) * step(phase, 0.5);
  float alpha = max(line * 0.35, arrow * 0.95);
  gl_FragColor = vec4(u_color * alpha, alpha);
}
