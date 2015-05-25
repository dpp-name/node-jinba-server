/*!
 * Copyright by Oleg Efimov
 * and other node-jinba-server contributors
 *
 * See contributors list in README
 *
 * See license text in LICENSE file
 */

var http = require('http');
var PinbaRequest = require('pinba').Request;

var requiredRequestFields = [
  'name',
  'value'
];

var requiredMeasurementFields = [
  'name',
  'value'
];

var requiredTagFields = [
  'name',
  'value'
];

var timerValueLimit = 2 * 60 * 10000; // 2 minutes in milliseconds

/** internal
 * checkStructure(jinbaRequest)
 * - jinbaRequest (Object): Jinba request object.
 **/
function checkStructure(jinbaRequest) {
  var error = false;

  requiredRequestFields.forEach(function (requiredRequestField) {
    if (error) {
      return;
    }

    if (!jinbaRequest[requiredRequestField]) {
      error = "request." + requiredRequestField + " is not set";
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
        if (!(requiredTagField in jinbaRequestTag)) {
          error = "request.tags[]." + requiredTagField + " is not set";
        }
      });
    });
  }
  if (error) {
    return error;
  }

  if ("measurements" in jinbaRequest) {
    if (!(jinbaRequest.measurements instanceof Array)) {
      return "request.measurements is not array, but: " + JSON.stringify(jinbaRequest.measurements);
    }

    jinbaRequest.measurements.forEach(function (jinbaRequestMeasurement) {
      if (error) {
        return;
      }

      requiredMeasurementFields.forEach(function (requiredMeasurementField) {
        if (!(requiredMeasurementField in jinbaRequestMeasurement)) {
          error = "request.measurements[]." + requiredMeasurementField + " is not set";
        }
      });
      if (error) {
        return;
      }

      if ("tags" in jinbaRequestMeasurement) {
        if (!(jinbaRequestMeasurement.tags instanceof Array)) {
          return "request.measurements[].tags is not array, but: " + JSON.stringify(jinbaRequestMeasurement.tags);
        }

        jinbaRequestMeasurement.tags.forEach(function (jinbaRequestMeasurementTag) {
          requiredTagFields.forEach(function (requiredTagField) {
            if (!(requiredTagField in jinbaRequestMeasurementTag)) {
              error = "request.measurements[].tags[]." + requiredTagField + " is not set";
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

/** internal
 * checkValues(jinbaRequest)
 * - jinbaRequest (Object): Jinba request object.
 **/
function checkValues(jinbaRequest) {
  var error = false;

  if (jinbaRequest.value > timerValueLimit || jinbaRequest.value < 0) {
    return "request.value is out of limits: " + jinbaRequest.value;
  }

  if ("measurements" in jinbaRequest) {
    jinbaRequest.measurements.forEach(function (jinbaRequestMeasurement) {
      if (error) {
        return;
      }

      if (jinbaRequestMeasurement.value > timerValueLimit || jinbaRequestMeasurement.value < 0) {
        error = "request.measurements[" + jinbaRequestMeasurement.name + "].value is out of limits: " + jinbaRequestMeasurement.value;
      }
    });
  }
  if (error) {
    return error;
  }

  return false;
}

/**
 * createRequestListener(pinbaPort, pinbaHost, isDebug)
 * - pinbaPort (Integer): Pinba server port.
 * - pinbaHost (String): Pinba server host.
 * - isDebug (Boolean): Debugging flag.
 **/
exports.createRequestListener = function createRequestListener(pinbaPort, pinbaHost, isDebug) {
  var sendPinbaRequest = function sendPinbaRequest(jinbaRequest) {
    var pr = new PinbaRequest({
      pinba_server: pinbaHost,
      pinba_port: pinbaPort,
      script_name: jinbaRequest.name
    });

    pr.setRequestTime(jinbaRequest.value / 1000);

    if (jinbaRequest.tags) {
      jinbaRequest.tags.forEach(function (jinbaRequestTag) {
        pr.tagSet(jinbaRequestTag.name, jinbaRequestTag.value);
      });
    }
    
    if (jinbaRequest.measurements) {
      jinbaRequest.measurements.forEach(function (jinbaRequestMeasurement) {
        var tags = {};

        // Request name
        tags.group = jinbaRequestMeasurement.name;

        // Request tags
        if (jinbaRequest.tags) {
          jinbaRequest.tags.forEach(function (jinbaRequestTag) {
            tags[jinbaRequestTag.name] = jinbaRequestTag.value;
          });
        }

        // Measurement tags
        if (jinbaRequestMeasurement.tags) {
          jinbaRequestMeasurement.tags.forEach(function (jinbaRequestMeasurementTag) {
            tags[jinbaRequestMeasurementTag.name] = jinbaRequestMeasurementTag.value;
          });
        }

        pr.timerAdd(tags, jinbaRequestMeasurement.value / 1000);
      });
    }

    var pinbaInfo = pr.getInfo();

    pr.flush();

    return pinbaInfo;
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

      var requestJson;

      try {
        requestJson = JSON.parse(requestPost);
      } catch (e) {
        requestFinalizer(response, {"error": "Cannot parse incoming JSON: " + requestPost});
        return;
      }

      if (!(requestJson instanceof Array)) {
        requestFinalizer(response, {"error": "Incoming JSON is not array: " + requestPost});
        return;
      }

      if (!requestJson.length) {
        requestFinalizer(response, {"error": "Incoming JSON is empty"});
        return;
      }

      responseJson = [];

      requestJson.forEach(function (jinbaRequest) {
        responseJson.push(processJinbaRequest(jinbaRequest));
      });

      requestFinalizer(response, responseJson);
    });
  };
};

/**
 * createJinbaServer(pinbaPort, pinbaHost, isDebug)
 * - pinbaPort (Integer): Pinba server port.
 * - pinbaHost (String): Pinba server host.
 * - isDebug (Boolean): Debugging flag.
 **/
exports.createJinbaServer = function (pinbaPort, pinbaHost, isDebug) {
  return http.createServer(exports.createRequestListener(pinbaPort, pinbaHost, isDebug));
};
