require('dotenv').config();
const { Client, Message } = require('discord.js');
const puppeteer = require('puppeteer');

const client = new Client();
const PREFIX = '!';

client.login(process.env.DISCORDJS_BOT_TOKEN);
client.on('ready', () => console.log(`${client.user.username} has logged in.`));

let browser;
login();

client.on('message', msg => {
   if (msg.author.bot) return;
   if (!msg.content.startsWith(PREFIX)) return;

   const [CMD_NAME, ...args] = msg.content
      .trim()
      .substring(PREFIX.length)
      .split(/\s+/);

   if (CMD_NAME === 'active') {
      if (args.length < 2 && args[0] !== '-a') return msg.reply(`Incorrect syntax!\nTry: \`${PREFIX}active name last_name\` or \`${PREFIX}active -a\``);

      if (args.includes('-a')) {
         (async () => {
            const online = await getActivePeople();
            let list = `List of currently online users (${online.length}):\n`;
            await online.forEach(user => list += `➜ ${user}\n`);
            msg.channel.send(list);
         })();
         return;
      }

      (async () => {
         const online = await getActivePeople();
         const person = `${args[0]} ${args[1]}`;
         msg.channel.send(online.includes(person) ? `${person} is online! ✅` : `${person} is offline! ❌`);
      })();
   }
});

async function getActivePeople() {
   const page = await browser.newPage();
   await page.goto('https://upel2.cel.agh.edu.pl/wiet/course/view.php?id=1464', { waitUntil: 'domcontentloaded' });
   const data = await page.evaluate(() => Array.from(document.querySelectorAll('.listentry')).map(el => el.textContent));
   return await data;
}

async function login() {
   browser = await puppeteer.launch({ headless: true });
   const page = await browser.newPage();
   await page.goto('https://upel2.cel.agh.edu.pl/wiet/login/index.php');
   await page.type('[name=username]', process.env.NR_INDEKSU);
   await page.type('[name=password]', process.env.PASSWORD);
   await page.click('[type=submit]');
}