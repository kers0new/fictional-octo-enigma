const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const fs = require("fs");

// ENV VARS
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// -----------------------------
// SIMPLE JSON DATABASE
// -----------------------------
const db = {
    users: {},
    keys: {}
};

function saveDB() {
    fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

if (fs.existsSync("db.json")) {
    Object.assign(db, JSON.parse(fs.readFileSync("db.json")));
}

// -----------------------------
// DISCORD CLIENT
// -----------------------------
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// -----------------------------
// SLASH COMMANDS
// -----------------------------
const commands = [

    // Generate key
    new SlashCommandBuilder()
        .setName("genkey")
        .setDescription("Generate a license key")
        .setDefaultMemberPermissions(0x8),

    // Redeem key
    new SlashCommandBuilder()
        .setName("redeem")
        .setDescription("Redeem a license key")
        .addStringOption(o =>
            o.setName("key").setDescription("Your key").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("hwid").setDescription("Your HWID").setRequired(true)
        ),

    // Reset HWID
    new SlashCommandBuilder()
        .setName("resethwid")
        .setDescription("Reset your HWID"),

    // Force reset HWID
    new SlashCommandBuilder()
        .setName("force_resethwid")
        .setDescription("Force reset a user's HWID")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(true)
        )
        .setDefaultMemberPermissions(0x8),

    // Script panel
    new SlashCommandBuilder()
        .setName("setpanel")
        .setDescription("Create the script panel")
        .setDefaultMemberPermissions(0x8)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Register commands
async function registerCommands() {
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log("Commands registered");
    } catch (err) {
        console.error(err);
    }
}

// -----------------------------
// BOT READY
// -----------------------------
client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// -----------------------------
// INTERACTION HANDLER
// -----------------------------
client.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand()) {
        const name = interaction.commandName;

        // -----------------------------
        // /genkey
        // -----------------------------
        if (name === "genkey") {
            const key = Math.random().toString(36).substring(2, 12).toUpperCase();
            db.keys[key] = { used: false };
            saveDB();
            return interaction.reply(`🔑 Generated key: \`${key}\``);
        }

        // -----------------------------
        // /redeem
        // -----------------------------
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

        // -----------------------------
        // /resethwid
        // -----------------------------
        if (name === "resethwid") {
            if (!db.users[interaction.user.id])
                return interaction.reply("❌ You are not registered");

            db.users[interaction.user.id].hwid = null;
            saveDB();
            return interaction.reply("🔄 HWID reset");
        }

        // -----------------------------
        // /force_resethwid
        // -----------------------------
        if (name === "force_resethwid") {
            const user = interaction.options.getUser("user");

            if (!db.users[user.id])
                return interaction.reply("❌ User not registered");

            db.users[user.id].hwid = null;
            saveDB();
            return interaction.reply(`🔧 Reset HWID for ${user.username}`);
        }

        // -----------------------------
        // /setpanel
        // -----------------------------
        if (name === "setpanel") {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("get_script")
                    .setLabel("📜 Get Script")
                    .setStyle(ButtonStyle.Primary)
            );

            return interaction.reply({
                content: "**📌 Script Panel**\nClick the button below to receive your loader script.",
                components: [row]
            });
        }
    }

    // -----------------------------
    // BUTTON HANDLER
    // -----------------------------
    if (interaction.isButton()) {
        if (interaction.customId === "get_script") {

            const loaderScript = `
-- Example Loader Script
print("Loaded successfully!")
            `;

            try {
                await interaction.user.send(
                    "Here is your script:\n```lua\n" + loaderScript + "\n```"
                );

                await interaction.reply({
                    content: "📬 Check your DMs!",
                    ephemeral: true
                });

            } catch {
                await interaction.reply({
                    content: "❌ I can't DM you. Enable DMs.",
                    ephemeral: true
                });
            }
        }
    }
});

// -----------------------------
// START BOT
// -----------------------------
registerCommands();
client.login(TOKEN);
