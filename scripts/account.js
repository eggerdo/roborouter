function AccountCtrl($scope, $http) {
	$scope.save = false;
	$scope.failure = false;
	$scope.account = {};
	$scope.submit = function() {
		$('#passwordForm .form-group').removeClass('has-error');

		$http.post('/save_pwd', $scope.account).success(function(response)
		{
			if (response.success) {
				$scope.save = true;
				$scope.failure = false;

				// $('#passwordForm')[0].reset();
				$scope.account = {};
			} else {
				$scope.save = false;
				$scope.failure = true;
				$scope.message = response.message;
				if (response.mismatch) {
					$('#new_password').closest('.form-group').addClass('has-error');
					$('#confirm_password').closest('.form-group').addClass('has-error');
				} else {
					$('#old_password').closest('.form-group').addClass('has-error');
				}
			}
		});
	};
};