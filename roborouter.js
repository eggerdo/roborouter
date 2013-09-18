var express = require('express')
	, angular = require('angular')
	, passport = require('passport')
	, LocalStrategy = require('passport-local').Strategy
	, mongodb = require('mongodb')
	, mongoose = require('mongoose')
	, bcrypt = require('bcrypt')
	, SALT_WORK_FACTOR = 10;
	
mongoose.connect('localhost', 'test');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
	console.log('Connected to DB');
});

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
});

// app.all('*', function(req, res, next) {
// 	if (/^\/login|\.css$/g.test(req.url)) {
// 		return next();
// 	} else if (req.isAuthenticated()) {
// 		return next();
// 	} else {
// 		return res.redirect('/login');
// 	}
// });

app.get('/login', function(req, res){
	res.render('login', { user: req.user, message: req.session.messages });
});

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

// app.get('/', function(req, res) {
// 	res.redirect('/home');
// });

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
		console.log("password mismatch");
		res.send({ success: false, mismatch: true, message: "Confirmation mismatch"});
	};
});

var util	= require('util'),
	exec	= require('child_process').exec,
	child;

// for now fixed to wlan0, the RasPi won't be able to handle more
// than one wlan interface anyway, but theoretically this could
// be made changable parameter too
var wlan_interface = 'wlan1'
var wpa_cli_cmd = 'wpa_cli -i' + wlan_interface;

var command, result;
executeCommand = function(command, cb) {
	console.log("execute", command);
	child = exec(command, function(error, stdout, stderr) {
		console.log('stdout:' + stdout);
		console.log('stderr:' + stderr);
		if (error) {
			cb(error, stderr);
			return null;
		}
		console.log('ready')
		return stdout;
	});
	console.log('done')
}

// following command produces a sorted list of unique networks names
// iwlist wlan0 scans the wireless interface
//  .. the result is filtered by the string SSID
//  .. then each line is separated by the : and only the second field is printed
//  .. now filter out empty results
//  .. sort them by name
//  .. and only print unique results
// var command = 'sudo iwlist wlan1 scan | grep SSID | cut -d: -f2 | sort | uniq';
// var command = "wpa_cli -i' + wlan_interface + ' scan_results | awk '/\[/{print $5}' | sort | uniq"

scanNetworks = function(cb) {
	console.log("search networks");

	// first issue the scan command
	command = wpa_cli_cmd + ' scan';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	// then obtain the scan results
	// .. use only the column 5 (which corresponds to the ssid)
	// .. sort it
	// .. and print only unique results
	command = "wpa_cli -i" + wlan_interface + " scan_results | awk '/\[/{print $5}' | sort | uniq";
	// child = exec(command, function(error, stdout, stderr) {
	// 	console.log('stdout:' + stdout);
	// 	console.log('stderr:' + stderr);
	// 	if (error) {
	// 		return cb(error, stderr);
	// 	} else {
	// 		// remove " from the strings, then split by newlines
	// 		// to get an array with each element containing a network name
	// 		var list = stdout.replace(/\"/g, "").split("\n")
	// 		// remove all empty elements
	// 		var index;
	// 		while ((index = list.indexOf("")) != -1) {
	// 			list.splice(index,1);
	// 		}
	// 		return cb(null, list);
	// 	}
	// });
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	} else {
		var list = result.replace(/\"/g, "").split("\n")
		// remove all empty elements
		var index;
		while ((index = list.indexOf("")) != -1) {
			list.splice(index,1);
		}
		return cb(null, list);
	}
}

stopSearch = function() {
	console.log("stop search");
	child.kill();
}

// 1. wpa_cli ap_scan 1
// 2. wpa_cli add_network
// 3. wpa_cli set_network 0 ssid '"SSID"'
// 5a. wpa_cli set_network 0 psk 123456
// 5b. wpa_cli set_network 0 key_mgmt NONE
// 6. wpa_cli select_network
addNetwork = function(network, psk, cb) {
	console.log("adding network", network);

	// first issue the scan command
	command = wpa_cli_cmd + ' ap_scan 1';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	var network_id;
	// .. next add a new network
	command = wpa_cli_cmd + ' add_network';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	} else {
		// network_id = result.split("\n")[1]

		network_id = result;
	}

	// .. then set the ssid for the network
	command = wpa_cli_cmd + ' set_network ' + network_id + ' ssid \'\"' + network + '\"\'';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	// .. and the pass key (if provided)
	if (psk) {
		command = wpa_cli_cmd + ' set_network ' + network_id + ' psk \'\"' + psk + '\"\'';
		if ((result = executeCommand(command, cb)) == null) {
			return false;
		}
	} else {
		command = wpa_cli_cmd + ' set_network ' + network_id + 'key_mgmt NONE';
		if ((result = executeCommand(command, cb)) == null) {
			return false;
		}
	}

	// and finally connect to the network
	command = wpa_cli_cmd + ' select_network ' + network_id;
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	cb(null, null);
	return true;
}

