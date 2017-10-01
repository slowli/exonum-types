import { createType } from './common'

/**
 * None is a zero-length type which is used where the type is demanded semantically,
 * but otherwise shouldn't be there (e.g., in `option`s).
 */
export default class None extends createType({
  name: 'None',
  typeLength: 0
}) {
  constructor (nullOrUndefined) {
    if (nullOrUndefined !== null && nullOrUndefined !== undefined) {
      throw new Error('Invalid None initializer; null or undefined expected')
    }
    super()
  }

  _doSerialize (buffer) {
    // `None` is not serialized
  }

  toJSON () {
    return null
  }
}
