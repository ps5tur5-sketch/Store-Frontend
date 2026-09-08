// Local, reproducible vector covers. Brand symbols come from the existing Iconify dependency.
import { writeFile } from 'node:fs/promises';
import steam from '@iconify-icons/logos/steam';
import discord from '@iconify-icons/logos/discord-icon';
import spotify from '@iconify-icons/logos/spotify-icon';
import youtube from '@iconify-icons/logos/youtube-icon';
import psn from '@iconify-icons/arcticons/playstation-family';
import xbox from '@iconify-icons/arcticons/xbox';
import roblox from '@iconify-icons/arcticons/roblox';
const covers = [
  ['steam', 'STEAM', 'WALLET & GAMES', '#153948', '#18348a', steam],
  ['cs2', 'COUNTER STRIKE 2', 'PRIME STATUS', '#bd6b21', '#eea82d', null],
  ['gta5', 'GRAND THEFT AUTO', 'V · PREMIUM EDITION', '#39255f', '#a75085', null],
  ['eft', 'ESCAPE FROM TARKOV', 'STANDARD EDITION', '#1b332f', '#677745', null],
  ['discord', 'DISCORD', 'NITRO · SUBSCRIPTION', '#373071', '#7373e5', discord],
  ['youtube', 'YOUTUBE', 'PREMIUM · SUBSCRIPTION', '#532336', '#cf3d53', youtube],
  ['spotify', 'SPOTIFY', 'PREMIUM · SUBSCRIPTION', '#15392d', '#2b8a4d', spotify],
  ['psn', 'PLAYSTATION', 'STORE · GIFT CARD', '#1b2856', '#245fa7', psn],
  ['xbox', 'XBOX', 'GIFT CARD', '#193225', '#447842', xbox],
  ['roblox', 'ROBLOX', '800 ROBUX', '#364443', '#66948a', roblox],
];
const xml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const [file, title, subtitle, a, b, icon] of covers) {
  const symbol = icon
    ? `<svg x="206" y="44" width="108" height="108" viewBox="0 0 ${icon.width ?? 24} ${icon.height ?? 24}" color="white">${icon.body.replaceAll('#1a1918', '#fff')}</svg>`
    : file === 'cs2'
      ? '<path d="M259 35l45 24-45 82-45-24z" fill="#202122"/><text x="260" y="115" text-anchor="middle" fill="white" font-size="65" font-weight="900">2</text>'
      : file === 'gta5'
        ? '<text x="260" y="140" text-anchor="middle" fill="#c6f9b9" stroke="#253b34" stroke-width="3" font-size="130" font-weight="900" font-family="Georgia">V</text>'
        : '<path d="M180 155l35-90 27 52 21-90 45 128z" fill="#0d1d1a"/><circle cx="260" cy="93" r="46" fill="none" stroke="#d9debd" stroke-width="2"/><path d="M260 38v25m0 60v25m-55-55h25m60 0h25" stroke="#d9debd" stroke-width="2"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="320" viewBox="0 0 520 320"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="white" stroke-opacity=".06"/></pattern></defs><rect width="520" height="320" fill="url(#bg)"/><rect width="520" height="320" fill="url(#grid)"/><circle cx="435" cy="20" r="150" fill="none" stroke="white" stroke-opacity=".09" stroke-width="45"/><circle cx="50" cy="300" r="120" fill="none" stroke="white" stroke-opacity=".08" stroke-width="25"/><path d="M0 250L520 60V320H0z" fill="#000" fill-opacity=".13"/>${symbol}<text x="260" y="208" fill="white" text-anchor="middle" font-family="Arial,sans-serif" font-size="${title.length > 18 ? 27 : 34}" font-weight="900" letter-spacing="1">${xml(title)}</text><text x="260" y="239" fill="white" fill-opacity=".65" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" letter-spacing="3">${xml(subtitle)}</text><text x="24" y="295" fill="white" fill-opacity=".55" font-family="Arial,sans-serif" font-size="10" letter-spacing="2">GAME GOODS / DIGITAL EDITION</text></svg>`;
  await writeFile(new URL(`../public/assets/${file}.svg`, import.meta.url), svg);
}
