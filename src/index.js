import * as crypto from './crypto'
import std from './std'
import { isExonumFactory, isExonumType, isExonumObject } from './lowlevel/common'

// Export standard + blockchain types and resolver
// XXX: Is there any way to do this in ES6 manner?
for (let name in std) {
  exports[name] = std[name]
}

export { isExonumFactory, isExonumType, isExonumObject, crypto }

export default Object.assign(std, {
  isExonumFactory,
  isExonumType,
  isExonumObject,
  crypto
})
