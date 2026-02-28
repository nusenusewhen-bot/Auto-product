require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events, ChannelType } = require('discord.js');
const axios = require('axios');
const bip39 = require('bip39');
const hdkey = require('hdkey');
const crypto = require('crypto');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ========== CONFIGURATION ==========
const OWNER_ID = process.env.OWNER_ID;
const FEE_ADDRESS = process.env.FEE_ADDRESS;
const BLOCKCHAIR_KEY = process.env.BLOCKCHAIR_KEY;
const BOT_MNEMONIC = process.env.BOT_MNEMONIC;

// Product Database
const PRODUCTS = {
  crunchyroll: {
    name: 'Crunchyroll Megafan LIFETIME',
    price: 1.2,
    stock: [
      'patty120487@gmail.com & pattys2luiz',
      'gustavocostamanhe@gmail.com & BlackGT1$',
      'fabiosouzahjf@gmail.com & Fabiosouza80',
      'melinda.damon@hotmail.com & ColaCoke157',
      'lucaslvpalacio@gmail.com & lango1807',
      'mwhitted2017@gmail.com & Hawaii808$',
      'Ayherpe@gmail.com & tu4ygpq4',
      'daniloorofino57@gmail.com & Dan0102--',
      'hmazet6@gmail.com & Kingofwar@1',
      'zdrops8345@gmail.com & 83452881V',
      'caiobatke123@gmail.com & Im13072006'
    ]
  },
  netflix: {
    name: 'Netflix LIFETIME',
    price: 1.0,
    stock: [
      'joy.bhowmik3@gmail.com:Tumpa@12',
      'rrsingh3269@gmail.com:Rsingh@1990',
      'harsha1p3vardhan@gmail.com:hiiharsha',
      'ahmednawaz81198@gmail.com:nawaz786',
      'rlondhe189@gmail.com:Rohit1991',
      'bt565282@gmail.com:Bobby@123',
      'jitujitenderkumar09@gmail.com:27/02/1999',
      'rakeshchauhan1322@gmail.com:rakesh@123',
      'manoharappu3@gmail.com:appu0302',
      'rishikumar8403@gmail.com:Akshita@8403',
      'mohitkholiya72@gmail.com:Mac20082008@',
      'sksarifulhassan@gmail.com:sariful@A1',
      'dgpatel36@gmail.com:deepakdip',
      'bainssaab284@gmail.com:Gagan123@',
      'noordhoka111@gmail.com:Noor@8080',
      'spriteupraj@gmail.com:Bhooljao@143',
      'raghuracchi789@gmail.com:9945920663',
      'nscharan181996@gmail.com:Rdns@1996',
      'karunesh.joshi@rediffmail.com:r30joshi',
      'hithu.kushi@gmail.com:hithu123',
      'jaysean1111@gmail.com:Somemissing@234',
      'dinnuchaudhry@gmail.com:divyachaudh2',
      'spalden03@gmail.com:ujjain902',
      'cameliacynthialangsieh@gmail.com:070819@#',
      'cordesangma123@gmail.com:Cordey44',
      'harrysaini988@gmail.com:Saini@1234',
      'tusharmohapatra988@gmail.com:9861835818',
      'aravindrajasekaran1@gmail.com:Simaya@23',
      'nareshprajapati31887@gmail.com:Neal@3797',
      'chanduchandurocks@gmail.com:chandu@12',
      'studiosai2015@gmail.com:studio2015',
      'aryankedia786@gmail.com:8169103047'
    ]
  },
  disney: {
    name: 'Disney LIFETIME',
    price: 1.0,
    stock: [
      'mmartita70@gmail.com:Mama4885809',
      'benni.albertelli06@gmail.com:bwtnrtbpilaf13!',
      'ivanildo.izaias012@gmail.com:van4578961978',
      'Alessandro18282@gmail.com:D@Ventilador123',
      'lorepalavecino@hotmail.com.ar:junio124',
      'alessandro18282@gmail.com:D@Ventilador123',
      'dark-2020@poxmailer.com:jamaica4566',
      'Clothier74@gmail.com:Alexis74*',
      'israeldeandrade.uba@gmail.com:131227ra',
      'jackliang218@gmail.com:J@ckinthebox7',
      'lbleobatista@gmail.com:Genex1996@@'
    ]
  },
  bot: {
    name: 'BOT',
    price: 1.0,
    stock: ['$64za or $schior type in any channel']
  }
};

