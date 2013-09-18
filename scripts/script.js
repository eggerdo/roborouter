function Controller($scope) {
	console.log("Hello");
    $scope.master= {};
     
    $scope.update = function(user) {
    	console.log("update");
    	$scope.master= angular.copy(user);
    };
     
    $scope.reset = function() {
    	$scope.user = angular.copy($scope.master);
    };
     
    $scope.reset();
}

function AccountCtrl($scope, $http) {
	$scope.save = false;
	$scope.failure = false;
	$scope.missmatch = false;
	$scope.account = {};
	$scope.submit = function() {
		$http.post('/save_pwd', $scope.account).success(function(response)
		{
			if (response.success) {
				$scope.save = true;
				$scope.failure = false;
			} else {
				$scope.save = false;
				if (response.missmatch) {
					$scope.failure = false;
					$scope.missmatch = true;
				} else {
					$scope.failure = true;
					$scope.missmatch = false;
				}
			}
		});
	};
};