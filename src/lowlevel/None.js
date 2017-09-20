import { initType } from './common'

/**
 * None is a zero-length type which is used where the type is demanded semantically,
 * but otherwise shouldn't be there (e.g., in `option`s).
 */
class None {
  serialize (buffer) {
    // `None` is not serialized
  }

  toJSON () {
    return null
  }
}

export default initType(None, {
  name: 'None',
  typeLength: 0
})