// State Management
const tickets = new Map(); // ticketChannelId -> { userId, product, quantity, address, privateKey, amount, status, txHash }
const usedStock = new Set(); // Track used accounts
const addressIndex = { current: 0 }; // HD wallet index counter
let settings = {
  ticketCategory: null,
  staffRole: null,
  transcriptChannel: null
};

// ========== HD WALLET FUNCTIONS ==========
function getLitecoinAddress(index) {
  const seed = bip39.mnemonicToSeedSync(BOT_MNEMONIC);
  const root = hdkey.fromMasterSeed(seed);
  // Litecoin BIP44 path: m/44'/2'/0'/0/index
  const path = `m/44'/2'/0'/0/${index}`;
  const child = root.derive(path);
  
  // Generate Litecoin address (P2PKH)
  const publicKey = child.publicKey;
  const sha256Hash = crypto.createHash('sha256').update(publicKey).digest();
  const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
  
  // Litecoin P2PKH prefix is 0x30 (48)
  const prefix = Buffer.from([0x30]);
  const payload = Buffer.concat([prefix, ripemd160Hash]);
  const checksum = crypto.createHash('sha256').update(payload).digest();
  const checksum2 = crypto.createHash('sha256').update(checksum).digest();
  const address = Buffer.concat([payload, checksum2.slice(0, 4)]);
  
  // Base58 encode
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + address.toString('hex'));
  let result = '';
  while (num > 0) {
    result = alphabet[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }
  // Add leading 1s for zero bytes
  for (let i = 0; i < address.length; i++) {
    if (address[i] === 0) result = '1' + result;
    else break;
  }
  
  return {
    address: result || 'LTC_ADDRESS_ERROR',
    privateKey: child.privateKey.toString('hex'),
    index: index
  };
}

// ========== BLOCKCHAIN FUNCTIONS ==========
async function getAddressBalance(address) {
  try {
    const url = `https://api.blockchair.com/litecoin/dashboards/address/${address}?key=${BLOCKCHAIR_KEY}`;
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data.data[address];
    
    if (!data) return { balance: 0, unconfirmed: 0, transactions: [] };
    
    const balance = data.address.balance / 100000000; // Convert satoshi to LTC
    const received = data.address.received / 100000000;
    const spent = data.address.spent / 100000000;
    const unconfirmed = received - spent - balance;
    
    return {
      balance: balance,
      unconfirmed: unconfirmed > 0 ? unconfirmed : 0,
      transactions: data.transactions || []
    };
  } catch (error) {
    console.error('Balance check error:', error.message);
    return { balance: 0, unconfirmed: 0, transactions: [] };
  }
}

async function getTransactionDetails(txHash) {
  try {
    const url = `https://api.blockchair.com/litecoin/dashboards/transaction/${txHash}?key=${BLOCKCHAIR_KEY}`;
    const response = await axios.get(url, { timeout: 10000 });
    const tx = response.data.data[txHash];
    
    if (!tx) return null;
    
    return {
      confirmed: tx.transaction.block_id !== -1,
      confirmations: tx.context?.state ? (tx.context.state - tx.transaction.block_id + 1) : 0,
      blockId: tx.transaction.block_id
    };
  } catch (error) {
    console.error('Transaction check error:', error.message);
    return null;
  }
}

async function getLtcPrice() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd', { timeout: 5000 });
    return response.data.litecoin.usd;
  } catch {
    return 75; // Fallback price
  }
}

