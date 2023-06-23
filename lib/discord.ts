import Discord from 'discord.js';

const client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds,
		Discord.GatewayIntentBits.GuildMessages,
		Discord.GatewayIntentBits.GuildVoiceStates,
		Discord.GatewayIntentBits.MessageContent,
	],
});

const readyPromise = new Promise((resolve) => {
	client.on('ready', () => {
		resolve(null);
	});
});

if (process.env.DISCORD_TOKEN) {
	client.login(process.env.DISCORD_TOKEN);
}

export async function send(...args) {
	await readyPromise;
	return (client.channels.cache.get(process.env.DISCORD_CHANNEL) as any).send(...args);
};
