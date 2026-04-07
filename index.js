const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const fs = require("fs");

// ENV VARS
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const LOG_CHANNEL = process.env.LOG_CHANNEL;

// -----------------------------
// SIMPLE JSON DATABASE
// -----------------------------
const db = {
    users: {}, // userId: { hwid, key }
    keys: {}   // key: { used, ownerId }
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

    new SlashCommandBuilder()
        .setName("genkey")
        .setDescription("Generate a license key")
        .setDefaultMemberPermissions(0x8),

    new SlashCommandBuilder()
        .setName("redeem")
        .setDescription("Redeem a license key")
        .addStringOption(o =>
            o.setName("key").setDescription("Your key").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("hwid").setDescription("Your HWID").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("resethwid")
        .setDescription("Reset your HWID"),

    new SlashCommandBuilder()
        .setName("force_resethwid")
        .setDescription("Force reset a user's HWID")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(true)
        )
        .setDefaultMemberPermissions(0x8),

    new SlashCommandBuilder()
        .setName("setpanel")
        .setDescription("Create the script access panel")
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
// READY
// -----------------------------
client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// -----------------------------
// INTERACTIONS
// -----------------------------
client.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand()) {
        const name = interaction.commandName;

        // /genkey
        if (name === "genkey") {
            const key = Math.random().toString(36).substring(2, 12).toUpperCase();
            db.keys[key] = { used: false, ownerId: null };
            saveDB();

            await interaction.reply(`🔑 Generated key: \`${key}\``);

            const log = client.channels.cache.get(LOG_CHANNEL);
            if (log) log.send(`🧾 **${interaction.user.tag}** generated key \`${key}\``);
            return;
        }

        // /redeem
        if (name === "redeem") {
            const key = interaction.options.getString("key");
            const hwid = interaction.options.getString("hwid");

            if (!db.keys[key]) return interaction.reply("❌ Invalid key");
            if (db.keys[key].used) return interaction.reply("❌ Key already used");

            db.keys[key].used = true;
            db.keys[key].ownerId = interaction.user.id;
            db.users[interaction.user.id] = { hwid, key };
            saveDB();

            await interaction.reply("✅ Key redeemed");

            const log = client.channels.cache.get(LOG_CHANNEL);
            if (log) log.send(`✅ **${interaction.user.tag}** redeemed key \`${key}\` with HWID \`${hwid}\``);
            return;
        }

        // /resethwid
        if (name === "resethwid") {
            const userData = db.users[interaction.user.id];
            if (!userData) return interaction.reply("❌ You are not registered");

            userData.hwid = null;
            saveDB();

            await interaction.reply("🔄 HWID reset");

            const log = client.channels.cache.get(LOG_CHANNEL);
            if (log) log.send(`♻️ **${interaction.user.tag}** reset their HWID`);
            return;
        }

        // /force_resethwid
        if (name === "force_resethwid") {
            const user = interaction.options.getUser("user");
            const userData = db.users[user.id];

            if (!userData) return interaction.reply("❌ User not registered");

            userData.hwid = null;
            saveDB();

            await interaction.reply(`🔧 Reset HWID for ${user.username}`);

            const log = client.channels.cache.get(LOG_CHANNEL);
            if (log) log.send(`🔧 **${interaction.user.tag}** force-reset HWID for **${user.tag}**`);
            return;
        }

        // /setpanel
        if (name === "setpanel") {
            const embed = new EmbedBuilder()
                .setTitle("Premium Script Access Panel")
                .setDescription("Click the button below to receive your loader script.\n\nAccess is based on your redeemed key + HWID.")
                .setColor("#f1c40f")
                .setThumbnail("https://i.imgur.com/8fK4h6X.png");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("get_script")
                    .setLabel("📜 Get Script")
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({
                embeds: [embed],
                components: [row]
            });

            const log = client.channels.cache.get(LOG_CHANNEL);
            if (log) log.send(`📌 **${interaction.user.tag}** created a script panel in <#${interaction.channelId}>`);
            return;
        }
    }

    // BUTTONS
    if (interaction.isButton()) {
        if (interaction.customId === "get_script") {
            const userData = db.users[interaction.user.id];

            if (!userData || !userData.key) {
                return interaction.reply({
                    content: "❌ You don't have a redeemed key. Use `/redeem` first.",
                    ephemeral: true
                });
            }

            const loaderScript = `
-- Premium Loader Example
-- User: ${interaction.user.id}
-- Key: ${userData.key}

print("Loader started for user ${interaction.user.id}")

-- Your script logic here
            `;

            try {
                await interaction.user.send(
                    "Here is your loader script:\n```lua\n" + loaderScript + "\n```"
                );

                await interaction.reply({
                    content: "📬 Check your DMs!",
                    ephemeral: true
                });

                const log = client.channels.cache.get(LOG_CHANNEL);
                if (log) log.send(`📥 **${interaction.user.tag}** requested the loader script.`);

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
// START
// -----------------------------
registerCommands();
client.login(TOKEN);