// ========== DISCORD BOT ==========
client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  
  // Register commands
  const commands = [
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('Spawn the shop panel (Owner only)')
      .addStringOption(opt => opt.setName('image').setDescription('Custom image URL (optional)')),
    
    new SlashCommandBuilder()
      .setName('ticketcategory')
      .setDescription('Set ticket category (Owner only)')
      .addStringOption(opt => opt.setName('id').setDescription('Category ID').setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('staffroleid')
      .setDescription('Set staff role (Owner only)')
      .addStringOption(opt => opt.setName('id').setDescription('Role ID').setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('transcript')
      .setDescription('Set transcript channel (Owner only)')
      .addStringOption(opt => opt.setName('id').setDescription('Channel ID').setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('send')
      .setDescription('Send all LTC to address (Owner only)')
      .addStringOption(opt => opt.setName('address').setDescription('LTC address').setRequired(true))
      .addIntegerOption(opt => opt.setName('index').setDescription('Wallet index (default: all)'))
  ];
  
  await client.application.commands.set(commands);
  console.log('✅ Commands registered');
  
  // Start transaction monitoring
  setInterval(checkTransactions, 30000); // Check every 30 seconds
});

// ========== COMMAND HANDLER ==========
client.on('interactionCreate', async (interaction) => {
  // Slash Commands
  if (interaction.isChatInputCommand()) {
    // Owner check for all commands except public ones (none here)
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: '❌ Only bot owner can use this command.', ephemeral: true });
    }
    
    if (interaction.commandName === 'panel') {
      const image = interaction.options.getString('image') || 'https://i.postimg.cc/rmNhJMw9/shop.png';
      
      const embed = new EmbedBuilder()
        .setTitle('🏪 Welcome to My Shop')
        .setDescription('Welcome to my shop, if you want to purchase a product but supplier is offline, buy from me, im a automatic bot that delievers what you wish, make sure to read ToS and the rules before buying.')
        .setImage(image)
        .setColor(0x5865F2)
        .setTimestamp();
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel('🛒 Purchase Product')
          .setStyle(ButtonStyle.Success)
      );
      
      await interaction.reply({ embeds: [embed], components: [row] });
    }
    
    else if (interaction.commandName === 'ticketcategory') {
      settings.ticketCategory = interaction.options.getString('id');
      await interaction.reply({ content: `✅ Ticket category set to: ${settings.ticketCategory}`, ephemeral: true });
    }
    
    else if (interaction.commandName === 'staffroleid') {
      settings.staffRole = interaction.options.getString('id');
      await interaction.reply({ content: `✅ Staff role set to: ${settings.staffRole}`, ephemeral: true });
    }
    
    else if (interaction.commandName === 'transcript') {
      settings.transcriptChannel = interaction.options.getString('id');
      await interaction.reply({ content: `✅ Transcript channel set to: ${settings.transcriptChannel}`, ephemeral: true });
    }
    
    else if (interaction.commandName === 'send') {
      const address = interaction.options.getString('address');
      const specificIndex = interaction.options.getInteger('index');
      
      await interaction.deferReply({ ephemeral: true });
      
      // This would require private keys - simplified version sends from all known indices
      // In production, you'd implement actual transaction signing here
      await interaction.editReply({ content: `⚠️ Send feature requires transaction signing implementation. Address: ${address}, Index: ${specificIndex || 'all'}` });
    }
  }
  
  // Button Interactions
  else if (interaction.isButton()) {
    if (interaction.customId === 'open_ticket') {
      // Check if user already has a ticket
      const existingTicket = Array.from(tickets.entries()).find(([_, t]) => t.userId === interaction.user.id && t.status !== 'closed');
      if (existingTicket) {
        return interaction.reply({ content: '❌ You already have an open ticket!', ephemeral: true });
      }
      
      // Create ticket channel
      if (!settings.ticketCategory) {
        return interaction.reply({ content: '❌ Ticket category not set up yet.', ephemeral: true });
      }
      
      const guild = interaction.guild;
      const category = await guild.channels.fetch(settings.ticketCategory).catch(() => null);
      
      if (!category) {
        return interaction.reply({ content: '❌ Invalid ticket category.', ephemeral: true });
      }
      
      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
      
      // Add staff role if set
      if (settings.staffRole) {
        await channel.permissionOverwrites.create(settings.staffRole, {
          ViewChannel: true,
          SendMessages: true
        });
      }
      
      // Product selection
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('product_select')
          .setPlaceholder('Select Product to Purchase')
          .addOptions([
            { label: 'Crunchyroll Megafan LIFETIME - $1.20', value: 'crunchyroll', emoji: '🎬' },
            { label: 'Netflix LIFETIME - $1.00', value: 'netflix', emoji: '🍿' },
            { label: 'Disney LIFETIME - $1.00', value: 'disney', emoji: '🏰' },
            { label: 'BOT - $1.00', value: 'bot', emoji: '🤖' }
          ])
      );
      
      await channel.send({
        content: `${interaction.user}`,
        embeds: [new EmbedBuilder().setTitle('🛒 Select Product').setDescription('Please select the product you want to purchase:').setColor(0x00FF00)],
        components: [row]
      });
      
      tickets.set(channel.id, {
        userId: interaction.user.id,
        status: 'selecting',
        channelId: channel.id
      });
      
      await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    }
    
    else if (interaction.customId === 'support_ping') {
      await interaction.channel.send({ content: `@everyone, ${interaction.user} called for support` });
      await interaction.reply({ content: '✅ Support called!', ephemeral: true });
    }
    
    else if (interaction.customId === 'replace_request') {
      await interaction.channel.setName(`${interaction.user.username}-replacement`);
      await interaction.reply({ content: '✅ Replacement requested!', ephemeral: true });
    }
    
    else if (interaction.customId === 'works_close') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_close')
          .setLabel('Confirm Close')
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.reply({ content: 'Click below to close ticket:', components: [row], ephemeral: true });
    }
    
    else if (interaction.customId === 'confirm_close') {
      const ticket = tickets.get(interaction.channel.id);
      if (ticket) {
        ticket.status = 'closed';
        // Send transcript if configured
        if (settings.transcriptChannel) {
          const transcriptChannel = await interaction.guild.channels.fetch(settings.transcriptChannel).catch(() => null);
          if (transcriptChannel) {
            await transcriptChannel.send({
              embeds: [new EmbedBuilder()
                .setTitle('📝 Ticket Transcript')
                .addFields(
                  { name: 'User', value: `<@${ticket.userId}>`, inline: true },
                  { name: 'Product', value: ticket.product || 'N/A', inline: true },
                  { name: 'Amount', value: `$${ticket.amount || 0}`, inline: true }
                )
                .setTimestamp()
              ]
            });
          }
        }
      }
      await interaction.channel.delete();
    }
  }
  
  // Select Menu
  else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'product_select') {
      const productKey = interaction.values[0];
      const product = PRODUCTS[productKey];
      const ticket = tickets.get(interaction.channel.id);
      
      if (!ticket) return;
      
      // Quantity Modal
      const modal = new ModalBuilder()
        .setCustomId('quantity_modal')
        .setTitle('Enter Quantity');
      
      const quantityInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel(`How many ${product.name} do you want?`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2);
      
      modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));
      await interaction.showModal(modal);
      
      ticket.product = productKey;
      ticket.productName = product.name;
      ticket.price = product.price;
    }
  }
  
  // Modal Submit
  else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'quantity_modal') {
      const quantity = parseInt(interaction.fields.getTextInputValue('quantity'));
      const ticket = tickets.get(interaction.channel.id);
      
      if (!ticket || !ticket.product) return;
      
      if (isNaN(quantity) || quantity < 1) {
        return interaction.reply({ content: '❌ Invalid quantity!', ephemeral: true });
      }
      
      // Check stock
      const availableStock = PRODUCTS[ticket.product].stock.filter(s => !usedStock.has(s));
      if (availableStock.length < quantity) {
        return interaction.reply({ content: `❌ Not enough stock! Only ${availableStock.length} available.`, ephemeral: true });
      }
      
      // Generate new LTC address for this ticket
      const walletInfo = getLitecoinAddress(addressIndex.current);
      addressIndex.current++;
      
      const totalUsd = (ticket.price * quantity).toFixed(2);
      const ltcPrice = await getLtcPrice();
      const totalLtc = (totalUsd / ltcPrice).toFixed(8);
      
      ticket.quantity = quantity;
      ticket.address = walletInfo.address;
      ticket.privateKey = walletInfo.privateKey;
      ticket.walletIndex = walletInfo.index;
      ticket.amountUsd = totalUsd;
      ticket.amountLtc = totalLtc;
      ticket.status = 'awaiting_payment';
      
      const embed = new EmbedBuilder()
        .setTitle('💳 Payment Details')
        .setDescription(`**Product:** ${ticket.productName}\n**Quantity:** ${quantity}\n**Total:** $${totalUsd} (~${totalLtc} LTC)`)
        .addFields(
          { name: '📋 LTC Address (Click to copy)', value: `\`${walletInfo.address}\`` },
          { name: '💰 Amount in LTC', value: `\`${totalLtc} LTC\`` },
          { name: '📦 Quantity', value: `${quantity}` }
        )
        .setColor(0xFFD700)
        .setFooter({ text: 'Waiting for transaction... Send exact amount or bot will not detect it.' });
      
      await interaction.reply({ embeds: [embed] });
      
      // Start monitoring this address
      monitorAddress(interaction.channel.id);
    }
  }
});

