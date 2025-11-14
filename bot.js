const { Telegraf, Markup } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const axios = require('axios');
const express = require('express');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const API_URL = process.env.API_URL || 'https://as-static-hosting.onrender.com';
const PORT = process.env.PORT || 3001;

// Admin user IDs (add your Telegram user ID here)
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];

const bot = new Telegraf(BOT_TOKEN);

// Use session middleware
const localSession = new LocalSession({ database: 'sessions.json' });
bot.use(localSession.middleware());

// Express server for Render health check
const app = express();
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Static Site Hosting Bot',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: 'running' });
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// Helper: Check if user is admin
function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

// Helper: Download file from Telegram
async function downloadTelegramFile(ctx, fileId) {
  try {
    const fileUrl = await ctx.telegram.getFileLink(fileId);
    const response = await axios.get(fileUrl.href, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

// Helper: Upload to hosting API
async function uploadToHosting(siteName, files) {
  try {
    const response = await axios.post(`${API_URL}/api/upload`, {
      siteName,
      files
    }, {
      headers: { 'Content-Type': 'application/json' },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000
    });
    
    return response.data;
  } catch (error) {
    console.error('Upload error:', error.response?.data || error.message);
    throw error;
  }
}

// Main menu keyboard
function mainMenu(isAdminUser = false) {
  const buttons = [
    [Markup.button.callback('🚀 Upload New Site', 'upload')],
    [Markup.button.callback('📊 View Statistics', 'stats')],
    [Markup.button.callback('❓ Help', 'help')]
  ];
  
  if (isAdminUser) {
    buttons.push([Markup.button.callback('⚙️ Admin Panel', 'admin_panel')]);
  }
  
  return Markup.inlineKeyboard(buttons);
}

// Admin panel menu
function adminMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 List All Sites', 'admin_list_sites')],
    [Markup.button.callback('📊 Server Stats', 'admin_server_stats')],
    [Markup.button.callback('🗑️ Delete Site', 'admin_delete_site')],
    [Markup.button.callback('♻️ Restore Site', 'admin_restore_site')],
    [Markup.button.callback('🔙 Back to Menu', 'back_menu')]
  ]);
}

// Upload options keyboard
function uploadOptionsMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📦 Upload ZIP File', 'upload_zip')],
    [Markup.button.callback('📁 Upload Multiple Files', 'upload_files')],
    [Markup.button.callback('🔙 Back to Menu', 'back_menu')]
  ]);
}

// Cancel keyboard
function cancelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Cancel', 'cancel')]
  ]);
}

// Start command
bot.start((ctx) => {
  const isAdminUser = isAdmin(ctx.from.id);
  const message = 
    '🚀 *Welcome to Static Site Hosting Bot!*\n\n' +
    '📤 Upload your HTML, CSS, JS, and images\n' +
    '🌐 Get a live hosted URL instantly!\n' +
    '⚡ Fast, secure, and completely free!\n\n' +
    (isAdminUser ? '👑 *Admin Mode Enabled*\n\n' : '') +
    'Choose an option below:';
  
  ctx.reply(message, {
    parse_mode: 'Markdown',
    ...mainMenu(isAdminUser)
  });
});

// Help callback
bot.action('help', (ctx) => {
  const helpText =
    '📚 *How to Use This Bot*\n\n' +
    '*Method 1: ZIP File*\n' +
    '1️⃣ Click "Upload New Site"\n' +
    '2️⃣ Select "Upload ZIP File"\n' +
    '3️⃣ Enter site name\n' +
    '4️⃣ Send ZIP file\n' +
    '5️⃣ Get your live URL! 🎉\n\n' +
    '*Method 2: Multiple Files*\n' +
    '1️⃣ Click "Upload New Site"\n' +
    '2️⃣ Select "Upload Multiple Files"\n' +
    '3️⃣ Enter site name\n' +
    '4️⃣ Send files one by one\n' +
    '5️⃣ Click "Finish Upload"\n' +
    '6️⃣ Get your live URL! 🎉\n\n' +
    '*Supported Formats:*\n' +
    '`.zip, .html, .css, .js, .png, .jpg, .svg, .gif, .webp, .ico`\n\n' +
    '*Tips:*\n' +
    '• Your main HTML file should be `index.html`\n' +
    '• ZIP files should contain all site files\n' +
    '• Maximum file size: 50MB';
  
  const isAdminUser = isAdmin(ctx.from.id);
  ctx.editMessageText(helpText, {
    parse_mode: 'Markdown',
    ...mainMenu(isAdminUser)
  });
});

