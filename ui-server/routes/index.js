(function(){
  "use strict";

  var fs = require('fs'),
      path = require('path'),
      crypto = require('crypto'),
      spawn = require('child_process').spawn,
      async = require('async'),
      underscore = require('underscore'),
      handlebars = require('handlebars'),
      Sequelize = require("sequelize"),
      Swag = require('swag'),
      moment = require('moment'),
      redis = require("redis"),
      nconf = require('nconf'),
      db = {},
      models = {},
      opts = {},
      config = {},
      reconnectTries = 0, cacheBuster = moment().format("X"),
      hmac, signature, connection, client, key, cert,
      transport, acl, subClient, analytics = "", appInfo = {}, pubClient;

  Swag.registerHelpers(handlebars);
  // searchUid = MD5(restaurant.id + timestamp(userSearch.date)+userSearch.partySize)


  exports.setKey = function(key, value) {
    opts[key] = value;
  };


  exports.initialize = function() {
    //Initialize PGsql
    //getConnection();

    //Initialize Email Client
    var setSubscription = function() {
          subClient.psubscribe("ha:*");
          subClient.on("pmessage", function (pattern, channel, message) {
            console.log("channel ", channel, ": ", message);
            if (channel === "ha:event") {
              message = JSON.parse(message);
              message.objectType = "ha-event";
              opts.io.emit('talk', message);
              //opts.io.room(message.uid).broadcast('talk', message);
            }
          });
        };

    console.log(opts.configs.get("redis"));
    subClient = redis.createClient(
      opts.configs.get("redis:port"),
      opts.configs.get("redis:host")
    );
    pubClient = redis.createClient(
      opts.configs.get("redis:port"),
      opts.configs.get("redis:host")
    );
    if (opts.configs.get("redis:db") && opts.configs.get("redis:db") > 0) {
      subClient.select(
        opts.configs.get("redis:db"),
        function() {
          console.log("Redis DB set to:", opts.configs.get("redis:db"));
          setSubscription();
        }
      );
      pubClient.select(
        opts.configs.get("redis:db"),
        function() {
          //console.log("Redis DB set to:", config.get("redis:db"));
        }
      );
    } else {
      setSubscription();
    }

    db.ha = new Sequelize(
      opts.configs.get("mysql:database"),
      opts.configs.get("mysql:username"),
      opts.configs.get("mysql:password"),
      {
          dialect: 'mysql',
          omitNull: true,
          logging: opts.configs.get("mysql:logging") || false,
          host: opts.configs.get("mysql:host") || "localhost",
          port: opts.configs.get("mysql:port") || 3306,
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
  };

  /************
  * Routes
  *************/

  exports.index = function(req, res){
    var init = "$(document).ready(function() { Dining.appInfo = new Dining.Models.AppInfoModel(" + JSON.stringify(appInfo) + ");Dining.start(); });";
    async.waterfall(
      [
        function(callback) {
          fs.readFile(
            __dirname + '/../assets/images/floorplan.svg',
            'utf8',
            function(error, content) {
              callback(error, content);
            }
          );
        },
        function(svg, callback) {
          fs.readFile(
            __dirname + '/../assets/templates/index.html',
            'utf8',
            function(error, content) {
              //console.log(content);
              var pageBuilder = handlebars.compile(content),
                  html = pageBuilder({
                    'svg': svg,
                    'cacheBuster': cacheBuster
                  });
              //console.log(html);
              callback(error, html);
            }
          );
        }
      ],
      function(error, html) {
        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.write("error", 'utf-8');
          res.end('\n');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.write(html, 'utf-8');
          res.end('\n');
        }
      }
    );
  };

  var sendBack = function(data, status, res) {
    res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
    res.writeHead(status, { 'Content-type': 'application/json' });
    res.write(JSON.stringify(data), 'utf-8');
    res.end('\n');
  };


  function pad(num, size) {
      var s = num+"";
      while (s.length < size) { s = "0" + s; }
      return s;
  }

  if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return this.replace(/^\s+|\s+$/g, '');
    };
  }

}());
