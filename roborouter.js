var express = require('express')
	, angular = require('angular')
	, passport = require('passport')
	, LocalStrategy = require('passport-local').Strategy
	, mongodb = require('mongodb')
	, mongoose = require('mongoose')
	, bcrypt = require('bcrypt')
	, colors = require('colors')
	, SALT_WORK_FACTOR = 10;

var debug = process.env.DEBUG;	

if (!debug) {
	mongoose.connect('localhost', 'test');
	var db = mongoose.connection;
	db.on('error', console.error.bind(console, 'connection error:'));
	db.once('open', function callback() {
		console.log('Connected to DB');
	});
}

// First, checks if it isn't implemented yet.
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

var app = express();

// configure Express
app.configure(function() {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.engine('ejs', require('ejs-locals'));
	app.use(express.logger());
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.session({ secret: 'keyboard cat' })); // CHANGE THIS SECRET!
	// Remember Me middleware
	app.use( function (req, res, next) {
		if ( req.method == 'POST' && req.url == '/login' ) {
			if ( req.body.rememberme ) {
				req.session.cookie.maxAge = 2592000000; // 30*24*60*60*1000 Rememeber 'me' for 30 days
			} else {
				req.session.cookie.expires = false;
			}
		}
		next();
	});
	// Initialize Passport!  Also use passport.session() middleware, to support
	// persistent login sessions (recommended).
	app.use(passport.initialize());
	app.use(passport.session());
	app.use(app.router);
	app.use(express.static(__dirname));
	app.use(express.static(__dirname + '/static'));
	app.use('/scripts', express.static(__dirname + '/scripts'));
	app.use('/images', express.static(__dirname + '/images'));
});

if (!debug) {
	app.all('*', function(req, res, next) {
		if (/^\/login|\.css$/g.test(req.url)) {
			return next();
		} else if (req.isAuthenticated()) {
			return next();
		} else {
			return res.redirect('/login');
		}
	});
}

app.get('/login', function(req, res){
	res.render('login', { user: req.user, message: req.session.messages });
});

// app.get('/', function(req, res){
// 	res.render('home', { page: "home" });
// });

app.get('/home', function(req, res){
	res.render('home', { page: "home" });
});

app.get('/settings', function(req, res){
	res.render('settings', { page: "settings", message: req.session.messages });
});

/*
app.get('/', function(req, res){
	res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
	res.render('account', { user: req.user });
});*/



// POST /login
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
//
//   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
//   
/***** This version has a problem with flash messages
app.post('/login', 
	passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
	function(req, res) {
		res.redirect('/');
	});
*/
	
// POST /login
//   This is an alternative implementation that uses a custom callback to
//   acheive the same functionality.
app.post('/login', function(req, res, next) {
	passport.authenticate('local', function(err, user, info) {
		if (err) { return next(err) }
		if (!user) {
			req.session.messages =  [info.message];
			return res.redirect('/login')
		}
		req.logIn(user, function(err) {
			if (err) { return next(err); }
			return res.redirect('/home');
		});
	})(req, res, next);
});

app.get('/', function(req, res) {
	res.redirect('/home');
});

app.get('/logout', function(req, res){
	req.logout();
	res.redirect('/');
});

app.listen(3000, function() {
	console.log('Express server listening on port 3000');
});


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
// function ensureAuthenticated(req, res, next) {
//   if (req.isAuthenticated()) { return next(); }
//   res.redirect('/login.html')
// }

// User Schema
var userSchema = mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true},
	accessToken: { type: String } // Used for Remember Me
});

// Bcrypt middleware
userSchema.pre('save', function(next) {
	var user = this;

	if(!user.isModified('password')) {
		console.log("pwd not modified");
		return next();
	} else {
		console.log("pwd modified");
	}

	bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
		if(err) return next(err);

		bcrypt.hash(user.password, salt, function(err, hash) {
			if(err) return next(err);
			user.password = hash;
			next();
		});
	});
});

// Password verification
userSchema.methods.comparePassword = function(candidatePassword, cb) {
	console.log("candidate", candidatePassword, "this", this.password);
	bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
		if(err) return cb(err);
		cb(null, isMatch);
	});
};

// Remember Me implementation helper method
userSchema.methods.generateRandomToken = function () {
	var user = this,
			chars = "_!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
			token = new Date().getTime() + '_';
	for ( var x = 0; x < 16; x++ ) {
		var i = Math.floor( Math.random() * 62 );
		token += chars.charAt( i );
	}
	return token;
};

// Seed a user
var User = mongoose.model('User', userSchema);
// var usr = new User({ username: 'admin', password: 'admin' });
User.findOne({ username: 'admin' }, function(err, user) {
	if (err) { 
		console.log("find user error"); 
	}
	if (!user) { 
		var usr = new User({ username: 'admin', password: 'admin' });
		usr.save(function(err) {
			if(err) {
				console.log(err);
			} else {
				console.log('user: ' + usr.username + " created.");
			}
		});
	} else {
		console.log("user found");
		var usr = user;
	}
});



// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
//
//   Both serializer and deserializer edited for Remember Me functionality
passport.serializeUser(function(user, done) {
	var createAccessToken = function () {
		var token = user.generateRandomToken();
		User.findOne( { accessToken: token }, function (err, existingUser) {
			if (err) { return done( err ); }
			if (existingUser) {
				createAccessToken(); // Run the function again - the token has to be unique!
			} else {
				user.set('accessToken', token);
				user.save( function (err) {
					if (err) return done(err);
					return done(null, user.get('accessToken'));
				})
			}
		});
	};

	if ( user._id ) {
		createAccessToken();
	}
});

passport.deserializeUser(function(token, done) {
	User.findOne( {accessToken: token } , function (err, user) {
		done(err, user);
	});
});


// Use the LocalStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.  In the real world, this would query a database;
//   however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy(function(username, password, done) {
	User.findOne({ username: username }, function(err, user) {
		if (err) { return done(err); }
		if (!user) { return done(null, false, { message: 'Unknown user ' + username }); }
		user.comparePassword(password, function(err, isMatch) {
			if (err) return done(err);
			if(isMatch) {
				return done(null, user);
			} else {
				return done(null, false, { message: 'Invalid password' });
			}
		});
	});
}));

