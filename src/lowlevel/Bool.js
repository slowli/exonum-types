import { rawValue, createType } from './common'

function isBoolean (obj) {
  return obj && typeof rawValue(obj) === 'boolean'
}

export default class Bool extends createType({
  typeLength: 1,
  proxiedMethods: [
    'toString',
    'valueOf'
  ],
  name: 'Bool'
}) {
  constructor (val) {
    if (isBoolean(val)) val = rawValue(val)

    if (typeof val !== 'boolean') {
      throw new TypeError(`Cannot construct Bool from ${val}`)
    }
    super(val)
  }

  _doSerialize (buffer) {
    buffer[0] = rawValue(this) ? 1 : 0
    return buffer
  }

  toJSON () {
    return rawValue(this)
  }
}

Object.defineProperty(Bool, 'TRUE', { value: new Bool(true) })
Object.defineProperty(Bool, 'FALSE', { value: new Bool(false) })
