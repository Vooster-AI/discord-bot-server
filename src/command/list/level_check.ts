import { SlashCommandBuilder } from 'discord.js';
import { supabase, LEVEL_DIVISOR } from '../../utils/supabase';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('자신의 레벨과 점수를 확인합니다'),
    
    async execute(interaction: any) {
        try {
            const discordId = interaction.user.id;

            const { data: user, error } = await supabase
                .from('Users')
                .select('name, score')
                .eq('discord_id', discordId)
                .single();

            let userName = interaction.user.displayName || interaction.user.username;
            let userScore = 0;

            if (error) {
                if (error.code !== 'PGRST116') {
                    console.error('Supabase error:', error);
                    await interaction.reply('❌ 데이터베이스 오류가 발생했습니다.');
                    return;
                }
                // PGRST116 = 등록되지 않은 사용자, 0점으로 처리
            } else {
                userName = user.name || userName;
                userScore = user.score || 0;
            }

            const level = Math.floor(userScore / LEVEL_DIVISOR);
            const currentLevelXP = userScore % LEVEL_DIVISOR;
            const progress = Math.round((currentLevelXP / LEVEL_DIVISOR) * 100);
            const remainingXP = LEVEL_DIVISOR - currentLevelXP;

            const embed = {
                color: userScore === 0 ? 0x95A5A6 : 0x5865F2,
                title: `📊 ${userName}님의 레벨 정보`,
                fields: [
                    {
                        name: '🏆 현재 레벨',
                        value: `**Lv. ${level}**`,
                        inline: true
                    },
                    {
                        name: '⭐ 총 점수',
                        value: `**${userScore}점**`,
                        inline: true
                    },
                    {
                        name: '📈 다음 레벨까지',
                        value: `**${remainingXP}점** (${progress}%)`,
                        inline: true
                    }
                ],
                footer: {
                    text: userScore === 0 ? 
                        '포럼에 참여하여 점수를 획득해보세요!' : 
                        `레벨업까지 ${remainingXP}점 남았습니다!`
                }
            };

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Level check error:', error);
            await interaction.reply('❌ 레벨 조회 중 오류가 발생했습니다.');
        }
    }
};