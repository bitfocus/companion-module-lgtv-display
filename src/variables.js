module.exports = {
	initVariables: function () {
		let self = this;
		let variables = []

		self.setVariableDefinitions(variables);
		self.checkVariables();
	},

	checkVariables: function () {
		let self = this;

		//set variables
		let variableObj = {};

		self.setVariableValues(variableObj);
	}
}