checkConfirmationPassword = function(new_pwd, confirm_pwd) {
	return new_pwd === confirm_pwd;
}

// return user object if correct password provided
checkPassword = function(pwd, cb) {
	User.findOne({ username: 'admin' }, function(err, user) {
		if (err) { 
			return console.log("failed to contact db");
		}
		if (!user) { 
			return console.log("Unknown user " + username);
		}
		user.comparePassword(pwd, function(err, isMatch) {
			if (err) {
				console.log("Error: ", err);
				return cb(err);
			} else if(isMatch) {
				console.log("match true");
				return cb(null, user);
			} else {
				console.log("match false");
				return cb("Invalid password");
			}
		});
	});
}

// change password to newPwd if correct old password provided
changePassword = function(oldPwd, newPwd, cb) {
	checkPassword(oldPwd, function(err, user) {
		if (user) {
			user.password = newPwd;
			user.save(function(err) {
				if(err) {
					console.log(err);
					return cb(err);
				} else {
					console.log("pwd changed for user: " + user.username);
					return cb(null);
				}
			});
		} else {
			return cb(err);
		}
	});
}

app.post('/save_pwd', function(req, res, next) {
	var account = req.body;
	if (checkConfirmationPassword(account.new_pwd, account.confirm_pwd)) {
		changePassword(account.old_pwd, account.new_pwd, function(err) {
			if (!err) {
				console.log("password changed");
				res.send({ success: true, mismatch: false, message: null});
			} else {
				console.log("failed to change password:", err);
				res.send({ success: false, mismatch: false, message: err});
			}
		});
	} else {
		console.log("password mismatch".red);
		res.send({ success: false, mismatch: true, message: "Confirmation mismatch"});
	};
});

var util	= require('util'),
	exec	= require('child_process').exec,
	child;


var mainInterface = 'eth0';

// for now fixed to wlan0, the RasPi won't be able to handle more
// than one wlan interface anyway, but theoretically this could
// be made changable parameter too
var robotInterface = 'wlan1';

var wpa_cli_cmd = 'wpa_cli -i' + robotInterface + ' ';

var command, result;
executeCommand = function(command, cb) {
	console.log("execute".blue, command);
	child = exec(command, function(error, stdout, stderr) {
		console.log('stdout:' + stdout);
		console.log('stderr:' + stderr);
		if (error) {
			return cb(error, stderr);
		}
		// console.log('ready')
		// if (stdout.match('FAIL')) {
		// 	return cb(null, '');
		// } else {
		return cb(null, stdout);
		// }
	});
	// console.log('done')
}

// following command produces a sorted list of unique networks names
// iwlist wlan0 scans the wireless interface
//  .. the result is filtered by the string SSID
//  .. then each line is separated by the : and only the second field is printed
//  .. now filter out empty results
//  .. sort them by name
//  .. and only print unique results
// var command = 'sudo iwlist wlan1 scan | grep SSID | cut -d: -f2 | sort | uniq';
// var command = "wpa_cli -i' + robotInterface + ' scan_results | awk '/\[/{print $5}' | sort | uniq"

// scanNetworks = function(cb) {
// 	console.log("search networks");

// 	// first issue the scan command
// 	command = wpa_cli_cmd + ' scan';
// 	executeCommand(command, function(err, result) {
// 		if (err) {
// 			return cb(err, result)
// 		} else {

// 			setTimeout(function() {
// 				// then obtain the scan results
// 				// .. use only the column 5 (which corresponds to the ssid)
// 				// .. sort it
// 				// .. and print only unique results
// 				command = "wpa_cli -i" + robotInterface + " scan_results | awk -F'\\t' '/\\[/{print $5\";\"$4}' | sort | uniq";
// 				// child = exec(command, function(error, stdout, stderr) {
// 				// 	console.log('stdout:' + stdout);
// 				// 	console.log('stderr:' + stderr);
// 				// 	if (error) {
// 				// 		return cb(error, stderr);
// 				// 	} else {
// 				// 		// remove " from the strings, then split by newlines
// 				// 		// to get an array with each element containing a network name
// 				// 		var list = stdout.replace(/\"/g, "").split("\n")
// 				// 		// remove all empty elements
// 				// 		var index;
// 				// 		while ((index = list.indexOf("")) != -1) {
// 				// 			list.splice(index,1);
// 				// 		}
// 				// 		return cb(null, list);
// 				// 	}
// 				// });
// 				executeCommand(command, function(err, result) {
// 					if (err) {
// 						return cb(err, result)
// 					} else {
// 						var list = result.replace(/\"/g, "").split("\n")
// 						// remove all empty elements
// 						var index;
// 						// while ((index = list.indexOf("")) != -1) {
// 						// 	list.splice(index,1);
// 						// }
// 						networks = [];
// 						for (var i = 0; i < list.length; ++i) {
// 							if (list[i] != "") {
// 								var net = list[i].split(";");
// 								networks.push({ ssid: net[0], security: getSecurity(net[1])});
// 							}
// 						}

// 						if (networks.length == 0) {
// 							return cb("error", "no networks found");
// 						} else {
// 							return cb(null, networks);
// 						}
// 					}
// 				});
// 			}, 2000);
// 		}
// 	});
// }

// following command produces a sorted list of unique networks names
// iwlist wlan0 scans the wireless interface
//  .. the result is filtered by the string SSID
//  .. then each line is separated by the : and only the second field is printed
//  .. now filter out empty results
//  .. sort them by name
//  .. and only print unique results
// var command = 'sudo iwlist wlan1 scan | grep SSID | cut -d: -f2 | sort | uniq';
// var command = "wpa_cli -i' + robotInterface + ' scan_results | awk '/\[/{print $5}' | sort | uniq"
// var command = "wpa_cli -i" + robotInterface + " scan_results | awk -F'\\t' '/\\[/{print $5\";\"$4}' | sort | uniq";

