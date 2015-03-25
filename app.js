/*
  Simple example that takes a command line provided serial port destination and routes the output to a file of the same name with .log appended to the port name.

  usage: node logger.js /dev/tty.usbserial <baudrate>

*/

var SerialPort = require("serialport"),
    fs = require("fs"),
    moment = require("moment"),
    hexy = require('hexy'),
    redis = require("redis"),
    nconf = require('nconf'),
    Sequelize = require("sequelize"),
    port = process.argv[2],
    baudrate = process.argv[3],
    active = false,
    bitRcvd = new Buffer(0),
    houseCode =  {'0x6' : 'A', '0x7' : 'B', '0x4' : 'C',
            '0x5' : 'D', '0x8' : 'E', '0x9' : 'F',
            '0xA' : 'G', '0xB' : 'H', '0xE' : 'I',
            '0xF' : 'J', '0xC' : 'K', '0xD' : 'L',
            '0x0' : 'M', '0x1' : 'N', '0x2' : 'O',
            '0x3' : 'P'},
    unitCode = {
      "00" : {"value":1, "state": "ON"}, "10" : {"value":2, "state": "ON"},
      "08" : {"value":3, "state": "ON"}, "18" : {"value":4, "state": "ON"},
      "40" : {"value":5, "state": "ON"}, "50" : {"value":6, "state": "ON"},
      "48" : {"value":7, "state": "ON"}, "58" : {"value":8, "state": "ON"},
      "00" : {"value":9, "state": "ON"}, "10" : {"value":10, "state": "ON"},
      "08" : {"value":11, "state": "ON"}, "18" : {"value":12, "state": "ON"},
      "40" : {"value":13, "state": "ON"}, "50" : {"value":14, "state": "ON"},
      "48" : {"value":15, "state": "ON"}, "58" : {"value":16, "state": "ON"},
      "20" : {"value":1, "state": "OFF"}, "30" : {"value":2, "state": "OFF"},
      "28" : {"value":3, "state": "OFF"}, "38" : {"value":4, "state": "OFF"},
      "60" : {"value":5, "state": "OFF"}, "70" : {"value":6, "state": "OFF"},
      "68" : {"value":7, "state": "OFF"}, "78" : {"value":8, "state": "OFF"},
      "20" : {"value":9, "state": "OFF"}, "30" : {"value":10, "state": "OFF"},
      "28" : {"value":11, "state": "OFF"}, "38" : {"value":12, "state": "OFF"},
      "60" : {"value":13, "state": "OFF"}, "70" : {"value":14, "state": "OFF"},
      "68" : {"value":15, "state": "OFF"},"78" : {"value":16, "state": "OFF"}
    }, db = {}, models = {}, configFile;

if (process.argv[2]) {
  if (fs.lstatSync(process.argv[2])) {
      configFile = require(process.argv[2]);
  } else {
      configFile = process.cwd() + '/config/settings.json';
  }
} else {
  configFile = process.cwd()+'/config/settings.json';
}

config = nconf
.argv()
.env("__")
.file({ file: configFile });

client = redis.createClient(
  config.get("redis:port"),
  config.get("redis:host")
);

pubClient = redis.createClient(
  config.get("redis:port"),
  config.get("redis:host")
);
if (config.get("redis:db") && config.get("redis:db") > 0) {
  pubClient.select(
    config.get("redis:db"),
    function() {
      //console.log("Redis DB set to:", config.get("redis:db"));
    }
  );
  client.select(
    config.get("redis:db"),
    function() {
      //console.log("Redis DB set to:", config.get("redis:db"));
    }
  );
}

db.ha = new Sequelize(
  config.get("mysql:database"),
  config.get("mysql:username"),
  config.get("mysql:password"),
  {
      dialect: 'mysql',
      omitNull: true,
      host: config.get("mysql:host") || "localhost",
      port: config.get("mysql:port") || 3306,
      pool: { maxConnections: 5, maxIdleTime: 30},
      define: {
        freezeTableName: true,
        timestamps: false
      }
});

models.Logs = db.ha.define('logs', {
  id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  type:                 { type: Sequelize.ENUM('sensors', 'hvac', 'lights') },
  typeId:               { type: Sequelize.INTEGER },
  event:                { type: Sequelize.STRING(255) },
  date:                 { type: Sequelize.DATE }
});

models.Sensors = db.ha.define('sensors', {
  id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  address:              { type: Sequelize.STRING(10) },
  description:          { type: Sequelize.TEXT }
});


String.prototype.reverse=function(){return this.split("").reverse().join("");}

function swap8(val) {
    return ((val & 0x1) << 7) | ((val & 0x2) << 5) | ((val & 0x4) << 3) | ((val & 0x8) << 1) | ((val >> 1) & 0x8) | ((val >> 3) & 0x4) | ((val >> 5) & 0x2) | ((val >> 7) & 0x1);
}

