const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base');
const UpgradeScripts = require('./src/upgrades');
const { LGTV, EnergySavingLevels, Keys, DefaultSettings } = require('lgtv-ip-control');

const config = require('./src/config');
const actions = require('./src/actions');
const feedbacks = require('./src/feedbacks');
const variables = require('./src/variables');
const presets = require('./src/presets');

const utils = require('./src/utils');

class LGTVInstance extends InstanceBase {
	constructor(internal) {
		super(internal);
		// Assign the methods from the listed files to this class
		Object.assign(this, {
			...config,
			...actions,
			...feedbacks,
			...variables,
			...presets,
			...utils,
		});
		this.avaliable_keys = [];
		this.avaliable_energyLevels = [];
	}

	async init(config) {
		this.configUpdated(config);
	}

	async configUpdated(config) {
		this.config = config;

		this.initActions();
		this.initFeedbacks();
		this.initVariables();
		this.initPresets();

		this.updateStatus(InstanceStatus.Connecting);
		this.initLGTV();
		this.initConnection();

		if (this.config.precision) {
			this.precision = parseInt(this.config.precision);
		}
	}

	initLGTV() {
		this.available_keys = Object.keys(Keys).map(key => ({ id: key, label: key }));
		this.available_energyLevels = Object.keys(EnergySavingLevels).map(key => ({ id: key, label: key }));
		this.initActions();
	}

	initConnection() {
		if (this.lgtv !== undefined) {
			this.lgtv.disconnect()
			delete this.lgtv;
		}
		this.updateStatus(InstanceStatus.Connecting);
		this.DefaultSettings = Object.assign({}, DefaultSettings);
		if (this.config.wol_ip && this.REGEX_IP.test(this.config.wol_ip)) {
			this.DefaultSettings.networkWolAddress = this.config.wol_ip;
		} else {
			this.DefaultSettings.networkWolAddress = '255.255.255.255'; // Default value if invalid
		}

		if (this.config.host && this.config.mac && this.config.code) {
			this.log('debug', `Connecting to ${this.config.host}`)
			try {
				this.lgtv = new LGTV(this.config.host, this.config.mac, this.config.code, this.DefaultSettings);
				this.lgtv
					.connect()
					.then(() => {
						this.log('info', `Connected to ${this.config.host}`);
						this.updateStatus(InstanceStatus.Ok);
					})
					.catch(error => {
						this.log('error', 'Could not connect to TV.');
						this.log('debug', error.message)
						this.updateStatus(InstanceStatus.ConnectionFailure, 'Error connecting to device: ' + error.message);
					});
					this.lgtv.socket
			} catch (error) {
				this.log('error', 'Error connecting to device: ' + error.message)
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Error connecting to device: ' + error.message)
			}
		} else {
			this.updateStatus(InstanceStatus.BadConfig)
		}
	}

	async destroy() {
		if (this.lgtv) {
			this.lgtv.disconnect()
		}
		this.log('debug', `Destroying instance ${this.id}`);
	}
}

runEntrypoint(LGTVInstance, UpgradeScripts);