scanNetworks = function(cb) {
	console.log("scan networks".yellow);

	var res;
	var networks = [];

	recursive = function(cb, step) {
		console.log("step", step);
		switch(step) {
		case 0:
			command = wpa_cli_cmd + ' scan';
			break;
		case 1:
			// give some time for the scan results to arrive
			return setTimeout(recursive(cb, ++step), 2000);
		case 2:
			// then obtain the scan results
			// .. use only the columns 4 and 5 (which corresponds to the ssid and security level)
			// .. sort it
			// .. and print only unique results
			command = "wpa_cli -i" + robotInterface + " scan_results | awk -F'\\t' '/\\[/{print $5\";\"$4}' | sort | uniq";
			break;
		case 3:
			var list = res.replace(/\"/g, "").split("\n")
			for (var i = 0; i < list.length; ++i) {
				if (list[i] != "") {
					var net = list[i].split(";");
					networks.push({ ssid: net[0], security: getSecurity(net[1])});
				}
			}
		default:
			// finished
			if (networks.length == 0) {
				return cb("error", "no networks found");
			} else {
				return cb(null, networks);
			}
		}

		executeCommand(command, function(err, result) {
			if (err) {
				return cb(err, result)
			} else {
				res = result;
				return recursive(cb, ++step);
			}
		});
	}

	recursive(cb, 0);
}

var OPEN 	= 0;
	WEP 	= 1;
	WPA 	= 2;

getSecurity = function(str) {
	if (str.match(/wep/gi)) {
		return WEP;
	} else if (str.match(/wpa/gi)) {
		return WPA;
	// } else if (...) // TODO: add all security protocols
	} else {
		return OPEN;
	}
}

stopSearch = function() {
	console.log("stop search".yellow);
	child.kill();
}


// executeCommand(command, function(err, result) {
// 	if (err) {
// 		return cb(err, result)
// 	} else {
		
// 	}
// });

// 1. wpa_cli ap_scan 1
// 2. wpa_cli add_network
// 3. wpa_cli set_network 0 ssid '"SSID"'
// 5a. wpa_cli set_network 0 psk 123456
// 5b. wpa_cli set_network 0 key_mgmt NONE
// 6. wpa_cli select_network
// addNetwork = function(network, psk, cb) {
// 	console.log("adding network", network);

// 	// first issue the scan command
// 	command = wpa_cli_cmd + ' ap_scan 1';
// 	executeCommand(command, function(err, result) {
// 		if (err) {
// 			return cb(err, result)
// 		} else {
// 			command = wpa_cli_cmd + ' add_network';
// 			executeCommand(command, function(err, result) {
// 				if (err) {
// 					return cb(err, result)
// 				} else {
// 					network_id = result.match(/^[0-9]/);

// 					command = wpa_cli_cmd + ' set_network ' + network_id + ' ssid \'\"' + network + '\"\'';
// 					executeCommand(command, function(err, result) {
// 						if (err) {
// 							return cb(err, result)
// 						} else {
// 							if (psk) {
// 								command = wpa_cli_cmd + ' set_network ' + network_id + ' psk \'\"' + psk + '\"\'';
// 							} else {
// 								command = wpa_cli_cmd + ' set_network ' + network_id + ' key_mgmt NONE';
// 							}
// 							executeCommand(command, function(err, result) {
// 								if (err) {
// 									return cb(err, result)
// 								} else {
// 									command = wpa_cli_cmd + ' select_network ' + network_id;
// 									executeCommand(command, function(err, result) {
// 										if (err) {
// 											return cb(err, result)
// 										} else {
// 											return cb(null, null);
// 										}
// 									});
// 								}
// 							});
// 						}
// 					});
// 				}
// 			});
// 		}
// 	});
// }

// 1. wpa_cli ap_scan 1
// 2. wpa_cli add_network
// 3. wpa_cli set_network 0 ssid '"SSID"'
// 5a. wpa_cli set_network 0 psk 123456
// 5b. wpa_cli set_network 0 key_mgmt NONE
// 6. wpa_cli select_network
addNetwork = function(network, cb) {
	console.log("adding network".yellow, network);

	var res;
	var set_network_cmd;

	recursive = function(cb, step) {
		console.log("step", step);
		switch(step) {
		case 0:
			command = wpa_cli_cmd + ' ap_scan 1';
			break;
		case 1:
			command = wpa_cli_cmd + ' add_network';
			break;
		case 2:
			network.id = res.match(/^[0-9]/)[0];
			set_network_cmd = wpa_cli_cmd + 'set_network ' + network.id;
			command = set_network_cmd + ' ssid \'\"' + network.ssid + '\"\'';
			break;
		case 3:
			if (network.psk) {
				command = set_network_cmd + ' psk \'\"' + network.psk + '\"\'';
			} else {
				command = set_network_cmd + ' key_mgmt NONE';
			}
			break;
		case 4:
			// set id_str
			command = set_network_cmd + ' id_str \'\"' + network.id_str + '\"\'';
			break;
		case 5:
			addNetworkToInterfaces(network, function(err, result) {
				if (err) {
					return cb(err, result);
				} else {
					network.routes = result.routes;
					return recursive(cb, ++step);
				}
			})
			// next step will be executed when addNetworkToInterfaces succeeds
			return;
		// case 4:
		// 	command = wpa_cli_cmd + ' select_network ' + network.id;
		// 	break;
		default:
			// finished
			return cb(null, network);
		}

		executeCommand(command, function(err, result) {
			if (err) {
				return cb(err, result)
			} else {
				res = result;
				return recursive(cb, ++step);
			}
		});
	}

	recursive(cb, 0);
}


// 1. wpa_cli ap_scan 2
// 2. wpa_cli add_network
// 3. wpa_cli set_network 0 ssid '"SSID"'
// 4. wpa_cli set_network 0 mode 1
// 5a. wpa_cli set_network 0 wep_key0 123456
//     wpa_cli set_network 0 wep_tx_keyidx 0
// 5b. wpa_cli set_network 0 key_mgmt NONE
// 7. wpa_cli select_network
// addAdhoc = function(network, key, cb) {
// 	if (!scanNetworks(cb)) {
// 		return false;
// 	}

// 	command = wpa_cli_cmd + ' ap_scan 2';
// 	if ((result = executeCommand(command, cb)) == null) {
// 		return false;
// 	}

// 	var network_id;
// 	// .. next add a new network
// 	command = wpa_cli_cmd + ' add_network';
// 	if ((result = executeCommand(command, cb)) == null) {
// 		return false;
// 	} else {
// 		network_id = result;
// 	}

// 	command = wpa_cli_cmd + ' set_network ' + network_id + ' ssid \'\"' + network + '\"\'';
// 	if ((result = executeCommand(command, cb)) == null) {
// 		return false;
// 	}

// 	command = wpa_cli_cmd + ' set_network ' + network_id + ' mode 1';
// 	if ((result = executeCommand(command, cb)) == null) {
// 		return false;
// 	}

// 	if (psk) {
// 		command = wpa_cli_cmd + ' set_network ' + network_id + ' wep_key0 ' + key;
// 		if ((result = executeCommand(command, cb)) == null) {
// 			return false;
// 		}

// 		command = wpa_cli_cmd + ' set_network ' + network_id + ' wep_tx_keyidx 0';
// 		if ((result = executeCommand(command, cb)) == null) {
// 			return false;
// 		}
// 	} else {
// 		command = wpa_cli_cmd + ' set_network ' + network_id + ' key_mgmt NONE';
// 		if ((result = executeCommand(command, cb)) == null) {
// 			return false;
// 		}
// 	}

// 	command = wpa_cli_cmd + ' select_network ' + network_id;
// 	if ((result = executeCommand(command, cb)) == null) {
// 		return false;
// 	}

// 	cb(null, null);
// 	return true;
// }

// 1. wpa_cli ap_scan 2
// 2. wpa_cli add_network
// 3. wpa_cli set_network 0 ssid '"SSID"'
// 4. wpa_cli set_network 0 mode 1
// 5a. wpa_cli set_network 0 wep_key0 123456
//     wpa_cli set_network 0 wep_tx_keyidx 0
// 5b. wpa_cli set_network 0 key_mgmt NONE
// 7. wpa_cli select_network
addAdhoc = function(network, cb) {
	console.log("adding adhoc network".yellow, network);

	var res;
	var set_network_cmd;

	recursive = function(cb, step) {
		console.log("step", step);
		switch(step) {
		case 0:
			command = wpa_cli_cmd + ' ap_scan 2';
			break;
		case 1:
			command = wpa_cli_cmd + ' add_network';
			break;
		case 2:
			network.id = res.match(/^[0-9]/)[1];
			set_network_cmd = wpa_cli_cmd + 'set_network ' + network.id;
			command = set_network_cmd + ' ssid \'\"' + network.ssid + '\"\'';
			break;
		case 3:
			command = set_network_cmd + ' mode 1';
			break;
		case 4:
			if (network.psk) {
				command = set_network_cmd + ' wep_key0 ' + network.psk;
				// with key, we also need to set the keyidx to be used in the next step
			} else {
				command = set_network_cmd + ' key_mgmt NONE';
				// without key we can skip the next step
				++step;
			}
			break;
		case 5:
			command = set_network_cmd + ' wep_tx_keyidx 0';
			break;
		case 6:
			// set id_str
			command = set_network_cmd + ' id_str \'\"' + network.id_str + '\"\'';
			break;
		case 7:
			addNetworkToInterfaces(network, function(err, result) {
				if (err) {
					return cb(err, result);
				} else {
					network.routes = result.routes;
					return recursive(cb, ++step);
				}
			})
			// next step will be executed when addNetworkToInterfaces succeeds
			return;
		// case 6:
		// 	command = wpa_cli_cmd + ' select_network ' + network.id;
		// 	break;
		default:
			// finished
			return cb(null, network);
		}

		executeCommand(command, function(err, result) {
			if (err) {
				return cb(err, result)
			} else {
				res = result;
				return recursive(cb, ++step);
			}
		});
	}

	recursive(cb, 0);
}


activateNetwork = function(network, cb) {

	command = 'wpa_cli -i' + robotInterface + ' select_network ' + network.id;
	executeCommand(command, function(err, result) {
		if (err) {
			return cb(err, result);
		} else {
			if (result.match('FAIL')) {
				return cb("error", "failed to select network " + network.id);
			} else {
				network.current = true;
				return cb(null, network);
			}
		}
	});

}

getNetworkStatus = function(cb) {
	console.log("get network status".yellow);

	command = wpa_cli_cmd + 'status';
	executeCommand(command, function(err, result) {
		if (err) {
			return cb(err, result);
		} else {
			if (result.match('FAIL')) {
				return cb("error", "failed to get network status");
			} else {
				var regex = /^(\S+)=(\S+)\n/gm;
				var match = regex.exec(result);
				var status = {};
				while (match != null) {
					status[match[1]] = match[2];
					match = regex.exec(result);
				}
				return cb(null, status);
			}
		}
	});

}

saveConfig = function(cb) {

	command = wpa_cli_cmd + 'save_config';
	executeCommand(command, function(err, result) {
		if (err) {
			return cb(err, result)
		} else {
			if (result.match('FAIL')) {
				console.log("Error: failed to save config".red);
				// return cb("error", "failed to save config");
			// } else {
				// also save interfaces file
				saveInterfaces(function(err, result) {
					if (err) {
						return cb(err, result)
					} else {
						return cb(null, null);
					}
				});
			}
		}
	});
}

// listNetworks = function(cb) {

// 	var networks = [];

// 	command = wpa_cli_cmd + ' list_networks';
// 	executeCommand(command, function(err, result) {
// 		if (err) {
// 			return cb(err, result)
// 		} else {
// 			var list = result.split("\n");
// 			for (var i = 1; i < list.length-1; ++i) {
// 				list[i] = list[i].split("\t");
				
// 				var network = {};
// 				network.id = list[i][0];
// 				network.ssid = list[i][1];
// 				network.current = (list[i][3].match(/current/i) != null);
// 				networks.push(network);
// 			}
// 			return cb(null, networks);;
// 		}
// 	});
// }

listNetworks = function(cb) {
	console.log("list networks".yellow);

	var networks = [];
	var res;
	var index = 0;

	recursive = function(cb, step) {
		console.log("step", step);
		switch(step) {
		case 0:
			command = wpa_cli_cmd + 'list_networks';
			break; 
		case 1:
			console.log("decode networks");
			var list = res.split("\n");
			for (var i = 1; i < list.length-1; ++i) {
				list[i] = list[i].split("\t");
				
				var network = {};
				network.id = list[i][0];
				network.ssid = list[i][1];
				network.current = (list[i][3].match(/current/i) != null);
				networks.push(network);
			}

			if (networks.length == 0) {
				// if no networks were found, exit
				return cb(null, networks);
			} else {
				return recursive(cb, ++step);
			}
		case 2:
			console.log("index:", index);
			if (index < networks.length) {
				command = wpa_cli_cmd + 'get_network ' + networks[index].id + ' id_str'
			// } else {
			// 	// if all networks have been checked, skip to step 4
			// 	return recursive(cb, 4);
			}
			break;
		case 3:
			console.log("got id_str");
			if (index < networks.length) {
				if (res.match('FAIL')) {
					// if FAIL is return, most likely no id_str was assigned
					networks[index].id_str = '';
				} else {
					res = res.replace(/\"/g, "") 
					console.log("res:", res);
					networks[index].id_str = res;
				}
			}
			++step;
			// no break, continue with step 4
		case 4:
			if (index < networks.length) {
				command = wpa_cli_cmd + 'get_network ' + networks[index].id + ' key_mgmt'
			}
			break;
		case 5:
			console.log("got key_mgmt");
			if (index < networks.length) {
				console.log("res:", res);
				networks[index].security = getSecurity(res);

				if (networks[index].security != 0) {
					networks[index].psk = "******";
				}
			}
			++step;
			// no break, continue with step 6
		case 6:
			var routes = null;
			var interfaces_network = null;
			if ((interfaces_network = getInterfacesNetwork(networks[index].id_str)) != null) {
				routes = interfaces_network.routes;
			}
			if (routes == null) {
				networks[index].routes = [];
				console.log("no route found");
			} else {
				networks[index].routes = routes;
				console.log("route found:", routes)
			}
			++step;
			// no break, continue with step 7
		case 7:
			++index;
			if (index < networks.length) {
				// if we have more networks, go back to step 2 
				return recursive(cb, 2);
			}
			// otherwise continue with next step
			// no break
		default:
			// finished
			return cb(null, networks);
		}

		executeCommand(command, function(err, result) {
			if (err) {
				return cb(err, result)
			} else {
				res = result;
				return recursive(cb, ++step);
			}
		});
	}

	recursive(cb, 0);
}

removeNetwork = function(network, cb) {

	command = wpa_cli_cmd + ' remove_network ' + network.id;
	executeCommand(command, function(err, result) {
		if (err) {
			return cb(err, result)
		} else {
			if (result == "FAIL") {
				return cb("error", "failed to remove network", network);
			} else {
				// if removing the element succeeded we also need to
				// remove the stanza for this network from the interfaces
				removeNetworkFromInterfaces(network, function(err, result) {
					if (err) {
						return cb(err, result);
					} else {
						return cb(null, null);
					}
				});
			}
		}
	});
}

editNetwork = function(network, cb) {
	console.log("editing network".yellow, network);

	var set_network_cmd = wpa_cli_cmd + 'set_network ' + network.id;
	recursive = function(cb, step) {
		console.log("step", step);
		switch(step) {
		case 0:
			// set key (if security on, otherwise set key_mgmt NONE)
			if (network.psk && network.psk != "******") {
				if (network.isAdhoc) {
					command = set_network_cmd + ' wep_key0 ' + network.psk;
				} else {
					command = set_network_cmd + ' psk \'\"' + network.psk + '\"\'';
				}
			} else {
				command = set_network_cmd + ' key_mgmt NONE';
			}
			break;
		case 1:
			// set id_str
			command = set_network_cmd + ' id_str \'\"' + network.id_str + '\"\'';
			break;
		case 2:
			// add routes to interfaces
			addRoutesToInterfaces(network, function(err, result) {
				if (err) {
					cb(err, result);
				} else {
					return recursive(cb, ++step);
				}
			});
			// if (network.routes.length != 0) {
			// 	var interfaces_network = getInterfacesNetwork(network.id_str);
			// 	if (interfaces_network != null) {
			// 		interfaces_network.routes = network.routes;
			// 	} else {
			// 		// initialise routes for interfaces network
			// 	}
			// }
			return;
			// no break, continue with next step
		default:
			// finished
			return cb(null, null);
		}

		executeCommand(command, function(err, result) {
			if (err) {
				return cb(err, result)
			} else {
				if (result == 'FAIL') {
					return cb("error", "failed to execute command: " + command);
				} else {
					return recursive(cb, ++step);
				}
			}
		});
	}

	recursive(cb, 0);
}

app.post('/network_scan', function(req, res, next) {

	scanNetworks(function(err, result) {
		if (err) {
			console.log("Error:".red, err);
			res.send({ success: false, message: result});
		} else {
			console.log("Scan result:".green, result);
			res.send({ success: true, networks: result});
		}
	});
});

app.post('/network_stop', function(req, res, next) {

	stopSearch();
	res.send({ success: true});
});

app.post('/network_add', function(req, res, next) {
	callback = function(err, result) {
		if (err) {
			console.log("Error:".red, result);
			res.send({ success: false, message: result});
		} else {
			console.log("Successfully added network:".green, network);
			res.send({ success: true, network: result});
		}
	};

	var network = req.body;
	if (network.isAdhoc) {
		addAdhoc(network, callback);
	} else {
		addNetwork(network, callback);
	}
});

app.post('/network_activate', function(req, res, next) {
	var network = req.body;

	activateNetwork(network, function(err, result) {
		if (err) {
			console.log("Error:".red, result);
			res.send({ success: false, message: result});
		} else {
			console.log("Network selected:".green, network);
			res.send({ success: true, network: result});
		}
	});
});

app.post('/network_list', function(req, res, next) {
	
	listNetworks(function(err, result) {
		if (err) {
			console.log("Error:".red, result);
			res.send({ success: false, message: result});
		} else {
			console.log("List result:".green, result);
			res.send({ success: true, networks: result});
		}
	});
});

app.post('/network_remove', function(req, res, next) {
	var network = req.body;
	
	removeNetwork(network, function(err, result) {
		if (err) {
			console.log("Error:".red, result);
			res.send({ success: false, message: result});
		} else {
			console.log("Network ".green + network.ssid + " removed".green);
			res.send({ success: true});
		}
	});
});

app.post('/network_edit', function(req, res, next) {
	var network = req.body;
	
	editNetwork(network, function(err, result) {
		if (err) {
			console.log("Error:".red, result);
			res.send({ success: false, message: result});
		} else {
			console.log("Network ".green + network.ssid + " edited".green);
			res.send({ success: true});
		}
	});
});

app.post('/network_saveconfig', function(req, res, next) {
	
	saveConfig(function(err, result) {
		if (err) {
			console.log("Error:".red, result);
			res.send({ success: false, message: result});
		} else {
			console.log("Config saved".green);
			res.send({ success: true});
		}
	});

});

app.post('/network_status', function(req, res, next) {

	getNetworkStatus(function(err, result) {
		if (err) {
			console.log("Error:".red, result);
			res.send({ success: false, message: result});
		} else {
			console.log("Network Info:".green, result);
			res.send({ success: true, network_status: result});
		}
	});

});

var fs = require('fs');

var INTERFACES_FILE = '/data/ws_nodejs/roborouter/assets/interfaces';
loadInterfaces = function(cb) {
	// fs.readFile('/etc/network/interfaces', 'utf8', function(err, data) {
	fs.readFile(INTERFACES_FILE, 'utf8', function(err, result) {
		if (err) {
			console.log("Error:".red, err);
			cb(err, result);
		} else {
			// console.log("File Content:", result);

			// the following regular expression parses the interfaces file so that the elements can be obtained
			/* simplified, it goes like this
			   ((?:auto|allow-hotplug|iface))		# Match one of the search terms (corresponds to stanza type)
			     *									# skip whitespaces
			    (\S+)								# match word (corresponds to name or interface)
			     *									# skip whitespaces
				(.*)								# match everything else until the first newline
				\n*									# skip newline ...
				 (?!                    			# ... (as long as we're not at the start of
				  (?:auto|allow-hotplug|iface) 		#   the next search term)
				 )                      			#  
				((?:								# try to match ...
				 .|\n								# ... any charachter, including newlines
				  (?!(?:auto|allow-hotplug|iface))	# (as long as we're not at the start of the next search term)
				 )*									# and repeat this any number of times
				)									#
				/g									# run a global search to find all matches
			*/
			// var regex = /((?:auto|allow-hotplug|iface)) *(\S+) *((?:.(?!(?:auto|allow-hotplug|iface)))*)\n*(?!(?:auto|allow-hotplug|iface))((?:.|\n(?!(?:auto|allow-hotplug|iface)))*)/gm
			var regex = /((?:auto|allow-hotplug|iface)) *(\S+) *(.*)\n*(?!(?:auto|allow-hotplug|iface))((?:.|\n(?!(?:auto|allow-hotplug|iface)))*)/g;
			var match = regex.exec(result);
			var arr = [];
			while (match != null) {
				var elem = { type: match[1],
							 name: match[2],
							 method: match[3],
							 settings: match[4] };
				arr.push(elem);

				match = regex.exec(result);
			}
			// console.log("Parsed:", arr)

			// in the next step we parse the routes and additional settings, which is a list of
			// strings seperated by newlines. 
			// we separate the settings from the routes, where a route starts with the keyword 'up'
			// the routes are then parsed to obtain the source port, destination port and destination
			// address

			// this regex strips the leading whitespaces and then matches everythin until the first newline
			// the global and multiline modifiers make it possible to obtain all possible matches.
			regex = /(?:^\s*(.+)\n*)/gm
			for (var i = 0; i < arr.length; ++i) {
				match = regex.exec(arr[i].settings);
				var routes = [];
				var settings = [];
				while (match != null) {
					if (match[1].match(/^up/)) {
						routes.push(match[1]);
					} else {
						settings.push(match[1]);
					}
					match = regex.exec(arr[i].settings);
				}
				arr[i].settings = settings;
				// the routes_raw contains the routes as they are written in the interfaces file
				// but also the pre-setup for the routes to work
				arr[i].routes_raw = routes;

				var routes = [];
				for (var j = 0; j < arr[i].routes_raw.length; ++j) {
					var route_raw = arr[i].routes_raw[j];
					var matches;
					// this regex gets the source port, the address and the destination port
					var route_regex = /.*--dport (\d*).*--to-destination ((?:\d+\.){3}\d+):(\d+)/
					if ((matches = route_raw.match(route_regex)) != null) {
						// console.log("matches", matches);
						var route = { srcPort: Number(matches[1]),
									  dstPort: Number(matches[3]),
									  target: matches[2] };
						routes.push(route);
					}
				}
				// the routes contain the source port, destination port and destination address
				// which will be displayed on the client
				arr[i].routes = routes;
				// console.log("route:", arr[i].routes);
			}

			// console.log("\n\nParsed:", arr);
			cb(null, arr);
		}
	});
}

saveInterfaces = function(cb) {
	// first we need to stringify the interfaces array

	if (!interfacesIsModified) {
		// if interfaces file is not modified we don't have to
		// save it again, just exit
		return cb(null, null);
	}

	command = 'cp {0} {0}.bak'.format(INTERFACES_FILE)
	executeCommand(command, function(err, result) {
		if (err) {
			console.log("Error: failed to backup interfaces".red);
		} else {

			var interfaces_string = "";
			for (var i in interfaces) {
				var stanza = interfaces[i];
				var stanza_str = "";

				stanza_str = "{0} {1} {2}\n".format(stanza.type, stanza.name, stanza.method);

				var stanza_settings_str = "";
				var stanza_routes_str = "";

				if (stanza.settings.length != 0) {
					stanza_settings_str = "  " + stanza.settings.toString().replace(/,/g,"\n  ");
					stanza_str = stanza_str.concat(stanza_settings_str, "\n");
				}

				// the following is a bit of a hack, maybe it could be solved more elegantly
				// we need to make sure that the routes are flushed from the table, and some
				// general route settings that apply for any network are written. we add these to the 
				// iface stanza of the robot interface. and to avoid duplicates, or checking if it is 
				// complete we write the whole set every time we save the interfaces file and discard 
				// the old entries
				if (stanza.type.match("iface") && stanza.name.match(robotInterface)) {
					if (stanza_settings_str != "") {
						stanza_str = stanza_str.concat("\n");
					}

					// TODO: make sure all flush and deletions are neccessary
										// flush the filter table
					stanza_routes_str = "  up /sbin/iptables -F\n" + 
										// delete all user chains from filter table
										"  up /sbin/iptables -X\n" + 
										// flush the nat table
										"  up /sbin/iptables -t nat -F\n" + 
										// delete all user chains from nat table
										"  up /sbin/iptables -t nat -X\n" + 
										// flush the mangle table
										"  up /sbin/iptables -t mangle -F\n" + 
										// delete all user chains from mangle table
										"  up /sbin/iptables -t mangle -X\n" + 
										// mask all ip packages going out from robot interface with the roborouter's source address
										"  up iptables -t nat -A POSTROUTING -o " + robotInterface + " -j MASQUERADE\n" + 
										// mask all ip packages going out from main interface with the roborouter's source address
										"  up iptables -t nat -A POSTROUTING -o " + mainInterface + " -j MASQUERADE\n" +
										// allow forwarding of packages
										"  up sysctl -w net.ipv4.ip_forward=1\n";
					stanza_str = stanza_str.concat(stanza_routes_str, "\n");

				} else if (stanza.routes_raw.length != 0) {
					if (stanza_settings_str != "") {
						stanza_str = stanza_str.concat("\n");
					}

					stanza_routes_str = "  " + stanza.routes_raw.toString().replace(/,/g,"\n  ");
					stanza_str = stanza_str.concat(stanza_routes_str, "\n");
				}

			
				interfaces_string = interfaces_string.concat(stanza_str, "\n");
			}

			console.log("saving interfaces:", interfaces_string);
			fs.writeFile(INTERFACES_FILE, interfaces_string, 'utf8', function(err) {
				if (err) {
					return cb(err, err);
				} else {
					console.log("interfaces saved".green);
					interfacesIsModified = false;
					return cb(null, null);
				}
			});
		}
	});

}

// on startup, read the file /etc/network/interfaces and store
// it the variable interfaces, each element of the array will
// be a stanza of the interfaces file.
var interfaces;
loadInterfaces(function(error, result) {
	if (error) {
		console.log("Error reading interfaces:".red, result);
	} else {
		interfaces = result;
		console.log("interfaces read Successfully:\n".green, interfaces);
	}
});

app.post('/interfaces', function(req, res, next) {

	loadRoutes(function(err, result) {
		if (err) {
			console.log("Error:", result);
			res.send({ success: false, message: result});
		} else {
			console.log("Info ok");
			res.send({ success: true});
		}
	});

});

getIpRange = function(iface, cb) {
	console.log("get ip range".yellow);

	var ipRange;
	var res;
	recursive = function(cb, step) {
		console.log("step", step);
		switch(step) {
		case 0:
			// first check the config and obtain the line with the address
			command = 'ifconfig ' + iface + ' | grep \'inet addr:\'';
			break;
		case 1:
			// then parse the string to get the address, we only care about the
			// first 3 parts which define the ip range
			var regex = /inet addr:((?:\d+\.){2}\d+)\.\d+/;
			ipRange = res.match(regex)[1];
			console.log("iface:", iface, "ipRange:", ipRange);
			++step;
			// no break, continue with next step
		default:
			// finished
			return cb(null, ipRange);
		}

		executeCommand(command, function(err, result) {
			if (err) {
				return cb(err, result)
			} else {
				res = result;
				return recursive(cb, ++step);
			}
		});
	}

	recursive(cb, 0);
}

compareIpRange = function(network, cb) {
	console.log("compare ip range".yellow);

	getIpRange(mainInterface, function(err, result) {
		if (err) {
			return cb(err, result);
		} else {
			var mainIpRange = result;

			var regex = /((?:\d+\.){2}\d+)\.\d+/;
			var robotIpRange = network.routes[0].target.match(regex)[1];
			console.log("robot ipRange:", robotIpRange);

			// if (robotIpRange == mainIpRange) {
			// 	console.log("IP's are the same");
			// } else {
				console.log("IP's are" + (robotIpRange != mainIpRange ? " not" : "") + " the same");
			// }
			cb(null, robotIpRange == mainIpRange);
		}
	});
}

// initializeRouteSetup = function(network, cb) {
// 	console.log("initialize route setup".yellow);

// 	compareIpRange(network, function(err, result) {
// 		if (err) {
// 			return cb(err, result);
// 		} else {
// 			var routes_raw = [];
// 			var elem;
// 			if (result) {
// 				// if they have the same ip range, we have to add some additional
// 				// route setup, to make sure that packages are going out on the
// 				// correct interface. if we didn't do this, then packages would go
// 				// out on the main interface, instead of the robot's interface
// 				// note: we use the 200 + netwrok id as table and fwmark
// 				var fwmark = parseInt(200 + Number(network.id));

// 				// first step is to flush the table (to remove possibly obsolete entries)
// 				elem = 'up ip route flush table ' + fwmark;
// 				routes_raw.push(elem);

// 				// then we add the fwmark and table to the ip rules
// 				elem = 'up ip rule add fwmark ' + fwmark + ' table ' + fwmark;
// 				routes_raw.push(elem);

// 				// next we define the robot's interface as default outgoing interface
// 				// for all routes marked with this fwmark
// 				elem = 'up ip route add default dev ' + robotInterface + ' table ' + fwmark;
// 				routes_raw.push(elem);

// 				// last we flush the cache to make sure everything is writen int he ip rules
// 				elem = 'up ip route flush cache';
// 				routes_raw.push(elem);
// 			} else {
// 				// if they don't have the same ip range, then we don't need to do
// 				// any setup. packages will automatically go out on the correct
// 				// interface
// 			}

// 			return cb(null, routes_raw);
// 		}
// 	});
// }

createNewStanza = function(network) {
	if (network.id_str == "") {
		return null;
	} else {
		// first thing to do is add a new stanza for the robot
		var stanza = { 
			type: 'iface', // type is iface
			name: network.id_str, // the name is the id_str used for the network
			method: 'inet dhcp', // ip address will be obtained from dhcp (robot)
			settings: [],
			routes_raw: [],
			routes: []
		};

		return stanza;
	}
}

getInterfacesNetwork = function(id_str) {
	if (id_str != '') {
		for (var i = 0; i < interfaces.length; ++i) {
			if (interfaces[i].name == id_str) {
				return interfaces[i];
			}
		}
	}
	return null;
}

removeNetworkFromInterfaces = function(network, cb) {
	console.log("remove network from interfaces".yellow);

	for (i in interfaces) {
		if (interfaces[i].name.match(network.id_str)) {
			// console.log("network found, i:", i);
			interfacesIsModified = true;
			// console.log("network removed:", interfaces.splice(i, 1));
			interfaces.splice(i, 1);
			return cb(null, null);
		}
	}
	return cb("error", "network not found in interfaces");
}

addNetworkToInterfaces = function(network, cb) {
	console.log("add new network to interfaces".yellow);

	// first check if there is already a stanza in the interfaces,
	// if not 
	var stanza = getInterfacesNetwork(network.id_str);
	if (stanza == null) {
		if (network.id_str == "") {
			console.log("network.id_str empty".red);
			return cb("error", "can't create stanza without id_str");
		}

		// then create a new one
		stanza = createNewStanza(network);

		// and add it to the interfaces
		interfaces.push(stanza);
		interfacesIsModified = true;

		console.log("created stanza:".green, stanza);

		return cb(null, stanza);
	} else {
		// otherwise there is nothing to do
		console.log("network already exists in interfaces".red);
		return cb(null, stanza);
	}
}

// flag to check if interfaces file should be saved when config is saved
var interfacesIsModified = false;

addRoutesToInterfaces = function(network, cb) {
	console.log("add routes to interfaces".yellow);

	if (network.routes.length == 0) {
		console.log("nothing to add");
		return cb(null, "nothing to add");
	}

	addRoutes = function(stanza, network) {
		console.log("add Routes".yellow);

		stanza.routes = network.routes;

		// now check if the ip range is the same
		compareIpRange(network, function(err, result) {
			if (err) {
				return cb(err, result);
			} else {

				var route;
				var elem;
				var fwmark;

				// initialize the routes_raw
				stanza.routes_raw = [];

				if (result) {
					// if the networks have the same ip range, we have to add some additional
					// route setup, to make sure that packages are going out on the
					// correct interface. if we didn't do this, then packages would go
					// out on the main interface, instead of the robot's interface
					// note: we use the 200 + netwrok id as table and fwmark
					fwmark = parseInt(200 + Number(network.id));

					// first step is to flush the table (to remove possibly obsolete entries)
					elem = 'up ip route flush table ' + fwmark;
					stanza.routes_raw.push(elem);

					// then we add the fwmark and table to the ip rules
					elem = 'up ip rule add fwmark ' + fwmark + ' table ' + fwmark;
					stanza.routes_raw.push(elem);

					// next we define the robot's interface as default outgoing interface
					// for all routes marked with this fwmark
					elem = 'up ip route add default dev ' + robotInterface + ' table ' + fwmark;
					stanza.routes_raw.push(elem);

					// last we flush the cache to make sure everything is writen int he ip rules
					elem = 'up ip route flush cache';
					stanza.routes_raw.push(elem);
				} else {
					// if they don't have the same ip range, then we don't need to do
					// any setup. packages will automatically go out on the correct
					// interface
				}

				// then for every route do ...
				for (var i in stanza.routes) {
					route = stanza.routes[i];

					// if the ip range is the same we need to
					// add an additional entry
					if (result) {

						// this will give any package coming in on the source Port the fwmark used by the robot so that
						// it can afterwards be forwarded to the correct interface
						// dport is the port where the roborouter is receiving the messages
						elem = 'up iptables -A PREROUTING -i eth0 -t mangle -p tcp --dport ' + route.srcPort + ' -j MARK --set-mark ' + fwmark
						stanza.routes_raw.push(elem);
					}

					// this will reroute packages coming in on the source port, with destination roborouter to the
					// destination port and address of the robot
					elem = 'up iptables -t nat -A PREROUTING -i eth0 -p tcp --dport ' + route.srcPort 
							+ ' -j DNAT --to-destination ' + route.target + ':' + route.dstPort;
					stanza.routes_raw.push(elem);

				}
				
				interfacesIsModified = true;

				return cb(null, stanza.routes_raw);
			}
		});
	}

	// first check if there is already a stanza in the interfaces,
	// if not, then create a new one
	var stanza = getInterfacesNetwork(network.id_str);
	if (stanza == null) {
		console.log("can't add routes, stanza not found".red);
		return cb("error", "can't add routes, stanza not found in interfaces");
		// addNetworkToInterfaces(network, function(err, result) {
		// 	if (err) {
		// 		return cb(err, result);
		// 	} else {
		// 		stanza = result;
		// 	}
		// 	addRoutes(stanza, network);
		// })
	} else {
		console.log("stanza found:".green, stanza);
		// if we found one, add the routes
		addRoutes(stanza, network);
	}

}

// removeExistingRoutes = function(stanza) {
// 	console.log("remove existing routes...".yellow);
// 	if (stanza.routes.length != 0) {
// 		// we remove all lines with iptable entries from the route information in the 
// 		// routes_raw so that we can rewrite them again from the routes, avoiding multiple 
// 		// occurences of the same route. at the same time we leave the lines that contain 
// 		// pre-setup (not iptable information) as is.
// 		var stripped_routes = [];
// 		for (j in stanza.routes_raw) {
// 			var route = stanza.routes_raw[j];
// 			console.log("route:", route)
// 			if (route.match(/iptables/) == null) {
// 				stripped_routes.push(route);
// 			}
// 		}
// 		stanza.routes_raw = stripped_routes;
// 	}
// 	console.log("stripped stanza:".green, stanza);
// }
