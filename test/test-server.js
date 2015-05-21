/*!
 * Copyright by Oleg Efimov
 * and other node-jinba-server contributors
 *
 * See contributors list in README
 *
 * See license text in LICENSE file
 */

var JinbaServer = require('../');

JinbaServer.createJinbaServer(30002, '127.0.0.1', true).listen(3000, '127.0.0.1');
