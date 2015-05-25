/*!
 * Copyright by Oleg Efimov
 * and other node-jinba-server contributors
 *
 * See contributors list in README
 *
 * See license text in LICENSE file
 */

/*global describe, it*/

var assert = require("assert");

var JinbaServer = require(process.env.LIB_COV ? '../lib-cov/jinba-server' : '../lib/jinba-server');

describe('JinbaServer', function () {
  it('should export createJinbaServer function', function () {
    assert.ok(typeof JinbaServer.createJinbaServer === 'function');
  });
});
