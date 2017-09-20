import { rawValue, setRawValue, initType } from './common'

function isBoolean (obj) {
  return obj && typeof rawValue(obj) === 'boolean'
}

const Bool = initType(class {
  constructor (val) {
    const raw = isBoolean(val) ? rawValue(val) : !!val
    setRawValue(this, raw)
  }

  serialize (buffer) {
    buffer[0] = rawValue(this) ? 1 : 0
    return buffer
  }

  check () {
    return rawValue(this)
  }

  toJSON () {
    return rawValue(this)
  }
}, {
  typeLength: 1,
  proxiedMethods: [
    'toString',
    'valueOf'
  ],
  name: 'Bool'
})

Object.defineProperty(Bool, 'TRUE', { value: new Bool(true) })
Object.defineProperty(Bool, 'FALSE', { value: new Bool(false) })

export default Bool
