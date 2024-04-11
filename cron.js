const cron = require("node-cron");

const { bsp_agent } = require('./agents/bsp_issuance')


exports.run_cron = async() => {
	cron.schedule("*/60 * * * * *", function () {
		bsp_agent()
	});
	
}