// Stats callback
bot.action('stats', async (ctx) => {
  try {
    await ctx.answerCbQuery('Fetching statistics...');
    
    const response = await axios.get(`${API_URL}/api/admin/usage`);
    const stats = response.data;
    
    const statsText =
      '📊 *Hosting Statistics*\n\n' +
      `🌐 Total Sites: *${stats.totalSites}*\n` +
      `💾 Storage Used: *${stats.totalStorageFormatted}*\n` +
      `✅ Status: *Active*\n\n` +
      `API: \`${API_URL}\``;
    
    const isAdminUser = isAdmin(ctx.from.id);
    ctx.editMessageText(statsText, {
      parse_mode: 'Markdown',
      ...mainMenu(isAdminUser)
    });
  } catch (error) {
    const isAdminUser = isAdmin(ctx.from.id);
    ctx.editMessageText('❌ Failed to fetch statistics.\n\nPlease try again later.', mainMenu(isAdminUser));
  }
});

// Admin Panel callback
bot.action('admin_panel', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return ctx.answerCbQuery('⛔ Access Denied! Admin only.', { show_alert: true });
  }
  
  ctx.editMessageText(
    '⚙️ *Admin Panel*\n\n' +
    'Manage all hosted sites and view server statistics.',
    {
      parse_mode: 'Markdown',
      ...adminMenu()
    }
  );
});

// Admin: List all sites
bot.action('admin_list_sites', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return ctx.answerCbQuery('⛔ Access Denied!', { show_alert: true });
  }
  
  try {
    await ctx.answerCbQuery('Fetching sites...');
    
    const response = await axios.get(`${API_URL}/api/admin/sites`);
    const sites = response.data.sites;
    
    if (sites.length === 0) {
      return ctx.editMessageText('📋 *All Sites*\n\nNo sites found.', {
        parse_mode: 'Markdown',
        ...adminMenu()
      });
    }
    
    let message = '📋 *All Sites*\n\n';
    sites.slice(0, 10).forEach((site, index) => {
      message += `${index + 1}. *${site.name}*\n`;
      message += `   └ Slug: \`${site.slug}\`\n`;
      message += `   └ Size: ${(site.size_bytes / 1024).toFixed(2)} KB\n`;
      message += `   └ Status: ${site.status}\n`;
      message += `   └ Created: ${new Date(site.created_at).toLocaleDateString()}\n\n`;
    });
    
    if (sites.length > 10) {
      message += `_...and ${sites.length - 10} more_\n\n`;
    }
    
    ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...adminMenu()
    });
  } catch (error) {
    ctx.editMessageText('❌ Failed to fetch sites.', adminMenu());
  }
});

// Admin: Server stats
bot.action('admin_server_stats', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return ctx.answerCbQuery('⛔ Access Denied!', { show_alert: true });
  }
  
  try {
    await ctx.answerCbQuery('Fetching stats...');
    
    const [usage, health] = await Promise.all([
      axios.get(`${API_URL}/api/admin/usage`),
      axios.get(`${API_URL}/health`)
    ]);
    
    const stats = usage.data;
    const healthData = health.data;
    
    const message =
      '📊 *Server Statistics*\n\n' +
      `🌐 Total Sites: *${stats.totalSites}*\n` +
      `💾 Storage: *${stats.totalStorageFormatted}*\n` +
      `⏱️ Uptime: *${healthData.uptime}*\n` +
      `🖥️ Platform: *${healthData.server?.platform || 'N/A'}*\n` +
      `📈 Memory: *${healthData.server?.memory?.used || 'N/A'}*\n` +
      `✅ Status: *${healthData.status}*\n\n` +
      `🔗 API: \`${API_URL}\``;
    
    ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...adminMenu()
    });
  } catch (error) {
    ctx.editMessageText('❌ Failed to fetch server stats.', adminMenu());
  }
});

// Admin: Delete site
bot.action('admin_delete_site', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return ctx.answerCbQuery('⛔ Access Denied!', { show_alert: true });
  }
  
  ctx.session = { state: 'admin_delete' };
  ctx.editMessageText(
    '🗑️ *Delete Site*\n\n' +
    'Enter the site slug to delete:',
    {
      parse_mode: 'Markdown',
      ...cancelKeyboard()
    }
  );
});

// Admin: Restore site
bot.action('admin_restore_site', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return ctx.answerCbQuery('⛔ Access Denied!', { show_alert: true });
  }
  
  ctx.session = { state: 'admin_restore' };
  ctx.editMessageText(
    '♻️ *Restore Site*\n\n' +
    'Enter the site slug to restore:',
    {
      parse_mode: 'Markdown',
      ...cancelKeyboard()
    }
  );
});

