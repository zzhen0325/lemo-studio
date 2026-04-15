export const CUSTOM_SHADER_INTERNAL_VISIBILITY = {
  equals: "__never__",
  key: "__customShaderInternal",
} as const

export const CUSTOM_SHADER_ENTRY_EXPORT = "sketch"

export const CUSTOM_SHADER_INTERNAL_KEYS = new Set([
  "entryExport",
  "sourceCode",
  "sourceFileName",
  "sourceMode",
  "sourceRevision",
])

export const CUSTOM_EFFECT_STARTER = `export const sketch = Fn(() => {
  const uv0 = uv()
  const warp = sin(uv0.y.mul(20).add(time.mul(2))).mul(0.02)
  const warped = vec2(uv0.x.add(warp), uv0.y)

  const size = float(0.025)
  const sx = warped.x.div(size)
  const sy = warped.y.div(size)
  const q = sx.mul(0.57735).sub(sy.mul(0.33333))
  const r = sy.mul(0.66667)

  const rq = round(q).toVar()
  const rr = round(r).toVar()
  const rs = round(q.negate().sub(r))

  const dq = abs(rq.sub(q))
  const dr = abs(rr.sub(r))
  const ds = abs(rs.sub(q.negate().sub(r)))

  If(dq.greaterThan(dr).and(dq.greaterThan(ds)), () => {
    rq.assign(rr.negate().sub(rs))
  })
  .Else(() => {
    If(dr.greaterThan(ds), () => {
      rr.assign(rq.negate().sub(rs))
    })
  })

  const cx = size.mul(float(1.7321).mul(rq).add(float(0.866).mul(rr)))
  const cy = size.mul(float(1.5).mul(rr))

  return inputTexture.sample(vec2(cx, float(1).sub(cy)))
})
`

export const CUSTOM_SHADER_STARTER = `export const sketch = Fn(() => {
  const uv0 = screenAspectUV(screenSize)
  const color = vec3(
    uv0.x.add(0.5),
    uv0.y.add(0.5),
    sin(time).mul(0.5).add(0.5)
  ).toVar()

  color.assign(technicolorTonemap(color))

  return color
})
`
