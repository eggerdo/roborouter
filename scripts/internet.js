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

var OPEN 	= 0;
	WEP 	= 1;
	WPA 	= 2;

function InternetCtrl($scope, $http) {
	$scope.success = false;
	$scope.failure = false;
	$scope.modified = false;
	$scope.networks = [];
	$scope.scan_networks = [];
	$scope.selected_network = {};
	$scope.editing = false;
	$scope.loading = false;

	$scope.reset = function() {
		$scope.success = false;
		$scope.failure = false;
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
			} else {
				$scope.failure = true;
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

	$scope.addNetwork = function(item) {
		console.log("add network: " + item);
		$scope.reset();

		$http.post('/network_add', item).success(function(response) {
			if (response.success) {
				$scope.success = true;
				$scope.networks.push(item);
				$('#tab_networks').click();	
				$scope.modified = true;
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

	$scope.add = function(item) {
		console.log("adding...");
		item.isSelected = false;
		$scope.addNetwork(item);
		$scope.scan_networks.splice($scope.scan_networks.indexOf(item),1);
	}

	$scope.saveConfig = function() {
		console.log("saving config...");
		$scope.reset();
		$scope.modified = false;

		$http.post('/network_saveconfig').success(function(response) {
			if (response.success) {
				$scope.success = true;
				$scope.networks = response.networks;
			} else {
				$scope.failure = true;
			}
		});
	}

	$scope.editNetwork = function(item) {
	}

	$scope.edit = function(item) {
		$scope.selected_network = item;
		$scope.old_network = item;
		$scope.editing = true;
		// $('#tab_edit').click();
	}

	$scope.cancel = function() {
		$scope.selected_network = {}
		$scope.editing = false;
	}

	$scope.undo = function() {
		$scope.selected_network = $scope.old_network;
	}

	$scope.checkModify = function() {
		if (!angular.equals($scope.selected_network, $scope.old_network)) {
			$scope.modified = true;
		}
	}

};