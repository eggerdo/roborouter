function AccountCtrl($scope, $http) {
	$scope.save = false;
	$scope.failure = false;
	$scope.mismatch = false;
	$scope.account = {};
	$scope.submit = function() {
		$('#old_password').closest('.form-group').removeClass('has-error');
		$('#new_password').closest('.form-group').removeClass('has-error');
		$('#confirm_password').closest('.form-group').removeClass('has-error');

		$http.post('/save_pwd', $scope.account).success(function(response)
		{
			if (response.success) {
				$scope.save = true;
				$scope.failure = false;
				$scope.mismatch = false;

				$('#passwordForm')[0].reset();
			} else {
				$scope.save = false;
				$scope.failure = true;
				$scope.message = response.message;
				if (response.mismatch) {
					$scope.mismatch = true;

					$('#new_password').closest('.form-group').addClass('has-error');
					$('#confirm_password').closest('.form-group').addClass('has-error');
				} else {
					$scope.mismatch = false;

					$('#old_password').closest('.form-group').addClass('has-error');
				}
			}
		});
	};
};