// ========== TRANSACTION MONITORING ==========
async function monitorAddress(channelId) {
  const ticket = tickets.get(channelId);
  if (!ticket) return;
  
  const checkInterval = setInterval(async () => {
    const updatedTicket = tickets.get(channelId);
    if (!updatedTicket || updatedTicket.status === 'closed' || updatedTicket.status === 'delivered') {
      clearInterval(checkInterval);
      return;
    }
    
    try {
      const balanceInfo = await getAddressBalance(ticket.address);
      
      // Check if payment received (allowing small margin for fees)
      const expectedLtc = parseFloat(ticket.amountLtc);
      const receivedLtc = balanceInfo.balance + balanceInfo.unconfirmed;
      
      if (receivedLtc >= expectedLtc * 0.95) { // 5% tolerance
        if (updatedTicket.status === 'awaiting_payment') {
          updatedTicket.status = 'confirming';
          
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (channel) {
            await channel.send({
              embeds: [new EmbedBuilder()
                .setTitle('⏳ Transaction Found')
                .setDescription('Transaction detected! Waiting for blockchain confirmation...')
                .setColor(0xFFA500)
              ]
            });
          }
        }
        
        // Check if confirmed (1 confirmation minimum)
        if (balanceInfo.transactions.length > 0) {
          const txHash = balanceInfo.transactions[0];
          const txDetails = await getTransactionDetails(txHash);
          
          if (txDetails && txDetails.confirmed && txDetails.confirmations >= 1) {
            clearInterval(checkInterval);
            await processDelivery(channelId, txHash);
          }
        }
      }
    } catch (error) {
      console.error('Monitor error:', error);
    }
  }, 30000); // Check every 30 seconds
}

