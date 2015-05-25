/*!
 * Copyright by Oleg Efimov
 * and other node-jinba-server contributors
 *
 * See contributors list in README
 *
 * See license text in LICENSE file
 */

/*global describe, it, beforeEach, afterEach */

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

function assertResponse(requestJson, onResponseJson) {
  testJinbaRequestResponse(requestJson, function (responseText) {
    var responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch (e) {
      assert.fail("Cannot parse Jinba server response JSON");
      return;
    }

    onResponseJson(responseText, responseJson);
  });
}

function assertResponseGlobalError(requestJson, expectedErrorSubstring) {
  assertResponse(
    requestJson,
    function (responseText, responseJson) {
      assert.ok(
        "error" in responseJson,
        "Response does not contains error description: " + responseText
      );

      assert.ok(
        responseJson.error.indexOf(expectedErrorSubstring) !== -1,
        "Response error description '" + responseJson.error + "' does not contains substring '" + expectedErrorSubstring + "'"
      );
    }
  );
}

function assertResponseLocalError(requestJson, expectedErrorSubstring) {
  assertResponse(
    requestJson,
    function (responseText, responseJson) {
      assert.ok(
        (responseJson instanceof Array) && (responseJson.length == 1),
        "Response should be an array with one object inside: " + responseText
      );

      assert.ok(
        "error" in responseJson[0],
        "Response does not contains error description: " + responseText
      );

      assert.ok(
        responseJson[0].error.indexOf(expectedErrorSubstring) !== -1,
        "Response error description '" + responseJson[0].error + "' does not contains substring '" + expectedErrorSubstring + "'"
      );
    }
  );
}

describe('JinbaServer', function () {
  it('should export createJinbaServer() function', function () {
    assert.ok(typeof JinbaServer.createJinbaServer === 'function');
  });

  it('should export createRequestListener() function', function () {
    assert.ok(typeof JinbaServer.createRequestListener === 'function');
  });

  describe('RequestListener', function () {
    var JS;

    beforeEach(function () {
      JS = JinbaServer.createJinbaServer(30002, '127.0.0.1', true);
      JS.listen(3000, '127.0.0.1');
    });

    afterEach(function (done) {
      JS.close(done);
    });

    it('should check for empty POST data', function () {
      assertResponseGlobalError("", "Empty POST data");
    });

    it('should check for broken JSON', function () {
      assertResponseGlobalError("[}", "Cannot parse incoming JSON");
    });

    it('should check for wring JSON', function () {
      assertResponseGlobalError("{}", "Incoming JSON is not array");
    });

    it('should check for empty JSON', function () {
      assertResponseGlobalError("[]", "Incoming JSON is empty");
    });

    it('should check for Jinba requests structure', function () {
      assertResponseLocalError([{}], "request.name is not set");
    });

    it('should check for Jinba requests timer values', function () {
      assertResponseLocalError(
        [
          {
            "name": "/",
            "value": 1000000000
          }
        ],
        "request.value is out of limits"
      );
    });
  });
});
