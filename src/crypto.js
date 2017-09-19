import sha from 'sha.js'
import nacl from 'tweetnacl'

import { isExonumObject, rawOrSelf } from './lowlevel/common'
import std from './std'

const { PublicKey } = std

export const hashLength = 32
export const secretKeyLength = nacl.sign.secretKeyLength
export const publicKeyLength = nacl.sign.publicKeyLength
export const signatureLength = nacl.sign.signatureLength

export function hash (...fragments) {
  const lengths = fragments.map(b => isExonumObject(b) ? b.byteLength() : b.length)
  const totalLen = lengths.reduce((len, total) => len + total, 0)

  if (typeof totalLen !== 'number') {
    throw new TypeError('Invalid argument(s) supplied for hash digest; arrayish objects and Exonum types supported')
  }

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
  return nacl.sign.detached(message, rawOrSelf(secretKey))
}

export function verify (message, signature, pubkey) {
  if (isExonumObject(message)) {
    message = message.serialize()
  }
  return nacl.sign.detached.verify(message, rawOrSelf(signature), rawOrSelf(pubkey))
}

export function randomKey () {
  const secretKey = nacl.sign.keyPair().secretKey
  secretKey.pub = function () { return PublicKey.from(fromSecretKey(this)) }
  secretKey.rawPub = function () { return fromSecretKey(this) }
  return secretKey
}

export function fromSecretKey (secretKey) {
  return nacl.sign.keyPair.fromSecretKey(secretKey).publicKey
}

export function randomBytes (length) {
  return nacl.randomBytes(length)
}
