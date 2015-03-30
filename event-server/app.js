/*jshint bitwise: false*/

/*
  Simple example that takes a command line provided serial port destination and routes the output to a file of the same name with .log appended to the port name.

  usage: node logger.js /dev/tty.usbserial <baudrate>

*/

(function(){
  "use strict";

  var SerialPort = require("serialport"),
      fs = require("fs"),
      async = require('async'),
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
      db = {}, models = {}, configFile, config, client, pubClient;

  configFile = process.cwd()+'/config/settings.json';

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
        logging: config.get("mysql:logging") || false,
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


  String.prototype.reverse = function() {
    return this.split("").reverse().join("");
  };

  function attemptLogging(fd, port, baudrate) {
    if (!active) {
      console.log("Attempting to Log.");
      fs.stat(port,  function (err, stats) {
        if (err) { console.log(err); }
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
                  //fs.write(fd, moment().format("YYYY-MM-DDTHH:mm:ss")+" "+bitRcvd.toString('hex')+"\n");
                  var out = bitRcvd.slice(0,4);
                  bitRcvd = bitRcvd.slice(4);
                  var house = "0x"+out.toString('hex',0,1).charAt(0);
                  //console.log("house:", house);
                  var unit = (out.toString('hex')).substr(4,2);
                  //console.log("unit:", unit);
                  var uc = null;
                  var action = null;

                  house = houseCode[house];

                  if ((out[0] & 0xf0) === (out[1] & 0xf0) && out[2] === (~out[3] & 0xff) &&
                      (out[0] & 0x0f) === (~out[1] & 0x0f)) {
                    var status = {
                          "04": {action: "open", delay: "min", battery: "normal"},
                          "84": {action: "closed", delay: "min", battery: "normal"},
                          "00": {action: "open", delay: "max", battery: "normal"},
                          "80": {action: "closed", delay: "max", battery: "normal"},
                          "01": {action: "open", delay: "min", battery: "low"},
                          "81": {action: "closed", delay: "min", battery: "low"},
                          "05": {action: "open", delay: "max", battery: "low"},
                          "85": {action: "closed", delay: "max", battery: "low"},
                        },
                        stat = status[unit];
                    house = "0x"+out.toString('hex',0,1);
                    uc = "";
                    if ("action" in stat) {
                      action = stat.action;
                    } else {
                      action = null;
                    }

                  } else if (out[0] === (~out[1] & 0xff) && out[2] === (~out[3] & 0xff)) {

                    if (out[2] & 0x80) {
                      if (out[2] & 0x10) {
                        //console.log("dim");
                        action = "dim";
                      } else {
                        //console.log("bright");
                        action = "bright";
                      }

                    } else {
                      uc = ((out[2] & 0x10) >> 4) |
                           ((out[2] & 0x8) >> 2)  |
                           ((out[2] & 0x40) >> 4) |
                           ((out[0] & 0x04) << 1);
                      uc += 1;
                      //console.log("uc: ", uc);
                      if (out[2] & 0x20) {
                        //console.log("off");
                        action = "off";
                      } else {
                        //console.log("on");
                        action = "on";
                      }

                    }

                  } else {
                    uc = "";
                    if (out[2] & 0x80) {
                        if (out[2] & 0x10) {
                            //console.log("dim");
                            action = "dim";
                        } else {
                            //console.log("bright");
                            action = "bright";
                        }

                    } else {
                        uc = ((out[2] & 0x10) >> 4) |
                             ((out[2] & 0x8) >> 2)  |
                             ((out[2] & 0x40) >> 4) |
                             ((out[0] & 0x04) << 1);
                        uc += 1;
                        //console.log("uc: ", uc);
                        if (out[2] & 0x20) {
                            //console.log("off");
                            action = "off";
                        } else {
                            //console.log("on");
                            action = "on";
                        }

                    }
                  }

                  var log = moment().format("YYYY-MM-DDTHH:mm:ss")+" " + " " + house+uc + " " + action;
                  //console.log(log);
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
                      if (sensor) {
                        var log = {
                                "type": "sensors",
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
                      } else {
                        console.log(moment.utc().format("YYYY-MM-DD HH:mm:ssZ"), "Unknown:", house+uc);
                      }
                    }
                  ],function(error, message) {
                    if (error) {
                      console.log(moment.utc().format("YYYY-MM-DD HH:mm:ssZ"), error);
                    }
                    pubClient.publish("ha:event", JSON.stringify(message));
                    //bitRcvd = new Buffer(0);
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
      console.log("Opening logfile.");
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

}());
