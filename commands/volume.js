const { embed } = require("../utilities/display.js");
const { isMod } = require('../utilities/auth');
const { client } = require('..');

exports.name = 'volume';
exports.type = 'Music';
exports.info = 'Config volume.';
exports.usage = '';
exports.alias = ['vol'];
exports.root = false;
exports.admin = false;
exports.mod = false;

exports.run = async ({message, args}) => {
    const num = +args[0]
	const player = client.music.get(message.guild.id);
	if (player === undefined || player.state !== 'CONNECTED' || player.current === null) return await message.channel.send(embed('RED', 'Volume Error', 'There is no music playing on this server.'));
	if (player.textChannel !== message.channel.id || player.voiceChannel !== message.member.voice.channel.id) {
		return await message.channel.send(embed('RED', 'Volume Error', `You must be in <#${player.voiceChannel}> and run commands in <#${player.textChannel}> to control the volume.`));
	}
	const mod = await isMod(message.author.id);
	if (message.guild.channels.cache.get(message.member.voice.channelID).members.filter(member => member.user.bot).size > 1 || !mod || num > 100 || num < 1) return await message.channel.send(embed('RED', 'Volume Error', 'You can only config volume if you are alone in the voice channel or volume is out of range.'));
	else {await player.setVolume(num); message.channel.send(embed("GREEN", "Configured Volume", `Sucessfully configured volume to ${num}`)).then(msg => msg.delete({timeout: 10000}))}
}