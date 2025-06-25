import { User, GuildMember } from 'discord.js';

/**
 * Discord 사용자 이름을 "username#discriminator" 형식으로 반환
 * Discord의 새로운 사용자명 시스템도 지원
 */
export function getDiscordFullName(user: User | GuildMember): string {
    const discordUser = user instanceof GuildMember ? user.user : user;
    
    // 새로운 Discord 사용자명 시스템 (discriminator가 "0"인 경우)
    if (discordUser.discriminator === '0') {
        return discordUser.username;
    }
    
    // 기존 시스템 (username#discriminator)
    return `${discordUser.username}#${discordUser.discriminator}`;
}

/**
 * Discord 사용자의 표시 이름을 반환 (서버 닉네임 우선, 없으면 전체 이름)
 */
export function getDiscordDisplayName(user: User | GuildMember): string {
    if (user instanceof GuildMember && user.nickname) {
        return user.nickname;
    }
    
    return getDiscordFullName(user);
}