// 1. wpa_cli ap_scan 2
// 2. wpa_cli add_network
// 3. wpa_cli set_network 0 ssid '"SSID"'
// 4. wpa_cli set_network 0 mode 1
// 5a. wpa_cli set_network 0 wep_key0 123456
//     wpa_cli set_network 0 wep_tx_keyidx 0
// 5b. wpa_cli set_network 0 key_mgmt NONE
// 7. wpa_cli select_network
addAdhoc = function(network, key, cb) {
	if (!scanNetworks(cb)) {
		return false;
	}

	command = wpa_cli_cmd + ' ap_scan 2';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	var network_id;
	// .. next add a new network
	command = wpa_cli_cmd + ' add_network';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	} else {
		network_id = result;
	}

	command = wpa_cli_cmd + ' set_network ' + network_id + ' ssid \'\"' + network + '\"\'';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	command = wpa_cli_cmd + ' set_network ' + network_id + ' mode 1';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	if (psk) {
		command = wpa_cli_cmd + ' set_network ' + network_id + ' wep_key0 ' + key;
		if ((result = executeCommand(command, cb)) == null) {
			return false;
		}

		command = wpa_cli_cmd + ' set_network ' + network_id + ' wep_tx_keyidx 0';
		if ((result = executeCommand(command, cb)) == null) {
			return false;
		}
	} else {
		command = wpa_cli_cmd + ' set_network ' + network_id + 'key_mgmt NONE';
		if ((result = executeCommand(command, cb)) == null) {
			return false;
		}
	}

	command = wpa_cli_cmd + ' select_network ' + network_id;
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	cb(null, null);
	return true;
}

selectNetwork = function(network_id, cb) {

	command = 'wpa_cli select_network ' + network_id;
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	cb(null, null);
	return true;

}

saveNetworks = function(cb) {

	command = wpa_cli_cmd + ' save_config';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	cb(null, null);
	return true;
}

listNetworks = function(cb) {

	var networks = [];

	command = wpa_cli_cmd + ' list_networks';
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	} else {
		var list = result.split("\n");
		for (var i = 0; i < list.length; ++i) {
			list[i] = list[i].split("\t");
			
			var network = {};
			network.id = list[0];
			network.ssid = list[1];
			network.slected = (list[3].match(/current/i) != null);
			networks.push(network);
		}
		cb(null, networks);
		return true;
	}
}

removeNetwork = function(network_id, cb) {

	command = wpa_cli_cmd + ' remove_network ' + network_id;
	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	return cb(null, null);
}

editNetwork = function(network_id, isAdhoc, key, cb) {

	if (key) {
		if (isAdhoc) {
			command = wpa_cli_cmd + ' set_network wep_key0 ' + key;
			if ((result = executeCommand(command, cb)) == null) {
				return false;
			}

			command = wpa_cli_cmd + ' set_network wep_tx_keyidx 0';			
		} else {
			command = wpa_cli_cmd + ' set_network psk \'\"' + key + '\"\'';
		}
	} else {
		command = wpa_cli_cmd + ' set_network key_mgmt NONE';
	}

	if ((result = executeCommand(command, cb)) == null) {
		return false;
	}

	return cb(null, null);
}

app.post('/network_scan', function(req, res, next) {

	scanNetworks(function(err, result) {
		if (err) {
			console.log("Error:", err);
			res.send({ success: false, message: result});
		} else {
			console.log("Scan result:", result);
			res.send({ success: true, networks: result});
		}
	});
});

app.post('/network_stop', function(req, res, next) {

	stopSearch();
	res.send({ success: true});
});

app.post('/network_add', function(req, res, next) {
	callback = function(err, msg) {
		if (err) {
			console.log("Error:", msg);
			res.send({ success: false, message: msg});
		} else {
			console.log("Successfully added network " + network.ssid);
			res.send({ success: true});
		}
	};

	var network = req.body;
	if (network.isAdhoc) {
		addAdhoc(network.ssid, network.psk, callback);
	} else {
		addNetwork(network.ssid, network.psk, callback);
	}

});

app.post('/network_select', function(req, res, next) {
	var network = req.body;

	selectNetwork(network.id, function(err, msg) {
		if (err) {
			console.log("Error:", msg);
			res.send({ success: false, message: msg});
		} else {
			console.log("Network " + network.ssid + " selected");
			res.send({ success: true});
		}
	});
});

app.post('/network_list', function(req, res, next) {
	
	listNetworks(function(err, result) {
		if (err) {
			console.log("Error:", msg);
			res.send({ success: false, message: result});
		} else {
			console.log("List networks suceeded");
			res.send({ success: true, networks: result});
		}
	});

});

app.post('/network_remove', function(req, res, next) {
	var network = req.body;
	
	removeNetwork(network.id, function(err, result) {
		if (err) {
			console.log("Error:", msg);
			res.send({ success: false, message: result});
		} else {
			console.log("Network " + network.ssid + " removed");
			res.send({ success: true});
		}
	});

});

app.post('/network_edit', function(req, res, next) {
	var network = req.body;
	
	editNetwork(network.id, network.isAdhoc, network.psk, function(err, result) {
		if (err) {
			console.log("Error:", msg);
			res.send({ success: false, message: result});
		} else {
			console.log("Network " + network.ssid + " edited");
			res.send({ success: true});
		}
	});

});
