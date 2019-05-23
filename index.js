const Discord = require('discord.js');
const config = require('./config.json');
const { Cat } = require('./utils/cat');
const { AwaitHandler } = require('./utils/await');
const mongoose = require('mongoose');
const { Channel } = require('./models/channel');
const moment = require('moment');
const client = new Discord.Client;
let globalCat;
const commandList = require('./commands/command');

// this is just a bunch of including the commands
// adding them dynamically is easier but SOMEONE keeps saying it's bad practice so
// this is on her
// this also makes the game easier as i can add the file for both collections needed

client.admin = new Discord.Collection();
const adminComms = commandList.admin;
for (const file of adminComms) {
	client.admin.set(file.tag, file);
}

client.commands = new Discord.Collection();
const commandsComms = commandList.commands;
for (const file of commandsComms) {
	client.commands.set(file.tag, file);
}

client.triggers = new Discord.Collection();
const triggerFiles = commandList.triggers;
for (const file of triggerFiles) {
	client.triggers.set(file.tag, file);
}

const guildUpdate = new Discord.Collection();
const awaitHandler = new AwaitHandler();

client.on('ready', () => {
	console.log(`I'm up, and i'm part of ${client.guilds.size} servers`);
	const db = config.db;
	mongoose.connect(db, { useNewUrlParser: true })
		.then(() => {
			console.log(`connected Succesfully to ${db}`);
		})
		.catch(console.error);
	globalCat = new Cat();
	console.log(globalCat.mood);
	setInterval(updateCat, 3600000);
});

function updateCat() {
	globalCat.updateMood();
	console.log(globalCat.mood);
}


client.on('message', async message => {
	if (message.author.bot) return;
	let newReg;
	const mentioned = message.isMentioned(client.user);

	// pre-verification admin/info ops
	if (mentioned === true) {
		for (const key of client.admin) {
			newReg = new RegExp(key[1].regexp, 'gm');
			if (newReg.test(message.content)) {
				console.log('found ' + key[1].info.name);
				key[1].execute(message, globalCat);
				return;
			}
		}
	}

	// channel + guild verification
	const search = await Channel.checkChannel(message.channel.id);
	if (!search) {
		console.log('channel not allowed');
		return;
	}
	const guildId = message.guild.id;
	const timeNow = new Date();
	// we store a guild and last updated time in memory to save on DB updates
	// if these aren't 100% accurate, it's not the end of the world
	// i might update this to users, but i'm not all that big on it right now
	if (guildUpdate.has(guildId)) {
		const guildUpdateTime = guildUpdate.get(guildId);
		const diff = moment().diff(guildUpdateTime, 'hours');
		if (diff === 0) {
			console.log('no update needed');
		}
		// do update stuff when i build the command
		else {
		console.log('update time');
		guildUpdate.set(guildId, timeNow);
		}

	}
	else {
		console.log('created Guild in volmem');
		guildUpdate.set(guildId, timeNow);
	}
	// post-verification
	if (mentioned === true) {
		for (const key of client.commands) {
			newReg = new RegExp(key[1].regexp, 'gmi');
			if (newReg.test(message.content)) {
				console.log('found ' + key[1].info.name);
				guildUpdate.set(message.guild.id, new Date());
				if (key[1].await) {
					key[1].execute(message, awaitHandler);
				}
				else {
					key[1].execute(message, globalCat);
				}

				return;
			}
		}
	}
	const dice = 1;
	// const dice = Math.floor((Math.random() * 100) + 1);
	for (const key of client.triggers) {
		newReg = new RegExp(key[1].regexp, key[1].flags);
		if (newReg.test(message.content) && dice <= key[1].chance) {
			console.log('found ' + key[1].info.name);
			if (key[1].await) {
				if (awaitHandler.isPaused(message.channel.id) === false) {
					key[1].execute(message, awaitHandler);
				}
			}
			else {
				key[1].execute(message, globalCat);
			}
			return;
		}
	}
});

client.on('error', data => {
	console.error('Connection Error', data.message);
});

client.login(config.token)
	.then(console.log('Logged In'))
	.catch(console.error);
