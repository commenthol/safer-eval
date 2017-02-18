/**
* @copyright 2017 Commenthol
* @license MIT
*/

'use strict'

const {freshContext, allow} = require('./common')

/**
* A safer approach for eval. (Browser)
*
* This might not be as safe as the nodeJs version as there is no real sandboxing
* available in the browser.
*
* **Warning: This function might be harmful - so you are warned!**
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
* var code = `{d: new Date('1970-01-01'), b: function () { return navigator.userAgent }`
* var res = saferEval(code, {navigator: window.navigator})
* // => toString.call(res.d) = '[object Date]'
* // => toString.call(res.b) = '[object Function]'
*/
function saferEval (code, context) {
  if (typeof code !== 'string') {
    throw new TypeError('not a string')
  }
  // define disallowed objects in context
  const _context = freshContext()
  // apply "allowed" context vars
  allow(context, _context)

  let src = ''
  // set local scope vars from each context property
  Object.keys(_context).forEach(function (key) {
    src += 'var ' + key + ' = _context[\'' + key + '\'];\n'
  })
  src += 'return ' + code + ';\n'

  return Function('_context', src).call(null, _context) // eslint-disable-line
}

module.exports = saferEval