// Upload callback
bot.action('upload', (ctx) => {
  const message =
    '📤 *Choose Upload Method*\n\n' +
    '🔹 *ZIP File:* Upload complete site in one file\n' +
    '🔹 *Multiple Files:* Upload files one by one';
  
  ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...uploadOptionsMenu()
  });
});

// Upload ZIP callback
bot.action('upload_zip', (ctx) => {
  ctx.session = { 
    state: 'waiting_for_name',
    uploadType: 'zip',
    files: []
  };
  
  ctx.editMessageText(
    '📝 *Enter Your Site Name*\n\n' +
    'Example: `My Portfolio`\n\n' +
    'This will be used to create your URL.',
    {
      parse_mode: 'Markdown',
      ...cancelKeyboard()
    }
  );
});

// Upload multiple files callback
bot.action('upload_files', (ctx) => {
  ctx.session = { 
    state: 'waiting_for_name',
    uploadType: 'multiple',
    files: []
  };
  
  ctx.editMessageText(
    '📝 *Enter Your Site Name*\n\n' +
    'Example: `My Portfolio`\n\n' +
    'This will be used to create your URL.',
    {
      parse_mode: 'Markdown',
      ...cancelKeyboard()
    }
  );
});

// Back to menu callback
bot.action('back_menu', (ctx) => {
  ctx.session = null;
  const isAdminUser = isAdmin(ctx.from.id);
  ctx.editMessageText(
    '🚀 *Static Site Hosting Bot*\n\n' +
    (isAdminUser ? '👑 *Admin Mode*\n\n' : '') +
    'Choose an option below:',
    {
      parse_mode: 'Markdown',
      ...mainMenu(isAdminUser)
    }
  );
});

// Cancel callback
bot.action('cancel', (ctx) => {
  ctx.session = null;
  ctx.answerCbQuery('Cancelled');
  const isAdminUser = isAdmin(ctx.from.id);
  ctx.editMessageText(
    '❌ *Cancelled*\n\n' +
    'Start over whenever you\'re ready!',
    {
      parse_mode: 'Markdown',
      ...mainMenu(isAdminUser)
    }
  );
});

// Finish upload callback
bot.action('finish_upload', async (ctx) => {
  if (!ctx.session || ctx.session.files.length === 0) {
    return ctx.answerCbQuery('No files uploaded yet!', { show_alert: true });
  }
  
  const { siteName, files } = ctx.session;
  
  try {
    await ctx.answerCbQuery('Deploying your site...');
    await ctx.editMessageText('🚀 *Deploying your site...*\n\n⏳ Please wait...', { parse_mode: 'Markdown' });
    
    const result = await uploadToHosting(siteName, files);
    
    if (result.ok) {
      const successMessage =
        '🎉 *Deployment Successful!*\n\n' +
        `🌐 Your site is live at:\n` +
        `${result.url}\n\n` +
        `📝 Slug: \`${result.slug}\`\n` +
        `📦 Files: ${files.length}\n\n` +
        `Click the button below to view your site!`;
      
      ctx.editMessageText(successMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('🌐 View Site', result.url)],
          [Markup.button.callback('🚀 Upload Another', 'upload')],
          [Markup.button.callback('🏠 Main Menu', 'back_menu')]
        ])
      });
    } else {
      const isAdminUser = isAdmin(ctx.from.id);
      ctx.editMessageText(`❌ Deployment failed: ${result.error}`, mainMenu(isAdminUser));
    }
    
    ctx.session = null;
    
  } catch (error) {
    console.error('Upload error:', error);
    const isAdminUser = isAdmin(ctx.from.id);
    ctx.editMessageText(
      `❌ *Deployment Failed*\n\n` +
      `Error: ${error.response?.data?.error || error.message}`,
      {
        parse_mode: 'Markdown',
        ...mainMenu(isAdminUser)
      }
    );
    ctx.session = null;
  }
});

