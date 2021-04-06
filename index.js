// Setup Client
const {Client, Intents} = require('discord.js');
const client = exports.client = new Client({
	partials: ['CHANNEL', 'MESSAGE', 'REACTION'],
	ws: {
		intents: Intents.ALL
	}
});

// Dependencies
const { Manager } = require('erela.js');
const config = require('./config.json');
const {isRoot, isAdmin, isMod} = require('./utilities/auth');
const {embed, format, duration, newuserEmbed} = require('./utilities/display');
const {userData, ownedProjects, allProjects, startConstStar, allStarMes} = require('./utilities/data');
const commands = require('./utilities/commands');
const { null } = require('mathjs');

// Execute Scripts
require('./utilities/cleanup');

// Active Executors
const active = [];

// Music Initializer
const music = client.music = new Manager({
	nodes: [{
		host: config.lavalink.host,
		port: +config.lavalink.port,
		password: config.lavalink.pass,
		identifier: 'PDBot',
	}],
	send(id, payload) {
		const guild = client.guilds.cache.get(id)
		if (guild) guild.shard.send(payload)
	},
});
music.on('nodeConnect', node => {
	console.log(`Connected to music node named "${node.options.identifier}"`);
});
music.on('nodeError', (node, err) => {
	console.log(`Error connecting to music node "${node.options.identifier}" • ${err.message}`);
});
music.on('trackStart', async (player, track) => {
	const channel = client.channels.cache.get(player.textChannel);
	if (channel === undefined) return;
	const user = await client.users.fetch(track.requester);
	await channel.send(embed('BLACK', 'Now Playing', `[${track.title}](${track.uri})\nRequester • ${user.tag}\nAuthor • ${track.author}\nDuration • ${duration(track.duration)}`, [], track.displayThumbnail('maxresdefault'))).then(msg => msg.delete({timeout: 10000}));
});
music.on(`queueEnd`, player => {
	client.lavalinkQueueTimeout = setTimeout(() => {
		if (player.queue.length != 0 || player.queue.length == 0 && player.queue.current) {return;}
		else {
			client.channels.cache.get(player.textChannel)
				.send(embed("BLACK", "Disconnected due to inactivity", "I've been inactive for too long. Saving bandwidth..")).then(msg => msg.delete({timeout: 10000}));
			player.destroy();
		}
	}, 600000);
});

client.on('raw', d => {
	client.music.updateVoiceState(d);
});

// Suggestion Channel Message
client.on('message', async message => {
	if (message.channel?.id !== config.channels.suggestions || message.author.bot) return;
	await message.delete();
	const content = embed('PURPLE', `Suggestion: ${message.author.tag}`, message.content).embed;
	content.author.icon_url = message.author.displayAvatarURL({
		dynamic: true
	});
	const replacement = await message.channel.send({embed: content});
	await replacement.react(config.emojis.yes);
	await replacement.react(config.emojis.no);
});

// Counter Channel Message
client.on('message', async message => {
	if (message.channel?.id !== config.channels.counting) return;
	const messages = await message.channel.messages.fetch({
		limit: 1,
		before: message.id
	});
	const previous = +messages.array().map(message => message.content)[0];
	if (isNaN(previous) || previous <= 0 || Math.floor(previous) !== previous || previous === Infinity || previous === -Infinity) return;
	const next = (previous + 1) + '';
	if (message.content != next) await message.delete().catch(() => {});
});

// Counter Channel Edit
client.on('messageUpdate', async (_, message) => {
	if (message.channel?.id !== config.channels.counting) return;
	const messages = await message.channel.messages.fetch({
		limit: 1,
		before: message.id
	});
	const previous = +messages.array().map(message => message.content)[0];
	if (isNaN(previous) || previous <= 0 || Math.floor(previous) !== previous || previous === Infinity || previous === -Infinity) return;
	const next = (previous + 1) + '';
	if (message.content !== next) await message.delete().catch(() => {});
});

