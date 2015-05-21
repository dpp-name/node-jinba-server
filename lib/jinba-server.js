/*!
 * Copyright by Oleg Efimov
 * and other node-jinba-server contributors
 *
 * See contributors list in README
 *
 * See license text in LICENSE file
 */

var http = require('http');
var _ = require('lodash');
var PinbaRequest = require('pinba').Request;

var requiredRequestFields = [
  'name',
  'value'
];

var requiredTimerFields = [
  'name',
  'value'
];

var requiredTagFields = [
  'name',
  'value'
];

var timerValueLimit = 2 * 60 * 10000; // 2 minutes in milliseconds

function checkStructure(jinbaRequest) {
  var error = false;

  requiredRequestFields.forEach(function (requiredRequestField) {
    if (error) {
      return;
    }

    if (!jinbaRequest[requiredRequestField]) {
      error = "request." + requiredRequestField + " is not set: ";
    }
  });
  if (error) {
    return error;
  }

  if ("tags" in jinbaRequest) {
    if (!(jinbaRequest.tags instanceof Array)) {
      return "request.tags is not array, but: " + JSON.stringify(jinbaRequest.tags);
    }
    jinbaRequest.tags.forEach(function (jinbaRequestTag) {
      if (error) {
        return;
      }

      requiredTagFields.forEach(function (requiredTagField) {
        if (!jinbaRequestTag[requiredTagField]) {
          error = "request.tags[]." + requiredTagField + " is not set";
        }
      });
    });
  }
  if (error) {
    return error;
  }

  if ("timers" in jinbaRequest) {
    if (!(jinbaRequest.tags instanceof Array)) {
      return "request.timers is not array, but: " + JSON.stringify(jinbaRequest.timers);
    }

    jinbaRequest.timers.forEach(function (jinbaRequestTimer) {
      if (error) {
        return;
      }

      requiredTimerFields.forEach(function (requiredTimerField) {
        if (!jinbaRequestTimer[requiredTimerField]) {
          error = "request.timers[]." + requiredTimerField + " is not set";
        }
      });
      if (error) {
        return;
      }

      if ("tags" in jinbaRequestTimer) {
        if (!(jinbaRequestTimer.tags instanceof Array)) {
          return "request.timers[].tags is not array, but: " + JSON.stringify(jinbaRequestTimer.tags);
        }

        jinbaRequestTimer.tags.forEach(function (jinbaRequestTimerTag) {
          requiredTagFields.forEach(function (requiredTagField) {
            if (!jinbaRequestTimerTag[requiredTagField]) {
              error = "request.timers[].tags[]." + requiredTagField + " is not set";
            }
          });
        });
      }
    });
  }
  if (error) {
    return error;
  }

  return false;
}

function checkValues(jinbaRequest) {
  var error = false;

  if (jinbaRequest.value > timerValueLimit || jinbaRequest.value < 0) {
    return "request.value is out of limits: " + jinbaRequest.value;
  }

  if ("timers" in jinbaRequest) {
    jinbaRequest.timers.forEach(function (jinbaRequestTimer) {
      if (error) {
        return;
      }

      if (jinbaRequestTimer.value > timerValueLimit || jinbaRequestTimer.value < 0) {
        error = "request.timers[" + jinbaRequestTimer.name + "].value is out of limits: " + jinbaRequestTimer.value;
      }
    });
  }
  if (error) {
    return error;
  }

  return false;
}

exports.createRequestListener = function createRequestListener(pinbaPort, pinbaHost, isDebug) {
  var sendPinbaRequest = function sendPinbaRequest() {
    //console.log(pinbaHost);
    //console.log(pinbaPort);

    var pr = new PinbaRequest({
      pinba_server: pinbaHost,
      pinba_port: pinbaPort
    });

    pr.flush();
  };

  var processJinbaRequest = function processJinbaRequest(jinbaRequest) {
    var error;

    error = checkStructure(jinbaRequest);
    if (error) {
      return {"error": error};
    }

    error = checkValues(jinbaRequest);
    if (error) {
      return {"error": error};
    }

    return sendPinbaRequest(jinbaRequest);
  };

  var requestFinalizer = function requestFinalizer(response, responseJson) {
    var responseBody = isDebug ? JSON.stringify(responseJson) : '{}';

    response.writeHead(
      200,
      {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Length': responseBody.length
      }
    );

    response.write(responseBody);

    response.end();
  };

  return function requestListener(request, response) {
    var requestPost = '', responseJson = [];

    request.on('data', function(data) {
      requestPost += data;
    });
    request.on('end', function() {
      if (!requestPost) {
        requestFinalizer(response, {"error": "Empty POST data"});
        return;
      }

      try {
        var requestJson = JSON.parse(requestPost);
      } catch (e) {
        requestFinalizer(response, {"error": "Cannot parse incoming JSON: " + requestPost});
        return;
      }

      if (!requestJson) {
        requestFinalizer(response, {"error": "Incoming JSON is empty: " + requestPost});
        return;
      }

      if (!(requestJson instanceof Array)) {
        requestFinalizer(response, {"error": "Incoming JSON is not array, but: " + requestPost});
        return;
      }

      responseJson = [];

      _.forOwn(requestJson, function (jinbaRequest) {
        responseJson.push(processJinbaRequest(jinbaRequest));
      });

      requestFinalizer(response, responseJson);
    });
  };
};

exports.createJinbaServer = function (pinbaPort, pinbaHost, isDebug) {
  var JinbaServer = http.createServer(exports.createRequestListener(pinbaPort, pinbaHost, isDebug));

  if (isDebug) {
    var origListen = JinbaServer.listen;

    JinbaServer.listen = function () {

      console.log("Start listening...");
      origListen.apply(JinbaServer, arguments);
      console.log("Listening stared.");
    };
  }

  return JinbaServer;
};
