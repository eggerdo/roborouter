var myApp = angular.module('roborouter', []);

myApp.filter('security_name', function() {
	return function(security_id) {
		switch(security_id) {
			case 0: return "Open";
			case 1: return "WEP";
			case 2: return "WPA";
		}
	};
});

var OPEN 	= 0;
	WEP 	= 1;
	WPA 	= 2;

// TODO: the #rootScope.config_modified get's reset everytime this
// function is called. why??? it only happens if we move back to
// the settings. it works as desired when moving away from the settings.
function RobotsCtrl($scope, $http, $rootScope) {
	$scope.success = false;
	$scope.failure = false;
	$scope.modified = false;
	$scope.networks = [];
	$scope.scan_networks = [];
	$scope.selected_network = {};
	$scope.network_status = {};
	$scope.editing = false;
	$scope.loading = false;
	$scope.route_edit = false;
	$scope.route_modified = false;
	$scope.settings_valid = false;
	// $rootScope.config_modified = false;

	$scope.id_str_pattern = /^\S+$/;
	$scope.ip_pattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;
	$scope.port_pattern = /^\d+$/;

	$scope.reset = function() {
		$scope.success = false;
		$scope.failure = false;
		$scope.message = "";
	};

	$scope.clear = function() {
		$scope.reset();
		$scope.scan_networks = [];
	}

	$scope.scanNetworks = function() {
		console.log("scanNetworks..")
		$scope.reset();
		$scope.loading = true;
		$scope.scan_networks = [];

		$http.post('/network_scan').success(function(response) {
			$scope.loading = false;

			if (response.success) {
				$scope.success = true;

				var ssid, found;

				// filter out the results that are already added
				for (var i = 0; i < response.networks.length; ++i) {
					ssid = response.networks[i].ssid;
					found = false;
					for (var j = 0; j < $scope.networks.length; ++j) {
						if ($scope.networks[j].ssid == ssid) {
							found = true;
						}
					}
					if (!found) {
						$scope.scan_networks.push(response.networks[i]);
					}
				}

				if ($scope.scan_networks.length == 0) {
					$scope.success = false;
					$scope.failure = true;
					$scope.message = 'no new networks found.';
				}
			} else {
				$scope.failure = true;
				$scope.message = response.message;
			}
		})
	};

	$scope.stopScan = function() {
		console.log("stop scan");
		$scope.reset();

		$http.post('/network_stop', item).success(function(response) {
			$scope.loading = false;

			if (response.success) {
				$scope.success = true;
			} else {
				$scope.success = false;
			}
		});
	}

	$scope.add = function(item) {
		console.log("adding...");
		item.isSelected = false;
		$scope.addNetwork(item);
		$scope.scan_networks.splice($scope.scan_networks.indexOf(item),1);
	}

	$scope.addNetwork = function(item) {
		console.log("add network: " + item);
		$scope.reset();

		$http.post('/network_add', item).success(function(response) {
			if (response.success) {
				var network = response.network;
				$scope.success = true;
				$scope.networks.push(network);
				$('#tab_edit').click();	
				$scope.edit(network);
				$rootScope.config_modified = true;
			} else {
				$scope.success = false;
			}
		});
	}

	$scope.removeNetwork = function(item) {
		console.log("remove network: " + item);
		$scope.reset();
		item.isRemoved = true;

		$http.post('/network_remove', item).success(function(response) {
			if (response.success) {
				$scope.success = true;
				$rootScope.config_modified = true;
				$scope.listNetworks();
				console.log("network removed");
			} else {
				$scope.success = false;
			}
		});
	}

	$scope.listNetworks = function(notify) {
		console.log("list networks...");
		$scope.reset();
		$scope.loading = true;

		$http.post('/network_list').success(function(response) {
			$scope.loading = false;

			if (response.success) {
				$scope.networks = response.networks;
				if (notify) {
					$scope.success = true;
				}
			} else {
				if (notify) {
					$scope.failure = true;
					$scope.message = response.message;
				}
			}
		});
	}

	$scope.getNetworkStatus = function() {
		console.log("get network info...");
		$scope.reset();

		$http.post('/network_status').success(function(response) {
			if (response.success) {
				$scope.network_status = response.network_status;
			}
		});
	}

	// $scope.findCurrentNetwork = function() {
	// 	for (i in $scope.networks) {
	// 		if (networks[i].current) {
	// 			$scope.current_network = networks[i];
	// 		}
	// 	}
	// 	$scope.current_network = {};
	// }

	$scope.select = function(item) {
		console.log("select", item);
		if ($scope.selected_network != item) {
			$scope.selected_network.isSelected = false;
			item.isSelected = true;
			$scope.selected_network = item;
		} else {
			$scope.selected_network.isSelected = false;
			$scope.selected_network = {};
		}

	}

	$scope.activate = function(item) {
		console.log("activating network", item);
		$scope.reset();

		$http.post('/network_activate', item).success(function(response) {
			if (response.success) {
				$scope.success = true;

				for (i in $scope.networks) {
					$scope.networks[i].current = false;
				}

				angular.copy(response.network, item);

				var intervalID = setInterval(function() {
					$scope.getNetworkStatus();
					if ($scope.getNetworkStatus["wpa_state"].match("COMPLETED")) {
						clearInterval(intervalID);
					}
				}, 500);
				
			} else {
				$scope.failure = true;
				$scope.message = response.message;
			}
		});		
	}

	$scope.saveConfig = function() {
		console.log("saving config...");
		$scope.reset();
		// $scope.modified = false;

		$http.post('/network_saveconfig').success(function(response) {
			if (response.success) {
				$scope.success = true;
				$rootScope.config_modified = false;
			} else {
				$scope.failure = true;
				$scope.message = response.message;
			}
		});
	}

	$scope.editNetworks = function(item) {
		console.log("show edit pane");
		$scope.reset();
		$scope.editing = false;
		$scope.selected_network = {};
	}

	$scope.edit = function(item) {
		if (item.isRemoved) {
			// this is a bit of a hack. because the remove button is on the list-group-item which is linked
			// to the edit function, the edit function also gets called when removing the element. to avoid this
			// we set the isRemoved flag on the element when removing it so that the edit function gets thrown
			// out again
			return;
		}

		console.log("edit...");

		if (!item.routes) {
			item.routes = [];
		}

		$scope.old_network = item;
		$scope.selected_network = angular.copy(item);
		$scope.editing = true;
		// $('#tab_edit').click();
	}

	$scope.cancel = function() {
		$scope.selected_network = {}
		$scope.editing = false;
	}

	$scope.undo = function() {
		$scope.reset();

		$scope.selected_network = angular.copy($scope.old_network);
		$scope.modified = false;
		$scope.generalSettingsForm.$setPristine();
	}

	$scope.checkModify = function(new_item, old_item, flag) {
		console.log("check modifiy ...");
		if (!angular.equals(new_item, old_item)) {
			console.log("... true");
			return true;
		}
		return flag;
	}

	$scope.applyNetworkChanges = function() {
		$scope.generalSettingsForm.$setPristine();

		$scope.reset();

		$http.post('/network_edit', $scope.selected_network).success(function(response) {
			if (response.success) {
				angular.copy($scope.selected_network, $scope.old_network);
				$scope.modified = false;
				$rootScope.config_modified = true;
			} else {
				$scope.failure = true;
				$scope.message = response.message;
			}
		});
	}

	$scope.addRoute = function(network, route) {
		console.log("addRoute: srcPort", route.srcPort, "dstPort", route.dstPort, "target", route.target)

		network.routes.push(angular.copy(route));
		$scope.route = {};
		$scope.modified = true;

		$scope.newRouteForm.$setPristine();
	}

	$scope.editRoute = function(route) {
		$scope.old_route = route;
		$scope.route = angular.copy(route);
		$scope.route_edit = true;
		$scope.route_modified = false;
		$scope.modified = true;
	}

	$scope.applyRouteChanges = function(route) {
		angular.copy(route, $scope.old_route);
		$scope.route_edit = false;
		$scope.route_modified = false;
		$scope.route = {};

		$scope.newRouteForm.$setPristine();
	}

	$scope.cancelRouteChanges = function() {
		$scope.route = {};
		$scope.route_edit = false;
		$scope.route_modified = false;

		$scope.newRouteForm.$setPristine();
	}

};