// Project Member Remover
client.on('guildMemberRemove', async member => {
	const projects = allProjects();
	for (const [name, project] of Object.entries(projects)) {
		if (project.owner === member.user.id) {
			const owned = ownedProjects(project.owner);
			delete owned[name];
		} else if (project.members.includes(member.user.id)) {
			project.members.splice(project.members.indexOf(member.user.id), 1);
		} else if (project.developers.includes(member.user.id)) {
			project.developers.splice(project.developers.indexOf(member.user.id), 1);
		}
	}
});

// Project Channel Adder
client.on('channelCreate', async channel => {
	if (channel.parentID === null || !['text', 'voice'].includes(channel.type)) return;
	const projects = allProjects();
	for (const project of Object.values(projects)) {
		if (channel.parentID === project.category) {
			project.channels.push(channel.id);
		}
	}
});

// Project Channel Remover
client.on('channelDelete', async channel => {
	if (channel.parentID === null || !['text', 'voice', 'category'].includes(channel.type)) return;
	const projects = allProjects();
	for (const [name, project] of Object.entries(projects)) {
		console.log(project, channel.id, channel.type);
		if (project.category === channel.id) {
			const owned = ownedProjects(project.owner);
			delete owned[name];
		} else if (project.channels.includes(channel.id)) {
			project.channels.splice(project.channels.indexOf(channel.id), 1);
		}
	}
});

// Project Invitation Handler
client.on('messageReactionAdd', async (reaction, user) => {
	if (reaction.partial) try {
		await reaction.fetch();
	} catch {return}
	if (reaction.message.partial) try {
		await reaction.message.fetch();
	} catch {return}
	const data = userData(user.id);
	for (const [messageId, invite] of Object.entries(data.activeInvites)) {
		if (messageId === reaction.message.id) {
			if (reaction.emoji.id === config.emojis.yes) {
				const projects = ownedProjects(invite.owner);
				const project = projects[invite.name];
				const channel = client.channels.cache.get(project.category);
				try {
					await channel.updateOverwrite(user.id, {
						VIEW_CHANNEL: true
					}, 'Added member to project.');
				} catch {return}
				project.members.push(user.id);
				delete data.activeInvites[messageId];
				await reaction.message.edit(embed('PURPLE', 'Accepted Invite', `You accepted the invitation to the \`${invite.name}\` project on **${channel.guild.name}**.`));
			} else if (reaction.emoji.id === config.emojis.no) {
				delete data.activeInvites[messageId];
				await reaction.message.edit(embed('PURPLE', 'Accepted Invite', `You rejected the invitation to the \`${invite.name}\` project on **${channel.guild.name}**.`));
			}
			break;
		}
	}
});

// New Users Handler
client.on('guildMemberAdd', async member => {
	if (!member.user.bot) {
		const nu_channel = client.channels.cache.get(config.channels.newuser)
		const nue = newuserEmbed(`GREEN`, `[${member.user.username}]`, `Welcome to Programmer's Den ${member.user.username}! Head <#${config.channels.serverinfo}> to get started and head to <#${config.channels.roles}> to choose your languages!`, `${member.id}`)
		nue.embed.thumbnail.url = member.user.displayAvatarURL();
		nu_channel.send(nue)
	} else if(member.user.bot) {
		let role = member.guild.roles.cache.get(config.roles.bot);
		await member.roles.add(role);
	}
});

// User Leave Handler
client.on('guildMemberRemove', async member => {
	const log_channel = client.channels.cache.get(config.channels.logs);
	const date = new Date();
	const em = embed(`RED`, `User left`, `**${member.user.username}** left the server`, [{
		name: `Left Date`,
		value: date.toUTCString()
	}], member.user.avatarURL());
	em.embed.footer.text = `ID • ${member.id}`;
	em.embed.timestamp = null;
	await log_channel.send(em);
});

