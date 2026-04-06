const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const fs = require("fs");

const TOKEN = process.env.TOKEN;

// Simple JSON DB
const db = {
    users: {},
    keys: {}
};

// Save DB
function saveDB() {
    fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

// Load DB
if (fs.existsSync("db.json")) {
    Object.assign(db, JSON.parse(fs.readFileSync("db.json")));
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Slash commands
const commands = [
    new SlashCommandBuilder()
        .setName("genkey")
        .setDescription("Generate a license key")
        .setDefaultMemberPermissions(0x8),

    new SlashCommandBuilder()
        .setName("redeem")
        .setDescription("Redeem a license key")
        .addStringOption(o => o.setName("key").setDescription("Your key").setRequired(true))
        .addStringOption(o => o.setName("hwid").setDescription("Your HWID").setRequired(true)),

    new SlashCommandBuilder()
        .setName("resethwid")
        .setDescription("Reset your HWID"),

    new SlashCommandBuilder()
        .setName("force_resethwid")
        .setDescription("Force reset a user's HWID")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
        .setDefaultMemberPermissions(0x8)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log("Commands registered");
    } catch (err) {
        console.error(err);
    }
}

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Handle commands
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const name = interaction.commandName;

    if (name === "genkey") {
        const key = Math.random().toString(36).substring(2, 12).toUpperCase();
        db.keys[key] = { used: false };
        saveDB();
        return interaction.reply(`🔑 Generated key: \`${key}\``);
    }

    if (name === "redeem") {
        const key = interaction.options.getString("key");
        const hwid = interaction.options.getString("hwid");

        if (!db.keys[key]) return interaction.reply("❌ Invalid key");
        if (db.keys[key].used) return interaction.reply("❌ Key already used");

        db.keys[key].used = true;
        db.users[interaction.user.id] = { hwid };
        saveDB();

        return interaction.reply("✅ Key redeemed");
    }

    if (name === "resethwid") {
        if (!db.users[interaction.user.id])
            return interaction.reply("❌ You are not registered");

        db.users[interaction.user.id].hwid = null;
        saveDB();
        return interaction.reply("🔄 HWID reset");
    }

    if (name === "force_resethwid") {
        const user = interaction.options.getUser("user");
        if (!db.users[user.id])
            return interaction.reply("❌ User not registered");

        db.users[user.id].hwid = null;
        saveDB();
        return interaction.reply(`🔧 Reset HWID for ${user.username}`);
    }
});

registerCommands();
client.login(TOKEN);
