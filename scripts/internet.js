var count = 1;
function scan() {
	var internet_item = '<a href="#' + count + '" class="list-group-item">Item ' + count + '</a>';
	$('#internet_list').append(internet_item);
	count++;
}

function InternetCtrl($scope, $http) {
	$scope.success = false;
	$scope.failure = false;
	$scope.networks = [];
	$scope.scan_networks = [];

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

		$http.post('/network_scan').success(function(response) {
			if (response.success) {
				$scope.success = true;
				$scope.scan_networks = response.networks;
			} else {
				$scope.failure = true;
			}
		})
	};

	$scope.stopScan = function() {
		console.log("stop scan");
		$scope.reset();

		$http.post('/network_stop', item).success(function(response) {
			if (response.success) {
				$scope.success = true;
			} else {
				$scope.success = false;
			}
		});
	}

	$scope.addNetwork = function(item) {
		console.log("select network: " + item);
		$scope.reset();

		$http.post('/network_add', item).success(function(response) {
			if (response.success) {
				$scope.success = true;
			} else {
				$scope.success = false;
			}
		});
	}

	$scope.removeNetwork = function(item) {
		console.log("select network: " + item);
		$scope.reset();

		$http.post('/network_remove', item).success(function(response) {
			if (response.success) {
				$scope.success = true;
			} else {
				$scope.success = false;
			}
		});
	}
};