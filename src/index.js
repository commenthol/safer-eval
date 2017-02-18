/**
* @copyright 2017 Commenthol
* @license MIT
*/

'use strict'

const vm = require('vm')
const {freshContext, allow} = require('./common')

/**
* A safer approach for eval. (node)
*
* In node the `vm` module is used to sandbox the evaluation of `code`.
*
* `context` allows the definition of passed in Objects into the sandbox.
* Take care, injected `code` can overwrite those passed context props!
* Check the tests under "harmful context"!
*
* @static
* @throws Error
* @param {String} code - a string containing javascript code
* @param {Object} [context] - define globals, properties for evaluation context
* @return {Any} evaluated code
* @example
* var code = `{d: new Date('1970-01-01'), b: new Buffer('data')}`
* var res = saferEval(code, {Buffer: Buffer})
* // => toString.call(res.d) = '[object Date]'
* // => toString.call(res.b) = '[object Buffer]'
*/
function saferEval (code, context) {
  if (typeof code !== 'string') {
    throw new TypeError('not a string')
  }

  // define disallowed objects in context
  const _context = freshContext()
  // apply "allowed" context vars
  allow(context, _context)

  const sandbox = vm.createContext(_context)
  return vm.runInNewContext('(function () {"use strict"; return ' + code + '})()', sandbox)
}

module.exports = saferEval
