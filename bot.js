require('dotenv').config();
const { Client, Message } = require('discord.js');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

const client = new Client();
let PREFIX = '!';

client.login(process.env.DISCORDJS_BOT_TOKEN);
client.on('ready', () => console.log(`${client.user.username} has logged into Discord.`));

let browser;
login();

const followed_users = [];

client.on('message', msg => {
   if (msg.author.bot) return;
   if (!msg.content.startsWith(PREFIX)) return;

   const [CMD_NAME, ...args] = msg.content
      .trim()
      .substring(PREFIX.length)
      .split(/\s+/);

   if (CMD_NAME === 'name') {
      if (args.length != 1) return msg.reply(`Incorrect syntax!\nTry: \`${PREFIX}${CMD_NAME} user_id\``);
      (async () => {
         const user = await getUserById(args[0]);
         msg.channel.send(user.name == null ? 'User not found' : `${user.name}: ${user.last_time_online.toString().toDDHHMMSS()}`);
      })();
      return;
   }

   if (CMD_NAME === 'follow') {
      if (args.length != 1) return msg.reply(`Incorrect syntax!\nTry: \`${PREFIX}${CMD_NAME} user_id\``);
      (async () => {
         msg.channel.send(await followUser(args[0]));
         const data = JSON.stringify({ ids: followed_users.map(v => v.id) });
         fs.writeFile('ids.json', data, err => {
            if (err) return;
         });
      })();
      return;
   }

   if (CMD_NAME === 'unfollow') {
      if (args.length != 1) return msg.reply(`Incorrect syntax!\nTry: \`${PREFIX}${CMD_NAME} user_id\``);
      if (followed_users.filter(user => user.id == args[0]).length === 0) return msg.channel.send(`User with id of ${args[0]} is not being follwed`);

      const index = followed_users.findIndex(user => user.id == args[0]);
      const user = followed_users[index];
      if (index !== -1) {
         followed_users.splice(index, 1);
      }
      const data = JSON.stringify({ ids: followed_users.map(v => v.id) });
      fs.writeFile('ids.json', data, err => {
         if (err) return;
      });
      return msg.channel.send(`Successfully unfollowed user: \`${user.name}\``);
   }

   if (CMD_NAME === 'followed') {
      followed_users.sort((a, b) => a.last_time_online > b.last_time_online ? 1 : -1);

      let list = `List of followed users (${followed_users.length}):\n`;
      followed_users.forEach(user => list += `➜ ${user.name}${args[0] === '-id' ? ' (' + user.id + ')' : ''}: ${user.last_time_online.toString().toDDHHMMSS()}\n`);
      return msg.channel.send(list);
   }

   if (CMD_NAME === 'prefix') {
      if (args.length != 1) return msg.reply(`Incorrect syntax!\nTry: \`${PREFIX}${CMD_NAME} new_prefix\``);
      PREFIX = args[0];
      return msg.channel.send(`Prefix set to: \`${PREFIX}\``);
   }

   if (CMD_NAME === 'ss') {
      if (args.length != 1 || !isUpelUrlValid(args[0])) return msg.reply(`Incorrect syntax!\nTry: \`${PREFIX}${CMD_NAME} upel_page_url\``);
      (async () => {
         const page = await browser.newPage();
         await page.goto(args[0], { waitUntil: 'domcontentloaded' });
         await page.screenshot({ path: '1.png', fullPage: true });
         await page.close();
         
         msg.channel.send({
            files: ['1.png']
         });
      })();
      return;
   }
   
   if (CMD_NAME === 'relog') {
      (async () => {
         if (await login()) {
            msg.channel.send(`${client.user.username} has logged into UPeL.`);
         }
      })();
      return;
   }
   
   if (CMD_NAME === 'help') {
      msg.channel.send('help command');
      return;
   }

   msg.channel.send(`\`${CMD_NAME}\` command not found!\nTry \`${PREFIX}help\` to display available commands`);
});

