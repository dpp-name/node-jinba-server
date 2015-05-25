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

var sinon = require("sinon");

var JinbaServer = require(process.env.LIB_COV ? '../lib-cov/jinba-server' : '../lib/jinba-server');
var PinbaRequest = require('pinba').Request;

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

function assertResponseGlobalError(done, requestJson, expectedErrorSubstring) {
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

      done();
    }
  );
}

function assertResponseLocalError(done, requestJson, expectedErrorSubstring) {
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

      done();
    }
  );
}

function assertResponseSuccess(done, requestJson, expectedResponseJson) {
  var pr_flush_stub = sinon.stub(PinbaRequest.prototype, "flush");

  assertResponse(
    requestJson,
    function (responseText, responseJson) {
      assert.ok(
        (responseJson instanceof Array) && (responseJson.length == 1),
        "Response should be an array with one object inside: " + responseText
      );

      assert.deepEqual(expectedResponseJson, responseJson[0]);

      assert.ok(pr_flush_stub.calledOnce);

      PinbaRequest.prototype.flush.restore();

      done();
    }
  );
}

describe('JinbaServer', function () {
  it('should export createRequestListener() function', function () {
    assert.ok(typeof JinbaServer.createRequestListener === 'function');
  });

  describe('RequestListener', function () {
    var JS;

    // Hooks

    beforeEach(function () {
      JS = http.createServer(JinbaServer.createRequestListener(30002, '127.0.0.1', true));
      JS.listen(3000, '127.0.0.1');
    });

    afterEach(function (done) {
      JS.close(done);
    });

    // Global request checks

    it('should check for empty POST data', function (done) {
      assertResponseGlobalError(done, "", "Empty POST data");
    });

    it('should check for broken JSON', function (done) {
      assertResponseGlobalError(done, "[}", "Cannot parse incoming JSON");
    });

    it('should check for wring JSON', function (done) {
      assertResponseGlobalError(done, "{}", "Incoming JSON is not array");
    });

    it('should check for empty JSON', function (done) {
      assertResponseGlobalError(done, "[]", "Incoming JSON is empty");
    });

    // Local requests checks

    it('should check for requests required fields', function (done) {
      assertResponseLocalError(done, [{}], "request.value is not set");
    });

    it('should check for requests timer value', function (done) {
      assertResponseLocalError(
        done,
        [
          {
            "name": "/",
            "value": 1000000000
          }
        ],
        "request.value is out of limits"
      );
    });

    it('should check for requests tags type', function (done) {
      assertResponseLocalError(
        done,
        [
          {
            "name": "/",
            "value": 1000000,
            "tags": {}
          }
        ],
        "request.tags is not array"
      );
    });

    it('should check for requests tags required fields', function (done) {
      assertResponseLocalError(
        done,
        [
          {
            "name": "/",
            "value": 1000000,
            "tags": [{}]
          }
        ],
        "request.tags[].value is not set"
      );
    });

    // Local measurements checks

    it('should check for requests measurements type', function (done) {
      assertResponseLocalError(
        done,
        [
          {
            "name": "/",
            "value": 1000000,
            "measurements": {}
          }
        ],
        "request.measurements is not array"
      );
    });

    it('should check for requests measurements required fields', function (done) {
      assertResponseLocalError(
        done,
        [
          {
            "name": "/",
            "value": 1000000,
            "measurements": [{}]
          }
        ],
        "request.measurements[].value is not set"
      );
    });

    it('should check for requests measurements timer value', function (done) {
      assertResponseLocalError(
        done,
        [
          {
            "name": "/",
            "value": 1000000,
            "measurements": [
              {
                "name": "all",
                "value": 1000000000
              }
            ]
          }
        ],
        "request.measurements[all].value is out of limits"
      );
    });

    it('should check for requests measurements tags type', function (done) {
      assertResponseLocalError(
        done,
        [
          {
            "name": "/",
            "value": 1000000,
            "measurements": [
              {
                "name": "all",
                "value": 1000000,
                "tags": {}
              }
            ]
          }
        ],
        "request.measurements[].tags is not array"
      );
    });

    it('should check for requests measurements tags required fields', function (done) {
      assertResponseLocalError(
        done,
        [
          {
            "name": "/",
            "value": 1000000,
            "measurements": [
              {
                "name": "all",
                "value": 1000000,
                "tags": [{}]
              }
            ]
          }
        ],
        "request.measurements[].tags[].value is not set"
      );
    });

    it('should process requests and send them to Pinba', function (done) {
      assertResponseSuccess(
        done,
        [
          {
            "name": "/",
            "value": 1000000,
            "tags": [
              {
                "name": "scheme",
                "value": "HTTPS"
              }
            ],
            "measurements": [
              {
                "name": "all",
                "value": 1000000,
                "tags": [
                  {
                    "name": "some",
                    "value": "thing"
                  }
                ]
              }
            ]
          }
        ],
        {
          "hostname": 'unknown',
          "server_name": 'unknown',
          "script_name": '/',
          "schema": "unknown",
          "req_count": 1,
          "req_time": 1000,
          "ru_utime": 0,
          "ru_stime": 0,
          "timers": [
            {
              "value": 1000,
              "started": false,
              "tags": {
                "group": "all",
                "scheme": "HTTPS",
                "some": "thing"
              }
            }
          ],
          "tags": {
            "scheme": "HTTPS"
          }
        }
      );
    });
  });
});
