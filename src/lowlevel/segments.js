import { uinteger } from './integers'
import { getType } from './common'

const Uint32 = uinteger(4)
const SEGMENT_LENGTH = 8

function serializeSegment (buffer, segment) {
  const start = Uint32.from(segment.start)
  const length = Uint32.from(segment.length)

  start.serialize(buffer.subarray(0, 4))
  length.serialize(buffer.subarray(4, 8))

  return buffer
}

function _byteLength (val) {
  const typeLength = getType(val).typeLength()
  return typeLength === undefined
    ? SEGMENT_LENGTH + val.byteLength()
    : typeLength
}

export function byteLength (values) {
  return values.reduce((acc, val) => acc + _byteLength(val), 0)
}

/**
 * Calculates the starting point of the "heap" memory in the serialization
 * of the specified sequence of Exonum types.
 *
 * @param {Array<Class<ExonumType>>} types
 */
export function heapStart (types) {
  return types.reduce((acc, type) => acc + (type.typeLength() || SEGMENT_LENGTH), 0)
}

/**
 * Serializes a sequence of Exonum-typed values into a binary buffer.
 *
 * @param {Uint8Array} buffer
 * @param {Array<ExonumType>} values
 * @param {number} [heapPos]
 *   the position of "heap" memory within the buffer. Can be calculated with `heapStart()`
 *   and cached beforehand
 * @param {number} [offset = 0]
 *   offset to add to segment start positions. Otherwise, the offset does not influence
 *   serialization; e.g., it still starts from the start of the buffer.
 */
export function serialize (buffer, values, heapPos, { offset = 0 } = {}) {
  if (heapPos === undefined) {
    heapPos = heapStart(values.map(val => getType(val)))
  }

  const initHeap = heapPos
  let mainPos = 0

  values.forEach(val => {
    const typeLength = getType(val).typeLength()
    if (typeLength === undefined) {
      // Serialize the value in the "heap"
      const len = val.byteLength()
      val.serialize(buffer.subarray(heapPos, heapPos + len))
      const segment = { start: heapPos + offset, length: len }
      serializeSegment(buffer.subarray(mainPos, mainPos + SEGMENT_LENGTH), segment)
      heapPos += len
      mainPos += SEGMENT_LENGTH
    } else {
      // Serialize the value in place
      val.serialize(buffer.subarray(mainPos, mainPos + typeLength))
      mainPos += typeLength
    }
  })

  if (mainPos !== initHeap) {
    throw new Error(`Invariant broken: The length of the main segment ${mainPos} does not match the heap position ${initHeap}`)
  }

  if (heapPos < buffer.length) {
    throw new Error(`Invariant broken: Over-allocation of heap, ${buffer.length} bytes allocated vs ${heapPos} used`)
  } else if (heapPos > buffer.length) {
    throw new Error(`Invariant broken: Under-allocation of heap, ${buffer.length} bytes allocated vs ${heapPos} used`)
  }

  return buffer
}
