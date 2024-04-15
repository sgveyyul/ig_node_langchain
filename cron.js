const cron = require("node-cron");

const { bsp_agent_2 } = require('./agents/bsp_issuance_2')


exports.run_cron = async() => {
	// cron.schedule('0 8,16 * * *', function () {
	cron.schedule("*/60 * * * * *", function () {
		console.log('bsp_issuance_2()')
		bsp_agent_2()
	});
	
}