// Starboard handler :D
client.on('messageReactionAdd', async (reaction) => {
	
	const channel_to_send = client.channels.cache.get(config.channels.starboard);
	const starboard_embed = embed('YELLOW', `${reaction.message.author.tag}`, `${reaction.message.content}`);
	starboard_embed.embed.author.icon_url = reaction.message.author.displayAvatarURL();
	if (reaction.emoji.name === '⭐' && reaction.message.reactions.cache.get('⭐').count >= 1 && allStarMes(reaction.message.id, reaction.message.channel.id) === null || allStarMes(reaction.message.id, reaction.message.channel.id) === undefined) {
		const mes = await channel_to_send.send(`:star2: ${reaction.message.reactions.cache.get(`⭐`).count}`, starboard_embed)
		const starboard_data = startConstStar(reaction.message.id);
		starboard_data[reaction.message.channel.id] = {
			oriID: reaction.message.id,
			oriMesID: reaction.message.channel.id,
			starID: mes.id,
			minStar: 3,
			currentStar: reaction.message.reactions.cache.get(`⭐`).count
		};
	} else if (reaction.emoji.name === '' && reaction.message.reactions.cache.get(`⭐`).count >= 1 && reaction.message.reactions.cache.get('⭐').count >= allStarMes(reaction.message.id, reaction.message.channel.id).minStar) {
		
	}
});

// Command Handler
client.on('message', async message => {
	if (message.author.bot || !message.guild || active.includes(message.author.id)) return;
	let text = message.content;
	const ping = `<@${client.user.id}>`;
	const nick = `<@!${client.user.id}>`;
	if (text.startsWith(config.prefix)) text = text.slice(config.prefix.length).trimLeft();
	else if (text.startsWith(ping)) text = text.slice(ping.length).trimLeft();
	else if (text.startsWith(nick)) text = text.slice(nick.length).trimLeft();
	else return;
	if (!text.length) return;
	const args = text.match(/[^\s\\"]+|"(?:[^"\\]|\\["\\])*"/g) ?? [];
	const name = args.shift().toLowerCase();
	text = text.slice(name.length).trimLeft();
	const texts = [text];
	let textCurrent = text;
	for (const arg of args) {
		textCurrent = textCurrent.slice(arg.length).trimLeft();
		if (textCurrent.length) texts.push(textCurrent);
	}
	let command;
	for (const [fileName, commandData] of Object.entries(commands)) {
		if (fileName === name || commandData.alias.includes(name)) {
			command = commandData;
			break;
		}
	}
	if (command === undefined) return;
	const root = await isRoot(message.author.id);
	const mod = await isMod(message.author.id);
	const admin = await isAdmin(message.author.id);
	if (command.root && !root) return await message.channel.send(embed('RED', 'Permission Denied', 'You must be an authorized root user to access this command.'));
	if (command.mod && !mod) return await message.channel.send(embed('RED', 'Permission Denied', 'You must be an authorized moderator to access this command.'));
	if (command.admin && !admin) return await message.channel.send(embed('RED', 'Permission Denied', 'You must be an authorized administrator to access this command.'));
	active.push(message.author.id);
	try {
		await command.run({name, args: args.map(arg => {
			if (arg.startsWith('"') && arg.endsWith('"')) return arg.slice(1, -1).replace(/\\([\\"])/g, '\1');
			else return arg;
		}), text, texts, command, root, mod, message, prefix: config.prefix});
		active.splice(active.indexOf(message.author.id), 1);
	} catch(error) {
		active.splice(active.indexOf(message.author.id), 1);
		console.log(error);
		await message.channel.send(embed('RED', 'Command Error', format(error.message, '', 2000)));
	}
});

// Ready Event + Manager Init
client.once('ready', async () => {
	await client.user.setPresence({
		activity: {
			name: 'you type ./help',
			type: 'LISTENING'
		},
		status: 'online'
	});
	console.log(`${client.user.tag} is now online and ready.`);
	client.music.init(client.user.id)
});

// Client Login
client.login(config.token);