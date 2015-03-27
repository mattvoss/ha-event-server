(function(){
  "use strict";

  var config;

  exports.connection = function (socket, data) {
    console.log("socket connected");
    socket.emit('talk', {
      message: 'io event from an io route on the server',
    });
  };

  exports.onJoinRoom = function(socket, data) {
    console.log("Join Room", data);
    socket.join(data);
  };

  exports.onLeaveRoom = function(socket, data) {
    //console.log("Join Room", req.data, ":", req.session.id, "-", req.socket.id);
    socket.leave(data);
  };

  exports.initialize = function(options) {
      config = options;
  };

}());