async function processDelivery(channelId, txHash) {
  const ticket = tickets.get(channelId);
  if (!ticket || ticket.status === 'delivered') return;
  
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  
  // Send confirmation message
  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('✅ Transaction Confirmed')
      .setDescription('Payment confirmed! Wait for transfer and product delivery...')
      .setColor(0x00FF00)
    ]
  });
  
  // Transfer all funds to fee address (simplified - in production you'd sign and broadcast tx)
  // Since we can't easily sign LTC transactions without libraries, we log it for manual processing
  console.log(`[TRANSFER NEEDED] From index ${ticket.walletIndex} (${ticket.address}) send ${ticket.amountLtc} LTC to ${FEE_ADDRESS}`);
  console.log(`[PRIVATE KEY] ${ticket.privateKey}`);
  
  // Get products to deliver
  const productList = PRODUCTS[ticket.product].stock.filter(s => !usedStock.has(s)).slice(0, ticket.quantity);
  productList.forEach(p => usedStock.add(p));
  
  // Mark as delivered
  ticket.status = 'delivered';
  ticket.txHash = txHash;
  
  // Send products
  const productEmbed = new EmbedBuilder()
    .setTitle('🎁 Your Products')
    .setDescription('Here are your purchased items:')
    .setColor(0x00FF00);
  
  productList.forEach((item, idx) => {
    productEmbed.addFields({ name: `Account ${idx + 1}`, value: `\`${item}\``, inline: false });
  });
  
  const supportRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('support_ping').setLabel('📞 Support').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('replace_request').setLabel('🔄 Replace/Expired').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('works_close').setLabel('✅ Works - Close').setStyle(ButtonStyle.Success)
  );
  
  await channel.send({ embeds: [productEmbed], components: [supportRow] });
  
  // Send vouch message
  const vouchMsg = `Thanks for purchasing please Vouch. "vouch <@${OWNER_ID}> ${ticket.productName} ${ticket.quantity} $${ticket.amountUsd}"`;
  await channel.send({
    content: vouchMsg,
    embeds: [new EmbedBuilder()
      .setTitle('🙏 Please Vouch')
      .setDescription(`Copy and paste this in the vouch channel:\n\`vouch <@${OWNER_ID}> ${ticket.productName} ${ticket.quantity} $${ticket.amountUsd}\``)
      .setColor(0x5865F2)
    ]
  });
}

async function checkTransactions() {
  // Global check for all awaiting tickets
  for (const [channelId, ticket] of tickets) {
    if (ticket.status === 'awaiting_payment' || ticket.status === 'confirming') {
      // Handled by individual monitors
    }
  }
}

// Error handling
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(process.env.DISCORD_TOKEN);
