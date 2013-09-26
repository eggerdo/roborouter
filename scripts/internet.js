var count = 1;
function scan() {
	var internet_item = '<a href="#' + count + '" class="list-group-item">Item ' + count + '</a>';
	$('#internet_list').append(internet_item);
	count++;
}

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

myApp.directive('stopEvent', function () {
	return {
		restrict: 'A',
		link: function (scope, element, attr) {
			element.bind(attr.stopEvent, function (e) {
				e.stopPropagation();
			});
		}
	};
});

var OPEN 	= 0;
	WEP 	= 1;
	WPA 	= 2;

// setPristine = function(form){
// 	if(form.$setPristine){//only supported from v1.1.x
// 		form.$setPristine();
// 	}else{
// 		for (var i in form) {
// 			var input = form[i];
// 			if (input.$dirty) {
// 				input.$dirty = false;
// 			}
// 		}
// 	 }
//  };

function InternetCtrl($scope, $http) {
	$scope.success = false;
	$scope.failure = false;
	$scope.modified = false;
	$scope.networks = [];
	$scope.scan_networks = [];
	$scope.selected_network = {};
	$scope.editing = false;
	$scope.loading = false;
	$scope.route_edit = false;
	$scope.route_modified = false;
	$scope.settings_valid = false;
	$scope.config_modified = false;

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
				$scope.edit(network);
				$('#tab_edit').click();	
				$scope.config_modified = true;
			} else {
				$scope.success = false;
			}
		});
	}

	$scope.removeNetwork = function(item) {
		console.log("remove network: " + item);
		$scope.reset();

		$http.post('/network_remove', item).success(function(response) {
			if (response.success) {
				$scope.success = true;
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

	$scope.saveConfig = function() {
		console.log("saving config...");
		$scope.reset();
		// $scope.modified = false;

		$http.post('/network_saveconfig').success(function(response) {
			if (response.success) {
				$scope.success = true;
				$scope.config_modified = false;
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

		$scope.selected_network = $scope.old_network;
		$scope.modified = false;
		$scope.generalSettingsForm.$setPristine();
	}

	$scope.checkModify = function() {
		if (!angular.equals($scope.selected_network, $scope.old_network)) {
			$scope.modified = true;
		}
	}

	$scope.applyNetworkChanges = function() {
		// $scope.generalSettingsForm.$setPristine();

		$scope.reset();
		// $('#generalSettingsForm .form-group').removeClass('has-error');

		// if (!$scope.selected_network.id_str || $scope.selected_network.id_str == "") {
		// 	$('#identification').closest('.form-group').addClass('has-error');
		// 	$scope.failure = true;
		// 	$scope.message = 'Identification required!';
		// 	return;
		// }


		$http.post('/network_edit', $scope.selected_network).success(function(response) {
			if (response.success) {
				angular.copy($scope.selected_network, $scope.old_network);
				// $scope.success = true;
				$scope.modified = false;
				$scope.config_modified = true;
				// $scope.saveConfig();
			} else {
				$scope.failure = true;
				$scope.message = response.message;
			}
		});
	}

	$scope.addRoute = function(network, route) {
		console.log("addRoute");

		// $scope.reset();
		// $('#newRouteForm .form-group').removeClass('has-error');

		// if (!route) {
		// 	console.log("route undefined");
		// 	$('#newRouteForm .form-group').addClass('has-error');
		// 	$scope.failure = true;
		// 	$scope.message = 'Input Required!';
		// 	return;
		// }
		console.log("srcPort", route.srcPort, "dstPort", route.dstPort, "target", route.target)

		// var check_ok = true;
		// if (!route.srcPort) {
		// 	$('#srcPort').closest('.form-group').addClass('has-error');
		// 	check_ok = false;
		// }
		// if (!route.dstPort) {
		// 	$('#dstPort').closest('.form-group').addClass('has-error');
		// 	check_ok = false;
		// }
		// if (!route.target) {
		// 	$('#target').closest('.form-group').addClass('has-error');
		// 	check_ok = false;
		// }

		// if(!check_ok) {
		// 	$scope.failure = true;
		// 	$scope.message = 'One or more fields are missing!';
		// 	return;
		// }

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
	}

	$scope.cancelRouteChanges = function() {
		$scope.route = {};
		$scope.route_edit = false;
		$scope.route_modified = false;
	}

	$scope.checkModifyRoute = function() {
		if (!angular.equals($scope.route, $scope.old_route)) {
			$scope.route_modified = true;
		}
	}

};