import path from 'path'

import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'
import cleanup from 'rollup-plugin-cleanup'
import babel from 'rollup-plugin-babel'

const SRC_DIR = path.resolve('src')
const DIST_DIR = path.resolve('dist')

export default {
  sourceMap: false,
  name: 'exonum-types',

  external: [
    'sha.js',
    'tweetnacl',
    'big-integer',
    'immutable'
  ],

  input: path.join(SRC_DIR, 'index.js'),
  output: {
    file: path.join(DIST_DIR, 'exonum-types.js'),
    format: 'umd',
    exports: 'named',

    // Just in case; the generated package is not intended to be used in browsers
    globals: {
      'sha.js': 'sha',
      'tweetnacl': 'nacl',
      'big-integer': 'bigInt',
      'immutable': 'immutable'
    }
  },

  plugins: [
    commonjs(),
    json(),
    babel(),
    cleanup()
  ]
}