function attemptLogging(fd, port, baudrate) {
  if (!active) {
    console.log("Attempting to Log.");
    fs.stat(port,  function (err, stats) {
      if (err) console.log(err);
      if (!err) {
        active = true;
    console.log("Logging active.");
        var serialPort = new SerialPort.SerialPort(port, {
          baudrate: baudrate,
          stopbits: 1,
          databits: 8,
          parity: 'none'
        });
        fs.write(fd, "\n------------------------------------------------------------\nOpening SerialPort: "+target+" at "+moment().format("YYYY-MM-DDTHH:mm:ss")+"\n------------------------------------------------------------\n");
        serialPort.on("data", function (data) {
            bitRcvd = Buffer.concat([bitRcvd, data]);
            //console.log("Raw", hexy.hexy(data));
            //console.log("Length", data.length);
            if (bitRcvd.length >= 4) {
                fs.write(fd, moment().format("YYYY-MM-DDTHH:mm:ss")+" "+bitRcvd.toString('hex')+"\n");
                var house = "0x"+bitRcvd.toString('hex',0,1).charAt(0);
                var unit = (bitRcvd.toString('hex')).substr(4,2);
                var uc = null;
                var action = null;

                house = houseCode[house];

                if ((bitRcvd[0] & 0xf0) == (bitRcvd[1] & 0xf0) && bitRcvd[2] == (~bitRcvd[3] & 0xff) &&
                    (bitRcvd[0] & 0x0f) == (~bitRcvd[1] & 0x0f)) {
                    house = "0x"+bitRcvd.toString('hex',0,1) + ":";
                    uc = "";
                    if (bitRcvd[2] == 0) {
                        //console.log("open");
                        action = "open";
                    } else {
                        //console.log("close");
                        action = "close";
                    }

                } else if (bitRcvd[0] == (~bitRcvd[1] & 0xff) && bitRcvd[2] == (~bitRcvd[3] & 0xff)) {

                    if (bitRcvd[2] & 0x80) {
                        if (bitRcvd[2] & 0x10) {
                            //console.log("dim");
                            action = "dim";
                        } else {
                            //console.log("bright");
                            action = "bright";
                        }

                    } else {
                        uc = ((bitRcvd[2] & 0x10) >> 4) |
                             ((bitRcvd[2] & 0x8) >> 2)  |
                             ((bitRcvd[2] & 0x40) >> 4) |
                             ((bitRcvd[0] & 0x04) << 1);
                        uc += 1;
                        //console.log("uc: ", uc);
                        if (bitRcvd[2] & 0x20) {
                            //console.log("off");
                            action = "off";
                        } else {
                            //console.log("on");
                            action = "on";
                        }

                    }

                } else {
                    uc = "";
                    if (bitRcvd[2] & 0x80) {
                        if (bitRcvd[2] & 0x10) {
                            //console.log("dim");
                            action = "dim";
                        } else {
                            //console.log("bright");
                            action = "bright";
                        }

                    } else {
                        uc = ((bitRcvd[2] & 0x10) >> 4) |
                             ((bitRcvd[2] & 0x8) >> 2)  |
                             ((bitRcvd[2] & 0x40) >> 4) |
                             ((bitRcvd[0] & 0x04) << 1);
                        uc += 1;
                        //console.log("uc: ", uc);
                        if (bitRcvd[2] & 0x20) {
                            //console.log("off");
                            action = "off";
                        } else {
                            //console.log("on");
                            action = "on";
                        }

                    }
                }

                var log = moment().format("YYYY-MM-DDTHH:mm:ss")+" " + " " + house+uc + " " + action;
                console.log(log);
                //fs.write(fd, log+"\n");
              
                async.waterfall([
                  function(cb){
                    models.Sensors
                    .find({
                      where: {
                        address: house+uc
                      }
                    })
                    .then(function(sensor) {
                      cb(null, sensor);
                    })
                    .catch(function(error) {
                      console.log(moment.utc().format("YYYY-MM-DD HH:mm:ssZ"), house+uc, error);
                      cb(error);
                    });
                  },
                  function(sensor, cb){
                    var log = { 
                            "type": "sensor",
                            "typeId": sensor.id,
                            "event": action,
                            "date": moment().format("YYYY-MM-DD HH:mm:ssZ") 
                          };
                    models.Logs.create(
                      log
                    ).then(function(searchLog) {
                      cb(null,{sensor: sensor, log: log});
                    }).catch(function(error) {
                      console.log(moment.utc().format("YYYY-MM-DD HH:mm:ssZ"), error);
                      //syslog.log(syslog.LOG_INFO, error);
                      cb(error);
                    });
                  }
                ],function(error, message) {
                  if (error) console.log(moment.utc().format("YYYY-MM-DD HH:mm:ssZ"), error);
                  pubClient.publish("ha:event", JSON.stringify(message));
                  bitRcvd = new Buffer(0);
                });
            }
        });
        serialPort.on("close", function (data) {
          active = false;
          fs.write(fd, "\n------------------------------------------------------------\nClosing SerialPort: "+target+" at "+Date.now()+"\n------------------------------------------------------------\n");
        });
      }
    });
  }
}

if (!port) {
  console.log("You must specify a serial port location.");
} else {
  var target = port.split("/");
  target = target[target.length-1]+".log";
  if (!baudrate) {
    baudrate = 4800;
  }
  fs.open("./"+target, 'a', function (err, fd) {
    console.log("Opening logfile.")
    setInterval(function () {
      if (!active) {
        try {
          attemptLogging(fd, port, baudrate);
        } catch (e) {
          // Error means port is not available for listening.
          active = false;
        }
      }
    }, 1000);
  });
}


