
  var app = angular.module('HaApp', ['angularMoment', 'ngMaterial', 'btford.socket-io']), timeouts = {};

  app.factory('socket', function (socketFactory) {
    var myIoSocket = io.connect();

    myIoSocket = socketFactory({
      prefix: ''
    });

    return myIoSocket;
  });

  app.controller('HaMain', ['$scope','$http', 'socket', function($scope, $http, socket) {
    angular.element(".sensors").hide();
    socket.on('connect', function () {
      socket.emit('ready', {date: moment.utc()});
    });
    socket.on('talk', function (data) {
      if ("log" in data) {
        if (data.log.event === "on") {
         angular.element("#"+data.sensor.address).show();
         if (data.sensor.address in timeouts) {
           window.clearTimeout(timeouts[data.sensor.address]);
           delete timeouts[data.sensor.address];
         }
         timeouts[data.sensor.address] = setTimeout(
           function() {
             console.log("hiding", data.sensor.address);
             angular.element("#"+data.sensor.address).hide();
             delete timeouts[data.sensor.address];
           },
           15000
          );
        } else if (data.log.event === "off") {
          angular.element("#"+data.sensor.address).hide();
          delete timeouts[data.sensor.address];
        }
      }
      console.log(data);
    });
  }]);

