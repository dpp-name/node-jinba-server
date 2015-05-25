/*!
 * Copyright by Oleg Efimov
 * and other node-jinba-server contributors
 *
 * See contributors list in README
 *
 * See license text in LICENSE file
 */

var http = require('http');

var JinbaServer = require('../');

console.log("Start listening...");
http.createServer(JinbaServer.createRequestListener(30002, '127.0.0.1', true)).listen(3000, '127.0.0.1');
console.log("Listening stared.");
