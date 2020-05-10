import sha from 'sha.js'
import nacl from 'tweetnacl'

import fixedBuffer from './lowlevel/fixedBuffer'
import { isExonumObject, rawOrSelf } from './lowlevel/common'

export const hashLength = 32
export const secretKeyLength = nacl.sign.secretKeyLength
export const publicKeyLength = nacl.sign.publicKeyLength
export const signatureLength = nacl.sign.signatureLength

const PublicKey = fixedBuffer(publicKeyLength)

/**
 * Calculates a SHA-256 hash of a sequential serialization of one or more items.
 * Items may either be `Uint8Array`s or Exonum-typed objects.
 *
 * @param {Array<ExonumType | Uint8Array>} fragments
 * @returns {Uint8Array}
 */
export function hash (...fragments) {
  if (!fragments.every(frag => isExonumObject(frag) || (frag instanceof Uint8Array))) {
    throw new TypeError('Unexpected argument(s) supplied for hash digest; Uint8Array(s) or Exonum-typed objects supported')
  }

  const lengths = fragments.map(b => isExonumObject(b) ? b.byteLength() : b.length)
  const totalLen = lengths.reduce((total, len) => len + total, 0)

  const buffer = new Uint8Array(totalLen)
  let pos = 0
  fragments.forEach((b, i) => {
    isExonumObject(b)
      ? b.serialize(buffer.subarray(pos, pos + b.byteLength()))
      : buffer.set(b, pos)

    pos += lengths[i]
  })

  return sha('sha256').update(buffer).digest()
}

export function sign (message, secretKey) {
  if (isExonumObject(message)) {
    message = message.serialize()
  }
  return nacl.sign.detached(message, secretKey)
}

export function verify (message, signature, pubkey) {
  if (isExonumObject(message)) {
    message = message.serialize()
  }
  return nacl.sign.detached.verify(message, rawOrSelf(signature), rawOrSelf(pubkey))
}

/**
 * Randomly generates a key pair for signing/verification purposes.
 *
 * @returns {Uint8Array}
 *   Secret key with the following additional methods:
 *   - `pub(): PublicKey` returns Exonum-typed public key
 *   - `rawPub(): Uint8Array` returns 32-byte raw public key buffer
 */
export function secret () {
  const { secretKey, publicKey } = nacl.sign.keyPair()
  const exonumPub = PublicKey.from(publicKey)

  secretKey.pub = function () { return exonumPub }
  secretKey.rawPub = function () { return publicKey.slice(0) }

  return secretKey
}

/**
 * Generates a key pair for signing/verification purposes from a given 32-byte seed.
 * You should not use this method unless for testing purposes; use `secret()` instead.
 *
 * @param {Uint8Array} seed
 *   32-byte seed to generate the key from
 * @returns {Uint8Array}
 *   Secret key with the following additional methods:
 *   - `pub(): PublicKey` returns Exonum-typed public key
 *   - `rawPub(): Uint8Array` returns 32-byte raw public key buffer
 */
secret.fromSeed = function (seed) {
  const { secretKey, publicKey } = nacl.sign.keyPair.fromSeed(seed)
  const exonumPub = PublicKey.from(publicKey)

  secretKey.pub = function () { return exonumPub }
  secretKey.rawPub = function () { return publicKey.slice(0) }

  return secretKey
}

export function fromSecretKey (secretKey) {
  return nacl.sign.keyPair.fromSecretKey(secretKey).publicKey
}