// Handle text messages
bot.on('text', async (ctx) => {
  // Admin delete
  if (ctx.session?.state === 'admin_delete') {
    if (!isAdmin(ctx.from.id)) return;
    
    const slug = ctx.message.text.trim();
    try {
      await ctx.reply('🗑️ Deleting site...');
      const response = await axios.post(`${API_URL}/api/admin/site/${slug}/delete`);
      
      if (response.data.ok) {
        ctx.reply(`✅ Site "${slug}" deleted successfully!`, adminMenu());
      } else {
        ctx.reply(`❌ Failed: ${response.data.error}`, adminMenu());
      }
    } catch (error) {
      ctx.reply('❌ Failed to delete site.', adminMenu());
    }
    ctx.session = null;
    return;
  }
  
  // Admin restore
  if (ctx.session?.state === 'admin_restore') {
    if (!isAdmin(ctx.from.id)) return;
    
    const slug = ctx.message.text.trim();
    try {
      await ctx.reply('♻️ Restoring site...');
      const response = await axios.post(`${API_URL}/api/admin/site/${slug}/restore`);
      
      if (response.data.ok) {
        ctx.reply(`✅ Site "${slug}" restored successfully!`, adminMenu());
      } else {
        ctx.reply(`❌ Failed: ${response.data.error}`, adminMenu());
      }
    } catch (error) {
      ctx.reply('❌ Failed to restore site.', adminMenu());
    }
    ctx.session = null;
    return;
  }
  
  // Site name input
  if (!ctx.session || ctx.session.state !== 'waiting_for_name') {
    return;
  }
  
  const siteName = ctx.message.text.trim();
  
  if (siteName.startsWith('/')) {
    return;
  }
  
  ctx.session.siteName = siteName;
  ctx.session.state = 'waiting_for_files';
  
  if (ctx.session.uploadType === 'zip') {
    ctx.reply(
      `✅ Site name: *${siteName}*\n\n` +
      `📦 Now send your ZIP file containing all site files.`,
      {
        parse_mode: 'Markdown',
        ...cancelKeyboard()
      }
    );
  } else {
    ctx.reply(
      `✅ Site name: *${siteName}*\n\n` +
      `📁 Now send your files one by one.\n` +
      `When done, click "Finish Upload" button.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Finish Upload', 'finish_upload')],
          [Markup.button.callback('❌ Cancel', 'cancel')]
        ])
      }
    );
  }
});

// Handle document/file uploads
bot.on('document', async (ctx) => {
  if (!ctx.session || ctx.session.state !== 'waiting_for_files') {
    return ctx.reply('⚠️ Please start an upload first using the menu buttons!');
  }
  
  const document = ctx.message.document;
  const fileName = document.file_name;
  const fileSize = document.file_size;
  
  if (fileSize > 50 * 1024 * 1024) {
    return ctx.reply('❌ File too large! Maximum size is 50MB.');
  }
  
  try {
    const downloadMsg = await ctx.reply(`⏳ Downloading *${fileName}*...`, { parse_mode: 'Markdown' });
    
    const fileBuffer = await downloadTelegramFile(ctx, document.file_id);
    const base64Data = fileBuffer.toString('base64');
    
    ctx.session.files.push({
      fileName,
      fileData: base64Data
    });
    
    await ctx.telegram.deleteMessage(ctx.chat.id, downloadMsg.message_id);
    
    if (ctx.session.uploadType === 'zip') {
      const { siteName, files } = ctx.session;
      
      await ctx.reply('🚀 *Deploying your site...*\n\n⏳ Please wait...', { parse_mode: 'Markdown' });
      
      const result = await uploadToHosting(siteName, files);
      
      if (result.ok) {
        const successMessage =
          '🎉 *Deployment Successful!*\n\n' +
          `🌐 Your site is live at:\n` +
          `${result.url}\n\n` +
          `📝 Slug: \`${result.slug}\`\n\n` +
          `Click the button below to view your site!`;
        
        ctx.reply(successMessage, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🌐 View Site', result.url)],
            [Markup.button.callback('🚀 Upload Another', 'upload')],
            [Markup.button.callback('🏠 Main Menu', 'back_menu')]
          ])
        });
      } else {
        const isAdminUser = isAdmin(ctx.from.id);
        ctx.reply(`❌ Deployment failed: ${result.error}`, mainMenu(isAdminUser));
      }
      
      ctx.session = null;
      
    } else {
      ctx.reply(
        `✅ *${fileName}* uploaded! (${(fileSize / 1024).toFixed(2)} KB)\n\n` +
        `📦 Total files: *${ctx.session.files.length}*\n\n` +
        `Send more files or click "Finish Upload" when done.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Finish Upload', 'finish_upload')],
            [Markup.button.callback('❌ Cancel', 'cancel')]
          ])
        }
      );
    }
    
  } catch (error) {
    console.error('File download error:', error);
    ctx.reply('❌ Failed to download file. Please try again.');
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  const isAdminUser = isAdmin(ctx.from.id);
  ctx.reply('❌ An error occurred. Please try again later.', mainMenu(isAdminUser));
});

// Launch bot
bot.launch();

console.log('🤖 Telegram bot started!');
console.log('API URL:', API_URL);
console.log('Admin IDs:', ADMIN_IDS.length > 0 ? ADMIN_IDS.join(', ') : 'None set');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
