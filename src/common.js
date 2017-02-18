'use strict'

const clones = require('clones')

const hasWindow = (typeof window !== 'undefined')
exports.hasWindow = hasWindow

const hasGlobal = (typeof global !== 'undefined')
exports.hasGlobal = hasGlobal

/**
* create a fresh context where nearly nothing is allowed
* @private
*/
exports.freshContext = function () {
  // protection might not be complete!
  const context = {
    // disallowed
    global: undefined,
    process: undefined,
    clearImmediate: undefined,
    clearInterval: undefined,
    clearTimeout: undefined,
    setImmediate: undefined,
    setInterval: undefined,
    setTimeout: undefined,
    console: undefined,
    module: undefined,
    require: undefined,
    document: undefined,
    window: undefined,
    Window: undefined,
    // no evil...
    eval: undefined,
    Function: undefined,
    // protect against overwriting
    JSON: clones(JSON),
    Math: clones(Math)
  }

  // locally define all potential global vars
  if (hasGlobal) {
    Object.keys(global).forEach(function (key) {
      context[key] = undefined
    })
  }
  if (hasWindow) {
    Object.keys(window).forEach(function (key) {
      context[key] = undefined
    })
  }

  return context
}

/**
* Apply allowed context properties
* @private
*/
exports.allow = function (context, newContext) {
  Object.keys(context || {}).forEach(function (key) {
    newContext[key] = context[key] // this is harmful - objects can be overwritten
  })
}
