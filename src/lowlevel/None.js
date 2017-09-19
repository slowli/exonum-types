import { initType } from './common'

export default initType(class {
  serialize (buffer) {
    // `None` is not serialized
  }

  toJSON () {
    return null
  }
}, {
  name: 'None',
  byteLength: 0
})
