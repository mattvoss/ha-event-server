(function(){
  "use strict";

  /*  ==============================================================
      Include required packages
  =============================================================== */

  var session = require('express-session'),
      cors = require('cors'),
      bodyParser = require('body-parser'),
      methodOverride = require('method-override'),
      errorhandler = require('errorhandler'),
      cookieParser = require('cookie-parser'),
      favicon = require('serve-favicon'),
      compression = require('compression'),
      morgan = require('morgan'),
      fs = require('fs'),
      nconf = require('nconf'),
      path = require('path'),
      redis = require("redis"),
      url = require('url'),
      config, configFile, opts = {}, userSockets = [], publicKey, privateKey,
      redisConfig = {
          "host": "localhost",
          "port": "6379",
          "ttl": 43200,
          "db": 0
      };

  /*  ==============================================================
      Configuration
  =============================================================== */

  //used for session and password hashes
  var salt = '20sdkfjk23';

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

  if (config.get("log")) {
    var access_logfile = fs.createWriteStream(config.get("log"), {flags: 'a'});
  }

  if (config.get("ssl")) {
    opts.https = {};
    if (config.get("ssl:key")) {
        opts.https.key = fs.readFileSync(config.get("ssl:key"));
    }
    if (config.get("ssl:cert")) {
        opts.https.cert = fs.readFileSync(config.get("ssl:cert"));
    }
    if (config.get("ssl:ca")) {
      opts.https.ca = [];
      config.get("ssl:ca").forEach(function (ca, index, array) {
        opts.https.ca.push(fs.readFileSync(ca));
      });
    }
    console.log("Express will listen: https");
  }

  if (config.get("tokenKey:public")) {
    publicKey = fs.readFileSync(config.get("tokenKey:public")).toString('utf8');
    config.set("publicKey", publicKey);
  }

  if (config.get("tokenKey:private")) {
    privateKey = fs.readFileSync(config.get("tokenKey:private")).toString('utf8');
    config.set("privateKey", privateKey);
  }

  //Session Conf
  if (config.get("redis")) {
    redisConfig = config.get("redis");
  }

  var redisClient = redis.createClient(redisConfig.port, redisConfig.host),
      RedisStore = require('connect-redis')(session);
  opts.secret = salt;
  opts.store = new RedisStore(redisConfig);

  var app = module.exports = require("sockpress").init(opts),
      router = app.express.Router();

  // Express Configuration
  var oneDay = 86400000;

  app.use(compression());
  /**
  if ("log" in config) {
    app.use(app.express.logger({stream: access_logfile }));
  }
  **/
  app.use(cookieParser());
  //app.use(favicon(path.join(__dirname, 'assets','images','favicon.ico')));
  app.use(app.express.static(__dirname + '/public'));     // set the static files location
  app.use('/css', app.express.static(__dirname + '/public/css'));
  app.use('/js', app.express.static(__dirname + '/public/js'));
  app.use('/images', app.express.static(__dirname + '/public/images'));
  app.use('/img', app.express.static(__dirname + '/public/images'));
  app.use('/fonts', app.express.static(__dirname + '/public/fonts'));
  app.use('/css/lib/fonts', app.express.static(__dirname + '/public/fonts'));
  app.use('/assets', app.express.static(__dirname + '/assets'));
  app.use('/lib', app.express.static(__dirname + '/lib'));
  app.use('/bower_components', app.express.static(__dirname + '/bower_components'));
  app.use(morgan('dev')); // log every request to the console
  app.use(bodyParser.urlencoded({'extended':'true'})); // parse application/x-www-form-urlencoded
  app.use(bodyParser.json()); // parse application/json
  app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
  app.use(methodOverride('X-HTTP-Method-Override')); // override with the X-HTTP-Method-Override header in the request
  app.use(cors());

  var routes = require('./routes'),
      ioEvents = require('./ioEvents');

  routes.setKey("configs", config);
  routes.initialize();
  ioEvents.initialize(config);

  /*  ==============================================================
      Routes
  =============================================================== */

  //Standard Routes
  router.get('/', routes.index);
  app.use('/', router);

  /*  ==============================================================
      Socket.IO Routes
  =============================================================== */

  routes.setKey("io", app.io);
  app.io.route('ready', ioEvents.connection);
  app.io.route('room:join', ioEvents.onJoinRoom);
  app.io.route('room:leave', ioEvents.onLeaveRoom);

  /*  ==============================================================
      Launch the server
  =============================================================== */
  var port = (config.get("port")) ? config.get("port") : 3001;
  app.listen(port);

}());
