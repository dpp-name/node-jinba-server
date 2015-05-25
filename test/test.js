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
var http = require("http");

var JinbaServer = require(process.env.LIB_COV ? '../lib-cov/jinba-server' : '../lib/jinba-server');

function testJinbaRequestResponse(jinbaRequest, onResponseEnd) {
  var requestData = (jinbaRequest instanceof Array) ? JSON.stringify(jinbaRequest) : jinbaRequest;

  var requestOptions = {
    hostname: '127.0.0.1',
    port: 3000,
    method: 'POST',
    headers: {
      'Content-Type': 'application/jinba',
      'Content-Length': requestData.length
    }
  };

  var request = http.request(requestOptions, function(response) {
    var responseText = '';

    response.setEncoding('utf8');
    response.on('data', function (chunk) {
      responseText += chunk;
    });
    response.on('end', function () {
      onResponseEnd(responseText);
    });
  });

  request.write(requestData);
  request.end();
}

function assertErrorResponse(requestJson, expectedErrorSubstring, done) {
  var JS = JinbaServer.createJinbaServer(30002, '127.0.0.1', true);
  JS.listen(3000, '127.0.0.1');

  testJinbaRequestResponse(requestJson, function (responseText) {
    var responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch (e) {
      assert.fail("Cannot parse Jinba server response JSON");
      JS.close(done);
      return;
    }

    assert.ok(
      "error" in responseJson,
      "Response does not contains error description"
    );

    assert.ok(
      responseJson.error.indexOf(expectedErrorSubstring) !== -1,
      "Response error description does not contains substring: " + expectedErrorSubstring
    );

    JS.close(done);
  });
}

describe('JinbaServer', function () {
  it('should export createRequestListener() function', function () {
    assert.ok(typeof JinbaServer.createRequestListener === 'function');
  });

  describe('RequestListener', function () {
    it('should check for empty POST data', function (done) {
      assertErrorResponse("", "Empty POST data", done);
    });

    it('should check for broken JSON', function (done) {
      assertErrorResponse("[}", "Cannot parse incoming JSON", done);
    });

    it('should check for wring JSON', function (done) {
      assertErrorResponse("{}", "Incoming JSON is not array", done);
    });

    it('should check for empty JSON', function (done) {
      assertErrorResponse("[]", "Incoming JSON is empty", done);
    });
  });
});
