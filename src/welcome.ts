import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'welcome_settings.json');

interface WelcomeSettings {
    welcomeChannelId?: string;
    welcomeMessage?: string;
    welcomeGif?: string;
    goodbyeChannelId?: string;
    goodbyeMessage?: string;
    goodbyeGif?: string;
    boostChannelId?: string;
    boostMessage?: string;
    boostGif?: string;
}

const settings: Record<string, WelcomeSettings> = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8') || '{}');

function saveSettings() {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export function setWelcome(guildId: string, channelId: string, message: string, gif: string) {
    if (!settings[guildId]) settings[guildId] = {};
    settings[guildId].welcomeChannelId = channelId;
    settings[guildId].welcomeMessage = message;
    settings[guildId].welcomeGif = gif;
    saveSettings();
}

export function setGoodbye(guildId: string, channelId: string, message: string, gif: string) {
    if (!settings[guildId]) settings[guildId] = {};
    settings[guildId].goodbyeChannelId = channelId;
    settings[guildId].goodbyeMessage = message;
    settings[guildId].goodbyeGif = gif;
    saveSettings();
}

export function setBoost(guildId: string, channelId: string, message: string, gif: string) {
    if (!settings[guildId]) settings[guildId] = {};
    settings[guildId].boostChannelId = channelId;
    settings[guildId].boostMessage = message;
    settings[guildId].boostGif = gif;
    saveSettings();
}

export function getSettings(guildId: string): WelcomeSettings | undefined {
    return settings[guildId];
}
