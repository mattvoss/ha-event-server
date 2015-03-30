
   function socketFac (socketFactory) {
    var myIoSocket = io.connect();

    myIoSocket = socketFactory({
      prefix: ''
    });

    return myIoSocket;
  }

  function MainCtrl ($scope, $http, socket, timeouts) {
    angular.element(".sensors").hide();
    socket.on('connect', function () {
      socket.emit('ready', {date: moment.utc()});
    });
    socket.on('talk', function (data) {
      if ("log" in data) {
        if (data.log.event === "on" || data.log.event === "open") {
         angular.element("#"+data.sensor.address+"B").attr('class', 'ring');
         angular.element("#"+data.sensor.address).show();
         if (data.sensor.address in timeouts) {
           window.clearTimeout(timeouts[data.sensor.address]);
           delete timeouts[data.sensor.address];
         }
         timeouts[data.sensor.address] = setTimeout(
           function() {
             angular.element("#"+data.sensor.address+"B").attr('class', '');
             angular.element("#"+data.sensor.address).hide();
             delete timeouts[data.sensor.address];
           },
           15000
          );
        } else if (data.log.event === "off" || data.log.event === "closed") {
          angular.element("#"+data.sensor.address).hide();
          delete timeouts[data.sensor.address];
        }
      }
      console.log(data);
    });
  }

  MainCtrl.$inject = ['$scope','$http', 'socket', 'timeouts'];

  angular
    .module('HaApp', ['angularMoment', 'ngMaterial', 'btford.socket-io'])
    .value('timeouts', {})
    .factory('socket', socketFac)
    .controller('HaMain',  MainCtrl);