async function login() {
   browser = await puppeteer.launch({ headless: true });
   const page = await browser.newPage();
   await page.goto('https://upel2.cel.agh.edu.pl/wiet/login/');
   await page.type('[name=username]', process.env.NR_INDEKSU);
   await page.type('[name=password]', process.env.PASSWORD);
   await page.click('[type=submit]');
   const content = await page.content();

   const isBotLoggedIntoUpel = !content.includes('Zaloguj');
   if (!isBotLoggedIntoUpel) return await login();

   fs.readFile('ids.json', (err, data) => {
      if (err) return false;
      JSON.parse(data)['ids'].forEach(id => followUser(id, false));
   });

   console.log(`${client.user.username} has logged into UPeL.`);
   return true;
}

async function getUserById(id) {
   const page = await browser.newPage();
   await page.goto(`https://upel2.cel.agh.edu.pl/wiet/user/profile.php?id=${id}`, { waitUntil: 'domcontentloaded' });

   const $ = cheerio.load(await page.content());
   await page.close();
   let name = $('h1').first().text();
   if (name == "" || name == "Użytkownik") {
      name = null;
   }

   let last_time_online;
   if (name != null) {
      last_time_online =
         $('dd').last().text()
            .match(/\((.*)\)/).pop()
            .toSeconds();
   }

   return {
      id: parseInt(id),
      name,
      last_time_online: name == null ? null : last_time_online
   };
}

async function followUser(id, msg = true) {
   const index = followed_users.findIndex(user => user.id == parseInt(id));
   if (index !== -1) {
      return msg ? `\`${followed_users[index].name}\` is already follwed` : true;
   }
   const user = await getUserById(id);
   if (user.name == null) {
      return msg ? 'User not found!' : true;
   }
   followed_users.push(user);
   return msg ? `Successfully followed user: \`${user.name}\`` : true;
}

function isUpelUrlValid(str) {
   let url;
   try {
      url = new URL(str);
   } catch (_) {
      return false;
   }
   return (url.protocol === "http:" || url.protocol === "https:") && url.hostname === 'upel2.cel.agh.edu.pl';
}

String.prototype.toSeconds = function () { // parse moodle time format to seconds
   const arr = this.split(' ');
   if (arr[0] === 'teraz') return 1;
   let time = 0;
   for (let i = 0; i < arr.length - 1; ++i) {
      if (arr[i + 1].includes('sek')) time += parseInt(arr[i]);
      if (arr[i + 1].includes('min')) time += parseInt(arr[i]) * 60;
      if (arr[i + 1].includes('godz')) time += parseInt(arr[i]) * 3600;
      if (arr[i + 1].includes('dni')) time += parseInt(arr[i]) * 86400;
   }
   return time;
}

String.prototype.toDDHHMMSS = function () {
   let sec_num = parseInt(this, 10);
   let days = Math.floor(sec_num / 86400);
   let hours = Math.floor((sec_num - (days * 86400)) / 3600);
   let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
   let seconds = sec_num - (hours * 3600) - (minutes * 60);

   if (days == 0) {
      if (hours == 0) {
         if (minutes == 0) {
            return `${seconds} sec`;
         }
         return `${minutes} mins ${seconds} sec`;
      }
      return `${hours} hours ${minutes} mins`;
   }
   return `${days} days ${hours} hours`;
}

setInterval(() => { // check online status
   followed_users.forEach(async (user, i) => {
      const page = await browser.newPage();
      await page.goto(`https://upel2.cel.agh.edu.pl/wiet/user/profile.php?id=${user.id}`, { waitUntil: 'domcontentloaded' });

      const $ = cheerio.load(await page.content());
      await page.close();
      const last_time_online =
         $('dd').last().text()
            .match(/\((.*)\)/).pop()
            .toSeconds();

      if (last_time_online < 300) { // user is online
         if (followed_users[i].last_time_online >= 300) { // user was offline
            client.channels.cache.get('941460638130118736').send(`\`${user.name}\` is online! 🟢`);
         }
      } else { // user is offline
         if (followed_users[i].last_time_online < 300) { // user was online
            client.channels.cache.get('941460638130118736').send(`\`${user.name}\` is offline! 🔴`);
         }
      }
      followed_users[i].last_time_online = last_time_online;
   });
}, 60000);
